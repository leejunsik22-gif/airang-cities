"""아이랑 앱 만들기 — 원본(템플릿) 1벌 + 도시 설정(cities.json) → 도시별 앱 폴더.

  python3 app/build.py                 # out/<도시>/ 에 7개 앱을 만든다
  python3 app/build.py --out 폴더       # 다른 곳에 만들기
  python3 app/build.py --city yongin   # 한 도시만 (--city entry = 입구)

템플릿 문법 (줄 단위)
  {{name}} {{key}} {{c.city}} …           도시 설정 값으로 바뀜 (cities.json)
  {{#if yongin}} … {{#elif suwon,anyang}} … {{#elif seoul}} … {{#else}} … {{/if}}
                                          (seoul / gyeonggi = 그 시도의 모든 도시)
                                          그 도시일 때만 들어가는 줄 (#if 줄은 한 줄 전체)
"""
import argparse, json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, "cities.json"), encoding="utf-8"))
# 2026-11-03: 비공개 후보 도시(app/cities_candidates/*.json)는 AIRANG_INCLUDE_CANDIDATES=1 일 때만 빌드에 넣는다(미리보기용). 기본 빌드 = 운영 도시(대전 5구)만.
CANDIDATE_SIDOS = {}
if os.environ.get("AIRANG_INCLUDE_CANDIDATES") == "1":
    import glob as _glob
    for _p in sorted(_glob.glob(os.path.join(HERE, "cities_candidates", "*.json"))):
        _c = json.load(open(_p, encoding="utf-8"))
        for _k, _v in _c.get("cities", {}).items():
            assert _k not in CFG["cities"], f"후보 도시 키가 운영 도시와 겹침: {_k}"
            _v.setdefault("stage", "비공개 후보"); CFG["cities"][_k] = _v
        CANDIDATE_SIDOS.update({k: tuple(v) for k, v in _c.get("sidos", {}).items()})
BASE = CFG.get("base", "https://airang-daejeon-all.pages.dev")   # 도시 주소 = BASE/도시키/
# 시도: 이름 → (정식 이름, 템플릿 태그, 시군구 끝 글자). 순서 = 다른 도시 둘러보기·입구 탭 순서
SIDOS = {"대전": ("대전광역시", "daejeon", "구")}   # 다른 시·도를 열 때 추가 (서울·경기 제외)
SIDOS.update(CANDIDATE_SIDOS)   # 후보 시·도(미리보기 빌드에서만)
SIDO_ORDER = list(SIDOS)
TEMPLATES = ["index.html", "sw.js", "manifest.webmanifest", "404.html"]
# 2026-11-03 테마·사계절(app/themes): applied.json 의 승인된 시즌만 적용. AIRANG_SEASON 환경변수 = 승인 없는 로컬 미리보기.
THEMES_DIR = os.path.join(HERE, "themes")
def _load_json(p, default):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return default
APPLIED = _load_json(os.path.join(THEMES_DIR, "applied.json"), {}).get("cities", {})
def season_of(city):
    """(시즌, 테마dict, 출처) — 미리보기 env > 승인된 applied > 없음"""
    sd = CFG["cities"][city].get("sido", "대전"); tag = SIDOS.get(sd, (None, sd))[1]
    th = _load_json(os.path.join(THEMES_DIR, f"{tag}.json"), {})
    env = os.environ.get("AIRANG_SEASON", "").strip()
    if env:
        return env, th.get("seasons", {}).get(env, {}), "미리보기(승인 아님)"
    ap = APPLIED.get(city, {})
    if ap.get("season"):
        if ap.get("approved_by") and ap.get("approved_at"):
            return ap["season"], th.get("seasons", {}).get(ap["season"], {}), f"승인 {ap['approved_by']} {ap['approved_at']}"
        print(f"  ⚠ {city}: applied.json 에 season={ap['season']} 이 있지만 승인 기록이 없어 무시(기본 디자인)")
    return "", {}, ""
COND = re.compile(r"^\{\{#(if|elif) ([a-z,]+)\}\}$|^\{\{#else\}\}$|^\{\{/if\}\}$")


def tokens(city):
    c = CFG["cities"][city]
    t = {"key": city, "name": c["name"]}
    for k, v in c.get("colors", {}).items():
        t["c." + k] = v
    season, th, why = season_of(city)
    for k, v in (th.get("colors") or {}).items():   # 시즌 테마 색(있을 때만) — 공식 정보와 무관한 디자인 값
        t["c." + k] = v
    t["f.season"] = season; t["f.seasonWhy"] = why
    for k, v in c.get("fields", {}).items():
        t["f." + k] = v
    # 도시마다 다른 값 (cities.json 에서 만들어 냄)
    g = c.get("gus", [])
    t["f.gus"] = json.dumps(g, ensure_ascii=False)
    tiles = ["t-mint", "t-indigo", "t-coral", "t-sun", "t-lilac"]
    t["f.tileCls"] = "{ " + ", ".join(f'"{x}": "{tiles[i % len(tiles)]}"' for i, x in enumerate(g)) + " }"
    t["f.searchEx"] = c.get("searchEx", "")
    # 시도 (경기 / 서울): 서울은 구 하나가 앱 하나 → 시군구 이름이 '강남구'
    sido = c.get("sido", "경기")
    t["f.sidoShort"] = sido
    t["f.sidoFull"] = SIDOS[sido][0]
    t["f.sgg"] = c.get("sgg", c["name"] + SIDOS[sido][2])
    # 다른 도시 둘러보기: [이름, 주소, 시도] — 경기도 → 서울, 시도 안에서는 가나다순
    oc = sorted(CFG["cities"].items(), key=lambda kv: (SIDO_ORDER.index(kv[1].get("sido", "경기")), kv[1]["name"]))
    oc = [f'["{v["name"]}", "{BASE}/{k}/", "{v.get("sido", "경기")}"]' for k, v in oc]
    t["f.otherCities"] = "const OTHER_CITIES = [\n  " + ",\n  ".join(", ".join(oc[i:i + 6]) for i in range(0, len(oc), 6)) + "];"
    return t


def tags(city):
    """{{#if …}} 에 쓸 수 있는 이름: 도시 키 + 시도 묶음 (gyeonggi / seoul / incheon / chungnam)
    + nojobs (엄마 일자리 자료가 없는 시도 = 경기 밖 전부)"""
    sido = CFG["cities"][city].get("sido", "경기")
    t = {city, SIDOS[sido][1]}
    if sido != "경기": t.add("nojobs")
    return t


def render(text, city):
    out, stack = [], []          # stack: [이 블록에서 이미 맞은 것이 있나, 지금 줄을 넣나]
    lines = text.split("\n")
    for ln in lines:
        m = COND.match(ln)
        if m:
            if ln.startswith("{{#if"):
                hit = bool(tags(city) & set(m.group(2).split(","))); stack.append([hit, hit])
            elif ln.startswith("{{#elif"):
                top = stack[-1]; hit = not top[0] and bool(tags(city) & set(m.group(2).split(","))); top[1] = hit; top[0] = top[0] or hit
            elif ln == "{{#else}}":
                top = stack[-1]; top[1] = not top[0]; top[0] = True
            else:
                stack.pop()
            continue
        if all(s[1] for s in stack):
            out.append(ln)
    assert not stack, "{{#if}} 블록이 닫히지 않았어요"
    s = "\n".join(out)
    t = tokens(city)
    def sub(m):
        k = m.group(1)
        if k not in t: raise KeyError(f"{city}: 설정에 없는 값 {{{{{k}}}}}")
        return t[k]
    return re.sub(r"\{\{([a-z]+(?:\.[A-Za-z0-9_]+)?)\}\}", sub, s)


NAVER = json.load(open(os.path.join(HERE, "naver.json"), encoding="utf-8")) if os.path.exists(os.path.join(HERE, "naver.json")) else {}

def build(city, out):
    d = os.path.join(out, city)
    if os.path.exists(d): shutil.rmtree(d)
    os.makedirs(d)
    for f in TEMPLATES:
        src = os.path.join(HERE, f)
        if not os.path.exists(src): continue
        if f == "404.html" and not CFG["cities"][city].get("has404"): continue
        txt = render(open(src, encoding="utf-8", newline="").read(), city)
        if f == "index.html" and NAVER.get(city):                                     # 네이버 서치어드바이저 소유확인 (도시마다 다름 → app/naver.json)
            txt = txt.replace('<meta charset="utf-8">', f'<meta charset="utf-8">\n<meta name="naver-site-verification" content="{NAVER[city]}" />', 1)
        if f == "index.html" and tokens(city).get("f.season"):
            txt = txt.replace('<meta charset="utf-8">', f'<meta charset="utf-8">\n<meta name="airang-theme" content="{tokens(city)["f.season"]} · {tokens(city)["f.seasonWhy"]}">', 1)
        open(os.path.join(d, f), "w", encoding="utf-8", newline="").write(txt)
    shutil.copytree(os.path.join(HERE, "assets"), os.path.join(d, "assets"))          # 모든 도시 같은 그림
    own = os.path.join(HERE, "cities", city)                                             # 도시 그림·아이콘
    if not os.path.isdir(own):   # 후보 도시(미리보기 빌드): 그림 폴더 없으면 대전 유성 그림을 임시로 빌려 쓰고 경고(운영 빌드에는 후보가 없음)
        print(f"  (후보) {city}: app/cities/{city} 없음 — 임시 그림(yuseong) 사용"); own = os.path.join(HERE, "cities", "yuseong")
    for f in os.listdir(own):
        dst = os.path.join(d, "assets", f) if f.startswith("hero-") else os.path.join(d, f)
        shutil.copy(os.path.join(own, f), dst)
    season = tokens(city).get("f.season")
    if season:   # 시즌 그림이 있으면 기본 그림 자리에 덮어쓴다(출력물에서만 — 원본 보존)
        for suf in ("-800", ""):
            sp = os.path.join(own, f"hero-{city}-{season}{suf}.webp")
            if os.path.exists(sp):
                shutil.copy(sp, os.path.join(d, "assets", f"hero-{city}{suf}.webp")); print(f"  시즌 그림 적용: {os.path.basename(sp)}")
            else:
                print(f"  (시즌 {season}) 그림 없음 → 기본 그림 유지: hero-{city}-{season}{suf}.webp")
    return d


def build_entry(out):
    """입구(BASE/entry/): 도시 고르기 화면. 도시 카드는 cities.json 에서."""
    d = os.path.join(out, "entry")
    if os.path.exists(d): shutil.rmtree(d)
    os.makedirs(os.path.join(d, "img"))
    rows = [[k, c["name"], c["colors"]["city"], c.get("areas", ""), c.get("lat", 0), c.get("lon", 0), c.get("sido", "경기"), c["colors"].get("ink", c["colors"]["city"])] for k, c in CFG["cities"].items()]
    src = open(os.path.join(HERE, "entry", "index.html"), encoding="utf-8").read()
    assert "/*CITIES*/[]" in src
    src = src.replace("/*CITIES*/[]", json.dumps(rows, ensure_ascii=False))
    # 검색용 페이지로 가는 링크 (검색 로봇이 따라가도록 HTML에 바로 적음)
    g = ""
    for sd, label in ((k, k) for k in SIDO_ORDER):
        cs = sorted([(k, c) for k, c in CFG["cities"].items() if c.get("sido", "경기") == sd], key=lambda kc: kc[1]["name"])
        if cs:
            g += f'<p>{label}</p>' + "".join(f'<a href="{BASE}/{k}/guide/">{c.get("sgg") or c["name"] + SIDOS[sd][2]} 학원·유치원·소아과</a>' for k, c in cs)
    src = src.replace("<!--GUIDES-->", f'<div class="lift guides"><h3>📍 동네 정보 모아보기</h3>{g}</div>')
    open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(src)
    for f in ("icon-192.png", "icon-512.png"):
        shutil.copy(os.path.join(HERE, "entry", f), d)
    # 2026-11-08: 입구 상단에도 대표 확정 로고(고객 앱과 같은 파일)를 씀 — 새 그림 아님, 복사만
    shutil.copy(os.path.join(HERE, "assets", "brand", "logo-symbol.png"), os.path.join(d, "img", "logo-symbol.png"))
    # 2026-11-09: 입구 실사풍 사진(033 Runway 생성 원본에서 자른 것 — app/entry/photos). 기존 삽화(hero-<구>)는 지우지 않고 보존
    ph = os.path.join(HERE, "entry", "photos")
    if os.path.isdir(ph):
        for f in os.listdir(ph):
            if f.endswith(".webp"): shutil.copy(os.path.join(ph, f), os.path.join(d, "img", f))
    for k in CFG["cities"]:
        own = os.path.join(HERE, "cities", k)
        if not os.path.isdir(own):   # 후보 도시(미리보기 빌드)는 그림 폴더가 없을 수 있음 → 대표 그림 자리 비움(경고만)
            print(f"  (후보) {k}: app/cities/{k} 없음 — 입구 그림·아이콘 생략"); continue
        shutil.copy(os.path.join(own, f"hero-{k}-800.webp"), os.path.join(d, "img"))
        shutil.copy(os.path.join(own, "icon-192.png"), os.path.join(d, "img", f"ic-{k}.png"))
    return d


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.path.dirname(HERE), "out"))
    ap.add_argument("--city", action="append")
    a = ap.parse_args()
    for c in a.city or list(CFG["cities"]) + ["entry"]:
        print("만듦:", build_entry(a.out) if c == "entry" else build(c, a.out))
