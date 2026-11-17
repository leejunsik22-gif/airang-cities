"""137 읽기 전용 대조: NEIS 학원교습소정보 원문을 학원지정번호로 1곳씩 조회해 출력만 한다.
키 없이 호출(공개 시험 호출), data/ 는 읽지도 쓰지도 않음. 시험 가지(check-137) 전용 — main 에 넣지 않는다."""
import json, sys, time, urllib.parse, urllib.request
ids = json.load(open("tools/qa/check137_ids.json"))
want = sorted(set(ids["sample"]) | set(ids["odd"]))
F = ["ACA_ASNUM", "ACA_NM", "REG_STTUS_NM", "FA_RDNMA", "FA_RDNDA", "FA_TELNO", "ADMST_ZONE_NM", "LOAD_DTM"]
out = {}
for aid in want:
    url = "https://open.neis.go.kr/hub/acaInsTiInfo?" + urllib.parse.urlencode({"Type": "json", "pIndex": 1, "pSize": 5, "ATPT_OFCDC_SC_CODE": "G10", "ACA_ASNUM": aid})
    rows, err = [], ""
    for i in range(3):
        try:
            with urllib.request.urlopen(url, timeout=40) as r:
                d = json.loads(r.read().decode("utf-8"))
            if "acaInsTiInfo" in d:
                rows = d["acaInsTiInfo"][1]["row"]
            else:
                err = d.get("RESULT", {}).get("CODE", "") + " " + d.get("RESULT", {}).get("MESSAGE", "")
            break
        except Exception as e:
            err = str(e)[:120]; time.sleep(3)
    rows = [r for r in rows if str(r.get("ACA_ASNUM")) == aid]
    out[aid] = {"rows": [{k: r.get(k) for k in F} for r in rows[:1]], "n": len(rows), "err": err}
    print(aid, json.dumps(out[aid], ensure_ascii=False))
    time.sleep(0.5)
json.dump({"fetched_at": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime()) + "Z", "data": out}, open("check137_result.json", "w"), ensure_ascii=False, indent=1)
print("조회", len(want), "곳 / 원문 있음", sum(1 for v in out.values() if v["rows"]), "/ 오류", sum(1 for v in out.values() if v["err"] and not v["rows"]))
