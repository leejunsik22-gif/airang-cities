/* 189: 운영에도 있는 화면 넘침 2건만 고친 운영 반영 후보 (2026-11-28, 클로드)
   F1 글자 150%(폭 260) 아이 화면 입력칸 넘침 · F2 글자 400%(폭 103) 학원 '빼기' 버튼 화면 밖. 가상 자료만. */
const { test, expect } = require("@playwright/test");
const KIDS = JSON.stringify([{ id: "k1", name: "가상아이", code: "", grade: 2, gy: 2026, color: 0, al: [1], acas: [{ id: "A123", n: "가상학원" }] }]);
const GU = ["djdonggu", "djjunggu", "djseogu", "yuseong", "daedeok"];
for (const [w, n] of [[260, "F1 글자150%"], [103, "F2 글자400%"]]) {
  test.describe(n, () => {
    test.use({ viewport: { width: w, height: w * 2 }, deviceScaleFactor: Math.round(1170 / w) / 1, isMobile: true, hasTouch: true });
    test(`${n}: 아이 화면 넘침 없음·'빼기' 화면 안 (5개 구)`, async ({ page }, info) => {
      test.skip(info.project.name !== "폰390", "한 번만");
      await page.route(/goatcounter|gc\.zgo|raw\.github|fonts\./, (r) => r.abort());
      const bad = {};
      for (const g of GU) {
        await page.goto(`/${g}/`); await page.waitForLoadState("networkidle");
        await page.evaluate((k) => { localStorage.setItem(NS + "edu.kids", k); localStorage.setItem(NS + "edu.installDone", "1"); }, KIDS);
        for (const r of ["kid/new", "kid/k1"]) {
          await page.goto(`/${g}/?t=${r}#${r}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(600);
          const o = await page.evaluate(() => { const W = document.documentElement.clientWidth; const b = [...document.querySelectorAll("#view button")].find((x) => x.textContent.trim() === "빼기");
            return { 넘침: document.scrollingElement.scrollWidth - W, 빼기: b ? Math.round(b.getBoundingClientRect().right - W) : null }; });
          if (o.넘침 > 2 || (o.빼기 !== null && o.빼기 > 1)) bad[`${g}#${r}`] = o;
        }
      }
      expect(bad, JSON.stringify(bad)).toEqual({});
    });
  });
}
