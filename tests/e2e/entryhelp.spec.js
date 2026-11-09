// 입구 설치 안내·문의하기 검사 v01후보 (2026-11-09, 피트 의견·대표 승인)
// ① 두 버튼이 '내 위치로 우리 구 찾기' 버튼 아래에 있음  ② 설치 안내 시트에 갤럭시 크롬 단계
// ③ 문의 시트: 세 유형 + 아이 이름·학교·건강정보 금지 문구, 메일 본문에도 같은 문구  ④ 닫기(×·Esc·바깥)
const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.route(/goatcounter\.com|gc\.zgo\.at|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.goto("/entry/"); await page.waitForLoadState("networkidle");
});

test("설치 안내·문의하기가 구 선택·내 위치 버튼 아래에 있음", async ({ page }) => {
  const y = await page.evaluate(() => ({
    grid: document.querySelector("#groups").getBoundingClientRect().bottom,
    loc: document.querySelector(".locate").getBoundingClientRect().bottom,
    row: document.querySelector(".help-row").getBoundingClientRect().top,
    sx: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  }));
  expect(y.row).toBeGreaterThan(y.loc);
  expect(y.loc).toBeGreaterThan(y.grid);
  expect(y.sx, "가로 밀림").toBe(false);
  await expect(page.locator("#btn-install")).toHaveText(/홈 화면에 추가해 보세요/);
  await expect(page.locator("#btn-contact"), "문의하기는 전용 메일 준비 전 비공개").toHaveCount(0);
  for (const id of ["#btn-install"]) {   // 한 줄로, 잘리지 않게
    const m = await page.locator(id).evaluate((e) => ({ h: e.getBoundingClientRect().height, cut: e.scrollWidth > e.clientWidth + 1 }));
    expect(m.h, `${id} 한 줄`).toBeLessThanOrEqual(50); expect(m.cut, `${id} 글자 잘림`).toBe(false);
  }
});

test("설치 안내: 갤럭시 크롬 단계 + 닫기", async ({ page }) => {
  await page.locator("#btn-install").click();
  const sh = page.locator("#help-sheet .sheet");
  await expect(sh).toBeVisible();
  for (const t of ["우리 구", "⋮", "홈 화면에 추가", "설치"]) await expect(sh).toContainText(t);
  await page.keyboard.press("Escape");
  await expect(page.locator("#help-sheet")).toHaveCount(0);
  await expect(page.locator("#btn-install")).toBeFocused();   // 닫으면 누른 버튼으로 돌아감
});

test.skip("문의하기(전용 메일 준비 후 공개 — entry-help 가지): 세 유형 · 개인정보 금지 문구 · 메일 제목/본문", async ({ page }) => {
  await page.locator("#btn-contact").click();
  const sh = page.locator("#help-sheet .sheet");
  await expect(sh.locator(".warn")).toContainText("아이 이름·학교·건강 정보는 적지 말아 주세요");
  const picks = sh.locator("a.pick");
  await expect(picks).toHaveCount(3);
  const want = { fix: ["정보 수정·오류 신고", ["틀린 내용"]], use: ["이용 문의", ["문의 내용"]], ad: ["광고·제휴 문의", ["업체명", "담당자 이름·연락처", "제안 내용"]] };
  for (const [kind, [subj, fields]] of Object.entries(want)) {
    const href = await sh.locator(`a.pick[data-kind="${kind}"]`).getAttribute("href");
    const u = new URL(href);
    expect(u.protocol).toBe("mailto:");
    expect(u.searchParams.get("subject")).toContain(subj);
    const body = u.searchParams.get("body");
    for (const f of fields) expect(body).toContain(f);
    expect(body, "메일 본문 개인정보 금지 문구").toContain("아이 이름·학교·건강 정보는 적지 말아 주세요");
  }
  await expect(sh.locator('a.pick[data-kind="ad"]')).toContainText("검색 순서는 바꾸지 않아요");
  await page.locator("#help-sheet .x").click();
  await expect(page.locator("#help-sheet")).toHaveCount(0);
});
