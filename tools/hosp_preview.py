"""갤럭시 확인용 시험 주소 병원 자료 만들기 v01후보 (2026-11-10, 대표 승인 '임시 주소 생성')
- 원본: main 가지의 비공개 검토본 review/<구>/hospitals.json (2026-11-09 수집)
- 대조 결과: tests/fixtures_hosp_cross.json (11-09 실제 두 공식 자료 대조 결과, 1=통과)
- 넣는 것: 대조 통과 의원만. 확인 전 제외 목록(tools/hosp_hold.json)은 뺌. 병원·약국·응급실은 빈 목록(이번 시험 범위 밖)
  python3 tools/hosp_preview.py preview      → preview/<구>/hospitals.json
"""
import json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUS = ["djdonggu", "djjunggu", "djseogu", "yuseong", "daedeok"]
PARTS_HELD = ["hospitals", "pharm", "er"]

def main(out):
    cross = json.load(open(os.path.join(ROOT, "tests/fixtures_hosp_cross.json"), encoding="utf-8"))
    hold = set(json.load(open(os.path.join(ROOT, "tools/hosp_hold.json"), encoding="utf-8"))["ids"])
    tot = {}
    for g in GUS:
        raw = json.loads(subprocess.check_output(["git", "show", f"origin/main:review/{g}/hospitals.json"], cwd=ROOT))
        cl = raw["clinics"]
        ok = [dict(x, cx=1) for x in cl if cross[g].get(x.get("id"), 0) & 1 and x.get("id") not in hold]
        held = sorted(x["id"] for x in cl if x.get("id") in hold)
        raw["clinics"] = ok
        for k in PARTS_HELD: raw[k] = []
        raw["held_parts"] = PARTS_HELD
        raw["cross"] = {"checked": len(cl), "ok": len(ok) + len(held), "held_ids": held, "excluded_ids": sorted(x.get("id") or "" for x in cl if not cross[g].get(x.get("id"), 0) & 1), "src": "건강보험심사평가원 병원정보서비스", "at": "2026-11-09"}
        raw["preview"] = "시험 주소 전용 — 운영 공개 아님 (2026-11-10)"
        os.makedirs(os.path.join(out, g), exist_ok=True)
        json.dump(raw, open(os.path.join(out, g, "hospitals.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        kids = [x for x in ok if x.get("p") == "소아청소년과"]
        tot[g] = (len(cl), len(ok), len(raw["cross"]["excluded_ids"]), held, len(kids))
        print(f"{g:9} 의원 {len(cl)} → 공개 후보 {len(ok)} (대조 불일치 {len(raw['cross']['excluded_ids'])}, 확인 전 제외 {held}) · 동네 소아과 {len(kids)}")
    return tot

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "preview")
