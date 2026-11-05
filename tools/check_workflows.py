#!/usr/bin/env python3
"""배포·수집 가지 고정 자동 검사 v01후보 (2026-11-05) — 재발 방지용.

  python3 tools/check_workflows.py [--cities 경로] [--stats 경로]

규칙(운영 배포는 승인된 main 기준, 다른 가지가 실수로 배포·수집되지 않게):
 C1 airang-cities 의 자료 수집 워크플로(daily·weather·hospitals)는 `ref: main` 으로 받고, `git push origin HEAD:main` 으로만 올린다. 그리고 가지 확인 단계가 있다.
 C2 promote-main 은 main 을 받고 옮겨온 자료에 검문(gate)을 다시 돌린다(A안 우회 방지).
 S1 airang-stats cf-apps 는 airang-cities 를 `ref: main` 으로만 받고, 받은 것이 main 그 자체인지 확인하는 단계가 있다.
 S2 cf-apps 작업은 `if: github.ref == 'refs/heads/main'` 로 자기 가지도 main 일 때만 돈다.
 S3 cf-apps 는 빌드 폴더가 운영 도시(cities.json)+입구 뿐인지 확인한다.
 X  어느 워크플로도 airang-cities 를 ref 없이(기본 가지로) 받지 않는다.
표준 라이브러리 + PyYAML(있으면). 실패하면 종료 코드 1.
"""
import argparse, glob, os, re, sys

def read(p):
    return open(p, encoding="utf-8").read()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cities", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ap.add_argument("--stats", default="")
    a = ap.parse_args()
    bad, ok = [], []
    wf = os.path.join(a.cities, ".github", "workflows")
    for name in ["daily", "weather", "hospitals", "monitor"]:
        p = os.path.join(wf, name + ".yml")
        if not os.path.exists(p): bad.append(f"C1 {name}.yml 없음"); continue
        s = read(p)
        if not re.search(r"checkout@v4\s*\n\s*with:\s*\{\s*ref:\s*main", s): bad.append(f"C1 {name}.yml: checkout 에 ref: main 없음")
        if "git push origin HEAD:main" not in s: bad.append(f"C1 {name}.yml: 'git push origin HEAD:main' 아님")
        if re.search(r"git push\s*&&", s) or re.search(r"git push\s*$", s, re.M): bad.append(f"C1 {name}.yml: 가지 지정 없는 git push 있음")
        if "운영 가지 확인" not in s: bad.append(f"C1 {name}.yml: 가지 확인 단계 없음")
        if not any(x.startswith(f"C1 {name}") for x in bad): ok.append(f"C1 {name}.yml")
    p = os.path.join(wf, "promote-main.yml")
    if os.path.exists(p):
        s = read(p)
        if "ref: main" not in s: bad.append("C2 promote-main.yml: main 을 받지 않음")
        if "tools/gate.py" not in s: bad.append("C2 promote-main.yml: 옮겨온 자료에 검문(gate) 재실행 없음")
        if not any(x.startswith("C2") for x in bad): ok.append("C2 promote-main.yml")
    else:
        bad.append("C2 promote-main.yml 없음")
    # X: any checkout of airang-cities without ref
    for p in glob.glob(os.path.join(wf, "*.yml")) + (glob.glob(os.path.join(a.stats, ".github", "workflows", "*.yml")) if a.stats else []):
        s = read(p)
        for m in re.finditer(r"repository:\s*leejunsik22-gif/airang-cities[^\n]*", s):
            if "ref:" not in m.group(0): bad.append(f"X {os.path.basename(p)}: airang-cities 를 ref 없이 받음 → {m.group(0)[:80]}")
    if a.stats:
        p = os.path.join(a.stats, ".github", "workflows", "cf-apps.yml")
        if not os.path.exists(p): bad.append("S1 cf-apps.yml 없음")
        else:
            s = read(p)
            if "repository: leejunsik22-gif/airang-cities, ref: main" not in s: bad.append("S1 cf-apps.yml: airang-cities 를 ref: main 으로 받지 않음")
            if "배포 원본 확인" not in s or "ls-remote" not in s: bad.append("S1 cf-apps.yml: 받은 것이 main 그 자체인지 확인하는 단계 없음")
            if not re.search(r"if:\s*github\.ref == 'refs/heads/main'", s): bad.append("S2 cf-apps.yml: 작업에 main 가지 조건(if) 없음")
            if "빌드 폴더" not in s or "cities.json" not in s: bad.append("S3 cf-apps.yml: 빌드 폴더(운영 도시+입구) 확인 없음")
            for k in ["S1", "S2", "S3"]:
                if not any(x.startswith(k) for x in bad): ok.append(f"{k} cf-apps.yml")
    for x in ok: print("  ✓", x)
    for x in bad: print("  ✗", x)
    print(f"통과 {len(ok)} / 실패 {len(bad)}")
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
