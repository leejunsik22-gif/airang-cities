// 아이랑 대전 v3 디자인 자동 검수 (Playwright/Chromium) — 폰 3폭 + 태블릿 + PC, 12화면
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:8766';
const OUTDIR = process.argv[2] || '/home/claude/out/2026-11-04_아이랑대전_033/v3_captures';
const GU = process.argv[3] || 'yuseong';
fs.mkdirSync(OUTDIR, { recursive: true });
const WIDTHS = [[360, 740, true], [390, 844, true], [430, 932, true], [820, 1180, true], [1280, 900, false]];
const SCREENS = [['home', '홈'], ['hosp', '동네병원'], ['bene', '혜택'], ['schools', '학교'], ['acas', '학원'], ['events', '행사'], ['library', '도서관'], ['kinders', '유치원'], ['my', '마이'], ['saved', '저장'], ['find/소아과', '찾기'], ['region', '지역']];
const results = [], audits = [];
const SHOT_W = new Set([390, 820, 1280]);

function lum([r, g, b]) { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }

(async () => {
  const browser = await chromium.launch();
  for (const [w, h, mobile] of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile, locale: 'ko-KR' });
    const page = await ctx.newPage();
    const log = { errors: [], pageerrors: [], f404: [] };
    await page.route(/^https?:\/\/(?!localhost)/, r => r.abort('failed'));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) log.errors.push(m.text()); });
    page.on('pageerror', e => log.pageerrors.push(e.message));
    page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) log.f404.push(r.url().replace(BASE, '') + ' ' + r.status()); });
    for (const [route, label] of SCREENS) {
      log.errors = []; log.pageerrors = []; log.f404 = [];
      await page.goto(`${BASE}/${GU}/index.html#${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      // 글꼴은 외부(차단) → 시스템 글꼴. 사진 로딩 대기
      await page.evaluate(() => Promise.all([...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; }))));
      const info = await page.evaluate(() => {
        const imgs = [...document.images].filter(i => getComputedStyle(i).display !== 'none' && !i.closest('[hidden]'));
        const broken = imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src'));
        const sel = 'a[href],button,[onclick],[role=button],input,select';
        const small = [];
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
          if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[hidden]')) continue;
          if (r.width < 44 || r.height < 44) small.push({ t: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 20), cls: (el.className || '').toString().split(' ').slice(0, 2).join('.'), w: Math.round(r.width), h: Math.round(r.height) });
        }
        // 글자 겹침/넘침: 글자 요소가 부모 밖으로 가로 넘침
        const overflow = [];
        for (const el of document.querySelectorAll('h1,h2,h3,b,span,p,small,button')) {
          if (el.closest('[hidden]')) continue;
          if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow === 'visible' && el.clientWidth > 0 && el.children.length === 0) overflow.push({ t: el.textContent.trim().slice(0, 20), sw: el.scrollWidth, cw: el.clientWidth });
        }
        // 사진 위 글자(hero/topscape 영역) 색: 뒤 배경이 사진이므로 덮개 불투명도로 판단 — 글자 상자 위치가 덮개 .9 구간(아래 34%)에 있는지
        const heroTxt = [];
        const t3 = document.querySelector('.hero-v3 .t3');
        if (t3) { const hr = document.querySelector('.hero-v3').getBoundingClientRect(); for (const el of t3.querySelectorAll('h1,p,.eyebrow3,.dday b,.dday span')) { const r = el.getBoundingClientRect(); heroTxt.push({ t: el.textContent.trim().slice(0, 14), topPct: Math.round((r.top - hr.top) / hr.height * 100) }); } }
        const ts = document.getElementById('topscape');
        let h1Pct = null;
        if (ts && !ts.hidden) { const r = ts.querySelector('div').getBoundingClientRect(); const h1 = document.querySelector('#view h1'); if (h1) { const hr = h1.getBoundingClientRect(); h1Pct = Math.round((hr.top - r.top) / r.height * 100); } }
        const h1 = document.querySelector('#view h1');
        return { scrollW: document.documentElement.scrollWidth, innerW: innerWidth, broken, small, overflow, heroTxt, h1Pct, h1: h1 ? h1.textContent.trim().slice(0, 30) : '', text: document.body.innerText.slice(0, 400), tag: !!document.querySelector('.img-tag:not([hidden] .img-tag)') };
      });
      const hs = info.scrollW > info.innerW;
      const r = { w, route, label, hscroll: hs, broken: info.broken, small: info.small, overflow: info.overflow, heroTxt: info.heroTxt, h1Pct: info.h1Pct, h1: info.h1, jsErr: [...log.errors, ...log.pageerrors], f404: [...new Set(log.f404)], tag: info.tag };
      results.push(r);
      const ok = !hs && !r.broken.length && !r.small.length && !r.overflow.length && !r.jsErr.length;
      console.log(`[${w}] ${label.padEnd(5)} ${ok ? 'PASS' : 'CHECK'} hscroll=${hs} broken=${r.broken.length} small=${r.small.length} overflow=${r.overflow.length} js=${r.jsErr.length} h1Pct=${r.h1Pct} ${r.small.map(s => s.t + s.w + 'x' + s.h).join(',')} ${r.overflow.map(o => o.t).join(',')}`);
      if (SHOT_W.has(w)) await page.screenshot({ path: `${OUTDIR}/${GU}_${label}_${w}.png`, fullPage: route === 'home' || w === 1280 ? true : false });
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(`${OUTDIR}/_results_${GU}.json`, JSON.stringify(results, null, 1));
})();
