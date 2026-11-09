#!/usr/bin/env python3
"""병원 두 공식 자료 자동 대조 v01후보 (2026-11-09, 대표 승인 '추천대로 견본' — A+B안)
국립중앙의료원(앱 수집본 review/<구>/hospitals.json) ↔ 건강보험심사평가원 병원정보서비스(대전 전체 의원·치과의원)
이름·전화·주소를 맞춰 보고, 의원마다 결과를 남긴다(읽기 전용 — 운영·공개 변경 없음).
판정: 통과 = 이름 같음 AND (전화 OR 주소 같음), 또는 전화·주소 모두 같음 / 확인 필요 = 그 밖
결과: output/hosp_cross.json  {구: {hpid: {"ok":bool, "name":bool, "tel":bool, "addr":bool, "ykiho":…}}} + 요약 출력
"""
import json, os, re, sys, glob
os.environ.setdefault("CITY", "유성")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import hospitals as H

def norm_name(s): return re.sub(r"[\s()·\-]|의료법인|사회복지법인|재단|\(.*?\)", "", s or "")
def norm_addr(s):
    s = re.sub(r"\(.*?\)", "", s or ""); s = re.sub(r"^\s*대전(광역시)?\s*\S+구\s*", "", s)
    m = re.search(r"([가-힣0-9]+(?:로|길)(?:\s*\d+번?길)?)\s*(\d+(?:-\d+)?)", s)
    return (re.sub(r"\s", "", m.group(1)), m.group(2)) if m else None

def main():
    rows = []
    for cl in ("31", "51", "71", "72", "75"):   # 의원, 치과의원, 보건소·보건지소·보건진료소 (심평원 종별 코드)
        rows += H.hira({"sidoCd": H.SIDO_CD, "clCd": cl})
    by_tel, by_name = {}, {}
    for it in rows:
        t = H.digits(it.get("telno")); n = norm_name(it.get("yadmNm"))
        if t: by_tel.setdefault(t, []).append(it)
        by_name.setdefault(n, []).append(it)
    out, summ = {}, {}
    for f in sorted(glob.glob("review/*/hospitals.json")):
        gu = f.split("/")[1]; d = json.load(open(f, encoding="utf-8")); out[gu] = {}
        ok = tot = 0
        for x in d.get("clinics", []):
            tot += 1; n = norm_name(x.get("n")); t = H.digits(x.get("t")); a = norm_addr(x.get("a"))
            cands = by_name.get(n, []) + [c for c in by_tel.get(t, []) if c not in by_name.get(n, [])]
            best = None
            for c in cands:
                r = {"name": norm_name(c.get("yadmNm")) == n, "tel": bool(t) and H.digits(c.get("telno")) == t, "addr": a is not None and norm_addr(c.get("addr")) == a}
                score = r["name"] * 2 + r["tel"] + r["addr"]
                if not best or score > best[0]: best = (score, r, c.get("ykiho"))
            r = best[1] if best else {"name": False, "tel": False, "addr": False}
            r["ok"] = (r["name"] and (r["tel"] or r["addr"])) or (r["tel"] and r["addr"])   # 전화·주소가 모두 같으면 이름만 바뀐 같은 곳(예: 소아과→소아청소년과); r["ykiho"] = best[2] if best else None
            out[gu][x.get("id") or x.get("n")] = r; ok += r["ok"]
        summ[gu] = {"의원": tot, "통과": ok, "확인필요": tot - ok}
    os.makedirs("output", exist_ok=True)
    json.dump(out, open("output/hosp_cross.json", "w", encoding="utf-8"), ensure_ascii=False)
    print("심평원 대전 의원·치과의원", len(rows), "곳")
    print("=====SUMMARY=====\n" + json.dumps(summ, ensure_ascii=False))
    print("=====JSON=====\n" + json.dumps({g: {k: int(v["ok"]) * 1 + int(v["name"]) * 2 + int(v["tel"]) * 4 + int(v["addr"]) * 8 for k, v in m.items()} for g, m in out.items()}, ensure_ascii=False, separators=(",", ":")) + "\n=====END=====")

if __name__ == "__main__":
    main()
