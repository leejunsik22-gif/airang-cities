"""도시 설정 — 수집기들이 공통으로 읽는다. CITY 환경변수(예: 유성)로 도시를 고른다.

새 도시를 열 때는 여기 한 칸만 채우면 된다. (도시 생성기의 바탕)
- gus: 구 이름 → 행정구역(시군구) 코드 (유치원 알리미). 구가 없는 시는 {"": 시 코드}
- lib: 구 이름 → 도서관 정보나루 세부지역 코드 (행정 코드와 다름)
- signgu: 경기육아종합지원센터 인력뱅크 시군구 코드 / kopis: KOPIS 시군구 하위 코드
- places: 행사 장소 이름으로 이 도시를 알아보는 정규식 / not_places: 이웃 도시(제외)
"""
import os
import re

# ── 지역 설정은 regions/*.json(시·도마다 한 파일)에서 읽는다 (2026-11-03 공통 모듈화). 대전 값은 regions/daejeon.json 에 그대로 보존.
import json as _json, glob as _glob
_HERE = os.path.dirname(os.path.abspath(__file__))
CITIES, SIDOS, STAGE = {}, {}, {}
for _p in sorted(_glob.glob(os.path.join(_HERE, "regions", "*.json"))):
    _r = _json.load(open(_p, encoding="utf-8"))
    SIDOS[_r["sido_key"]] = _r["sido"]
    for _k, _v in _r["cities"].items():
        _v.setdefault("sido", _r["sido_key"]); _v.setdefault("stage", _r.get("stage", "후보"))
        CITIES[_k] = _v; STAGE[_k] = _v["stage"]
if not CITIES:
    raise SystemExit("regions/*.json 이 없습니다")
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
