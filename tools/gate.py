#!/usr/bin/env python3
"""공개 전 자료 검문(gate) v03후보 — 공식 원문 확인(official_verify)이 없으면 자동 검사를 통과해도 공개 보류, 기존 공개본 유지 시에도 공식 상태·유효기간 동시 검사 — 006 안전 구조(검사→승인→공개)를 수집 파일 단위로 적용.

  python3 tools/gate.py --city yuseong --in output --out data/yuseong [--today 2026-11-02] [--dry-run]

규칙: tools/data_rules.json
- verify_status 가 publishable(확인 완료·부분 확인)이 아닌 파일 → 공개 폴더에 올리지 않고, 이미 있으면 치운다(제외).
- 공개 대상 파일은 검사: JSON 열림 / 필수 키 / 최소 건수 / 직전 공개본 대비 급감(기본 50%) / 갱신일이 오래됨.
  검사 실패 → 새 파일을 올리지 않고 직전 공개본 유지(없으면 미공개). 이유는 _status.json 과 표준출력에 남긴다.
- 결과: <out>/_status.json (파일별 상태·출처·확인일·건수·사유), 종료 코드 0(이전본 유지로 운영 지속). --strict 면 실패 시 1.
"""
import argparse, json, os, shutil, sys
from datetime import datetime, date

HERE = os.path.dirname(os.path.abspath(__file__))
RULES = json.load(open(os.path.join(HERE, "data_rules.json"), encoding="utf-8"))


def parse_dt(s):
    for f in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(s)[:19], f).date()
        except Exception:
            pass
    return None


def count_of(obj, key):
    if not key:
        return None
    v = obj.get(key)
    return len(v) if isinstance(v, (list, dict)) else None


def expired(path, rule, today):
    """직전 공개본이 유효기간(valid_days)을 넘겼는지 — 넘기면 공개 제외(만료)"""
    vd = rule.get("valid_days")
    uk = rule.get("updated_key")
    if not vd or not uk or not os.path.exists(path):
        return False, None
    try:
        d = parse_dt(json.load(open(path, encoding="utf-8")).get(uk, ""))
    except Exception:
        return True, None
    if d is None:
        return True, None
    return (today - d).days > vd, d


def check(path, rule, prev_path, today):
    """검사 결과 (ok, reasons, count)"""
    reasons = []
    try:
        obj = json.load(open(path, encoding="utf-8"))
    except Exception as e:
        return False, [f"JSON 못 읽음: {e}"], None
    if not isinstance(obj, dict):
        return False, ["최상위가 객체(dict)가 아님"], None
    for k in rule.get("required", []):
        if k not in obj:
            reasons.append(f"필수 키 없음: {k}")
    n = count_of(obj, rule.get("list"))
    mn = rule.get("min_count")
    if mn is not None and (n is None or n < mn):
        reasons.append(f"건수 부족: {n} < {mn}")
    uk = rule.get("updated_key")
    if uk:
        d = parse_dt(obj.get(uk, ""))
        max_age = rule.get("max_age_days", RULES.get("max_age_days", 3))
        if d is None:
            reasons.append(f"갱신일 형식 오류: {obj.get(uk)!r}")
        elif (today - d).days > max_age:
            reasons.append(f"갱신일 오래됨: {d} ({(today - d).days}일 > {max_age}일)")
        elif (d - today).days > 1:
            reasons.append(f"갱신일이 미래: {d}")
    if prev_path and os.path.exists(prev_path) and n is not None:
        try:
            pn = count_of(json.load(open(prev_path, encoding="utf-8")), rule.get("list"))
            ratio = RULES.get("max_drop_ratio", 0.5)
            if pn and n < pn * (1 - ratio):
                reasons.append(f"직전 공개본 대비 급감: {pn} → {n} (허용 {int(ratio*100)}%)")
        except Exception:
            pass
    return not reasons, reasons, n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", required=True)
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--today", default=date.today().isoformat())
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--review", default="", help="보류로 내려가는 기존 공개본을 보존할 비공개 폴더(예: review/yuseong) — 앱은 data/ 만 읽음")
    a = ap.parse_args()
    today = date.fromisoformat(a.today)
    pub = set(RULES["publishable"])
    status, failed = {}, []
    if not a.dry_run:
        os.makedirs(a.out, exist_ok=True)

    for fn, rule in RULES["files"].items():
        src, dst = os.path.join(a.inp, fn), os.path.join(a.out, fn)
        ent = {"label": rule["label"], "verify_status": rule["verify_status"], "source_org": rule.get("source_org", ""),
               "source_url": rule.get("source_url", ""), "checked_at": a.today, "published": False, "count": None, "reason": "",
               "auto_check": "", "official_verify": rule.get("official_verify", "미확인"), "verified_at": rule.get("verified_at", ""), "verified_by": rule.get("verified_by", ""),
               "valid_days": rule.get("valid_days")}
        official_ok = (not RULES.get("publish_requires_official", False)) or rule.get("official_verify", "미확인") in set(RULES.get("publishable_official", ["확인 완료", "부분 확인"]))
        if rule["verify_status"] not in pub:
            ent["reason"] = "공개 제외: " + rule.get("note", rule["verify_status"]); ent["auto_check"] = "검사 안 함(비공개 등급)"
            if os.path.exists(dst) and not a.dry_run:
                os.remove(dst); ent["reason"] += " (기존 공개본 치움)"
            print(f"  ⛔ {fn:16} 제외 — {rule.get('note','')}")
        elif not official_ok:   # 자동 검사는 하되(기록용) 공식 원문 확인 전엔 공개 보류
            ok, rs, n = check(src, rule, dst, today) if os.path.exists(src) else (None, [], None)
            ent["count"] = n; ent["auto_check"] = ("통과" if ok else "실패") if ok is not None else "수집 없음"
            ent["hold"] = True; had = os.path.exists(dst)
            if had and not a.dry_run:
                if a.review:   # 2026-11-04 A안: 기존 공개본은 삭제하지 않고 비공개 검토 폴더에 보존(원문 검증 뒤 복귀용)
                    os.makedirs(a.review, exist_ok=True); shutil.copy(dst, os.path.join(a.review, "_prev_" + fn))
                os.remove(dst)
            ent["reason"] = f"공개 보류: 공식기관 원문 확인 {rule.get('official_verify','미확인')} (자동 검사 {ent['auto_check']}" + (": " + "; ".join(rs) if rs else "") + ") — 표본 대조 후 official_verify 갱신 필요" + (" (기존 공개본 치움)" if had else "")
            print(f"  ⏸ {fn:16} 보류 — 원문 {rule.get('official_verify','미확인')} / 자동 {ent['auto_check']}")
        elif not os.path.exists(src):
            if os.path.exists(dst):
                ex, d = expired(dst, rule, today)
                if ex:
                    if not a.dry_run: os.remove(dst)
                    ent.update(published=False, auto_check="만료", reason=f"새 수집 없음 + 직전 공개본 만료({d}, 유효 {rule.get('valid_days')}일) → 공개 제외")
                    print(f"  ⌛ {fn:16} 만료 — 이전본 {d} (유효 {rule.get('valid_days')}일) → 공개 제외")
                else:
                    ok, rs, n = check(dst, rule, None, today)
                    ent.update(published=True, count=n, auto_check="통과(이전본)", reason="새 수집 없음 — 직전 공개본 유지" + ("" if ok else " (주의: " + "; ".join(rs) + ")"))
                    print(f"  ◻ {fn:16} 새 수집 없음 → 이전본 유지 ({n}건)")
            else:
                ent["reason"] = "수집 파일 없음·공개본도 없음"
                print(f"  ◻ {fn:16} 없음")
        else:
            ok, rs, n = check(src, rule, dst, today)
            ent["count"] = n
            if ok:
                if not a.dry_run:
                    shutil.copy(src, dst)
                ent.update(published=True, auto_check="통과", reason="검사 통과")
                print(f"  ✅ {fn:16} 공개 ({n}건)")
            else:
                failed.append(fn)
                keep = os.path.exists(dst)
                ex, d = expired(dst, rule, today) if keep else (False, None)
                if keep and ex:
                    if not a.dry_run: os.remove(dst)
                    ent.update(published=False, auto_check="실패+만료", reason="검사 실패: " + "; ".join(rs) + f" → 직전 공개본도 만료({d}, 유효 {rule.get('valid_days')}일) → 공개 제외")
                    print(f"  ❌⌛ {fn:16} 실패 + 이전본 만료({d}) → 공개 제외")
                else:
                    if keep:   # 공개된 것은 직전본이므로 건수도 직전본 기준
                        try: ent["count"] = count_of(json.load(open(dst, encoding="utf-8")), rule.get("list"))
                        except Exception: pass
                    ent.update(published=keep, auto_check="실패", reason="검사 실패: " + "; ".join(rs) + (" → 직전 공개본 유지" if keep else " → 미공개"))
                    print(f"  ❌ {fn:16} 실패 — {'; '.join(rs)} → {'이전본 유지' if keep else '미공개'}")
        status[fn] = ent

    # 규칙에 없는 파일은 공개하지 않는다(알 수 없는 자료)
    for fn in sorted(os.listdir(a.inp)):
        if fn.endswith(".json") and fn not in RULES["files"]:
            print(f"  ⛔ {fn:16} 규칙 없음 — 공개하지 않음")
            status[fn] = {"label": fn, "verify_status": "제외", "published": False, "reason": "규칙에 없는 파일", "checked_at": a.today}
    if not a.dry_run:
        json.dump({"city": a.city, "checked_at": a.today, "files": status}, open(os.path.join(a.out, "_status.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    pubn = sum(1 for v in status.values() if v.get("published"))
    print(f"{a.city}: 공개 {pubn}개 / 제외·미공개 {len(status)-pubn}개 / 검사 실패 {len(failed)}개 {failed if failed else ''}")
    if failed:
        print(f"::warning::{a.city} 검사 실패 {failed} — 직전 공개본 유지")
        if a.strict:
            sys.exit(1)


if __name__ == "__main__":
    main()
