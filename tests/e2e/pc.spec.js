// 태블릿·PC 첫 화면 검사 v01후보 (2026-11-09, 피트 확인 요청)
// ① 첫 화면에서 검색창·'찾기' 버튼이 하단 메뉴(바닥 받침 포함)에 가리지 않음
// ② '찾기' 버튼 클릭 / Enter 키 각각으로 검색 실행
// PC 프로젝트에서만 돌고, 안에서 화면 크기를 여러 개로 바꿔 본다.
const { test, expect } = require("@playwright/test");

const SIZES = [[1280, 800], [1440, 900], [1920, 1080], [1024, 768], [820, 1180]];

test.beforeEach(async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("PC"), "PC 프로젝트에서만");
  await page.route(/goatcounter\.com|gc\.zgo\.at|raw\.githubusercontent\.com/, (r) => r.abort());
});

for (const [w, h] of SIZES) {
  test(`${w}×${h}: 첫 화면 검색창·찾기 버튼이 하단 메뉴에 안 가림`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/yuseong/"); await expect(page.locator("form.search-v2")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const r = await page.evaluate(() => {
      const f = document.querySelector("form.search-v2").getBoundingClientRect();
      const btn = document.querySelector("form.search-v2 button[type=submit]").getBoundingClientRect();
      const nav = document.querySelector("nav.nav").getBoundingClientRect();
      const dockTop = innerHeight - 104;   // PC 바닥 받침(body::after) 높이
      const coverTop = Math.min(nav.top, innerWidth >= 700 ? dockTop : nav.top);
      return { formBottom: Math.round(f.bottom), btnBottom: Math.round(btn.bottom), coverTop: Math.round(coverTop), photoH: Math.round(document.querySelector(".hero-v3 .ph").getBoundingClientRect().height) };
    });
    test.info().annotations.push({ type: "측정", description: JSON.stringify(r) });
    expect(r.formBottom, `검색창 아래끝 ${r.formBottom} ≤ 가림 시작 ${r.coverTop}`).toBeLessThanOrEqual(r.coverTop);
    expect(r.btnBottom, "찾기 버튼").toBeLessThanOrEqual(r.coverTop);
  });
}

for (const how of ["클릭", "Enter"]) {
  test(`PC 검색: '찾기' ${how}로 실행`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/yuseong/"); await page.waitForLoadState("networkidle");
    const box = page.locator('form.search-v2 input[name="q"]');
    await box.fill("수학");
    if (how === "클릭") await page.locator("form.search-v2 button[type=submit]").click();   // 가려져 있으면 클릭이 실패함
    else await box.press("Enter");
    await expect(page).toHaveURL(/#find\//);
    await expect(page.locator("#view")).toContainText("학원·교습소", { timeout: 15_000 });
  });
}
