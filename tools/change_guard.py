#!/usr/bin/env python3
"""변경 감지·재검증 v02후보 (2026-11-03, 025 의료정보 안전) — 새 수집본을 직전 공개본과 기록(record) 단위로 비교한다.

  python3 tools/change_guard.py --city yuseong --file hospitals.json --new output/hospitals.json --prev data/yuseong/hospitals.json \
      [--today 2026-11-03] [--review review/yuseong] [--approvals approvals/reverify.json] [--changes ops/changes] [--dry-run]

규칙: tools/change_rules.json (파일별 key·meaning·simple 필드, on_meaning_change·removed 정책, reconfirm_days, file 보류 비율)
v02 (025): "기존 값을 무기한 공개하지 않는다"
- 의미 변경(meaning 필드가 바뀜): 공식 확인 전에는 **바뀐 칸을 비우고(blank) `rv`(재확인 필요: 칸·감지일·기한·사유) 표시**해 공개하거나(병원), 기록째 비공개(혜택·학교·학원).
  reconfirm_days 안에 승인이 없으면 기록을 공개에서 뺀다(보류 만료). 원천이 원래 값으로 돌아오면 자동 원복.
- 삭제(원천 목록에서 사라짐 = 폐업·종료 의심): **즉시 공개에서 제외**(복원하지 않음). 대표·피트가 폐업을 확인하면 승인 기록으로 확정, 다시 나타나면 '추가'로 자동 복귀.
- 단순 갱신(simple 필드만 바뀜)·추가 → 공개(사전 승인 규칙).
- 의미 변경+삭제가 max_meaning_ratio 를 넘으면 파일째 보류(file_hold) — gate 가 직전본을 유지한다.
- v03 (028): **원천 누락 vs 실제 종료 구분** — 한 번에 사라진 기록이 removed_outage_min 건 또는 removed_outage_ratio 비율을 넘거나, 목록(list) 하나가 통째로 비면
  원천 API 장애·누락으로 보고 사라진 기록을 **그대로 유지**(폐업 처리 안 함, 비공개 안 함)하고 '원천 누락 의심'으로 기록한다. 소수(기준 이하)만 사라졌을 때만 폐업 의심 비공개.
- 승인(approvals/reverify.json): result 승인(기본)=새 값 공개 / 기각=원래 값 그대로 공개(표시 해제). 결과는 ops/changes 에 verify_result 로 보존.
- 기록: review/<구>/_reverify.json(대기: 전후 값·출처·감지일·기한·사유), ops/changes/<구>.json(적용·보류·해결 전부).
- 외부 API 호출 없음. 표준 라이브러리만.
"""
import argparse, json, os, sys
from datetime import datetime, timedelta, timezone, date

KST = timezone(timedelta(hours=9))
HERE = os.path.dirname(os.path.abspath(__file__))
RULES = json.load(open(os.path.join(HERE, "change_rules.json"), encoding="utf-8"))
try:
    DATA_RULES = json.load(open(os.path.join(HERE, "data_rules.json"), encoding="utf-8")).get("files", {})
except Exception:
    DATA_RULES = {}
MAX_ITEMS_PER_RUN = 300
MAX_LOG_ITEMS = 400


def _norm(v):
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, list):
        return [_norm(x) for x in v]
    if isinstance(v, dict):
        return {k: _norm(x) for k, x in sorted(v.items())}
    return v


def _key(rec, keyf):
    return "|".join(str(_norm(rec.get(k, ""))) for k in keyf)


def _name(rec):
    return rec.get("n") or rec.get("name") or rec.get("id") or ""


def _pick(rec, fields):
    return {f: rec.get(f) for f in fields if f in rec}


def _load(p):
    return json.load(open(p, encoding="utf-8"))


def _save(p, obj):
    os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
    json.dump(obj, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def _plus(d, days):
    try:
        return (date.fromisoformat(d) + timedelta(days=days)).isoformat()
    except Exception:
        return ""


def load_approvals(path, city, fn):
    out, wild = {}, None
    if not path or not os.path.exists(path):
        return out, wild
    try:
        for it in _load(path).get("items", []):
            if it.get("city") != city or it.get("file") != fn:
                continue
            if it.get("key") == "*" and it.get("all_pending_before"):
                wild = it
            elif it.get("key"):
                out[str(it["key"])] = it
    except Exception as e:
        print(f"::warning::승인 파일을 읽지 못함({path}): {e} — 승인 없음으로 처리", file=sys.stderr)
    return out, wild


def guard(city, fn, new_path, prev_path, today=None, review_dir="", approvals_path="", changes_dir="", dry_run=False):
    """비교·차단·표시·기록. 돌려주는 값: 보고서(dict). new_path 는 공개 가능한 상태로 덮어써진다(dry_run·file_hold 제외)."""
    today = today or datetime.now(KST).date().isoformat()
    rule = RULES.get("files", {}).get(fn)
    src = DATA_RULES.get(fn, {})
    rep = {"file": fn, "city": city, "checked_at": today, "label": (rule or {}).get("label", fn), "source_org": src.get("source_org", ""), "source_url": src.get("source_url", ""),
           "guard": "", "counts": {"added": 0, "removed": 0, "meaning": 0, "simple": 0, "unchanged": 0, "approved": 0, "held": 0, "excluded": 0, "flagged": 0, "expired": 0, "reverted": 0, "outage_kept": 0},
           "file_hold": False, "file_hold_reason": "", "items": []}
    if not rule or rule.get("no_guard"):
        rep["guard"] = "검사 안 함(규칙 없음)"
        return rep
    if not prev_path or not os.path.exists(prev_path):
        rep["guard"] = "직전 공개본 없음(첫 공개) — 비교 생략"
        return rep
    try:
        new, prev = _load(new_path), _load(prev_path)
    except Exception as e:
        rep["guard"] = f"읽기 실패: {e}"
        return rep
    keyf, meaning, simple = rule["key"], rule.get("meaning", []), rule.get("simple", [])
    policy = rule.get("on_meaning_change", "exclude")           # blank | exclude
    rm_policy = rule.get("removed", "exclude")                  # exclude | apply
    outage_min, outage_ratio = int(rule.get("removed_outage_min", 5)), float(rule.get("removed_outage_ratio", 0.03))
    rep["outage"] = {"suspected": False, "reason": "", "lists": []}
    recon = int(rule.get("reconfirm_days", 7))
    blank = rule.get("blank_values", {})
    approvals, wild = load_approvals(approvals_path, city, fn)
    rv_path = os.path.join(review_dir, "_reverify.json") if review_dir else ""
    prev_pending = {}
    if rv_path and os.path.exists(rv_path):
        try:
            for it in _load(rv_path).get("pending", []):
                if it.get("file") == fn:
                    prev_pending[(it.get("list"), it.get("key"))] = it
        except Exception:
            prev_pending = {}

    def approval(k, first_seen):
        a = approvals.get(k)
        if a:
            return a
        if wild and first_seen and first_seen < wild["all_pending_before"]:
            return wild
        return None

    items, total_prev, NKEYS = [], 0, {}
    for lst in rule["lists"]:
        P = {_key(r, keyf): r for r in (prev.get(lst) or []) if isinstance(r, dict)}
        N = {_key(r, keyf): r for r in (new.get(lst) or []) if isinstance(r, dict)}
        NKEYS[lst] = set(N); total_prev += len(P)
        removed = {k: r for k, r in P.items() if k not in N}
        added = {k: r for k, r in N.items() if k not in P}
        paired = set()
        if len(keyf) > 1:   # 이름은 같은데 주소 등 key 의 다른 칸만 바뀜 → 삭제+추가가 아니라 변경
            by_name = {}
            for k, r in removed.items():
                by_name.setdefault(str(_norm(r.get(keyf[0], ""))), []).append(k)
            for k, r in list(added.items()):
                c = by_name.get(str(_norm(r.get(keyf[0], ""))), [])
                if len(c) == 1 and c[0] in removed:
                    old = removed.pop(c[0]); added.pop(k); paired.add(k)
                    fields = [f for f in keyf[1:] if _norm(old.get(f)) != _norm(r.get(f))] + [f for f in meaning if _norm(old.get(f)) != _norm(r.get(f))]
                    items.append({"list": lst, "key": c[0], "new_key": k, "name": _name(r), "kind": "변경", "fields": fields, "before": _pick(old, keyf + meaning), "after": _pick(r, keyf + meaning), "meaning": True, "_old": old, "_new": r})
                    by_name[str(_norm(r.get(keyf[0], "")))] = []
        for k, r in added.items():
            items.append({"list": lst, "key": k, "name": _name(r), "kind": "추가", "fields": [], "before": None, "after": _pick(r, keyf + meaning), "meaning": False, "_new": r})
        for k, r in removed.items():
            items.append({"list": lst, "key": k, "name": _name(r), "kind": "삭제", "fields": [], "before": _pick(r, keyf + meaning), "after": None, "meaning": rm_policy != "apply", "_old": r})
        for k, r in N.items():
            if k not in P or k in paired:
                continue
            o = P[k]
            pend = prev_pending.get((lst, k))
            # 직전본이 '비운 칸(rv)' 상태면 원래 값(pending.before)과 비교한다 — 원복·변경 판단은 원래 값 기준
            base = dict(o)
            if o.get("rv") and pend and isinstance(pend.get("before"), dict):
                base.update({f: v for f, v in pend["before"].items() if f in meaning})
                base.pop("rv", None)
            mf = [f for f in meaning if _norm(base.get(f)) != _norm(r.get(f))]
            sf = [f for f in simple if _norm(base.get(f)) != _norm(r.get(f))]
            if mf:
                items.append({"list": lst, "key": k, "name": _name(r), "kind": "변경", "fields": mf + sf, "before": _pick(base, keyf + meaning), "after": _pick(r, keyf + meaning), "meaning": True, "_old": base, "_new": r})
            elif o.get("rv") and pend:   # 원천이 원래 값으로 돌아옴 → 원복(표시 해제)
                items.append({"list": lst, "key": k, "name": _name(r), "kind": "원복", "fields": pend.get("fields", []), "before": pend.get("before"), "after": _pick(r, keyf + meaning), "meaning": False, "_new": r, "status": "적용(원복 — 원천이 원래 값으로 복귀)", "verify_result": "원복"})
                rep["counts"]["reverted"] += 1
            elif sf:
                items.append({"list": lst, "key": k, "name": _name(r), "kind": "변경", "fields": sf, "before": _pick(o, sf), "after": _pick(r, sf), "meaning": False, "status": "적용(단순 갱신)"})
                rep["counts"]["simple"] += 1
            else:
                rep["counts"]["unchanged"] += 1

    # 원천 누락 의심: 사라진 기록이 기준보다 많거나 목록 하나가 통째로 빔 → 삭제를 '유지'로 바꾼다(폐업 아님으로 간주)
    C = rep["counts"]
    removed_items = [it for it in items if it["kind"] == "삭제"]
    wiped = [lst for lst in rule["lists"] if (prev.get(lst) or []) and not (new.get(lst) or [])]
    n_rm = len(removed_items)
    if removed_items and (wiped or n_rm > max(outage_min, int(total_prev * outage_ratio))):
        thr = max(outage_min, int(total_prev * outage_ratio))
        why = (f"목록이 통째로 빔({', '.join(wiped)})" if wiped else f"사라진 기록 {n_rm}건 > 기준 {thr}건(최소 {outage_min}·{outage_ratio*100:.0f}%)")
        rep["outage"] = {"suspected": True, "lists": wiped, "reason": why + " — 원천 API 장애·누락 의심, 폐업 처리하지 않고 직전 기록 유지"}
        for it in removed_items:
            it["kind"] = "유지"; it["meaning"] = False; it["status"] = "유지(원천 누락 의심 — 폐업 아님으로 간주)"; it["why"] = rep["outage"]["reason"]; it["verify_result"] = "원천 누락 의심 유지"
        C["outage_kept"] = n_rm
    # 판정
    for it in items:
        if it.get("status"):
            continue
        pk = (it["list"], it["key"]); pend = prev_pending.get(pk, {})
        if it["kind"] == "추가":
            if not pend:
                C["added"] += 1; it["status"] = "적용(추가)"; continue
            if pend.get("kind") == "삭제":   # 사라졌던 기록이 원천에 다시 나타남 → 복귀(폐업 의심 해제)
                it["status"] = "적용(복귀 — 원천 목록에 다시 나타남)"; it["verify_result"] = "복귀"; it["before"] = pend.get("before"); C["reverted"] += 1; continue
            # 비공개(exclude·만료)됐던 '변경' 기록이 다시 옴 → 원래 값과 비교해 원복/계속 보류/승인 판정 (아래 변경 로직으로 보냄)
            orig = pend.get("orig") or {}
            it.update(kind="변경", meaning=True, fields=[f for f in meaning if _norm(orig.get(f)) != _norm(it["_new"].get(f))] or pend.get("fields", []), before=pend.get("before"), after=_pick(it["_new"], keyf + meaning), _old=orig or {k: v for k, v in it["_new"].items()})
            if not [f for f in meaning if _norm(orig.get(f)) != _norm(it["_new"].get(f))] and orig:
                it.update(kind="원복", meaning=False, status="적용(원복 — 원천이 원래 값으로 복귀)", verify_result="원복"); C["reverted"] += 1; continue
        first = pend.get("first_seen", today); due = _plus(first, recon)
        it["first_seen"], it["due"] = first, due
        a = approval(it["key"], first) or (approval(it.get("new_key", ""), first) if it.get("new_key") else None)
        result = (a or {}).get("result", "승인")
        if it["kind"] == "삭제":
            C["removed"] += 1
            if not it["meaning"]:
                it["status"] = "적용(삭제)"; continue
            if a and result == "승인":
                it["status"] = "삭제 확정(폐업·종료 확인)"; it["verify_result"] = "삭제 확정"; it["approved_by"] = a.get("by", ""); it["approved_at"] = a.get("approved_at", ""); C["approved"] += 1
            elif a:
                it["status"] = "비공개 유지(기각 — 원천에 없어 복원 불가)"; it["verify_result"] = "기각"; C["held"] += 1
            else:
                it["status"] = "비공개(원천 목록에서 사라짐 — 폐업·종료 확인 전)"; it["why"] = "원천 목록에서 사라짐(폐업·종료 의심) — 공식 확인 전 비공개"; C["held"] += 1; C["excluded"] += 1
            continue
        # 변경(의미)
        C["meaning"] += 1
        if a and result == "승인":
            it["status"] = "적용(승인 반영)"; it["verify_result"] = "승인 반영"; it["approved_by"] = a.get("by", ""); it["approved_at"] = a.get("approved_at", ""); C["approved"] += 1
        elif a:
            it["status"] = "적용(기각 — 원래 값 유지·표시 해제)"; it["verify_result"] = "기각(기존값 유지)"; it["_keep_old"] = True; C["approved"] += 1
        elif today > due:
            it["status"] = f"비공개(보류 만료 — {due} 까지 확인 없음)"; it["why"] = f"{', '.join(it['fields'])} 변경 감지 {first} → {recon}일 안에 공식 확인 없음 → 공개 제외"; it["verify_result"] = "보류 만료 비공개"; C["held"] += 1; C["expired"] += 1; C["excluded"] += 1
        elif policy == "blank":
            it["status"] = "공개(바뀐 칸 비움 · 확인 중 표시)"; it["why"] = f"{', '.join(it['fields'])} 변경 감지 — 공식 확인 전 그 칸은 표시하지 않음(기한 {due})"; it["_flag"] = True; C["held"] += 1; C["flagged"] += 1
        else:
            it["status"] = "비공개(의미 변경 — 공식 확인 전)"; it["why"] = f"{', '.join(it['fields'])} 변경 감지 — 공식 확인 전 비공개(기한 {due})"; C["held"] += 1; C["excluded"] += 1

    ratio = (C["meaning"] + C["removed"]) / max(total_prev, 1)
    if ratio > rule.get("max_meaning_ratio", 0.2):
        rep["file_hold"] = True
        rep["file_hold_reason"] = f"의미 변경 {C['meaning']} + 삭제 {C['removed']} = {ratio*100:.0f}% > {rule.get('max_meaning_ratio',0.2)*100:.0f}% — 원천 자료 형식 변화 의심, 파일 전체 공개 보류(직전본 유지)"
        rep["guard"] = "파일 보류"
    else:
        rep["guard"] = "적용"

    # 공개본 만들기: 제외·비움·기각 반영
    if not rep["file_hold"] and not dry_run:
        for lst in rule["lists"]:
            L = new.get(lst)
            if not isinstance(L, list):
                continue
            drop, repl = set(), {}
            for it in items:
                if it["list"] != lst:
                    continue
                kk = it.get("new_key", it["key"])
                if it["kind"] == "변경" and it["meaning"]:
                    if it.get("_keep_old"):
                        repl[kk] = {k: v for k, v in it["_old"].items() if k != "rv"}
                    elif it.get("_flag"):
                        r = {k: v for k, v in it["_old"].items() if k != "rv"}
                        for f in it["fields"]:
                            if f in meaning or f in keyf:
                                r[f] = blank.get(f, "" if isinstance(r.get(f), str) else [] if isinstance(r.get(f), list) else None)
                        r["rv"] = {"f": [f for f in it["fields"] if f in meaning or f in keyf], "since": it["first_seen"], "due": it["due"], "why": "공식 확인 전 — 바뀐 칸은 표시하지 않음"}
                        repl[kk] = r
                    elif it["status"].startswith("비공개"):
                        drop.add(kk)
                elif it["kind"] == "삭제" and it["status"].startswith("비공개"):
                    pass   # 새 수집본에 없으므로 자연히 비공개
                elif it["kind"] == "유지":
                    L.append(it["_old"])   # 원천 누락 의심: 직전 기록을 그대로 되살림
            out = []
            for r in L:
                if not isinstance(r, dict):
                    out.append(r); continue
                k = _key(r, keyf)
                if k in drop:
                    continue
                out.append(repl.get(k, r))
            new[lst] = out
        _save(new_path, new)

    clean = []
    for it in sorted(items, key=lambda it: (not it["meaning"] and it["kind"] != "원복", it["kind"])):
        c = {k: v for k, v in it.items() if not k.startswith("_")}
        c.update(file=fn, city=city, checked_at=today, source_org=rep["source_org"], source_url=rep["source_url"])
        clean.append(c)
    rep["items"] = clean[:MAX_ITEMS_PER_RUN]; rep["items_truncated"] = max(0, len(clean) - MAX_ITEMS_PER_RUN)
    if dry_run:
        return rep
    if rv_path:   # 대기 목록(파일 단위 교체, first_seen 유지). 해결된 것(승인·기각·원복·삭제 확정)은 빠진다
        try:
            rv = _load(rv_path) if os.path.exists(rv_path) else {}
        except Exception:
            rv = {}
        keep = [it for it in rv.get("pending", []) if it.get("file") != fn]
        seen = set()
        origs = {(it["list"], it["key"]): it.get("_old") for it in items if it.get("_old")}
        for it in clean:
            if it["meaning"] and it.get("verify_result") in (None, "보류 만료 비공개"):   # 미해결(확인 중·비공개·만료)만 대기 유지
                pk = (it["list"], it["key"]); seen.add(pk)
                prior = prev_pending.get(pk, {})
                keep.append({k: it[k] for k in ("file", "list", "key", "name", "kind", "fields", "before", "after", "first_seen", "due", "why", "status", "source_org", "source_url", "city") if k in it} | {"last_seen": today, "orig": prior.get("orig") or origs.get(pk)})
        for pk, pi in prev_pending.items():   # 이번에 다시 감지되지 않은 미해결 보류도 유지(사라진 기록·비공개된 기록은 다음 수집본에 없으면 비교에 안 잡힘)
            if pk in seen or pi.get("file") != fn:
                continue
            if pk[1] in NKEYS.get(pk[0], set()):   # 새 수집본에 다시 있는데 변경·추가로 안 잡혔다면 해결된 것
                continue
            keep.append(pi | {"last_seen": today})
        _save(rv_path, {"_설명": "재검증 대기 — 의미가 바뀌거나 사라진 기록(변경 전후·출처·감지일·기한·사유). 앱은 읽지 않음. 원문 대조 뒤 approvals/reverify.json 에 승인(result 승인/기각)을 넣으면 다음 수집부터 반영", "city": city, "updated": today,
                        "pending": keep, "file_hold": {**({fn: rep["file_hold_reason"]} if rep["file_hold"] else {}), **{k: v for k, v in (rv.get("file_hold") or {}).items() if k != fn}}})
    if changes_dir:
        cp = os.path.join(changes_dir, f"{city}.json")
        try:
            log = _load(cp) if os.path.exists(cp) else {}
        except Exception:
            log = {}
        runs = log.get("runs", [])
        runs.insert(0, {"checked_at": today, "file": fn, "label": rep["label"], "source_org": rep["source_org"], "source_url": rep["source_url"], "guard": rep["guard"], "counts": C, "file_hold_reason": rep["file_hold_reason"], "items": clean[:120]})
        n, trimmed = 0, []
        for r in runs:
            n += len(r.get("items", [])) + 1
            if n > MAX_LOG_ITEMS and len(trimmed) >= 10:
                break
            trimmed.append(r)
        _save(cp, {"_설명": "공식 자료 변경 기록(변경 전후·원문 출처·확인일·영향 지역·검증 결과 verify_result) — change_guard 가 수집 때마다 추가. 앱은 읽지 않음", "city": city, "updated": today, "runs": trimmed})
    return rep


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", required=True); ap.add_argument("--file", required=True)
    ap.add_argument("--new", required=True); ap.add_argument("--prev", required=True)
    ap.add_argument("--today", default=None); ap.add_argument("--review", default="")
    ap.add_argument("--approvals", default=os.path.join(os.path.dirname(HERE), "approvals", "reverify.json"))
    ap.add_argument("--changes", default=""); ap.add_argument("--dry-run", action="store_true"); ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    rep = guard(a.city, a.file, a.new, a.prev, a.today, a.review, a.approvals, a.changes, a.dry_run)
    c = rep["counts"]
    print(f"{a.city} {a.file}: {rep['guard']} — 추가 {c['added']} · 단순 {c['simple']} · 의미 변경 {c['meaning']}(확인중 표시 {c['flagged']}·비공개 {c['excluded']}·만료 {c['expired']}) · 삭제 {c['removed']} · 승인 {c['approved']} · 원복 {c['reverted']} · 그대로 {c['unchanged']}")
    if rep["file_hold"]:
        print(f"::warning::{a.city} {a.file} {rep['file_hold_reason']}")
    if rep.get("outage", {}).get("suspected"):
        print(f"::warning::{a.city} {a.file} 원천 누락 의심 — {rep['outage']['reason']} (유지 {c.get('outage_kept',0)}건)")
    for it in rep["items"][:20]:
        if it.get("meaning") or it["kind"] == "원복":
            print(f"   {it['status']:40} {it['kind']} {it['list']}/{it['name']} {it.get('fields') or ''}")
    if a.json:
        print(json.dumps(rep, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
