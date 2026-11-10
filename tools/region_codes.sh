#!/usr/bin/env bash
# 행정안전부 법정동코드 전체 파일(2026-07-01 시행)에서 후보 지역 코드 확인 — 읽기만
set -u
P="https://www.mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000052&nttId=127039"
curl -sL -A "Mozilla/5.0" "$P" -o page.html
path=$(grep -o '[^"'"'"' ]*FileDown[^"'"'"' ?]*' page.html | head -1); echo "path=$path"
mkdir -p dl && cd dl
for n in 0 1 2 3 4 5 6 7 8; do
  u="https://www.mois.go.kr${path}?atchFileId=FILE_00146280tlU2Y2B&fileSn=$n"
  curl -sL -A "Mozilla/5.0" -e "$P" -D h$n.txt "$u" -o f$n
  nm=$(grep -i "content-disposition" h$n.txt | tail -1 | tr -d '\r'); echo "fileSn=$n $(wc -c < f$n)B $(file -b f$n | cut -c1-40) | $nm" | cut -c1-260
done
for f in f*; do if file -b $f | grep -qi zip; then mkdir -p z_$f && (cd z_$f && unzip -qo -O cp949 ../$f 2>/dev/null || unzip -qo ../$f); ls z_$f; fi; done
python3 - <<'PY'
import re
want=["광주","경주시","금산군","충주시","제천시","단양군","청주시","군위군","세종특별자치시","울산광역시","부산광역시","대구광역시","대전광역시"]
def rd(fn):
    raw=open(fn,"rb").read()
    for enc in ("cp949","utf-8"):
        try: return raw.decode(enc).splitlines()
        except: pass
for fn,tag in [("z_f0/jscode20260701/KIKcd_B.20260701","현행"),("z_f1/jscode20260701(말소코드포함)/KIKcd_B.20260701(말소코드포함)","말소포함")]:
    print("==",tag)
    for L in rd(fn)[1:]:
        code=L[:10]
        if not code.isdigit() or not code.endswith("00000"): continue
        t=" ".join(L[10:].split())
        if not any(w in t for w in want): continue
        if tag=="말소포함" and not re.search(r"\d{8}\s+\d{8}$", t): continue   # 말소된 것만
        if tag=="말소포함" and not ("광주" in t or "전라남도" in t): continue
        print(" ",code,t)
PY
