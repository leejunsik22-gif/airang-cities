/* 182: 부모·선생님 알레르기 확인 카드(가안) 자동 검사 (2026-11-27, 클로드) — 가상 자료만, 통계는 가짜로 받아 기록만 */
const { test, expect } = require("@playwright/test");
const GU = ["djdonggu", "djjunggu", "djseogu", "yuseong", "daedeok"];
const FAKE = "window.__gc=[];window.goatcounter={count:function(o){window.__gc.push(o)}};";
const KIDS = JSON.stringify([{ id: "k1", name: "가상아이", code: "", grade: 2, gy: 2026, color: 0, al: [1, 5], acas: [] }, { id: "k2", name: "가상둘째", code: "", grade: 1, gy: 2026, color: 1, al: [], acas: [] }]);
test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "기능 시험 — 폰390에서 한 번만");
  await page.route(/gc\.zgo\.at\/count\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: FAKE }));
  await page.route(/goatcounter\.com/, (r) => r.abort());
  await page.route(/raw\.githubusercontent\.com/, (r) => r.abort());
});
async function settle(page) { await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200); }
for (const key of GU) {
  test(`${key}: 확인 뒤에만 카드가 보이고, 카드에는 별명·알레르기·날짜만, 통계는 'kid/card'만`, async ({ page }) => {
    await page.goto(`/${key}/`); await settle(page);
    await page.evaluate((k) => localStorage.setItem(NS + "edu.kids", k), KIDS);
    await page.goto(`/${key}/#kid/k1/card`); await page.reload(); await settle(page);
    await expect(page.getByText("이 카드는 건강 관련 정보예요.")).toBeVisible();
    await expect(page.locator("#kidCard")).toHaveCount(0);
    await page.getByRole("button", { name: "확인하고 카드 보기" }).click();
    const card = page.locator("#kidCard");
    await expect(card).toContainText("가상아이");
    await expect(card).toContainText("난류"); await expect(card).toContainText("대두");
    await expect(card).toContainText("학교 공식 절차를 대신하지 않습니다");
    const txt = await card.innerText();
    expect(txt).not.toMatch(/학년|초등학교|중학교|010-/);
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: "그림으로 저장" }).click();
    expect((await dl).suggestedFilename()).toMatch(/^hyoforest_allergy_card_\d{4}-\d{2}-\d{2}\.png$/);
    const sent = await page.evaluate(() => (window.__gc || []).map((o) => o.path));
    expect(sent.filter((p) => /k1|가상|난류|card\//.test(p))).toEqual([]);
    expect(sent).toContain("/kid/card");
  });
}
test("알레르기 없는 아이는 카드를 만들지 않고, 수정 화면 버튼도 알레르기 있는 아이에게만", async ({ page }) => {
  await page.goto("/yuseong/"); await settle(page);
  await page.evaluate((k) => localStorage.setItem(NS + "edu.kids", k), KIDS);
  await page.goto("/yuseong/#kid/k2/card"); await page.reload(); await settle(page);
  await expect(page.locator("#kidCard")).toHaveCount(0);
  await page.goto("/yuseong/#kid/k2"); await settle(page);
  await expect(page.getByRole("button", { name: "알레르기 확인 카드 만들기" })).toHaveCount(0);
  await page.goto("/yuseong/#kid/k1"); await settle(page);
  await expect(page.getByRole("button", { name: "알레르기 확인 카드 만들기" })).toHaveCount(1);
});

/* 182: 글자 약 400%(폭 103px)에서 카드 화면 가로 넘침 없음 */
test.describe("글자 400%", () => {
  test.use({ viewport: { width: 103, height: 229 }, deviceScaleFactor: 10.5, isMobile: true, hasTouch: true });
  test("카드 확인창·카드 가로 넘침 없음", async ({ page }) => {
    await page.goto("/yuseong/"); await settle(page);
    await page.evaluate((k) => { localStorage.setItem(NS + "edu.kids", k); localStorage.setItem(NS + "edu.installDone", "1"); }, KIDS);
    await page.goto("/yuseong/#kid/k1/card"); await page.reload(); await settle(page);
    const a = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
    await page.getByRole("button", { name: "확인하고 카드 보기" }).click(); await page.waitForTimeout(500);
    const b = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
    expect([a, b].every((x) => x <= 2), JSON.stringify([a, b])).toBe(true);
  });
});
