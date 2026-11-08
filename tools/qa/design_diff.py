#!/usr/bin/env python3
"""운영 main ↔ 검수 가지 디자인 차이 + 대표 확정 원본 ↔ 실제 화면 전후 비교 (v01후보, 2026-11-08)

  python3 tools/qa/design_diff.py [기준가지=origin/main]

하는 일(읽기 전용 — 운영·배포 변경 없음):
 1) 디자인 파일 차이 목록: app/index.html·app/entry·app/assets·app/cities·app/build.py
 2) 두 판을 각각 임시 폴더에 만들어 띄우고, 입구·유성 홈을 390·1280 으로 찍어 화소 차이(%)와 차이 표시 그림 저장
 3) 대표 확정 원본 그림 ↔ 검수 가지 390 화면을 나란히 붙인 비교 그림 저장
결과: docs/design_qa/<날짜>/diff_*.jpg, compare_*.jpg, design_diff.md
"""
import datetime, functools, http.server, json, os, shutil, subprocess, sys, tempfile, threading
from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE_REF = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
DAY = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=9)).strftime("%Y-%m-%d")
OUT = os.path.join(ROOT, "docs", "design_qa", DAY)
os.makedirs(OUT, exist_ok=True)
B = json.load(open(os.path.join(ROOT, "tools", "qa", "design_baseline.json"), encoding="utf-8"))
DESIGN_PATHS = ["app/index.html", "app/entry", "app/assets", "app/cities", "app/build.py"]
SHOTS = [("entry", "/entry/", 390), ("yuseong_home", "/yuseong/", 390), ("entry", "/entry/", 1280), ("yuseong_home", "/yuseong/", 1280)]

def sh(*a, cwd=ROOT):
    return subprocess.run(a, cwd=cwd, check=True, capture_output=True, text=True).stdout

def build(src_root, label):
    out = os.path.join(tempfile.gettempdir(), f"airang-design-{label}")
    shutil.rmtree(out, ignore_errors=True)
    subprocess.run([sys.executable, os.path.join(src_root, "app", "build.py"), "--out", out], cwd=src_root, check=True, stdout=subprocess.DEVNULL)
    cities = json.load(open(os.path.join(src_root, "app", "cities.json"), encoding="utf-8"))["cities"]
    for c in cities:   # 자료는 두 판 모두 현재 작업본 것(디자인만 비교)
        if os.path.isdir(os.path.join(ROOT, "data", c)):
            shutil.copytree(os.path.join(ROOT, "data", c), os.path.join(out, c, "data"), dirs_exist_ok=True)
    return out

def serve(folder):
    H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=folder)
    H.func.log_message = lambda *a: None
    s = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, f"http://127.0.0.1:{s.server_address[1]}"

def capture(url_base, label):
    from playwright.sync_api import sync_playwright
    files = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, path, w in SHOTS:
            ctx = b.new_context(viewport={"width": w, "height": 844 if w < 700 else 800}, device_scale_factor=2, is_mobile=w < 700, has_touch=w < 700, locale="ko-KR")
            pg = ctx.new_page()
            pg.route("**/*", lambda r: r.abort() if any(x in r.request.url for x in ("goatcounter.com", "gc.zgo.at", "raw.githubusercontent.com")) else r.continue_())
            pg.goto(url_base + path, wait_until="networkidle"); pg.wait_for_timeout(500)
            f = os.path.join(tempfile.gettempdir(), f"dd_{label}_{name}_{w}.png")
            pg.screenshot(path=f); files[(name, w)] = f; ctx.close()
        b.close()
    return files

def font(sz):
    for f in ("/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc", os.path.expanduser("~/.fonts/NotoSansKR-Bold.ttf")):
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    import glob
    g = glob.glob(os.path.expanduser("~/.fonts/**/*NotoSansKR*"), recursive=True) + glob.glob("/usr/share/fonts/**/*CJK*", recursive=True)
    return ImageFont.truetype(g[0], sz) if g else ImageFont.load_default()

def side_by_side(imgs, titles, out):
    h = max(i.height for i in imgs); pad = 70
    canvas = Image.new("RGB", (sum(i.width for i in imgs) + 30 * (len(imgs) + 1), h + pad + 30), "white")
    d = ImageDraw.Draw(canvas); x = 30; F = font(30)
    for im, t in zip(imgs, titles):
        canvas.paste(im, (x, pad)); d.text((x, 18), t, fill=(31, 42, 68), font=F); x += im.width + 30
    canvas.save(out, quality=82)

def main():
    head = sh("git", "rev-parse", "--short", "HEAD").strip(); base = sh("git", "rev-parse", "--short", BASE_REF).strip()
    stat = sh("git", "diff", "--stat", f"{BASE_REF}...HEAD", "--", *DESIGN_PATHS).strip() or "(차이 없음)"
    names = sh("git", "diff", "--name-status", f"{BASE_REF}...HEAD", "--", *DESIGN_PATHS).strip() or "(차이 없음)"
    wt = os.path.join(tempfile.gettempdir(), "airang-design-base-src")
    subprocess.run(["git", "worktree", "remove", "--force", wt], cwd=ROOT, capture_output=True)
    sh("git", "worktree", "add", "--detach", wt, BASE_REF)
    try:
        s1, u1 = serve(build(wt, "base")); s2, u2 = serve(build(ROOT, "head"))
        A, Bf = capture(u1, "base"), capture(u2, "head")
        s1.shutdown(); s2.shutdown()
    finally:
        subprocess.run(["git", "worktree", "remove", "--force", wt], cwd=ROOT, capture_output=True)
    rows = []
    for key in A:
        a, b = Image.open(A[key]).convert("RGB"), Image.open(Bf[key]).convert("RGB")
        if a.size != b.size: b = b.resize(a.size)
        diff = ImageChops.difference(a, b).convert("L").point(lambda v: 255 if v > 24 else 0)
        pct = 100.0 * sum(1 for v in diff.tobytes() if v) / (a.width * a.height)
        mark = b.copy(); red = Image.new("RGB", b.size, (230, 40, 40)); mark.paste(red, mask=diff)
        name, w = key; f = f"diff_{name}_{w}.jpg"
        side_by_side([x.resize((x.width // 2, x.height // 2)) for x in (a, b, mark)], [f"운영 main {base}", f"검수 가지 {head}", "다른 곳(빨강)"], os.path.join(OUT, f))
        rows.append((name, w, pct, f))
    # 대표 확정 원본 ↔ 검수 가지(유성 홈 390) / 운영 main
    ap = Image.open(os.path.join(ROOT, B["approved_image"])).convert("RGB")
    def fit(im, h=1400): return im.resize((round(im.width * h / im.height), h))
    side_by_side([fit(ap), fit(Image.open(A[("yuseong_home", 390)])), fit(Image.open(Bf[("yuseong_home", 390)]))],
                 ["대표 확정 원본(11-05)", f"운영 main {base}", f"검수 가지 {head}"], os.path.join(OUT, "compare_approved_yuseong_390.jpg"))
    md = [f"# 디자인 차이 점검 — {DAY}", f"기준 {BASE_REF}({base}) ↔ 검수 가지 HEAD({head}) · 자료는 양쪽 동일(디자인만 비교)", "",
          "## 디자인 파일 차이", "```", names, "", stat, "```", "", "## 화면 화소 차이(2배 화질, 차이 기준 밝기 24 초과)", "| 화면 | 폭 | 다른 화소 | 그림 |", "|---|---|---|---|"]
    md += [f"| {n} | {w} | {p:.2f}% | {f} |" for n, w, p, f in rows]
    md += ["", "## 대표 확정 원본 ↔ 실제", "compare_approved_yuseong_390.jpg (원본 / 운영 / 검수 가지 나란히)",
           "", "승인된 차이: " + "; ".join(f"{d['항목']}({d['근거']})" for d in B["approved_deviations"])]
    open(os.path.join(OUT, "design_diff.md"), "w", encoding="utf-8").write("\n".join(md) + "\n")
    print("\n".join(md))

if __name__ == "__main__":
    main()
