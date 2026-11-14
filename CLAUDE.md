# airang-cities — 클로드 작업 규칙 (131B v01, 2026-11-14)

아이랑 대전: 대전 5개 구(djdonggu djjunggu djseogu yuseong daedeok) 학부모 정보 앱(PWA).
**대표 = 최종 승인 · 피트(ChatGPT) = 기획·독립 검수 · 클로드 = 제작·자체 시험.**
작업 시작 전 프로젝트 문서 **「현재 상태판」 최신 판(131A…)**을 먼저 읽는다. 다른 사업(효자·살림과 장부·라그릴스·경영실) 코드와 자료는 섞지 않는다.

## 1. 승인 없이는 하지 않는 것
- `main` 에 커밋·병합·push (main = 운영. airang-stats `cf-apps` 가 main 만 배포하고 6시간마다 자동 실행)
- 운영 배포 실행, GitHub 저장소·계정 설정 변경, 공개 게시·광고, 결제·유료 서비스, 외부 계정 생성
- 병원·혜택 등 보류 자료 공개, 서울·경기 자료(`tools/safety_policy.json`)
- 기존 가지·보고서·원본 삭제, 강제 push, 덮어쓰기

## 2. 변경 절차 (모든 화면·기능 수정)
1. 백업 가지 `backup/before-<번호>` = 현재 `origin/main`
2. 수정 가지 `fix-<번호>` 에서 작업 → 로컬 시험(§3)
3. 시험 주소: `fix-ime-hosp` 에 합치고 airang-stats `hosp-preview` 워크플로에 확인 항목 추가 → 실행 결과 확인
4. 보고서(자동시험/클로드 육안/피트/대표 실기기 분리) → 피트 검수 → 대표 갤럭시 확인 → 대표 "승인"
5. 승인 뒤에만: main ← `fix-<번호>` (앞으로 감기 또는 병합, 자동 수집 커밋 보존) → cf-apps → 운영 주소 재확인
6. 되돌리기: main 을 `backup/before-<번호>` 로 되돌리고 cf-apps 재실행 (이것도 승인 필요)

## 3. 시험
- `npm ci && npx playwright install chromium` 처음 한 번 · `npm run qa`(전체) · `npm run qa:func`(디자인 제외)
- 시험 서버 `tools/qa/serve.py` 가 5개 구 + 입구를 임시로 만들어 띄움. GoatCounter 는 차단됨.
- 한글 조합 입력(IME)·글자 확대(130/150/200/300%) 시험은 tests/e2e 에 있다 — 검색칸·입력칸을 바꾸면 반드시 돌린다.
- **디자인 기준 20건 실패**(117 이전 문구 기준)는 대표가 기준 갱신을 결정하기 전까지 알려진 실패. 이게 남아 있으면 "전체 통과"라고 쓰지 않는다.
- 여러 시험을 한꺼번에 돌릴 때 생긴 실패는 해당 파일만 다시 돌려 구분해 적는다.
- 시험 뒤 `test-results/`, `tests/results`, `docs/design_qa/<날짜>` 는 저장소 밖으로 옮긴다(커밋하지 않음).
- 실제 갤럭시 "글자 최대"는 모의 180%보다 훨씬 크다(약 300%). 모의 통과 ≠ 실기기 통과.

## 4. 자료 (data/)
- 공개 전 검문: `tools/gate.py` + `tools/data_rules.json` + `tools/change_guard.py` · 감시: `tools/monitor.py`
- 공식 원문 확인(official_verify) 없으면 자동 검사를 통과해도 공개 보류. 사람 손으로 data/ 를 고치지 않는다.
- 자료의 main 반영은 airang-cities `promote-main` 워크플로(대표 계정 + '승인' 입력)로만.

## 5. 앱 코드 주의 (app/index.html)
- 검색칸 5개(q, acaq, kinq, hq, bnq)는 `.oninput` + `refocus(...)` 구조와 `$view.innerHTML` 보호(124)를 깨지 않는다.
- 큰 글자 대응 CSS 는 `@media (max-width:240px)` / `(max-width:200px)` 묶음에 있다.
- 개인 메일 주소를 화면에 넣지 않는다 — 문의는 `inqUrl(kind, screen)` → `/inquiry/`(127).
- 방문 통계: 검색어·전화번호를 화면 이름으로 보내지 않는다(047).

## 6. 보고
- 이름: `YYYY-MM-DD_아이랑대전_번호_작업명_vNN` → 프로젝트 문서 + 드라이브 04_아이랑_전용. 이전 판 보존.
- 상태는 완료 / 부분 완료 / 미완료 / 미확인 으로만. 시험하지 않은 것을 완료로 쓰지 않는다.
- 작업이 끝나면 「현재 상태판」을 새 판으로 갱신한다.
