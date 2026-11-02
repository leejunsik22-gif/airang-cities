#!/usr/bin/env python3
"""P0-4 진료과목 표시 왜곡 수정 (2026-11-03)
- 의원 이름에 든 진료과(정신건강의학과·성형외과·비뇨의학과 … 전부)를 대표 과목 p 로 둔다.
- 국립중앙의료원 진료과 코드로 붙은 과목(d)은 '신고 과목'으로 남기되 대표 과목을 맨 앞에 둔다.
- 앱은 p 를 먼저 보여 주고 나머지는 "신고 과목"으로 구분 표시한다.
사용: python3 tools/fix_depts.py data/<구>/hospitals.json ...   (수집기 hospitals.py 에도 같은 규칙 적용)
"""
import json, re, sys

# 긴·구체적인 이름을 먼저 본다(정형외과 → 외과, 신경외과 → 신경과, 정신건강 → 신경 … 순서가 중요)
ORDER = [("치과", "치과"), ("정신건강의학과", "정신건강|정신과|신경정신"), ("심장혈관흉부외과", "심장혈관흉부"), ("흉부외과", "흉부외과"),
         ("신경외과", "신경외과"), ("정형외과", "정형외과"), ("성형외과", "성형외과"), ("마취통증의학과", "마취통증"), ("통증의학과", "통증의학"),
         ("재활의학과", "재활의학"), ("비뇨의학과", "비뇨의학"), ("비뇨기과", "비뇨기"), ("영상의학과", "영상의학"), ("직업환경의학과", "직업환경"),
         ("응급의학과", "응급의학"), ("예방의학과", "예방의학"), ("핵의학과", "핵의학"), ("진단검사의학과", "진단검사"), ("병리과", "병리과"),
         ("방사선종양학과", "방사선종양"), ("결핵과", "결핵"), ("신경과", "신경과"), ("외과", "외과"), ("소아청소년과", "소아"), ("이비인후과", "이비인후"),
         ("피부과", "피부과"), ("안과", "안과"), ("산부인과", "산부인|여성의원|여성병원"), ("가정의학과", "가정의학"), ("내과", "내과"), ("한방", "한의원|한방")]


def primary_of(name):
    for sp, hint in ORDER:
        if re.search(hint, name):
            return sp
    return ""


def fix(rec):
    name = rec.get("n", "")
    p = primary_of(name)
    d = list(rec.get("d") or [])
    if rec.get("k", "").startswith("치과"):
        p = "치과"; d = ["치과"]
    if p:
        d = [p] + [x for x in d if x != p]
    rec["p"] = p
    rec["d"] = d
    return bool(p)


if __name__ == "__main__":
    for path in sys.argv[1:]:
        o = json.load(open(path, encoding="utf-8"))
        n = sum(fix(r) for r in o.get("clinics", []))
        for r in o.get("hospitals", []): fix(r)
        json.dump(o, open(path, "w", encoding="utf-8"), ensure_ascii=False)
        print(f"{path}: 대표 과목 확정 {n}/{len(o.get('clinics', []))}곳")
