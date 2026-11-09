#!/usr/bin/env python3
"""병원 기관 ID(hpid)별 국립중앙의료원 공식 원자료 그대로 뽑기 v01후보 (2026-11-09, 피트 063 재검수 요청)

  WEATHER_KEY=… python3 tools/hosp_raw.py A1602873 A1234567 …  →  output/hosp_raw.json, output/hosp_raw.md

- 국립중앙의료원 '병·의원 기본정보 조회'(HsptlAsembySearchService/getHsptlBassInfoInqire)에 hpid 하나씩 물어 응답 필드를 고치지 않고 그대로 남김
- 빈 값은 빈 값 그대로(앱이 휴진·운영으로 바꿨는지 피트가 대조할 수 있게)
- 앱 수집본(review/<구>/hospitals.json)의 같은 기관 값을 옆에 붙임
- 공개 기관 정보만(개인정보 없음). 아무것도 공개·배포하지 않음
"""
import json, os, sys, time, urllib.parse, urllib.request, xml.etree.ElementTree as ET, glob
from datetime import datetime, timedelta, timezone
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
URL = "https://apis.data.go.kr/B552657/HsptlAsembySearchService/getHsptlBassInfoInqire"
KEY = os.environ.get("WEATHER_KEY", "").strip()
KST = timezone(timedelta(hours=9))
FIELDS = ["hpid", "dutyName", "dutyAddr", "dutyTel1", "dgidIdName", "dutyDivNam"] + [f"dutyTime{i}{x}" for i in range(1, 9) for x in "sc"] + ["dutyInf", "dutyEtc", "dutyLunch"]
DAY = ["월", "화", "수", "목", "금", "토", "일", "공휴일"]

def fetch(hpid):
    q = urllib.parse.urlencode({"serviceKey": urllib.parse.unquote(KEY), "HPID": hpid, "pageNo": 1, "numOfRows": 10})
    with urllib.request.urlopen(urllib.request.Request(f"{URL}?{q}", headers={"User-Agent": "airang-review"}), timeout=30) as r:
        txt = r.read().decode("utf-8", "replace")
    at = datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")
    root = ET.fromstring(txt)
    it = root.find(".//item")
    raw = {f: (it.findtext(f) if it is not None and it.find(f) is not None else None) for f in FIELDS} if it is not None else None
    return {"hpid": hpid, "fetched_at": at, "resultCode": root.findtext(".//resultCode"), "raw": raw,
            "raw_all_fields": ({c.tag: c.text for c in it} if it is not None else None)}

def app_row(hpid):
    for f in glob.glob("review/*/hospitals.json"):
        d = json.load(open(f, encoding="utf-8"))
        for k in ("clinics", "hospitals"):
            for x in d.get(k, []):
                if x.get("id") == hpid: return {"gu": f.split("/")[1], "collected": d.get("fetched_at"), **{k2: x.get(k2) for k2 in ("n", "a", "t", "p", "d", "h")}}
    return None

def main(ids):
    if not KEY: sys.exit("WEATHER_KEY 없음")
    out = []
    for h in ids:
        try: r = fetch(h)
        except Exception as e: r = {"hpid": h, "fetched_at": datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S"), "error": str(e)[:200]}
        r["app"] = app_row(h); out.append(r); time.sleep(0.5)
    os.makedirs("output", exist_ok=True)
    json.dump(out, open("output/hosp_raw.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    md = ["# 국립중앙의료원 원자료(고치지 않음) ↔ 앱 수집본", "", "빈 값은 '(빈 값)'으로 그대로 표시. 시간은 원자료 형식 HHMM.", ""]
    for r in out:
        raw, app = r.get("raw") or {}, r.get("app") or {}
        md += [f"## {raw.get('dutyName') or (app.get('n') or '')} — hpid {r['hpid']}", f"- 조회 시각(원자료): {r['fetched_at']} · 결과 코드 {r.get('resultCode')} {r.get('error','')}", f"- 앱 수집 시각: {app.get('collected')}",
               "", "| 항목 | 원자료 필드 = 값 | 앱에 들어간 값 |", "|---|---|---|",
               f"| 이름 | dutyName = {raw.get('dutyName') or '(빈 값)'} | {app.get('n')} |",
               f"| 주소 | dutyAddr = {raw.get('dutyAddr') or '(빈 값)'} | {app.get('a')} |",
               f"| 전화 | dutyTel1 = {raw.get('dutyTel1') or '(빈 값)'} | {app.get('t')} |",
               f"| 진료과목 | dgidIdName = {raw.get('dgidIdName') or '(빈 값)'} | 대표 {app.get('p') or '(없음)'} / 신고 {', '.join(app.get('d') or [])} |"]
        for i, d in enumerate(DAY, 1):
            s, c = raw.get(f"dutyTime{i}s"), raw.get(f"dutyTime{i}c")
            a = (app.get("h") or [""] * 8)[i - 1] or ""
            md.append(f"| {d} | dutyTime{i}s = {s or '(빈 값)'} · dutyTime{i}c = {c or '(빈 값)'} | {a[:4] + '~' + a[4:] if a else '(빈 칸 → 앱 표시: 정보 없음)'} |")
        extra = {k: v for k, v in (r.get("raw_all_fields") or {}).items() if k not in FIELDS and v}
        if extra: md.append(f"| 그 밖의 원자료 필드 | {json.dumps(extra, ensure_ascii=False)[:600]} | |")
        md.append("")
    open("output/hosp_raw.md", "w", encoding="utf-8").write("\n".join(md) + "\n")
    print("\n".join(md[:30]))

if __name__ == "__main__":
    main(sys.argv[1:])
