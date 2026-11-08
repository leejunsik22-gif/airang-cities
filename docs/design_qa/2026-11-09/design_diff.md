# 디자인 차이 점검 — 2026-11-09
기준 origin/main(274327b) ↔ 검수 가지 HEAD(d0fdf73) · 자료는 양쪽 동일(디자인만 비교)

## 디자인 파일 차이
```
M	app/build.py
M	app/entry/index.html
A	app/entry/photos/card-daedeok-1600.webp
A	app/entry/photos/card-daedeok-800.webp
A	app/entry/photos/card-djdonggu-1600.webp
A	app/entry/photos/card-djdonggu-800.webp
A	app/entry/photos/card-djjunggu-1600.webp
A	app/entry/photos/card-djjunggu-800.webp
A	app/entry/photos/card-djseogu-1600.webp
A	app/entry/photos/card-djseogu-800.webp
A	app/entry/photos/card-yuseong-1600.webp
A	app/entry/photos/card-yuseong-800.webp
A	app/entry/photos/entry-main-1600.webp
A	app/entry/photos/entry-main-800.webp
M	app/index.html

app/build.py                             |   7 +++++++
 app/entry/index.html                     |  12 +++++++-----
 app/entry/photos/card-daedeok-1600.webp  | Bin 0 -> 112912 bytes
 app/entry/photos/card-daedeok-800.webp   | Bin 0 -> 37380 bytes
 app/entry/photos/card-djdonggu-1600.webp | Bin 0 -> 74052 bytes
 app/entry/photos/card-djdonggu-800.webp  | Bin 0 -> 30762 bytes
 app/entry/photos/card-djjunggu-1600.webp | Bin 0 -> 77700 bytes
 app/entry/photos/card-djjunggu-800.webp  | Bin 0 -> 24128 bytes
 app/entry/photos/card-djseogu-1600.webp  | Bin 0 -> 90846 bytes
 app/entry/photos/card-djseogu-800.webp   | Bin 0 -> 32254 bytes
 app/entry/photos/card-yuseong-1600.webp  | Bin 0 -> 79530 bytes
 app/entry/photos/card-yuseong-800.webp   | Bin 0 -> 24558 bytes
 app/entry/photos/entry-main-1600.webp    | Bin 0 -> 131090 bytes
 app/entry/photos/entry-main-800.webp     | Bin 0 -> 37842 bytes
 app/index.html                           |   5 +++--
 15 files changed, 17 insertions(+), 7 deletions(-)
```

## 화면 화소 차이(2배 화질, 차이 기준 밝기 24 초과)
| 화면 | 폭 | 다른 화소 | 그림 |
|---|---|---|---|
| entry | 390 | 23.74% | diff_entry_390.jpg |
| yuseong_home | 390 | 0.00% | diff_yuseong_home_390.jpg |
| entry | 1280 | 13.38% | diff_entry_1280.jpg |
| yuseong_home | 1280 | 0.00% | diff_yuseong_home_1280.jpg |

## 대표 확정 원본 ↔ 실제
compare_approved_yuseong_390.jpg (원본 / 운영 / 검수 가지 나란히)

승인된 차이: 상단 로고·이름 뒤 반투명 흰 받침(044-5 사진 위 대비 보완(피트 지시 2026-11-05 4항), 운영 반영 대표 승인 2026-11-07)
