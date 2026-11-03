#!/usr/bin/env python3
"""지역 섞임 자동 검사 v01후보 (2026-11-03) — 수집 결과에 다른 시·도(또는 다른 구·군) 자료가 섞였는지 파일별로 검사한다.

  CITY=유성 python3 tools/check_region.py --dir output [--quarantine] [--report output/_region_check.json]

- regions/*.json 의 시·도 이름(full)·구군(area)·중심 좌표(lat/lon)·전화 지역번호(tel)를 기준으로:
  latest.json(schools.address) · academies.json(academies.a) · benefits.json(items.org, scope=local) 는 주소·기관명에 우리 시·도/구군이 들어야 하고,
  hospitals.json(clinics/hospitals/er/pharm) 은 좌표가 우리 시·도 범위 안(기본 중심 ±0.35°)이어야 한다(전화 지역번호 불일치는 경고).
- 같은 시·도의 다른 구·군 주소·전화 지역번호 불일치는 '경고'로 세고, 경고가 2%(최소 3건)를 넘으면 실패.
- 다른 시·도 이름이 들어간 기록(예: 대전 자료에 '대구광역시')은 1건이라도 있으면 그 파일은 실패.
  주소 없음 등 판정 불가는 '불명'으로 세고, 불명이 20%를 넘으면 실패(자료 형식 변화 의심).
- --quarantine: 실패한 파일을 <dir>/_rejected/ 로 옮긴다 → gate.py 는 '새 수집 없음'으로 보고 직전 공개본을 유지한다.
- 종료 코드: 실패 파일이 있으면 1(--quarantine 이면 0, 옮긴 것으로 처리 끝).
"""
import argparse, json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import city  # noqa: E402  (CITY 환경변수로 도시 선택)

ALL_SIDO_NAMES = ["서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
                  "경기도", "강원특별자치도", "강원도", "충청북도", "충청남도", "전북특별자치도", "전라북도", "전라남도", "경상북도", "경상남도",
                  "제주특별자치도", "제주도"]
SHORT = {"서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천", "광주광역시": "광주", "대전광역시": "대전",
         "울산광역시": "울산", "세종특별자치시": "세종", "경기도": "경기", "충청북도": "충북", "충청남도": "충남", "제주특별자치도": "제주"}
NONGEO_TEL = re.compile(r"^(0?50|010|070|1[5-9]\d\d|080)")


def me():
    c = city.CITIES[city.CITY]; s = city.SIDOS[c["sido"]]
    return {"key": city.CITY, "sido": c["sido"], "full": s["full"], "sgg": c["area"], "lat": c["lat"], "lon": c["lon"],
            "tel": s.get("tel", ""), "span": s.get("span", 0.35), "others": [n for n in ALL_SIDO_NAMES if n != s["full"] and SHORT.get(n, n) != c["sido"]]}


def text_judge(txt, M, need_sgg=True):
    """주소·기관명 한 줄 판정: ok / other(다른 시도) / warn(같은 시도·다른 구군) / unknown"""
    if not txt:
        return "unknown"
    for o in M["others"]:
        if o in txt or (SHORT.get(o) and re.search(rf"(^|\s){SHORT[o]}(시|도)?\s", txt)):
            return "other"
    if M["full"] in txt or M["sido"] in txt:
        if need_sgg and M["sgg"] and M["sgg"] not in txt:
            return "warn"
        return "ok"
    if need_sgg and M["sgg"] and M["sgg"] in txt:
        return "ok"
    return "unknown"


def geo_judge(rec, M):
    y, x = rec.get("y"), rec.get("x")
    try:
        y, x = float(y), float(x)
    except Exception:
        return "unknown"
    if abs(y - M["lat"]) > M["span"] or abs(x - M["lon"]) > M["span"]:
        return "other"
    t = str(rec.get("t", "")).replace("-", "")
    if M["tel"] and t and not NONGEO_TEL.match(t) and not t.startswith(M["tel"].replace("-", "")):
        return "warn"   # 좌표는 우리 지역인데 전화 지역번호가 다름(원천 자료 오류 가능) — 경고로만 센다
    return "ok"


CHECKS = {
    "latest.json": [("schools", lambda r, M: text_judge(r.get("address", ""), M))],
    "academies.json": [("academies", lambda r, M: text_judge(r.get("a", ""), M))],
    "benefits.json": [("items", lambda r, M: "ok" if r.get("scope") == "nat" else text_judge(r.get("org", ""), M))],
    "hospitals.json": [(k, geo_judge) for k in ("clinics", "hospitals", "er", "pharm")],
    "meals.json": [("schools", lambda r, M: text_judge(r.get("address", r.get("a", "")), M) if (r.get("address") or r.get("a")) else "ok")],
}


def check_file(path, M):
    try:
        obj = json.load(open(path, encoding="utf-8"))
    except Exception as e:
        return {"result": "실패", "reason": f"JSON 못 읽음: {e}"}
    tot = {"ok": 0, "other": 0, "warn": 0, "unknown": 0}; samples = []
    for key, fn in CHECKS[os.path.basename(path)]:
        for r in obj.get(key, []) or []:
            if not isinstance(r, dict):
                continue
            j = fn(r, M); tot[j] += 1
            if j != "ok" and len(samples) < 5:
                samples.append({"list": key, "judge": j, "name": r.get("n") or r.get("name"), "where": r.get("address") or r.get("a") or r.get("org") or f"{r.get('y')},{r.get('x')} {r.get('t')}"})
    n = sum(tot.values())
    reasons = []
    if tot["other"]:
        reasons.append(f"다른 시·도/범위 밖 {tot['other']}건")
    if tot["warn"] and tot["warn"] > max(2, n * 0.02):
        reasons.append(f"경고(다른 구·군 주소 또는 전화 지역번호 불일치) {tot['warn']}건 > 허용 2%")
    if n and tot["unknown"] > n * 0.2:
        reasons.append(f"판정 불가 {tot['unknown']}건({tot['unknown']*100//n}%)")
    return {"result": "실패" if reasons else "통과", "reason": "; ".join(reasons), "counts": tot, "total": n, "samples": samples}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--quarantine", action="store_true")
    ap.add_argument("--report", default="")
    a = ap.parse_args()
    M = me()
    out = {"city": M["key"], "sido": M["full"], "sgg": M["sgg"], "files": {}}
    bad = []
    for fn in CHECKS:
        p = os.path.join(a.dir, fn)
        if not os.path.exists(p):
            continue
        r = check_file(p, M); out["files"][fn] = r
        mark = "✅" if r["result"] == "통과" else "❌"
        print(f"  {mark} {fn:16} {r['result']} {r.get('reason','')} {r.get('counts','')}")
        if r["result"] == "실패":
            bad.append(fn)
            if a.quarantine:
                os.makedirs(os.path.join(a.dir, "_rejected"), exist_ok=True)
                shutil.move(p, os.path.join(a.dir, "_rejected", fn)); r["quarantined"] = True
                print(f"     → {fn} 을 _rejected/ 로 옮김 (공개 안 함, 직전 공개본 유지)")
    print(f"{M['key']}({M['full']} {M['sgg']}): 지역 검사 {len(out['files'])}파일, 실패 {len(bad)} {bad if bad else ''}")
    if a.report:
        json.dump(out, open(a.report, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if bad:
        print(f"::warning::{M['key']} 지역 섞임 의심 {bad}")
        if not a.quarantine:
            sys.exit(1)


if __name__ == "__main__":
    main()
