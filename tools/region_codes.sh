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
import glob,io
want=["광주","경주시","금산군","충주시","제천시","단양군","청주시","군위군","세종특별자치시","울산광역시","부산광역시","대구광역시","대전광역시"]
for fn in glob.glob("z_*/*.txt")+glob.glob("z_*/*/*.txt"):
    raw=open(fn,"rb").read()
    for enc in ("cp949","utf-8"):
        try: s=raw.decode(enc); break
        except: pass
    lines=s.splitlines(); print("FILE",fn,len(lines)); print(" HEAD",lines[0][:120])
    for L in lines:
        p=L.split("\t")
        if len(p)<2: continue
        code,name=p[0].strip(),p[1].strip()
        # 시·군·구 단위만(법정동 10자리 뒤 5자리가 00000)
        if len(code)==10 and code.endswith("00000") and any(w in name for w in want):
            print(" ",code,name,"|"," ".join(x.strip() for x in p[2:4]))
PY
