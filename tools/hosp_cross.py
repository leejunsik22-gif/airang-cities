#!/usr/bin/env python3
"""병원 두 공식 자료 자동 대조(읽기 전용) — 수집기 hospitals.cross_check 를 그대로 써서 지금 수집본을 점검 (2026-11-09 A+B안)"""
import json, os, sys, glob
os.environ.setdefault("CITY", "유성")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import hospitals as H
def main():
    rows = []
    for cl in H.CROSS_CL: rows += H.hira({"sidoCd": H.SIDO_CD, "clCd": cl})
    out, summ = {}, {}
    for f in sorted(glob.glob("review/*/hospitals.json")):
        gu = f.split("/")[1]; cl = json.load(open(f, encoding="utf-8")).get("clinics", [])
        out[gu] = H.cross_check(cl, rows); ok = sum(v["ok"] for v in out[gu].values())
        summ[gu] = {"의원": len(cl), "통과": ok, "확인필요": len(cl) - ok}
    os.makedirs("output", exist_ok=True)
    json.dump(out, open("output/hosp_cross.json", "w", encoding="utf-8"), ensure_ascii=False)
    print("심평원 대전 의원·치과의원·보건기관", len(rows), "곳")
    print("=====SUMMARY=====\n" + json.dumps(summ, ensure_ascii=False))
    print("=====JSON=====\n" + json.dumps({g: {k: int(v["ok"]) + int(v["name"]) * 2 + int(v["tel"]) * 4 + int(v["addr"]) * 8 for k, v in m.items()} for g, m in out.items()}, ensure_ascii=False, separators=(",", ":")) + "\n=====END=====")
if __name__ == "__main__":
    main()
