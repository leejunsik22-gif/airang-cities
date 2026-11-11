// 홈 검색 → '학원·교습소 전체 보기' 검사 v02후보 (2026-11-10, 076 견본 → 077 조건부 승인 최종 검수)
// 홈 검색과 학원 메뉴는 같은 규칙(acaFind: 이름·교습과정·분야·동네)으로 같은 목록을 만든다.
// 홈은 앞 10곳만, 10곳을 넘으면 '전체 보기(N곳)' → 학원 메뉴에 같은 검색어로 N곳 전부.
const { test, expect } = require("@playwright/test");
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const ACAS = JSON.parse(fs.readFileSync(path.join(ROOT, "data/yuseong/academies.json"), "utf8")).academies;
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, "");
const find = (q) => ACAS.filter((a) => norm(a.n + " " + (a.c || []).join(" ") + " " + a.r + " " + (a.dong || "")).includes(norm(q)));
const BTN = "학원·교습소 전체 보기";

test.beforeEach(async ({ page }) => {
  await page.route(/goatcounter\.com|gc\.zgo\.at/, (r) => r.abort());
  await page.route(/raw\.githubusercontent\.com/, (r) => r.abort());   // 앱이 ./data 로 읽음
});
async function menuIds(page) {   // 학원 메뉴에 보이는 목록 전부(더 보기 끝까지)
  return page.evaluate(() => { acaShow = 99999; render(); return [...document.querySelectorAll("#view button.school")].map((b) => (b.getAttribute("onclick").match(/aca\/([^'"]+)/) || [])[1]).filter(Boolean); });
}

test("① '영어': 홈 10곳 = 같은 목록의 앞 10곳, 버튼 숫자 = 메뉴 숫자, 중복·누락 없음", async ({ page }) => {
  const want = find("영어");
  await page.goto("/yuseong/#find/" + encodeURIComponent("영어"));
  const btn = page.locator("#view button", { hasText: BTN });
  await expect(btn).toContainText(`(${want.length.toLocaleString()}곳)`);
  const home = await page.locator("#view a[href^='#aca/']").evaluateAll((as) => as.map((a) => a.getAttribute("href").slice(5)));
  expect(home).toEqual(want.slice(0, 10).map((a) => a.id));
  await btn.click(); await expect(page).toHaveURL(/#acas$/);
  await expect(page.locator("#acaq")).toHaveValue("영어");
  const ids = await menuIds(page);
  expect(new Set(ids).size, "메뉴 중복").toBe(ids.length);
  expect([...ids].sort()).toEqual(want.map((a) => a.id).sort());
});

test("① 동 이름·글자 일부 검색도 홈 10곳이 모두 메뉴 목록 안", async ({ page }) => {
  for (const q of ["지족동", "대동", "도안", "피아노"]) {
    const want = find(q); if (want.length <= 10) continue;
    await page.goto("/yuseong/#find/" + encodeURIComponent(q));
    await page.locator("#view button", { hasText: BTN }).click();
    const ids = new Set(await menuIds(page));
    expect(ids.size, q).toBe(want.length);
    for (const a of want.slice(0, 10)) expect(ids.has(a.id), `${q} → ${a.n}`).toBe(true);
  }
});

test("① 10곳 이하·0곳: 버튼 없음", async ({ page }) => {
  const few = ["영어", "수학", "피아노", "미술", "코딩", "바둑", "발레", "수영", "로봇", "중국어"].find((q) => find(q).length > 0 && find(q).length <= 10)
    || ACAS.map((a) => a.n).find((n) => find(n).length === 1);
  await page.goto("/yuseong/#find/" + encodeURIComponent(few));
  await expect(page.locator("#view")).toContainText("학원·교습소");
  await expect(page.locator("#view button", { hasText: "전체 보기" })).toHaveCount(0);
  await page.goto("/yuseong/#find/" + encodeURIComponent("가나다라없는말"));
  await expect(page.locator("#view")).toContainText("맞는 결과가 없어요");
  await expect(page.locator("#view button", { hasText: "전체 보기" })).toHaveCount(0);
});

test("② 뒤로 가기: 메뉴 → 검색 결과로, 검색어 유지", async ({ page }) => {
  await page.goto("/yuseong/#find/" + encodeURIComponent("수학"));
  await page.locator("#view button", { hasText: BTN }).click(); await expect(page).toHaveURL(/#acas$/);
  await page.goBack();
  await expect(page).toHaveURL(/#find\//);
  await expect(page.locator('#view input[name="q"]')).toHaveValue("수학");
  await expect(page.locator("#view button", { hasText: BTN })).toBeVisible();
});

test("② 메뉴에서 검색어 바꾸기·동네 고르기·과목 고르기가 그대로 동작", async ({ page }) => {
  await page.goto("/yuseong/#find/" + encodeURIComponent("영어"));
  await page.locator("#view button", { hasText: BTN }).click();
  await page.fill("#acaq", "수학"); await page.waitForTimeout(600);
  await expect(page.locator("#view")).toContainText(`${find("수학").length.toLocaleString()}곳`);
  const dong = Object.entries(find("수학").reduce((m, a) => (a.dong && (m[a.dong] = (m[a.dong] || 0) + 1), m), {})).sort((x, y) => y[1] - x[1])[0][0];
  await page.evaluate((d) => { acaFilter().dong = d; render(); }, dong);   // 동네 칩과 같은 동작
  const n = find("수학").filter((a) => a.dong === dong).length;
  await expect(page.locator("#view")).toContainText(`${n.toLocaleString()}곳`);
  await page.fill("#acaq", "가나다라없는말"); await page.waitForTimeout(600);
  await expect(page.locator("#view")).toContainText("0곳");
});

test("② 다시 검색해도 이전 메뉴 조건이 남지 않음", async ({ page }) => {
  await page.goto("/yuseong/#acas");
  await page.evaluate(() => { acaFilter().cat = "예체능"; acaFilter().dong = "지족동"; render(); });   // 사용자가 전에 걸어 둔 조건
  await page.goto("/yuseong/#find/" + encodeURIComponent("영어"));
  await page.locator("#view button", { hasText: BTN }).click();
  expect(await page.evaluate(() => [acaF.cat, acaF.dong, acaF.gu, acaF.q])).toEqual(["전체", "", "", "영어"]);
});

test("③(근사) 휴대폰 글자 1.3·1.5배: 버튼 글자·숫자 잘림 없음, 화면 폭 안, 44px 이상", async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "폰390에서만");
  for (const z of [1, 1.3, 1.5]) {
    await page.goto("/yuseong/#find/" + encodeURIComponent("영어")); await page.waitForLoadState("networkidle");
    await page.evaluate((z) => { const els = [...document.querySelectorAll("body *")], px = els.map((e) => parseFloat(getComputedStyle(e).fontSize)); els.forEach((e, i) => { e.style.fontSize = px[i] * z + "px"; }); }, z);
    const btn = page.locator("#view button", { hasText: BTN }); await btn.scrollIntoViewIfNeeded();
    const m = await btn.evaluate((e) => { const r = e.getBoundingClientRect(); return { h: r.height, l: r.left, r: r.right, vw: innerWidth, cutX: e.scrollWidth > e.clientWidth + 1, cutY: e.scrollHeight > e.clientHeight + 1, t: e.innerText }; });
    expect(m.h, `×${z} 높이`).toBeGreaterThanOrEqual(44); expect(m.l).toBeGreaterThanOrEqual(0); expect(m.r).toBeLessThanOrEqual(m.vw);
    expect(m.cutX || m.cutY, `×${z} 잘림`).toBe(false); expect(m.t).toMatch(/\(\d[\d,]*곳\)/);
    await page.screenshot({ path: `test-results/aca_more_x${z}.png` });
  }
});
