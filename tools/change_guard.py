#!/usr/bin/env python3
"""변경 감지·재검증 보류 v01후보 (2026-11-03, 024) — 새 수집본을 직전 공개본과 기록(record) 단위로 비교한다.

  python3 tools/change_guard.py --city yuseong --file hospitals.json --new output/hospitals.json --prev data/yuseong/hospitals.json \
      [--today 2026-11-03] [--review review/yuseong] [--approvals approvals/reverify.json] [--changes ops/changes] [--dry-run]

규칙: tools/change_rules.json (파일별 key·meaning·simple 필드, 추가/삭제 정책, 파일 보류 비율)
- 단순 갱신(simple 필드만 바뀜, 새 기록 추가) → 새 값 그대로 공개(사전 승인 규칙).
- 의미 변경(meaning 필드가 바뀜) / 삭제(removed=hold) → 새 수집본 안의 그 기록을 **직전 공개본 값으로 되돌려** 공개하고,
  review/<구>/_reverify.json 에 전후 값·출처·확인일·지역을 남긴다(앱은 읽지 않음). 승인(approvals/reverify.json)이 있으면 새 값을 공개.
- 의미 변경+삭제가 max_meaning_ratio 를 넘으면 파일째 보류(file_hold=True) — gate 가 직전본을 유지한다.
- 모든 변경(적용·보류)은 ops/changes/<구>.json 에 쌓인다(변경 전후·원문 출처·확인일·영향 지역).
- 외부 API 호출 없음. 표준 라이브러리만.
"""
import argparse, json, os, shutil, sys
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
HERE = os.path.dirname(os.path.abspath(__file__))
RULES = json.load(open(os.path.join(HERE, "change_rules.json"), encoding="utf-8"))
try:
    DATA_RULES = json.load(open(os.path.join(HERE, "data_rules.json"), encoding="utf-8")).get("files", {})
except Exception:
    DATA_RULES = {}
MAX_ITEMS_PER_RUN = 300      # 기록 파일이 끝없이 커지지 않게
MAX_LOG_ITEMS = 400


def _norm(v):
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, list):
        return [_norm(x) for x in v]
    if isinstance(v, dict):
        return {k: _norm(x) for k, x in sorted(v.items())}
    return v


def _sig(rec, fields):
    return json.dumps({f: _norm(rec.get(f)) for f in fields}, ensure_ascii=False, sort_keys=True)


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


def load_approvals(path, city, fn):
    """approvals/reverify.json → {key: 승인기록}; key '*' + all_pending_before 는 그 날짜 전에 처음 발견된 보류 전부 승인"""
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
    """비교·되돌리기·기록. 돌려주는 값: 보고서(dict). new_path 는 보류 기록이 되돌려진 상태로 덮어써진다(dry_run 제외, file_hold 제외)."""
    today = today or datetime.now(KST).date().isoformat()
    rule = RULES.get("files", {}).get(fn)
    src = DATA_RULES.get(fn, {})
    rep = {"file": fn, "city": city, "checked_at": today, "label": (rule or {}).get("label", fn), "source_org": src.get("source_org", ""), "source_url": src.get("source_url", ""),
           "guard": "", "counts": {"added": 0, "removed": 0, "meaning": 0, "simple": 0, "unchanged": 0, "approved": 0, "held": 0}, "file_hold": False, "file_hold_reason": "", "items": []}
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
    approvals, wild = load_approvals(approvals_path, city, fn)
    prev_pending = {}
    rv_path = os.path.join(review_dir, "_reverify.json") if review_dir else ""
    if rv_path and os.path.exists(rv_path):
        try:
            for it in _load(rv_path).get("pending", []):
                if it.get("file") == fn:
                    prev_pending[(it.get("list"), it.get("key"))] = it
        except Exception:
            prev_pending = {}

    def approved(k, first_seen):
        a = approvals.get(k)
        if a:
            return a
        if wild and first_seen and first_seen < wild["all_pending_before"]:
            return wild
        return None

    items, pending = [], []
    total_prev = 0
    for lst in rule["lists"]:
        P = {_key(r, keyf): r for r in (prev.get(lst) or []) if isinstance(r, dict)}
        N_list = [r for r in (new.get(lst) or []) if isinstance(r, dict)]
        N = {_key(r, keyf): r for r in N_list}
        total_prev += len(P)
        removed = {k: r for k, r in P.items() if k not in N}
        added = {k: r for k, r in N.items() if k not in P}
        # 이름은 같은데 key 의 다른 칸(주소 등)이 바뀐 경우 → 삭제+추가가 아니라 '변경'으로 짝 맞춤
        if len(keyf) > 1:
            by_name_rm = {}
            for k, r in removed.items():
                by_name_rm.setdefault(str(_norm(r.get(keyf[0], ""))), []).append(k)
            for k, r in list(added.items()):
                nm = str(_norm(r.get(keyf[0], "")))
                cands = by_name_rm.get(nm, [])
                if len(cands) == 1 and cands[0] in removed:
                    ok = cands[0]
                    old = removed.pop(ok); added.pop(k)
                    # 변경된 key 칸은 meaning 으로 취급
                    diff_fields = [f for f in keyf[1:] if _norm(old.get(f)) != _norm(r.get(f))]
                    it = {"list": lst, "key": ok, "new_key": k, "name": _name(r), "kind": "변경", "fields": diff_fields + [f for f in meaning if _norm(old.get(f)) != _norm(r.get(f))],
                          "before": _pick(old, keyf + meaning), "after": _pick(r, keyf + meaning), "meaning": True, "_old": old, "_new": r}
                    items.append(it)
                    by_name_rm[nm] = []
        for k, r in added.items():
            items.append({"list": lst, "key": k, "name": _name(r), "kind": "추가", "fields": [], "before": None, "after": _pick(r, keyf + meaning), "meaning": False, "_new": r})
        for k, r in removed.items():
            items.append({"list": lst, "key": k, "name": _name(r), "kind": "삭제", "fields": [], "before": _pick(r, keyf + meaning), "after": None, "meaning": rule.get("removed", "hold") == "hold", "_old": r})
        for k, r in N.items():
            if k not in P or any(x.get("new_key") == k and x["list"] == lst for x in items):
                continue
            o = P[k]
            mf = [f for f in meaning if _norm(o.get(f)) != _norm(r.get(f))]
            sf = [f for f in simple if _norm(o.get(f)) != _norm(r.get(f))]
            if mf:
                items.append({"list": lst, "key": k, "name": _name(r), "kind": "변경", "fields": mf + sf, "before": _pick(o, keyf + meaning), "after": _pick(r, keyf + meaning), "meaning": True, "_old": o, "_new": r})
            elif sf:
                items.append({"list": lst, "key": k, "name": _name(r), "kind": "변경", "fields": sf, "before": _pick(o, sf), "after": _pick(r, sf), "meaning": False})
                rep["counts"]["simple"] += 1
            else:
                rep["counts"]["unchanged"] += 1

    # 판정: 적용 / 보류 / 승인 반영
    held_meaning = 0
    for it in items:
        if it["kind"] == "추가":
            rep["counts"]["added"] += 1
            it["status"] = "적용(추가)" if rule.get("added", "apply") == "apply" else "보류(추가 승인 전)"
            if it["status"].startswith("보류"):
                it["meaning"] = True
        elif it["kind"] == "삭제":
            rep["counts"]["removed"] += 1
            it["status"] = "보류(삭제 재검증)" if it["meaning"] else "적용(삭제)"
        elif it["meaning"]:
            rep["counts"]["meaning"] += 1
            it["status"] = "보류(재검증)"
        else:
            it["status"] = "적용(단순 갱신)"
        if it["meaning"]:
            pk = (it["list"], it["key"])
            first = prev_pending.get(pk, {}).get("first_seen", today)
            a = approved(it["key"], first)
            if a:
                it["status"] = "적용(승인 반영)"; it["approved_by"] = a.get("by", ""); it["approved_at"] = a.get("approved_at", "")
                rep["counts"]["approved"] += 1
            else:
                held_meaning += 1
                it["first_seen"] = first
    rep["counts"]["held"] = held_meaning
    ratio_base = max(total_prev, 1)
    ratio = (rep["counts"]["meaning"] + rep["counts"]["removed"]) / ratio_base
    if ratio > rule.get("max_meaning_ratio", 0.2):
        rep["file_hold"] = True
        rep["file_hold_reason"] = f"의미 변경 {rep['counts']['meaning']} + 삭제 {rep['counts']['removed']} = {ratio*100:.0f}% > {rule.get('max_meaning_ratio',0.2)*100:.0f}% — 원천 자료 형식 변화 의심, 파일 전체 공개 보류(직전본 유지)"
        rep["guard"] = "파일 보류"
    else:
        rep["guard"] = "적용"

    # 되돌리기(merge): 보류된 변경은 직전본 값으로, 보류된 삭제는 직전본 기록을 다시 넣음
    if not rep["file_hold"] and not dry_run and held_meaning:
        for lst in rule["lists"]:
            N_list = new.get(lst)
            if not isinstance(N_list, list):
                continue
            for it in items:
                if it["list"] != lst or not it["meaning"] or it["status"].startswith("적용"):
                    continue
                if it["kind"] == "변경":
                    kk = it.get("new_key", it["key"])
                    for i, r in enumerate(N_list):
                        if isinstance(r, dict) and _key(r, keyf) == kk:
                            N_list[i] = it["_old"]; break
                elif it["kind"] == "삭제":
                    N_list.append(it["_old"])
                elif it["kind"] == "추가":
                    N_list[:] = [r for r in N_list if not (isinstance(r, dict) and _key(r, keyf) == it["key"])]
        _save(new_path, new)

    # 기록 정리(내부 원본 _old/_new 제거)
    clean = []
    for it in items:
        c = {k: v for k, v in it.items() if not k.startswith("_")}
        c.update(file=fn, city=city, checked_at=today, source_org=rep["source_org"], source_url=rep["source_url"])
        clean.append(c)
    rep["items"] = clean[:MAX_ITEMS_PER_RUN]
    rep["items_truncated"] = max(0, len(clean) - MAX_ITEMS_PER_RUN)

    if dry_run:
        return rep
    # review/<구>/_reverify.json — 재검증 대기 목록(파일 단위로 교체, first_seen 유지)
    if rv_path:
        try:
            rv = _load(rv_path) if os.path.exists(rv_path) else {}
        except Exception:
            rv = {}
        keep = [it for it in rv.get("pending", []) if it.get("file") != fn]
        for it in clean:
            if it["meaning"] and it["status"].startswith("보류"):
                keep.append({k: it[k] for k in ("file", "list", "key", "name", "kind", "fields", "before", "after", "first_seen", "source_org", "source_url", "city") if k in it} | {"last_seen": today})
        _save(rv_path, {"_설명": "재검증 대기 — 의미가 바뀐 기록(변경 전후). 앱은 읽지 않음. 원문 대조 뒤 approvals/reverify.json 에 승인을 넣으면 다음 수집부터 새 값 공개", "city": city, "updated": today,
                        "pending": keep, "file_hold": {**({fn: rep["file_hold_reason"]} if rep["file_hold"] else {}), **{k: v for k, v in (rv.get("file_hold") or {}).items() if k != fn}}})
    # ops/changes/<구>.json — 변경 기록(적용·보류 모두)
    if changes_dir:
        cp = os.path.join(changes_dir, f"{city}.json")
        try:
            log = _load(cp) if os.path.exists(cp) else {}
        except Exception:
            log = {}
        runs = log.get("runs", [])
        runs.insert(0, {"checked_at": today, "file": fn, "label": rep["label"], "source_org": rep["source_org"], "source_url": rep["source_url"], "guard": rep["guard"], "counts": rep["counts"],
                        "file_hold_reason": rep["file_hold_reason"], "items": sorted(clean, key=lambda it: (not it["meaning"], it["kind"]))[:120]})   # 의미 변경·삭제를 앞에
        n = 0; trimmed = []
        for r in runs:
            n += len(r.get("items", [])) + 1
            if n > MAX_LOG_ITEMS and len(trimmed) >= 10:
                break
            trimmed.append(r)
        _save(cp, {"_설명": "공식 자료 변경 기록(변경 전후·원문 출처·확인일·영향 지역) — change_guard 가 수집 때마다 추가. 앱은 읽지 않음", "city": city, "updated": today, "runs": trimmed})
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
    print(f"{a.city} {a.file}: {rep['guard']} — 추가 {c['added']} · 단순 갱신 {c['simple']} · 의미 변경 {c['meaning']} · 삭제 {c['removed']} · 승인 반영 {c['approved']} · 재검증 보류 {c['held']} · 그대로 {c['unchanged']}")
    if rep["file_hold"]:
        print(f"::warning::{a.city} {a.file} {rep['file_hold_reason']}")
    for it in rep["items"][:20]:
        if it.get("meaning"):
            print(f"   {it['status']:12} {it['kind']} {it['list']}/{it['name']} {it.get('fields') or ''}")
    if a.json:
        print(json.dumps(rep, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
