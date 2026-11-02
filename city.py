"""도시 설정 — 수집기들이 공통으로 읽는다. CITY 환경변수(예: 유성)로 도시를 고른다.

새 도시를 열 때는 여기 한 칸만 채우면 된다. (도시 생성기의 바탕)
- gus: 구 이름 → 행정구역(시군구) 코드 (유치원 알리미). 구가 없는 시는 {"": 시 코드}
- lib: 구 이름 → 도서관 정보나루 세부지역 코드 (행정 코드와 다름)
- signgu: 경기육아종합지원센터 인력뱅크 시군구 코드 / kopis: KOPIS 시군구 하위 코드
- places: 행사 장소 이름으로 이 도시를 알아보는 정규식 / not_places: 이웃 도시(제외)
"""
import os
import re

CITIES = {
    # ── 대전광역시 5개 구 (2026-11-02, 아이랑_대전_시작_안내서 3-3 값 그대로. '확인 필요' 값은 첫 수집 로그로 검증)
    "대전동구": {
        "sido": "대전", "sgg": "동구",
        "area": "동구", "gus": {"": 30110}, "lib": {"": 25010}, "signgu": "", "kopis": "3011",
        "lat": 36.3120, "lon": 127.4548, "stations": ["성남동", "대성동"], "region": "대전",
        "places": r"대전역|대전 동구|판암|가양|용운|대동|자양|신흥동|산내|대청호|소제동",
        "not_places": r"대전 중구|대전 서구|유성|대덕구|세종|청주",
        "domain": "djdonggu", "lib_home": "",
    },
    "대전중구": {
        "sido": "대전", "sgg": "중구",
        "area": "중구", "gus": {"": 30140}, "lib": {"": 25020}, "signgu": "", "kopis": "3014",
        "lat": 36.3255, "lon": 127.4214, "stations": ["문창동", "문화동"], "region": "대전",
        "places": r"대전 중구|은행동|대흥동|선화동|문화동|태평동|유천동|산성동|오월드|보문산|뿌리공원|중앙시장|으능정이",
        "not_places": r"대전 동구|대전 서구|유성|대덕구|서울|인천|부산",
        "domain": "djjunggu", "lib_home": "",
    },
    "대전서구": {
        "sido": "대전", "sgg": "서구",
        "area": "서구", "gus": {"": 30170}, "lib": {"": 25030}, "signgu": "", "kopis": "3017",
        "lat": 36.3555, "lon": 127.3838, "stations": ["둔산동", "월평동", "정림동"], "region": "대전",
        "places": r"대전 서구|둔산|탄방|월평|갈마|관저|도마|가수원|정림|복수동|용문동|만년동|대전시청|한밭수목원|예술의전당",
        "not_places": r"대전 동구|대전 중구|유성|대덕구|인천|부산|광주",
        "domain": "djseogu", "lib_home": "",
    },
    "유성": {
        "sido": "대전", "sgg": "유성구",
        "area": "유성구", "gus": {"": 30200}, "lib": {"": 25040}, "signgu": "", "kopis": "3020",
        "lat": 36.3624, "lon": 127.3563, "stations": ["노은동", "구성동", "상대동"], "region": "대전",
        "places": r"유성|봉명|노은|지족|관평|전민|도룡|신성동|어은|구즉|엑스포|국립중앙과학관|카이스트|KAIST|대덕연구단지|상대동|학하",
        "not_places": r"대전 동구|대전 중구|대전 서구|대덕구|세종",
        "domain": "yuseong", "lib_home": "",
    },
    "대덕": {
        "sido": "대전", "sgg": "대덕구",
        "area": "대덕구", "gus": {"": 30230}, "lib": {"": 25050}, "signgu": "", "kopis": "3023",
        "lat": 36.3466, "lon": 127.4156, "stations": ["읍내동", "문평동"], "region": "대전",
        "places": r"대덕구|송촌|법동|중리동|비래|오정동|신탄진|목상|덕암|대청댐|계족산|동춘당",
        "not_places": r"대전 동구|대전 중구|대전 서구|유성|대덕연구단지|세종|청주",
        "domain": "daedeok", "lib_home": "",
    },
}
# 시도마다 다른 코드 (안내서 3-1). 다른 시·도를 열 때 한 줄씩 추가한다 (서울·경기는 운영 대상 제외)
SIDOS = {
    "대전": {"full": "대전광역시", "neis": "G10", "lib": 25, "kinder": 30, "kopis": "30", "hira": "250000", "air": "대전", "tour": 3},   # tour: 한국관광공사 지역코드 (대전 3)
}
CITY = os.environ.get("CITY", "유성").strip()
if CITY not in CITIES:
    raise SystemExit(f"모르는 도시: {CITY} (city.py 에 추가해 주세요)")
C = CITIES[CITY]
AREA = C["area"]                     # 예: 성남시
GUS = list(C["gus"])                 # 구 이름 목록 ('' 하나면 구 없는 시)
GU_RE = "|".join(g for g in GUS if g) or "(?!)"
PLACES = re.compile(C["places"], re.I)
NOT_PLACES = re.compile(C["not_places"])
SCRIPTS = C.get("scripts", {})       # 그 도시만 다른 수집기 (없으면 공통)
SIDO_NAME = C.get("sido", "대전")     # 대전 (다른 시·도를 열 때 SIDOS 에 추가)
SIDO = SIDOS[SIDO_NAME]
SGG = C.get("sgg", CITY + "시")       # 병원·복지 API의 시군구 이름 (경기: 용인시, 서울: 강남구)


def in_area(text, name=None):
    """주소·지역 글에 우리 시군구가 있나 — 앞 글자가 한글이면 다른 곳 (예: '양주시' 는 '남양주시' 안에 있지만 다른 도시)"""
    return re.search(r"(?<![가-힣])" + re.escape(name or AREA), text or "") is not None


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
