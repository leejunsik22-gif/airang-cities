// 홈 검색 → '학원·교습소 전체 보기' 견본 검사 v01후보 (2026-11-10, 대표 '견본 만들어')
// 홈 검색은 학원 10곳까지만 보여 줌 → 아래 버튼으로 '우리 동네 학원'에서 같은 검색어 전체를 이어 봄
const { test, expect } = require("@playwright/test");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const ACAS = JSON.parse(fs.readFileSync(path.join(ROOT, "data/yuseong/academies.json"), "utf8")).academies;
const text = (a) => (a.n + " " + (a.c || []).join(" ") + " " + a.r).replace(/\s/g, "");

test.beforeEach(async ({ page }) => {
  await page.route(/goatcounter\.com|gc\.zgo\.at/, (r) => r.abort());
  await page.route(/raw\.githubusercontent\.com/, (r) => r.abort());   // 앱이 ./data 로 읽음
});

test("검색어 '영어': 10곳 + 전체 보기 버튼 → 학원 메뉴에 같은 수", async ({ page }) => {
  const want = ACAS.filter((a) => text(a).includes("영어")).length;
  expect(want).toBeGreaterThan(10);
  await page.goto("/yuseong/#find/" + encodeURIComponent("영어"));
  const btn = page.locator("#view button", { hasText: "학원·교습소 전체 보기" });
  await expect(btn).toBeVisible();
  await expect(btn).toContainText(`(${want.toLocaleString()}곳)`);
  await expect(page.locator("#view a[href^='#aca/']")).toHaveCount(10);
  await btn.click();
  await expect(page).toHaveURL(/#acas$/);
  await expect(page.locator("#acaq")).toHaveValue("영어");
  await expect(page.locator("#view")).toContainText(`${want.toLocaleString()}곳`);
});

test("동 이름 검색: 그 동 학원만 전체로", async ({ page }) => {
  const cnt = {}; for (const a of ACAS) if (a.dong) cnt[a.dong] = (cnt[a.dong] || 0) + 1;
  const [dong, n] = Object.entries(cnt).sort((x, y) => y[1] - x[1])[0];
  test.skip(n <= 10, "10곳 넘는 동 없음");
  await page.goto("/yuseong/#find/" + encodeURIComponent(dong));
  const btn = page.locator("#view button", { hasText: "학원·교습소 전체 보기" });
  await expect(btn).toContainText(`(${n.toLocaleString()}곳)`);
  await btn.click();
  await expect(page).toHaveURL(/#acas$/);
  await expect(page.locator("#acaq")).toHaveValue("");
  expect(await page.evaluate(() => acaF.dong)).toBe(dong);
  await expect(page.locator("#view")).toContainText(`${n.toLocaleString()}곳`);
});

test("10곳 이하로 끝나는 검색어에는 버튼 없음", async ({ page }) => {
  const one = ACAS.find((a) => ACAS.filter((b) => text(b).includes(a.n.replace(/\s/g, ""))).length === 1 && a.n.length >= 4);
  await page.goto("/yuseong/#find/" + encodeURIComponent(one.n));
  await expect(page.locator("#view")).toContainText(one.n);
  await expect(page.locator("#view button", { hasText: "전체 보기" })).toHaveCount(0);
});

test("휴대폰: 버튼이 화면 폭 안, 글자 잘림 없음, 높이 44px 이상", async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "폰390에서만");
  await page.goto("/yuseong/#find/" + encodeURIComponent("수학"));
  const btn = page.locator("#view button", { hasText: "학원·교습소 전체 보기" });
  await btn.scrollIntoViewIfNeeded();
  const m = await btn.evaluate((e) => { const r = e.getBoundingClientRect(); return { h: r.height, right: r.right, vw: innerWidth, cut: e.scrollWidth > e.clientWidth + 1 }; });
  expect(m.h).toBeGreaterThanOrEqual(44); expect(m.right).toBeLessThanOrEqual(m.vw); expect(m.cut).toBe(false);
  await page.screenshot({ path: "test-results/aca_more_phone.png", fullPage: false });
});
