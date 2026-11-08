# 디자인 차이 점검 — 2026-11-09
기준 origin/main(274327b) ↔ 검수 가지 HEAD(98b6af1) · 자료는 양쪽 동일(디자인만 비교)

## 디자인 파일 차이
```
M	app/build.py
M	app/entry/index.html
M	app/index.html

app/build.py         | 2 ++
 app/entry/index.html | 7 ++++---
 app/index.html       | 1 +
 3 files changed, 7 insertions(+), 3 deletions(-)
```

## 화면 화소 차이(2배 화질, 차이 기준 밝기 24 초과)
| 화면 | 폭 | 다른 화소 | 그림 |
|---|---|---|---|
| entry | 390 | 1.40% | diff_entry_390.jpg |
| yuseong_home | 390 | 0.00% | diff_yuseong_home_390.jpg |
| entry | 1280 | 0.59% | diff_entry_1280.jpg |
| yuseong_home | 1280 | 0.00% | diff_yuseong_home_1280.jpg |

## 대표 확정 원본 ↔ 실제
compare_approved_yuseong_390.jpg (원본 / 운영 / 검수 가지 나란히)

승인된 차이: 상단 로고·이름 뒤 반투명 흰 받침(044-5 사진 위 대비 보완(피트 지시 2026-11-05 4항), 운영 반영 대표 승인 2026-11-07)
