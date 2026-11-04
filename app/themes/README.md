# 아이랑 테마·사계절 구조 v01후보 (2026-11-03)

- `common.json` 공통 브랜드 값 · `<시도>.json` 지역 테마(봄·여름·가을·겨울 4칸: colors 덮어쓰기, tagline, hero 파일 이름, 이미지 출처·사용권·제작일·후보/승인 버전) · `applied.json` 지금 운영에 적용된 시즌(대표 승인 기록 포함).
- 빌드(`app/build.py`): `applied.json`의 season이 비어 있으면 **기본 디자인(현재 운영본)** 그대로. season이 있고 approved_by/approved_at이 모두 있으면 그 시즌의 colors를 덮어쓰고, `app/cities/<키>/hero-<키>-<season>-800.webp`(와 1200 크기)가 있으면 그 그림을 쓴다. 승인 기록이 없으면 무시하고 경고.
- 미리보기: `AIRANG_SEASON=spring python3 app/build.py --out <폴더>` 로 승인 없이 로컬 확인(배포 아님).
- 이미지 원본·사용권은 `docs/이미지_관리표.md`에 함께 기록. 피트가 시안·이미지 방향을 맡고, 클로드는 구조·빌드·시험만 담당.
- 공식 생활정보 수집(매일)과 시즌 디자인 교체(연 4회, 별도 승인)는 서로 독립.
