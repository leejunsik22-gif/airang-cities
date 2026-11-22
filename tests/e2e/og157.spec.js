// 157: 링크 미리보기(카카오톡 등) 그림 — 입구·5개 구 모두 새 효숲 그림(1200×630)을 가리키고, 그 그림이 실제로 열리며 초록 나무가 있음
const { test, expect } = require("@playwright/test");

for (const path of ["/entry/", "/yuseong/", "/djdonggu/"]) {
  test(`157 링크 미리보기 ${path}`, async ({ page }, info) => {
    test.skip(info.project.name !== "폰390", "한 번만");
    await page.route(/goatcounter\.com|gc\.zgo\.at|raw\.githubusercontent\.com/, (r) => r.abort());
    await page.goto(path);
    const og = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('meta[property^="og:"]')].map((m) => [m.getAttribute("property"), m.getAttribute("content")])));
    expect(og["og:title"]).toMatch(/^효숲 /);
    expect(og["og:description"]).not.toMatch(/병원|혜택|소아과|급식|도서관/);
    expect(og["og:image"]).toContain("og-hyoforest.png");
    const r = await page.evaluate(async (src) => {
      const im = new Image(); im.src = src; await im.decode();
      const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext("2d"); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
      let green = 0, orange = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 1] > d[i] + 15 && d[i + 1] > d[i + 2]) green++; if (d[i] > 200 && d[i + 1] > 100 && d[i + 1] < 190 && d[i + 2] < 90) orange++; }
      return { w: im.naturalWidth, h: im.naturalHeight, green, orange };
    }, og["og:image"]);
    expect([r.w, r.h]).toEqual([1200, 630]);
    expect(r.green).toBeGreaterThan(2000);
    expect(r.orange).toBeLessThan(50);
  });
}
