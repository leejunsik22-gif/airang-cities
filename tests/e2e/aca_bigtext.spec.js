// 142: 학원 상세 머리 — 큰 글자에서 학원 이름 칸이 0px로 줄어 한 글자씩 세로로 쌓이던 문제(141 보고) 회귀시험
const { test, expect } = require("@playwright/test");
const NAMES = { "3000012366": "JK영어학원", "3000012491": "에듀플렉스에듀코치개별지도테크노학원" }; /* 짧은 이름 + 긴 이름 */
for (const z of [1, 1.7, 2, 2.5, 3]) test(`학원 상세 이름 칸 글자 ${Math.round(z * 100)}%`, async ({ browser }, info) => {
  test.skip(info.project.name !== "폰390", "폭을 직접 정하는 시험 — 폰390에서 한 번만");
  const ctx = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: Math.round(412 / z), height: Math.round(915 / z) }, deviceScaleFactor: 2.625 * z, isMobile: true, hasTouch: true, locale: "ko-KR" });
  await ctx.route(/goatcounter|gc\.zgo\.at|raw\.githubusercontent/, (r) => r.abort());
  const p = await ctx.newPage();
  for (const [id, n] of Object.entries(NAMES)) {
    await p.goto(`/yuseong/#aca/${id}`); await p.waitForLoadState("networkidle");
    await expect(p.locator("#view h1")).toHaveText(n, { timeout: 8000 });
    const r = await p.evaluate(() => { const h = document.querySelector("#view h1"), b = h.getBoundingClientRect(), fs = parseFloat(getComputedStyle(h).fontSize); const ch = Math.max(...[...h.innerText].map(() => 0), 0); return { w: b.width, vw: innerWidth, perLine: b.width / fs, over: document.documentElement.scrollWidth - innerWidth }; });
    expect(r.w, `${n}: 이름 칸 폭이 화면 폭의 60% 이상`).toBeGreaterThanOrEqual(r.vw * 0.6);
    expect(r.perLine, `${n}: 한 줄에 3글자 이상 들어감(세로 한 글자씩 쌓이지 않음)`).toBeGreaterThanOrEqual(3);
    expect(r.over, `${n}: 가로 넘침 없음`).toBeLessThanOrEqual(2);
    const ov = await p.evaluate(() => { const h = document.querySelector("#view h1"); if (!h) return "이름 없음"; const b = h.getBoundingClientRect(); /* AI 이미지 표시는 #view 밖(사진 머리)에 있음 — 화면 전체에서 찾는다 */ return [...document.querySelectorAll(".img-tag")].some((t) => { const a = t.getBoundingClientRect(); return a.width > 0 && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top); }); });
    expect(ov, `${n}: 'AI 이미지' 표시가 이름을 가리지 않음`).toBe(false);
    const ov2 = await p.evaluate(() => { const tags = [...document.querySelectorAll(".topscape .img-tag")].map((t) => t.getBoundingClientRect()).filter((a) => a.width > 0); const btns = [...document.querySelectorAll("#view .back, #view .fav-btn")].map((e) => e.getBoundingClientRect()); return tags.some((a) => btns.some((b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top))); });
    expect(ov2, `${n}: 'AI 이미지' 표시가 뒤로·즐겨찾기 버튼을 가리지 않음`).toBe(false);
    expect(await p.locator(".topscape .img-tag").first().isVisible(), `${n}: AI 이미지 표시는 계속 보임`).toBe(true);
    if (z === 3) await test.info().attach(`${n}-300%`, { body: await p.screenshot(), contentType: "image/png" });
  }
  await ctx.close();
});
