"""도시 설정 — 수집기들이 공통으로 읽는다. CITY 환경변수(예: 대전)로 도시를 고른다.

새 도시를 열 때는 여기 한 칸만 채우면 된다. (도시 생성기의 바탕)
- SIDOS: 시도(광역) 단위 값. 예전에는 수집기마다 경기도 값이 따로 박혀 있었는데 여기 한곳으로 모았다.
- sido: 이 도시가 속한 시도 (SIDOS 의 키)
- gus: 구 이름 → 행정구역(시군구) 코드 (유치원 알리미). 구가 없는 시는 {"": 시 코드}
- lib: 구 이름 → 도서관 정보나루 세부지역 코드 (행정 코드와 다름)
- signgu: 경기육아종합지원센터 인력뱅크 시군구 코드 (경기 전용, 대전은 비움) / kopis: KOPIS 시군구 하위 코드
- places: 행사 장소 이름으로 이 도시를 알아보는 정규식 / not_places: 이웃 도시(제외)
- short: 도시의 짧은 이름 (광역시는 '대전광역시' 대신 '대전')
- aca_zone: 나이스 학원 조회의 행정구역명. None 이면 보내지 않고 시도교육청 전체를 받는다
- nmc_q1: 국립중앙의료원 병원·약국 조회의 시군구 목록 (광역시는 구마다 따로 부른다)
- sgg_name: 복지로 지자체복지 조회의 시군구 이름. 비우면 시도 전체

※ '확인 필요' 표시가 붙은 값은 실제 API 를 한 번 불러 보고 맞는지 확인해야 한다 (작업현황 문서 참고).
"""
import os
import re

# 시도(광역) 단위 값
#   name: 정식 이름 (국립중앙의료원·복지로) / short: 짧은 이름 / neis: 나이스 시도교육청 코드
#   lib: 도서관 정보나루 지역 코드 / kinder: 유치원알리미 시도 코드 / kopis: KOPIS 시도 코드
#   hira: 심평원 시도 코드 / air: 에어코리아 시도명(실시간)과 미세먼지 예보 권역 이름 / tour: 한국관광공사 지역 코드
SIDOS = {
    "대전": {"name": "대전광역시", "short": "대전", "neis": "G10", "lib": 25, "kinder": 30, "kopis": "30",
             "hira": "250000", "air": "대전", "tour": 3},
    # 부산을 열 때: {"name": "부산광역시", "short": "부산", "neis": "C10", "lib": 21, "kinder": 26, "kopis": "26",
    #                "hira": "210000", "air": "부산", "tour": 6}
}

CITIES = {
    "대전": {
        "sido": "대전", "area": "대전광역시", "short": "대전",
        "gus": {"동구": 30110, "중구": 30140, "서구": 30170, "유성구": 30200, "대덕구": 30230},
        "lib": {"동구": 25010, "중구": 25020, "서구": 25030, "유성구": 25040, "대덕구": 25050},   # 확인 필요: 정보나루 세부지역 코드
        "signgu": "", "kopis": "",
        "aca_zone": None,                                      # 확인 필요: 학원 행정구역명 (None = 대전교육청 전체)
        "nmc_q1": ["동구", "중구", "서구", "유성구", "대덕구"],      # 확인 필요: 국립중앙의료원 Q1 에 구 이름이 통하는지
        "sgg_name": "",
        "lat": 36.3504, "lon": 127.3845, "stations": [], "region": "대전",   # stations 가 비면 대전 측정소 전체 평균을 쓴다
        "places": r"대전|유성|둔산|노은|도안|대덕|대전예술의전당|엑스포|한밭",
        "not_places": r"세종|청주|공주|논산|계룡|옥천|금산|서울",
        "domain": "daejeon", "lib_home": "",
    },
}
CITY = os.environ.get("CITY", "대전").strip()
if CITY not in CITIES:
    raise SystemExit(f"모르는 도시: {CITY} (city.py 에 추가해 주세요)")
C = CITIES[CITY]
SIDO = SIDOS[C["sido"]]              # 이 도시가 속한 시도 값
AREA = C["area"]                     # 예: 대전광역시
GUS = list(C["gus"])                 # 구 이름 목록 ('' 하나면 구 없는 시)
GU_RE = "|".join(g for g in GUS if g) or "(?!)"
PLACES = re.compile(C["places"], re.I)
NOT_PLACES = re.compile(C["not_places"])
SCRIPTS = C.get("scripts", {})       # 그 도시만 다른 수집기 (없으면 공통)


def gu_of(addr, detail=""):
    """주소에서 구 이름 찾기: 주소에 'OO구'가 있으면 그것, 없으면 읍·면·동 규칙(gu_rules), 그래도 없으면 '기타'.
    구가 없는 시(평택·오산)는 언제나 '' """
    if GUS == [""]:
        return ""
    m = re.search(AREA + r"\s*(\S+구)\b", addr or "")
    if m and m.group(1) in C["gus"]:
        return m.group(1)
    text = (addr or "") + " " + (detail or "")
    tail = text.split(AREA, 1)[-1]
    for pat, gu in C.get("gu_rules", []):
        if re.search(pat, tail):
            return gu
    return "기타"
