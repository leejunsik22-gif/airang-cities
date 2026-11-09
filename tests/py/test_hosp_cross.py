"""수집기 두 공식 자료 대조·실패 동작 시험 (2026-11-09 A+B안, 피트 요청 2번) — 네트워크 없이 가짜 자료로
python3 tests/py/test_hosp_cross.py"""
import os, sys, json, tempfile
os.environ.update(CITY="유성", WEATHER_KEY="fake")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT); os.chdir(tempfile.mkdtemp())
import hospitals as H
R = []
def ok(name, cond): R.append(("통과" if cond else "실패", name))
C = [{"id": "A1", "n": "가나소아청소년과의원", "t": "042-111-1111", "a": "배울1로 1, 2층"},
     {"id": "A2", "n": "다라내과의원", "t": "042-222-2222", "a": "대학로 5"},
     {"id": "A3", "n": "마바소아과의원", "t": "042-333-3333", "a": "계룡로 9"},        # 심평원엔 '마바소아청소년과의원'(이름 변경, 전화·주소 같음)
     {"id": "A4", "n": "없는의원", "t": "042-444-4444", "a": "둔산로 7"}]              # 심평원에 없음
HR = [{"yadmNm": "가나소아청소년과의원", "telno": "042-111-1111", "addr": "대전광역시 유성구 배울1로 1, 2층 (관평동)", "ykiho": "Y1"},
      {"yadmNm": "다라내과의원", "telno": "042-999-9999", "addr": "대전광역시 유성구 대학로 5 (궁동)", "ykiho": "Y2"},
      {"yadmNm": "마바소아청소년과의원", "telno": "042-333-3333", "addr": "대전광역시 서구 계룡로 9", "ykiho": "Y3"}]
x = H.cross_check(C, HR)
ok("이름·전화·주소 일치 → 통과", x["A1"]["ok"])
ok("이름·주소 일치, 전화 다름 → 통과", x["A2"]["ok"])
ok("이름만 바뀜(전화·주소 같음) → 통과", x["A3"]["ok"])
ok("심평원에 없음 → 제외", not x["A4"]["ok"])

def run_main(hira_fn, nmc_fn):
    H.hira, H.nmc = hira_fn, nmc_fn
    try: H.main(); return "저장"
    except SystemExit as e: return "중단: " + str(e)
NMC = [{"hpid": c["id"], "dutyName": c["n"], "dutyTel1": c["t"], "dutyAddr": "대전광역시 유성구 " + c["a"], "dutyDivNam": "의원", "wgs84Lat": "36.3", "wgs84Lon": "127.3"} for c in C]
def nmc_ok(url, params): return NMC if url == H.HOURS else []
def nmc_fail(url, params): raise RuntimeError("국립중앙의료원 응답 없음")
def hira_fail(params): raise RuntimeError("심평원 응답 없음")
def hira_ok(params): return HR if params.get("clCd") == "31" else []
def hira_empty(params): return []
def hira_partial(params): return HR[:1] if params.get("clCd") == "31" else []
r = run_main(hira_fail, nmc_ok); ok(f"심평원 못 받음 → 저장 안 함 ({r[:40]})", r.startswith("중단") and not os.path.exists("output/hospitals.json"))
r = run_main(hira_empty, nmc_ok); ok(f"심평원 빈 목록 → 저장 안 함 ({r[:40]})", r.startswith("중단") and not os.path.exists("output/hospitals.json"))
r = run_main(hira_ok, nmc_fail); ok(f"국립중앙의료원 못 받음 → 저장 안 함 ({r[:40]})", r.startswith("중단") and not os.path.exists("output/hospitals.json"))
r = run_main(hira_partial, nmc_ok); ok(f"통과율 낮음(심평원 덜 옴) → 저장 안 함 ({r[:40]})", r.startswith("중단") and not os.path.exists("output/hospitals.json"))
H.CROSS_MIN_OK = 0.5
r = run_main(hira_ok, nmc_ok)
saved = json.load(open("output/hospitals.json", encoding="utf-8")) if os.path.exists("output/hospitals.json") else {}
names = [c["n"] for c in saved.get("clinics", [])]
ok(f"두 자료 다 있음 → 저장 ({r})", r == "저장")
ok("불일치 의원은 수집본에서 빠짐(목록·검색·상세 모두 없음)", "없는의원" not in names and len(names) == 3)
ok("통과 의원엔 cx=1, 제외 ID 기록", all(c.get("cx") == 1 for c in saved.get("clinics", [])) and saved.get("cross", {}).get("excluded_ids") == ["A4"])
for s, n in R: print(f"{s} | {n}")

# ── 2026-11-10: 공개 문에서 보류 유형(병원·약국·응급실) 비우기 ──
import tempfile as _tf, shutil as _sh, subprocess as _sp, datetime as _dt
def gate_case():
    d = _tf.mkdtemp(); inp, out, rev = [os.path.join(d, x) for x in ("in", "out", "rev")]
    os.makedirs(inp)
    today = _dt.date.today().isoformat()
    obj = {"updated": today, "clinics": [{"n": f"가상의원{i}", "cx": 1} for i in range(25)], "hospitals": [{"n": "가상병원"}], "pharm": [{"n": "가상약국"}], "er": [{"n": "가상응급실"}]}
    json.dump(obj, open(os.path.join(inp, "hospitals.json"), "w"), ensure_ascii=False)
    rules = json.load(open(os.path.join(ROOT, "tools/data_rules.json"), encoding="utf-8"))
    rules["files"]["hospitals.json"]["official_verify"] = "확인 완료"   # 시험에서만 '공개 승인된 상태'를 흉내(실제 규칙 파일은 안 바꿈)
    tools = os.path.join(d, "tools"); _sh.copytree(os.path.join(ROOT, "tools"), tools, ignore=_sh.ignore_patterns("__pycache__"))
    json.dump(rules, open(os.path.join(tools, "data_rules.json"), "w"), ensure_ascii=False)
    r = _sp.run([sys.executable, os.path.join(tools, "gate.py"), "--city", "yuseong", "--in", inp, "--out", out, "--review", rev, "--only", "hospitals.json", "--no-guard", "--changes", ""], capture_output=True, text=True)
    pub = json.load(open(os.path.join(out, "hospitals.json"), encoding="utf-8")) if os.path.exists(os.path.join(out, "hospitals.json")) else None
    full = json.load(open(os.path.join(rev, "hospitals.json"), encoding="utf-8")) if os.path.exists(os.path.join(rev, "hospitals.json")) else None
    st = json.load(open(os.path.join(out, "_status.json"), encoding="utf-8"))["files"]["hospitals.json"]
    return r, pub, full, st
r, pub, full, st = gate_case()
ok("공개 문: 공개본에 의원 25곳 그대로", bool(pub) and len(pub["clinics"]) == 25)
ok("공개 문: 공개본의 병원·약국·응급실은 빈 목록 + held_parts 표시", bool(pub) and pub["hospitals"] == [] and pub["pharm"] == [] and pub["er"] == [] and pub.get("held_parts") == ["hospitals", "pharm", "er"])
ok("공개 문: 전체 수집본은 비공개 검토 폴더에 보존", bool(full) and len(full["pharm"]) == 1 and len(full["er"]) == 1)
ok("공개 문: 상태 파일에 보류 유형 기록", st.get("published") is True and st.get("held_parts") == ["hospitals", "pharm", "er"])
ok("실제 규칙 파일은 아직 공개 보류(부분 확인)", json.load(open(os.path.join(ROOT, "tools/data_rules.json"), encoding="utf-8"))["files"]["hospitals.json"]["official_verify"] == "부분 확인")
for s_, n_ in R[-5:]: print(s_, '|', n_)
print("합계", sum(s == "통과" for s, _ in R), "/", len(R)); sys.exit(0 if all(s == "통과" for s, _ in R) else 1)
