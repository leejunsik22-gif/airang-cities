"""지역 비교 조사(읽기 전용) v01 — 2026-11-10 대표 지시 '지역 비교 보고서'
- NEIS 학원교습소정보: 교육청별 전체 행을 읽어 행정구역(ADMST_ZONE_NM)별 개원 학원·교습소 수, 동네 상위, 영어·수학 검색 예시 수를 셈
- 행정안전부 법정동코드(StanReginCd): 후보 시·군·구 코드와 폐지 여부
결과는 로그에만 출력(저장·공개 없음)."""
import json, os, re, sys, time, urllib.parse, urllib.request
from collections import Counter, defaultdict
NEIS = os.environ.get("NEIS_KEY", ""); DGK = os.environ.get("DATA_KEY", "")
OFFICES = {"G10": "대전(기준)", "D10": "대구", "C10": "부산", "F10": "광주(옛 코드)", "Q10": "전남(옛 코드)", "H10": "울산", "I10": "세종", "M10": "충북", "N10": "충남", "R10": "경북"}
FOCUS = {"M10": ["청주", "충주", "제천", "단양"], "N10": ["금산"], "R10": ["경주"], "Q10": ["광주", "나주"]}
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
        if not d or "acaInsTiInfo" not in d: return rows, (d or {}).get("RESULT", {}).get("CODE", "실패") if page == 1 else "끝"
        head, body = d["acaInsTiInfo"]; rows += body["row"]; total = head["head"][0]["list_total_count"]
        if len(rows) >= total: return rows, total
        page += 1
DONG = re.compile(r"\(([가-힣]{1,6}\d?동|[가-힣]{1,5}[읍면])[,)\s]")
out = {"neis": {}, "codes": {}}
for off, name in OFFICES.items():
    rows, total = neis_all(off)
    zones = defaultdict(lambda: {"all": 0, "open": 0, "학원": 0, "교습소": 0, "영어": 0, "수학": 0, "dong": Counter(), "addr_prefix": Counter()})
    for r in rows:
        z = zones[r.get("ADMST_ZONE_NM") or "?"]; z["all"] += 1
        if (r.get("REG_STTUS_NM") or "") != "개원": continue
        z["open"] += 1; z[r.get("ACA_INSTI_SC_NM") or "학원"] = z.get(r.get("ACA_INSTI_SC_NM") or "학원", 0) + 1
        nm = (r.get("ACA_NM") or "") + " " + (r.get("LE_CRSE_LIST_NM") or "") + " " + (r.get("LE_CRSE_NM") or "")
        if "영어" in nm: z["영어"] += 1
        if "수학" in nm: z["수학"] += 1
        a = (r.get("FA_RDNMA") or "") + " " + (r.get("FA_RDNDA") or "")
        m = DONG.search(a + " ")
        if m: z["dong"][m.group(1)] += 1
        z["addr_prefix"][" ".join(a.split()[:2])] += 1
    out["neis"][off] = {"name": name, "rows": len(rows), "result": total, "zones": {k: {**{x: v[x] for x in ("all", "open", "학원", "교습소", "영어", "수학")}, "top_dong": v["dong"].most_common(6), "addr_prefix": v["addr_prefix"].most_common(3)} for k, v in sorted(zones.items(), key=lambda kv: -kv[1]["open"])}}
    print(f"{off} {name}: 행 {len(rows)} / 응답 {total} / 행정구역 {len(zones)}개", file=sys.stderr)
for nm in ["광주광역시", "전남광주", "경상북도 경주시", "충청남도 금산군", "충청북도 충주시", "충청북도 제천시", "충청북도 단양군", "충청북도 청주시", "대구광역시 군위군", "세종특별자치시", "울산광역시", "부산광역시", "대구광역시", "대전광역시"]:
    q = urllib.parse.urlencode({"ServiceKey": DGK, "type": "json", "pageNo": 1, "numOfRows": 60, "flag": "Y", "locatadd_nm": nm})
    d = get("http://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList?" + q)
    try:
        rows = d["StanReginCd"][1]["row"]
        out["codes"][nm] = [(r["region_cd"], r["locatadd_nm"]) for r in rows if r.get("umd_cd") == "000" and r.get("ri_cd") == "00"][:30]
    except Exception:
        out["codes"][nm] = ["조회 실패", str(d)[:200]]
print("=====SURVEY====="); print(json.dumps(out, ensure_ascii=False)); print("=====END=====")
