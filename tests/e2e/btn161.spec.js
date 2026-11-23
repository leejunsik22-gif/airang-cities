// 161: 갤럭시 글자 최대 — 마이 '앱처럼 쓰기' 버튼 둘째 줄이 버튼 밖으로 나옴(높이 52px 고정). 높이를 정한 버튼이 글자에 맞게 늘어나는지
const { test, expect } = require("@playwright/test");

for (const z of [1, 3, 3.5, 4]) {
  for (const h of ["#my", "#home", "#about"]) {
    test(`161 버튼 글자 ${Math.round(z * 100)}% ${h}: 버튼 글자가 버튼 안`, async ({ browser }, info) => {
      test.skip(info.project.name !== "폰390", "모의 확대는 한 번만");
      const ctx = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: Math.round(412 / z), height: Math.round(915 / z) }, deviceScaleFactor: 2.625 * z, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await ctx.newPage();
      await page.route(/goatcounter\.com|gc\.zgo\.at|raw\.githubusercontent\.com/, (r) => r.abort());
      await page.goto("/yuseong/" + h); await page.waitForTimeout(1500);
      const bad = await page.evaluate(() => [...document.querySelectorAll("#view .btn")].filter((b) => b.offsetParent && b.innerText.trim()).filter((b) => b.scrollHeight - b.clientHeight > 2).map((b) => b.innerText.trim().slice(0, 12) + ":" + (b.scrollHeight - b.clientHeight)));
      expect(bad, "버튼 밖으로 나온 글자(px)").toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      if (h === "#my" && z === 1) {
        const hgt = await page.evaluate(() => { const b = [...document.querySelectorAll("#view .btn")].find((x) => x.innerText.includes("앱처럼 쓰기")); return b && b.getBoundingClientRect().height; });
        expect(hgt, "보통 글자에서는 원래 높이 52px 그대로").toBe(52);
      }
      await ctx.close();
    });
  }
}
