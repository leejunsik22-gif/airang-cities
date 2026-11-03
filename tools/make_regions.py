#!/usr/bin/env python3
"""확장 후보 지역 설정 생성기 v01후보 (2026-11-03) — 대구·부산·제주·청주·충주의 regions/*.json 과 app/cities_candidates/*.json 을 만든다.

  python3 tools/make_regions.py [--codes out/022-1_regions_codes.json]

- 모든 후보는 stage="비공개 후보". 대전(regions/daejeon.json)은 건드리지 않는다.
- 코드 값은 --codes(공식 출처 검증표)가 있으면 그 값을 쓰고 verify="확인(출처)" 로, 없으면 클로드 기억값을 넣고 verify="미확인" 로 표시한다.
  미확인 코드로는 수집을 돌리지 않는다(newcity 실행 전 대표·피트 확인 필요).
- 서울·경기는 만들지 않는다.
"""
import argparse, json, os

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)

# 시·도 공통(기억값 — 검증표로 덮어씀). hira=심평원 시도코드, air=에어코리아 시도명, kopis=KOPIS 지역코드, lib=정보나루 지역코드, kinder=유치원알리미 시도코드, tour=관광공사 areaCode
SIDO = {
    "대구": {"full": "대구광역시", "neis": "D10", "lib": "22", "kinder": "27", "kopis": "27", "hira": "230000", "air": "대구", "tour": 4, "tel": "053", "span": 0.5, "tag": "daegu", "suffix": "구"},
    "부산": {"full": "부산광역시", "neis": "C10", "lib": "21", "kinder": "26", "kopis": "26", "hira": "210000", "air": "부산", "tour": 6, "tel": "051", "span": 0.5, "tag": "busan", "suffix": "구"},
    "제주": {"full": "제주특별자치도", "neis": "T10", "lib": "50", "kinder": "50", "kopis": "50", "hira": "390000", "air": "제주", "tour": 39, "tel": "064", "span": 0.6, "tag": "jeju", "suffix": "시"},
    "충북": {"full": "충청북도", "neis": "M10", "lib": "33", "kinder": "43", "kopis": "43", "hira": "330000", "air": "충북", "tour": 33, "tel": "043", "span": 0.8, "tag": "chungbuk", "suffix": "시"},
}
# 구·군: (키, 표시 이름, 지역 이름(area), 시군구 코드(법정동 5자리), 위도, 경도, 생활권 예시, 폴더)
CITIES = {
    "대구": [("대구중구", "대구 중구", "중구", 27110, 35.8694, 128.6061, "동성로·남산·대신", "dgjunggu"), ("대구동구", "대구 동구", "동구", 27140, 35.8866, 128.6356, "신천·동대구역·안심", "dgdonggu"),
            ("대구서구", "대구 서구", "서구", 27170, 35.8718, 128.5592, "평리·내당·비산", "dgseogu"), ("대구남구", "대구 남구", "남구", 27200, 35.8460, 128.5976, "대명·봉덕·앞산", "dgnamgu"),
            ("대구북구", "대구 북구", "북구", 27230, 35.8858, 128.5829, "칠곡·침산·복현", "dgbukgu"), ("수성", "수성", "수성구", 27260, 35.8582, 128.6307, "범어·만촌·시지", "suseong"),
            ("달서", "달서", "달서구", 27290, 35.8299, 128.5327, "월성·상인·성서", "dalseo"), ("달성", "달성", "달성군", 27710, 35.7747, 128.4313, "다사·화원·테크노폴리스", "dalseong"),
            ("군위", "군위", "군위군", 27720, 36.2429, 128.5729, "군위읍", "gunwi")],
    "부산": [("부산중구", "부산 중구", "중구", 26110, 35.1064, 129.0323, "남포·중앙", "bsjunggu"), ("부산서구", "부산 서구", "서구", 26140, 35.0979, 129.0243, "서대신·암남", "bsseogu"),
            ("부산동구", "부산 동구", "동구", 26170, 35.1292, 129.0453, "초량·범일", "bsdonggu"), ("영도", "영도", "영도구", 26200, 35.0912, 129.0679, "동삼·남항", "yeongdo"),
            ("부산진", "부산진", "부산진구", 26230, 35.1630, 129.0531, "서면·양정·개금", "busanjin"), ("동래", "동래", "동래구", 26260, 35.2048, 129.0837, "온천·사직·명장", "dongnae"),
            ("부산남구", "부산 남구", "남구", 26290, 35.1365, 129.0843, "대연·용호·문현", "bsnamgu"), ("부산북구", "부산 북구", "북구", 26320, 35.1972, 128.9903, "화명·덕천·구포", "bsbukgu"),
            ("해운대", "해운대", "해운대구", 26350, 35.1631, 129.1636, "좌동·재송·반여", "haeundae"), ("사하", "사하", "사하구", 26380, 35.1044, 128.9747, "하단·괴정·다대", "saha"),
            ("금정", "금정", "금정구", 26410, 35.2429, 129.0922, "구서·장전·부곡", "geumjeong"), ("부산강서", "부산 강서", "강서구", 26440, 35.2121, 128.9806, "명지·대저·녹산", "bsgangseo"),
            ("연제", "연제", "연제구", 26470, 35.1761, 129.0796, "연산·거제", "yeonje"), ("수영", "수영", "수영구", 26500, 35.1455, 129.1131, "광안·남천·민락", "suyeong"),
            ("사상", "사상", "사상구", 26530, 35.1525, 128.9912, "괘법·주례·모라", "sasang"), ("기장", "기장", "기장군", 26710, 35.2445, 129.2223, "정관·기장읍·일광", "gijang")],
    "제주": [("제주시", "제주시", "제주시", 50110, 33.4996, 126.5312, "노형·연동·아라", "jejusi"), ("서귀포", "서귀포", "서귀포시", 50130, 33.2541, 126.5600, "중문·동홍·대정", "seogwipo")],
    "충북": [("상당", "청주 상당", "청주시 상당구", 43111, 36.6349, 127.4890, "용암·금천·방서", "sangdang"), ("서원", "청주 서원", "청주시 서원구", 43112, 36.6375, 127.4699, "산남·분평·수곡", "seowon"),
            ("흥덕", "청주 흥덕", "청주시 흥덕구", 43113, 36.6410, 127.4319, "복대·가경·오송", "heungdeok"), ("청원", "청주 청원", "청주시 청원구", 43114, 36.6640, 127.4900, "율량·오창·내덕", "cheongwon"),
            ("충주", "충주", "충주시", 43130, 36.9910, 127.9259, "연수·호암·칠금", "chungju")],
}
NOTE = {"대구": "군위군은 2023-07 대구 편입(대표 지시 '8 구·군'에는 없음 → 후보에만 넣고 표시, 포함 여부는 대표 결정)",
        "충북": "청주 4구 + 충주시. 청주시 구는 법정동 코드 43111~43114(청주시 43110 하위) — NEIS·심평원 등은 '청주시' 단위 코드를 쓰는 API가 있어 수집기별 확인 필요"}
PALETTE = [("#2F6FBA", "#24568F", "#183B63", "#EAF1FA"), ("#C2410C", "#9A3412", "#6B2308", "#FDEEE4"), ("#5E8C7A", "#2E5A4B", "#1E3C32", "#EBF3EF"), ("#7048E8", "#5537B0", "#3E2881", "#F1EDFD"),
           ("#B8923E", "#6F5415", "#4A370E", "#F8F2E4"), ("#0F8B8D", "#0A6466", "#064546", "#E6F4F4"), ("#D9654A", "#A33D27", "#6E2819", "#FBEDE9"), ("#1F2A44", "#16203A", "#0E1526", "#ECEEF3")]


def ok(v):
    return str(v or "").startswith("확인")


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--codes", default=os.path.join(ROOT, "..", "out", "2026-11-03_아이랑대전_022", "022-1_regions_codes.json")); a = ap.parse_args()
    codes = json.load(open(a.codes, encoding="utf-8")) if a.codes and os.path.exists(a.codes) else {"sido": {}, "sgg": []}
    sgg_by_code = {str(x["code"]): x for x in codes.get("sgg", [])}
    src = (codes.get("meta") or {}).get("sources", {})
    os.makedirs(os.path.join(ROOT, "regions"), exist_ok=True); os.makedirs(os.path.join(ROOT, "app", "cities_candidates"), exist_ok=True)
    n_ok = n_un = 0
    for sk, S in SIDO.items():
        sv = dict(S); verify = {}
        cs = codes.get("sido", {}).get(sk, {}); cv = cs.get("verified", {})
        for f, (key, vkey) in {"neis": ("neis", "neis"), "lib": ("lib_region", "lib_region"), "kinder": ("kinder_sidoCode", "kinder"), "kopis": ("kopis_signgucode", "kopis"), "hira": ("hira_sidoCd", "hira_sido"), "tour": ("tour_areaCode", "tour_area")}.items():
            if cs.get(key) not in (None, "") and ok(cv.get(vkey)):
                sv[f] = cs[key] if f != "tour" else int(cs[key]); verify[f] = cv[vkey] + " — 022-1 검증표"
            else:
                verify[f] = "미확인(검증표에 공식 출처 없음 — 클로드 기억값, 수집 전 확인 필요)"
        verify["air"] = "확인 — 에어코리아 시도명(측정소는 구·군별 air_station)"
        reg = {"_설명": f"{S['full']} 지역 설정 v01후보(2026-11-03) — 비공개 후보. 코드 검증 상태는 _verify(시·도)와 각 구·군의 _verify 참고. '미확인' 코드가 남은 수집기는 돌리지 않는다(서울·경기 제외).",
               "sido_key": sk, "stage": "비공개 후보", "_note": NOTE.get(sk, ""), "_sources": {k: src.get(k, "") for k in ("code", "hira", "egen", "kma", "air", "lib", "kopis", "kinder", "neis", "tour") if src.get(k)},
               "sido": {k: v for k, v in sv.items() if k not in ("tag", "suffix")}, "_verify": verify, "cities": {}}
        app = {"_설명": f"{S['full']} 앱 설정 v01후보 — AIRANG_INCLUDE_CANDIDATES=1 미리보기 빌드에서만 쓰임. 운영 cities.json 과 분리.", "sidos": {sk: [S["full"], S["tag"], S["suffix"]]}, "cities": {}}
        for i, (k, name, area, sgg_code, lat, lon, areas, d) in enumerate(CITIES[sk]):
            x = sgg_by_code.get(str(sgg_code), {}); xv = x.get("verified", {})
            ent = {"sido": sk, "sgg": area, "area": area, "dir": d, "stage": "비공개 후보", "gus": {"": int(x.get("code", sgg_code))}, "lat": lat, "lon": lon, "areas": areas,
                   "lib": {"": int(x["lib_dtl_region"])} if x.get("lib_dtl_region") else {"": None}, "kopis": str(x.get("kopis_signgucodesub", "")).split("(")[0] or sv.get("kopis"),
                   "hira_sgg": x.get("hira_sgguCd", ""), "kinder_sgg": x.get("kinder_sggCode", ""), "egen_q1": x.get("egen_Q1", area), "grid": [x.get("kma_nx"), x.get("kma_ny")], "air_station": x.get("airkorea_station", ""),
                   "tour_ldong": [x.get("tour_lDongRegnCd"), x.get("tour_lDongSignguCd")], "stations": [], "places": "|".join([area.replace("청주시 ", "")] + areas.split("·")), "not_places": "|".join(o[2] for o in CITIES[sk] if o[2] != area) or "(?!)",
                   "domain": f"{d}.{S['tag']}.example.invalid",
                   "_verify": {"code": xv.get("code", "미확인"), "hira_sgg": xv.get("hira_sgguCd", "미확인"), "lib": xv.get("lib_dtl_region", xv.get("lib", "미확인")), "kopis": xv.get("kopis_sub", xv.get("kopis", "미확인")), "kinder_sgg": xv.get("kinder_sggCode", xv.get("kinder", "미확인")),
                               "egen_q1": xv.get("egen_Q1", "미확인"), "grid": xv.get("kma", xv.get("kma_nx", "미확인")), "air_station": xv.get("airkorea_station", xv.get("airkorea", "미확인")), "tour": xv.get("tour_sigunguCode", "미확인")},
                   "_note": x.get("note", ""), "_todo": "stations(날씨 관측소 동 이름)·places(생활권 정규식) 는 수집 전 보완; 미확인 코드 확인 전 해당 수집기 실행 금지"}
            n_ok += sum(1 for v in ent["_verify"].values() if ok(v)); n_un += sum(1 for v in ent["_verify"].values() if not ok(v))
            reg["cities"][k] = ent
            c, ink, deep, soft = PALETTE[i % len(PALETTE)]
            app["cities"][d] = {"name": name, "sido": sk, "sgg": area, "stage": "비공개 후보", "colors": {"city": c, "ink": ink, "deep": deep, "soft": soft}, "areas": areas, "lat": lat, "lon": lon,
                                "searchEx": ", ".join(areas.split("·")[:2]), "domain": f"{d}.{S['tag']}.example.invalid", "pages": "airang-all", "has404": True, "gus": [], "fields": {"start": "", "startVer": ""}}
        json.dump(reg, open(os.path.join(ROOT, "regions", f"{S['tag']}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        json.dump(app, open(os.path.join(ROOT, "app", "cities_candidates", f"{S['tag']}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"{sk}: 구·군 {len(CITIES[sk])}곳 → regions/{S['tag']}.json | 시·도 코드: " + ", ".join(f"{k}={'O' if ok(v) else 'X'}" for k, v in verify.items()))
    print(f"구·군 코드 칸: 확인 {n_ok} / 미확인 {n_un}")


if __name__ == "__main__":
    main()
