#!/usr/bin/env bash
# 행정안전부 법정동코드 전체 파일(2026-07-01 시행)에서 후보 지역 코드 확인 — 읽기만
set -u
P="https://www.mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000052&nttId=127039"
curl -sL -A "Mozilla/5.0" "$P" -o page.html; echo "page $(wc -c < page.html)"
grep -o "fn_egov_downFile('[^']*','[^']*')\|atchFileId=[^\"&']*[^\"']*\|fileDown[^\"']*" page.html | head -20
python3 - <<'PY'
import re,html
s=open("page.html",encoding="utf-8",errors="ignore").read()
for m in re.finditer(r"(fn_egov_downFile|fileDown)[^<]{0,200}", s): print("A:", html.unescape(m.group(0))[:200])
for m in re.finditer(r"jscode[^<\"']{0,60}", s): print("F:", m.group(0))
PY
