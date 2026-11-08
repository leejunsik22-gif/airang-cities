const { chromium } = require('playwright');
const BASE = 'http://localhost:8766/yuseong/index.html#';
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[360, 740], [390, 844], [430, 932]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await ctx.newPage(); await p.route(/^https?:\/\/(?!localhost)/, r => r.abort('failed'));
    for (const r of ['home', 'schools', 'acas', 'hosp', 'my', 'saved', 'region', 'find/소아과']) {
      await p.goto(BASE + r, { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
      await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await p.waitForTimeout(200);
      const o = await p.evaluate(() => {
        const nav = document.querySelector('.nav'); const nr = nav.getBoundingClientRect();
        const els = [...document.querySelectorAll('#view *')].filter(e => e.children.length === 0 && e.textContent.trim() && getComputedStyle(e).display !== 'none');
        let last = null; for (const e of els) { const r = e.getBoundingClientRect(); if (r.height && (!last || r.bottom > last.bottom)) last = { bottom: r.bottom, t: e.textContent.trim().slice(0, 20) }; }
        return { navTop: Math.round(nr.top), navH: Math.round(nr.height), lastBottom: Math.round(last.bottom), lastT: last.t, covered: last.bottom > nr.top, vh: innerHeight, sh: document.documentElement.scrollHeight };
      });
      console.log(w, r, JSON.stringify(o));
    }
    await ctx.close();
  }
  await b.close();
})();
