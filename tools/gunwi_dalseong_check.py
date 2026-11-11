"""088 군위군·달성군 대조(읽기 전용) — 2026-11-11 피트 의견(대표 전달)
- 군위군: 대구(D10) 자료와 경북(R10) 자료에서 '군위'가 들어간 학원·교습소를 모두 꺼내 등록번호·이름·주소·상태로 대조
- 달성군: 대구(D10) 달성군 개원 학원 중 옛 이름(유가면·옥포면·현풍면·구지면) 주소를 세고 표본을 보임
결과는 로그에만 출력(저장·공개 없음). 학원 등록정보는 교육청 공개 자료."""
import json, os, sys, time, urllib.parse, urllib.request
from collections import Counter
NEIS = os.environ.get("NEIS_KEY", "")
def get(url):
    for i in range(3):
        try:
            with urllib.request.urlopen(url, timeout=60) as r: return json.loads(r.read().decode("utf-8"))
        except Exception as e: print("  재시도", i + 1, e, file=sys.stderr); time.sleep(4)
    return None
def neis_all(off):
    rows, page = [], 1
    while True:
        q = urllib.parse.urlencode({"KEY": NEIS, "Type": "json", "pIndex": page, "pSize": 1000, "ATPT_OFCDC_SC_CODE": off})
        d = get("https://open.neis.go.kr/hub/acaInsTiInfo?" + q)
        if not d or "acaInsTiInfo" not in d: return rows
        head, body = d["acaInsTiInfo"]; rows += body["row"]
        if len(rows) >= head["head"][0]["list_total_count"]: return rows
        page += 1
K = ["ATPT_OFCDC_SC_CODE", "ACA_ASNUM", "ACA_NM", "ACA_INSTI_SC_NM", "REG_STTUS_NM", "ESTBL_YMD", "REG_YMD", "CAA_BEGIN_YMD", "CAA_END_YMD", "ADMST_ZONE_NM", "FA_RDNMA", "LOAD_DTM"]
out = {"run_at": time.strftime("%Y-%m-%d %H:%M:%S"), "gunwi": [], "dalseong": {}}
d10 = neis_all("D10"); r10 = neis_all("R10")
out["rows"] = {"D10": len(d10), "R10": len(r10)}
for r in d10 + r10:
    if "군위" in (r.get("ADMST_ZONE_NM") or "") or "군위군" in (r.get("FA_RDNMA") or ""):
        out["gunwi"].append({k: r.get(k) for k in K})
ds = [r for r in d10 if (r.get("ADMST_ZONE_NM") or "") == "달성군" or "달성군" in (r.get("FA_RDNMA") or "")]
op = [r for r in ds if r.get("REG_STTUS_NM") == "개원"]
OLD = {"유가면": "유가읍", "옥포면": "옥포읍", "현풍면": "현풍읍", "구지면": "구지읍"}
c = Counter()
for r in op:
    a = r.get("FA_RDNMA") or ""
    for o, n in OLD.items():
        if o in a: c[o] += 1
        if n in a: c[n] += 1
out["dalseong"] = {"all": len(ds), "open": len(op), "addr_counts": dict(c),
                   "old_samples": [{k: r.get(k) for k in K} for r in op if any(o in (r.get("FA_RDNMA") or "") for o in OLD)][:8],
                   "old_reg_years": dict(Counter((r.get("REG_YMD") or "")[:4] for r in op if any(o in (r.get("FA_RDNMA") or "") for o in OLD))),
                   "new_reg_years": dict(Counter((r.get("REG_YMD") or "")[:4] for r in op if any(n in (r.get("FA_RDNMA") or "") for n in OLD.values())))}
print("=====CHECK====="); print(json.dumps(out, ensure_ascii=False)); print("=====END=====")
