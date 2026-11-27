/* 184: 개인정보 처리방침(초안) 화면 자동 검사 (2026-11-28, 클로드) — 가상 자료 없음, 통계는 가짜로 받아 기록만 */
const { test, expect } = require("@playwright/test");
const GU = ["djdonggu", "djjunggu", "djseogu", "yuseong", "daedeok"];
const FAKE = "window.__gc=[];window.goatcounter={count:function(o){window.__gc.push(o)}};";
test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "기능 시험 — 폰390에서 한 번만");
  await page.route(/gc\.zgo\.at\/count\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: FAKE }));
  await page.route(/goatcounter\.com/, (r) => r.abort());
  await page.route(/raw\.githubusercontent\.com/, (r) => r.abort());
});
async function settle(page) { await page.waitForLoadState("networkidle"); await page.waitForTimeout(1000); }
for (const key of GU) {
  test(`${key}: 이용 안내 → 처리방침(초안) 12개 항목·곁나루/효숲 구분·확인 필요 표시`, async ({ page }) => {
    await page.goto(`/${key}/#about`); await settle(page);
    await page.getByRole("button", { name: "개인정보 처리방침 전체 보기" }).click(); await settle(page);
    const v = await page.locator("#view").innerText();
    expect(v).toContain("초안");
    for (let i = 1; i <= 12; i++) expect(v, `${i}번 항목`).toMatch(new RegExp(`${i}\\. `));
    expect(v).toContain("곁나루"); expect(v).toContain("효숲");
    expect(v).toContain("법정대리인 동의 확인 방법이 아니에요");
    expect(v).toContain("〔상호 / 대표자 / 사업자등록번호 / 주소〕");
    expect(await page.content()).not.toMatch(/leejunsik22@gmail|010-\d{3,4}-\d{4}/);
    const sent = await page.evaluate(() => (window.__gc || []).map((o) => o.path));
    expect(sent).toContain("/privacy");
  });
}
test.describe("글자 400%", () => {
  test.use({ viewport: { width: 103, height: 229 }, deviceScaleFactor: 10.5, isMobile: true, hasTouch: true });
  test("처리방침·이용 안내 가로 넘침 없음", async ({ page }) => {
    const over = {};
    for (const r of ["privacy", "about"]) { await page.goto(`/yuseong/#${r}`); await settle(page); over[r] = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth); }
    expect(Object.values(over).every((x) => x <= 2), JSON.stringify(over)).toBe(true);
  });
});
