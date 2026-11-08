#!/usr/bin/env python3
"""자동 검사용 로컬 시험 서버 (운영과 무관).
app/build.py 로 5개 구 + 입구를 임시 폴더에 만들고, 각 구 data/ 를 복사한 뒤 PORT 로 띄운다.
  python3 tools/qa/serve.py [PORT]
"""
import http.server, json, os, shutil, subprocess, sys, tempfile, functools
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
out = os.path.join(tempfile.gettempdir(), "airang-qa-site")
shutil.rmtree(out, ignore_errors=True)
subprocess.run([sys.executable, os.path.join(ROOT, "app", "build.py"), "--out", out], check=True, cwd=ROOT,
               stdout=subprocess.DEVNULL)
cities = json.load(open(os.path.join(ROOT, "app", "cities.json"), encoding="utf-8"))["cities"]
for c in cities:
    src = os.path.join(ROOT, "data", c)
    if os.path.isdir(src):
        shutil.copytree(src, os.path.join(out, c, "data"), dirs_exist_ok=True)
print(f"시험 서버: http://localhost:{PORT}/  ({', '.join(cities)} + entry)", flush=True)
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=out)
H.func.log_message = lambda *a: None
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
