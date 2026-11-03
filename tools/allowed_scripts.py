#!/usr/bin/env python3
"""미확인 지역 코드 자동 실행 차단 v01후보 (2026-11-03) — 후보 도시에서 공식 출처로 확인되지 않은 코드를 쓰는 수집기는 실행 목록에서 뺀다.

  CITY=수성 python3 tools/allowed_scripts.py collect academies kinder meals libs books events jobs sports elite weather benefits hospitals
  → 표준출력: 실행 허용 수집기(공백 구분). 표준오류: 차단 사유.

규칙
- 운영 도시(stage=운영)는 모두 허용(대전은 이미 운영 검증됨).
- 후보 도시는 regions/*.json 의 시·도 `_verify` 와 구·군 `_verify` 에서 수집기별 필요 코드가 모두 '확인…'으로 시작해야 허용.
- AIRANG_ALLOW_UNVERIFIED=1 이면 차단하지 않고 경고만(대표 승인 뒤 시험용). 기본은 차단.
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import city  # noqa: E402

# 수집기 → (시·도 코드 필요 항목, 구·군 코드 필요 항목)
NEED = {
    "collect": (["neis"], ["code"]), "academies": (["neis"], ["code"]), "meals": (["neis"], ["code"]), "elite": (["neis"], []),
    "kinder": (["kinder"], ["kinder_sgg"]), "libs": (["lib"], ["lib"]), "books": (["lib"], ["lib"]),
    "events": (["tour", "kopis"], ["tour", "kopis"]), "weather": ([], ["grid", "air_station"]),
    "benefits": ([], ["code"]), "hospitals": (["hira"], ["egen_q1"]),
    "jobs": ([], ["code"]), "sports": ([], ["code"]), "deals": None,   # deals(비공식 검색)는 후보 도시에서 항상 차단
}


def ok(v):
    return str(v or "").startswith("확인")


def main():
    scripts = sys.argv[1:]
    c = city.CITIES[city.CITY]
    if c.get("stage") == "운영":
        print(" ".join(scripts)); return
    sv = None
    for r in city.REGION_FILES.values():
        if r["sido_key"] == c["sido"]:
            sv = r.get("_verify", {})
    sv = sv or {}; cv = c.get("_verify", {})
    allowed, blocked = [], []
    for s in scripts:
        need = NEED.get(s, ([], []))
        if need is None:
            blocked.append((s, "비공식 자료 — 후보 도시에서 수집 안 함")); continue
        miss = [f"시도.{k}={sv.get(k, '없음')}" for k in need[0] if not ok(sv.get(k))] + [f"구군.{k}={cv.get(k, '없음')}" for k in need[1] if not ok(cv.get(k))]
        if miss and os.environ.get("AIRANG_ALLOW_UNVERIFIED") != "1":
            blocked.append((s, "; ".join(miss)))
        else:
            if miss:
                print(f"::warning::{city.CITY} {s}: 미확인 코드이지만 AIRANG_ALLOW_UNVERIFIED=1 로 실행 — {'; '.join(miss)}", file=sys.stderr)
            allowed.append(s)
    for s, why in blocked:
        print(f"::warning::{city.CITY} {s} 차단 — 미확인 코드: {why}", file=sys.stderr)
    print(" ".join(allowed))


if __name__ == "__main__":
    main()
