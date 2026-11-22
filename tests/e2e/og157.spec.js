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

/* 157: 대표 갤럭시 글자 최대 사진 — 마이 '관심 지역' 버튼 글이 버튼 밖으로 넘쳐 위 글자와 겹침 */
for (const z of [3, 3.5, 4]) {
  test(`157 마이 '관심 지역' 버튼 글자 ${Math.round(z * 100)}%: 버튼 안에 다 들어가고 위 글자와 안 겹침`, async ({ browser }, info) => {
    test.skip(info.project.name !== "폰390", "모의 확대는 한 번만");
    const ctx = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: Math.round(412 / z), height: Math.round(915 / z) }, deviceScaleFactor: 2.625 * z, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    const page = await ctx.newPage();
    await page.route(/goatcounter\.com|gc\.zgo\.at|raw\.githubusercontent\.com/, (r) => r.abort());
    await page.goto("/yuseong/#my"); await page.waitForTimeout(1200);
    const m = await page.evaluate(() => { const row = [...document.querySelectorAll("#view .row")].find((r) => r.innerText.includes("관심 지역")); const s = row.querySelector("span").getBoundingClientRect(), b = row.querySelector("button"), br = b.getBoundingClientRect();
      return { overflow: b.scrollHeight - b.clientHeight, overlap: Math.min(s.bottom, br.bottom) - Math.max(s.top, br.top) > 1 && Math.min(s.right, br.right) - Math.max(s.left, br.left) > 1, sx: document.documentElement.scrollWidth - innerWidth }; });
    expect(m.overflow, "버튼 글 넘침(px)").toBeLessThanOrEqual(2);
    expect(m.overlap, "'관심 지역' 글자와 겹침").toBe(false);
    expect(m.sx).toBeLessThanOrEqual(1);
    await ctx.close();
  });
}

/* 159: 대표 갤럭시 글자 최대 사진 — 마이 '성범죄자 알림e' 칸의 아이콘 바탕이 칸 밖으로 삐져나옴 */
for (const z of [3, 4]) {
  test(`159 마이 메뉴 칸 글자 ${Math.round(z * 100)}%: 아이콘·글자가 칸 안에`, async ({ browser }, info) => {
    test.skip(info.project.name !== "폰390", "모의 확대는 한 번만");
    const ctx = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: Math.round(412 / z), height: Math.round(915 / z) }, deviceScaleFactor: 2.625 * z, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    const page = await ctx.newPage();
    await page.route(/goatcounter\.com|gc\.zgo\.at|raw\.githubusercontent\.com/, (r) => r.abort());
    await page.goto("/yuseong/#my"); await page.waitForTimeout(1200);
    const bad = await page.evaluate(() => [...document.querySelectorAll("#view .mtile")].filter((t) => t.offsetParent).flatMap((t) => { const T = t.getBoundingClientRect(); return [...t.querySelectorAll(".bi, b")].filter((e) => { const r = e.getBoundingClientRect(); return r.left < T.left - 1 || r.right > T.right + 1; }).map(() => t.innerText.trim().slice(0, 10)); }));
    expect(bad, "칸 밖으로 나간 아이콘·글자").toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await ctx.close();
  });
}
