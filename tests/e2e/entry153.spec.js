// 153: 입구 화면 글자 크게(갤럭시 글자 최대) — 가로 밀림·글자 세로 쌓임 없음 + 공개 범위 문구(학교 일정·학원만)
const { test, expect } = require("@playwright/test");

for (const z of [1.7, 2, 3, 3.5, 4]) {
  test(`153 입구 글자 ${Math.round(z * 100)}%: 가로 밀림 없음·구 이름·머리글이 세로로 쌓이지 않음`, async ({ browser }, info) => {
    test.skip(info.project.name !== "폰390", "모의 확대는 한 번만");
    const ctx = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: Math.round(412 / z), height: Math.round(915 / z) }, deviceScaleFactor: 2.625 * z, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    const page = await ctx.newPage();
    await page.route(/goatcounter\.com|gc\.zgo\.at|raw\.githubusercontent\.com/, (r) => r.abort());
    await page.goto("/entry/"); await page.waitForTimeout(1200);
    const m = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const tall = [...document.querySelectorAll(".top b, .city .nm, .again .t b, .tab, .help-btn")].filter((e) => e.offsetParent).filter((e) => { const r = e.getBoundingClientRect(), fs = parseFloat(getComputedStyle(e).fontSize); return r.width < fs * 2.2 && e.innerText.trim().length > 2; }).map((e) => e.innerText.trim());
      return { sx: document.documentElement.scrollWidth - vw, tall };
    });
    expect(m.sx, "가로 밀림(px)").toBeLessThanOrEqual(1);
    expect(m.tall, "글자가 한 자씩 세로로 쌓인 칸").toEqual([]);
    await ctx.close();
  });
}

test("153 입구 문구: 공개된 메뉴(학교 일정·학원)만, 병원·혜택 없음", async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "글자 확인은 한 폭에서");
  await page.route(/goatcounter\.com|gc\.zgo\.at|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.goto("/entry/"); await page.waitForTimeout(800);
  const fam = await page.locator(".fam").innerText();
  expect(fam).toContain("학교 일정");
  expect(fam).toContain("학원");
  expect(fam).not.toMatch(/병원|혜택|급식|도서관/);
});
