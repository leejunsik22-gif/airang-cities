/* 188: 학원 수업 요일 7칸 — 좁은 화면·큰 글자에서 두 줄(4+3) 이상으로, 칸 폭 44px 이상 (2026-11-28, 클로드)
   피트 dc1211 추가 지시 5항. 넓은 화면(폴드 펼침 등)은 예전처럼 한 줄 7칸인지도 본다. 가상 자료만. */
const { test, expect } = require("@playwright/test");
const fs = require("fs"), path = require("path");
const OUT = process.env.QA188_OUT || "/tmp/qa188"; fs.mkdirSync(OUT, { recursive: true });
const KIDS = JSON.stringify([{ id: "k1", name: "가상아이", code: "", grade: 2, gy: 2026, color: 0, al: [], acas: [{ id: "A123", n: "가상학원", days: [0, 2] }] }]);
const W = [[690, "폴드 펼침"], [412, "A 보급형"], [384, "S 울트라"], [360, "S 기본형"], [344, "폴드 바깥"], [260, "글자150%"], [195, "글자200%"], [130, "글자300%"], [103, "글자400%"]];
const res = {};
for (const [w, n] of W) {
  test.describe(`폭 ${w}`, () => {
    test.use({ viewport: { width: w, height: Math.max(700, w * 2) }, deviceScaleFactor: Math.max(2, Math.round(1170 / w) / 1), isMobile: true, hasTouch: true });
    test(`${n}(${w}): 요일 7칸 모두 보이고 칸 폭 44px 이상, 가로 넘침 없음`, async ({ page }, info) => {
      test.skip(info.project.name !== "폰390", "한 번만");
      await page.route(/goatcounter|gc\.zgo|raw\.github|fonts\./, (r) => r.abort());
      await page.goto("/yuseong/"); await page.waitForLoadState("networkidle");
      await page.evaluate((k) => { localStorage.setItem(NS + "edu.kids", k); localStorage.setItem(NS + "edu.installDone", "1"); }, KIDS);
      await page.goto(`/yuseong/?t=${w}#kid/k1`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
      /* 요일 칸이 접혀 있으면 펼친다 */
      if (!(await page.locator(".acadays").count())) { const t = page.getByRole("button", { name: /시간|요일/ }).first(); if (await t.count()) await t.click(); }
      await expect(page.locator(".acadays button")).toHaveCount(7);
      const r = await page.evaluate(() => {
        const bs = [...document.querySelectorAll(".acadays button")].map((b) => b.getBoundingClientRect());
        const rows = new Set(bs.map((b) => Math.round(b.top))).size, Wd = document.documentElement.clientWidth;
        return { 줄: rows, 최소폭: Math.round(Math.min(...bs.map((b) => b.width))), 최소높이: Math.round(Math.min(...bs.map((b) => b.height))), 오른쪽넘침: Math.round(Math.max(...bs.map((b) => b.right)) - Wd), 화면넘침: document.scrollingElement.scrollWidth - Wd, 칸묶음폭: Math.round(document.querySelector(".acadays").getBoundingClientRect().width) };
      });
      res[`${w}_${n}`] = r; fs.writeFileSync(path.join(OUT, "days188.json"), JSON.stringify(res, null, 1));
      fs.writeFileSync(path.join(OUT, `days_${w}.png`), await page.locator(".acadays").screenshot());
      expect(r.최소폭, JSON.stringify(r)).toBeGreaterThanOrEqual(44);
      expect(r.최소높이).toBeGreaterThanOrEqual(44);
      expect(r.오른쪽넘침).toBeLessThanOrEqual(1);
      expect(r.화면넘침).toBeLessThanOrEqual(2);
      if (w >= 600) expect(r.줄, "넓은 화면은 예전처럼 한 줄").toBe(1);
      if (w >= 340 && w < 600) expect(r.줄, "보통 갤럭시 폭은 두 줄(4+3)").toBe(2);
    });
  });
}
