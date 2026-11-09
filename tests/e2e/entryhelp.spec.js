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
  await expect(page.locator("#btn-contact")).toHaveText(/문의하기/);   // 2026-11-09 A안: 메일 대신 /inquiry/ 문의 화면
  for (const id of ["#btn-install", "#btn-contact"]) {   // 한 줄로, 잘리지 않게
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
