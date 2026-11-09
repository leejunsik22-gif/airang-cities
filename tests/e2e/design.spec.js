// @디자인 — 대표 확정 디자인 일치 검수 v01후보 (2026-11-08)
// 기준: tools/qa/design_baseline.json (원본 그림 docs/design_baseline/…_v01.png)
// 기능 검수(airang·stats·textscale)와 따로 실행·보고: npm run qa:design
// 화면 캡처: docs/design_qa/<날짜>/<화면>_<폭>.jpg (CSS 화소 기준, 육안 대조용)
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const B = require("../../tools/qa/design_baseline.json");

const DAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const SHOTS = path.join(__dirname, "..", "..", "docs", "design_qa", DAY);
fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}_${test.info().project.name}.jpg`), type: "jpeg", quality: 80, scale: "css" });

test.beforeEach(async ({ page }) => {
  await page.route(/goatcounter\.com|gc\.zgo\.at/, (r) => r.abort());
  await page.route(/raw\.githubusercontent\.com/, (r) => r.abort());
});

// 결과를 항목별로 모아 한 번에 판정(어느 항목이 어긋났는지 보고서에 그대로 남도록)
function judge(rows) {
  const bad = rows.filter((r) => !r.ok);
  test.info().annotations.push(...rows.map((r) => ({ type: r.ok ? "일치" : "불일치", description: `${r.k}: ${r.ok ? "" : `기준 ${JSON.stringify(r.want)} / 실제 ${JSON.stringify(r.got)}`}` })));
  expect(bad, "확정 디자인과 다른 항목").toEqual([]);
}

for (const [key, name] of Object.entries(B.names)) {
  test(`@디자인 ${name} 홈: 로고·글씨체·색·사진·배치·문구`, async ({ page }) => {
    await page.goto(`/${key}/`);
    await expect(page.locator(".brand-round").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    const pc = test.info().project.name.startsWith("PC");
    const g = await page.evaluate(() => {
      const q = (s) => document.querySelector(s), cs = (e) => e && getComputedStyle(e);
      const h1 = q(".hero-v3 h1"), logo = q(".brand3 .logo3"), ph = q(".hero-v3 img.ph");
      const ey = [...document.querySelectorAll(".hero-v3 .t3 *")].find((e) => !e.children.length && /· (초등|중등|고등)/.test(e.textContent));
      const tops = (sels) => sels.map((s) => { const e = q(s); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null; });
      return {
        logoSrc: logo && logo.getAttribute("src"), logoOk: !!logo && logo.complete && logo.naturalWidth > 0, logoW: logo && logo.getBoundingClientRect().width,
        logoLeftOfRegion: (() => { const a = q(".brand3"), b = q(".topbar-region"); return !!a && !!b && a.getBoundingClientRect().right <= b.getBoundingClientRect().left; })(),
        titleFont: cs(h1).fontFamily, titleWeight: cs(h1).fontWeight, brandFont: cs(q(".brand-round")).fontFamily, bodyFont: cs(document.body).fontFamily,
        titleColor: cs(h1).color, accent: cs(q(".hero-v3 h1 span")).color, brandColor: cs(q(".brand-round")).color, bg: cs(document.body).backgroundColor,
        photo: ph && (ph.currentSrc || ph.src).split("/").pop(),
        h1: h1.innerText.trim(), brand: q(".brand-round").innerText.trim(), tag: q(".hero-v3 .img-tag") && q(".hero-v3 .img-tag").innerText.trim(),
        eyebrow: ey && ey.textContent.trim(), sub: q(".hero-v3 .t3 p") && q(".hero-v3 .t3 p").innerText.trim(), kid: q(".kidadd b") && q(".kidadd b").innerText.trim(),
        ph: q('form.search-v2 input[name="q"]').placeholder, chips: [...document.querySelectorAll(".q-chips .q-chip")].map((e) => e.innerText.trim()),
        nav: [...document.querySelectorAll("nav.nav .navi")].map((e) => e.innerText.trim()),
        order: tops([".top3", ".hero-v3 h1", ".kidadd", "form.search-v2", ".q-chips", ".home-menu"]),
        tagBetween: (() => { const t = q(".top3").getBoundingClientRect(), a = q(".hero-v3 .img-tag").getBoundingClientRect(), h = q(".hero-v3 h1").getBoundingClientRect(); return a.top >= t.bottom && a.bottom <= h.top + 2; })(),
      };
    });
    const T = (s) => s.replaceAll("{name}", name);
    const sorted = (a) => a.every((v, i) => v !== null && (i === 0 || v > a[i - 1]));
    judge([
      { k: "로고 파일(대표 확정 주황 가족 하트)", ok: g.logoSrc === B.logo.home_src && g.logoOk, want: B.logo.home_src, got: g.logoSrc },
      { k: "로고 크기", ok: g.logoW >= B.logo.min_width, want: `≥${B.logo.min_width}px`, got: g.logoW },
      { k: "로고는 상단 왼쪽(지역 버튼보다 왼쪽)", ok: g.logoLeftOfRegion, want: true, got: g.logoLeftOfRegion },
      { k: "제목 글씨체", ok: g.titleFont.includes(B.fonts.title) && g.titleWeight === B.fonts.title_weight, want: `${B.fonts.title} ${B.fonts.title_weight}`, got: `${g.titleFont} ${g.titleWeight}` },
      { k: "이름 글씨체", ok: g.brandFont.includes(B.fonts.title), want: B.fonts.title, got: g.brandFont },
      { k: "본문 글씨체", ok: g.bodyFont.includes(B.fonts.body), want: B.fonts.body, got: g.bodyFont },
      { k: "제목 남색", ok: g.titleColor === B.colors.navy_title, want: B.colors.navy_title, got: g.titleColor },
      { k: "강조 주황('더 행복한'·구 이름)", ok: g.accent === B.colors.orange_accent, want: B.colors.orange_accent, got: g.accent },
      { k: "이름 갈색", ok: g.brandColor === B.colors.brand_brown, want: B.colors.brand_brown, got: g.brandColor },
      { k: "배경 아이보리", ok: g.bg === B.colors.ivory_bg, want: B.colors.ivory_bg, got: g.bg },
      { k: "첫 사진(엄마·딸)", ok: new RegExp(pc ? B.photo.pc : B.photo.mobile).test(g.photo || ""), want: pc ? B.photo.pc : B.photo.mobile, got: g.photo },
      { k: "제목 문구", ok: g.h1 === T(B.texts.h1), want: T(B.texts.h1), got: g.h1 },
      { k: "상단 이름", ok: g.brand === T(B.texts.brand), want: T(B.texts.brand), got: g.brand },
      { k: "AI 표기 문구", ok: g.tag === B.texts.ai_tag, want: B.texts.ai_tag, got: g.tag },
      { k: "AI 표기 위치(상단 바 아래·제목 위)", ok: g.tagBetween, want: true, got: g.tagBetween },
      { k: "지역·학교급 표시", ok: !!g.eyebrow && g.eyebrow.startsWith(name + " · "), want: `${name} · …`, got: g.eyebrow },
      { k: "소개 문구", ok: g.sub === B.texts.sub, want: B.texts.sub, got: g.sub },
      { k: "우리 아이 추가", ok: g.kid === B.texts.kid, want: B.texts.kid, got: g.kid },
      { k: "검색 안내", ok: g.ph === B.texts.placeholder, want: B.texts.placeholder, got: g.ph },
      { k: "빠른 메뉴 앞 2개(첫 칸은 시간대에 따라 '밤에 여는'/'지금 문 연' 소아과)", ok: ["밤에 여는 소아과", "지금 문 연 소아과"].includes(g.chips[0]) && g.chips[1] === B.texts.chips_first[1], want: B.texts.chips_first, got: g.chips.slice(0, 2) },
      { k: "하단 메뉴 5개", ok: JSON.stringify(g.nav) === JSON.stringify(B.texts.nav), want: B.texts.nav, got: g.nav },
      { k: "배치 순서(상단→제목→아이 추가→검색→빠른 메뉴→메뉴판)", ok: sorted(g.order), want: "위에서 아래로 차례", got: g.order },
    ]);
    await shot(page, `${key}_home`);
  });
}

test("@디자인 입구: 확정 로고·안내 문구·글씨체", async ({ page }) => {
  await page.goto("/entry/");
  await page.waitForLoadState("networkidle");
  const g = await page.evaluate(() => {
    const logo = document.querySelector(".top img");
    return { src: logo && logo.getAttribute("src"), ok: !!logo && logo.complete && logo.naturalWidth > 0,
      tag: document.querySelector(".fam-tag")?.innerText.trim(), h1: document.querySelector("h1")?.innerText.trim(),
      body: getComputedStyle(document.body).fontFamily,
      tagOnFace: (() => { const p = document.querySelector(".fam-pic").getBoundingClientRect(), t = document.querySelector(".fam-tag").getBoundingClientRect(); return t.top < p.top + p.height * 0.6; })() };
  });
  judge([
    { k: "입구 로고(대표 확정 주황 가족 하트)", ok: g.src === B.logo.entry_src && g.ok, want: B.logo.entry_src, got: g.src },
    { k: "입구 사진 표기 문구", ok: g.tag === B.texts.entry_tag, want: B.texts.entry_tag, got: g.tag },
    { k: "입구 사진 표기가 얼굴 영역(위 60%) 밖", ok: !g.tagOnFace, want: "아래 띠", got: g.tagOnFace ? "위쪽(얼굴 가림 위험)" : "아래" },
    { k: "입구 제목", ok: g.h1 === B.texts.entry_h1, want: B.texts.entry_h1, got: g.h1 },
    { k: "입구 본문 글씨체", ok: g.body.includes(B.fonts.body), want: B.fonts.body, got: g.body },
  ]);
  await shot(page, "entry");
});

// 삽화풍 이미지 금지(2026-11-09) — 입구 + 5개 구 앱의 여러 화면에서 실제로 보이는 그림 파일을 모두 모아 검사
async function usedImages(page) {
  return page.evaluate(() => {
    const urls = [...document.images].filter((i) => i.offsetParent).map((i) => i.currentSrc || i.src);
    document.querySelectorAll("*").forEach((e) => { if (!e.offsetParent && e !== document.body) return; const bg = getComputedStyle(e).backgroundImage; for (const m of bg.matchAll(/url\("?([^")]+)"?\)/g)) urls.push(m[1]); });
    return [...new Set(urls.map((u) => u.split("/").pop().split("?")[0]))];
  });
}
test("@디자인 삽화풍 이미지 없음(입구 + 5개 구 주요 화면)", async ({ page }) => {
  test.setTimeout(240_000);   // 화면 51개를 차례로 열어 봄
  const found = [];
  await page.goto("/entry/"); await page.waitForLoadState("networkidle");
  (await usedImages(page)).filter((f) => B.no_illustration.files.includes(f)).forEach((f) => found.push(`입구: ${f}`));
  for (const key of Object.keys(B.names)) {
    for (const r of ["home", "my", "saved", "region", "find/" + encodeURIComponent("영어"), "acas", "schools", "hosp", "bene", "kid/new"]) {
      await page.goto(`/${key}/?r=${encodeURIComponent(r)}#${r}`); await page.waitForLoadState("networkidle");
      (await usedImages(page)).filter((f) => B.no_illustration.files.includes(f)).forEach((f) => found.push(`${key} #${decodeURIComponent(r)}: ${f}`));
    }
  }
  test.info().annotations.push({ type: found.length ? "불일치" : "일치", description: `삽화풍: ${found.join(" / ") || "없음"}` });
  expect(found, "고객 화면에 남은 삽화풍 이미지").toEqual([]);
});

test("@디자인 입구: 카드 사진 AI 생성 표기(사진 밖 별도 줄)", async ({ page }) => {
  await page.goto("/entry/"); await page.waitForLoadState("networkidle");
  const t = await page.locator(".ai-note").first().innerText();
  expect(t, "카드 사진 AI 표기").toContain("AI 생성 이미지");
  const inside = await page.evaluate(() => { const n = document.querySelector(".ai-note").getBoundingClientRect(); return [...document.querySelectorAll(".city .pic")].some((p) => { const b = p.getBoundingClientRect(); return n.top < b.bottom && n.bottom > b.top && n.left < b.right && n.right > b.left; }); });
  expect(inside, "표기가 사진 위에 겹침").toBe(false);
});

// 2026-11-09 견본 육안에서 발견: 긴 구 이름이 공유 버튼 뒤로 잘림 — 글자 내용 검사로는 못 잡아 '보이는 영역' 검사 추가
for (const [key, name] of Object.entries(B.names)) {
  test(`@디자인 ${name}: 상단 이름이 잘리거나 버튼에 가리지 않음`, async ({ page }) => {
    await page.goto(`/${key}/`); await expect(page.locator(".brand-round").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const t = document.querySelector(".brand-round"), box = document.querySelector(".brand3").getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(t); const tx = range.getBoundingClientRect();
      const btns = [...document.querySelectorAll(".top3 > button")].map((b) => b.getBoundingClientRect());
      return { textRight: Math.round(tx.right), boxRight: Math.round(box.right), firstBtnLeft: Math.round(Math.min(...btns.map((b) => b.left))), clipped: t.scrollWidth > t.clientWidth + 1, fs: getComputedStyle(t).fontSize };
    });
    expect(r.clipped, "이름 글자 넘침").toBe(false);
    expect(r.textRight, `이름 끝(${r.textRight})이 받침(${r.boxRight}) 안`).toBeLessThanOrEqual(r.boxRight + 1);
    expect(r.boxRight, `받침 끝이 버튼(${r.firstBtnLeft})보다 왼쪽`).toBeLessThanOrEqual(r.firstBtnLeft);
  });
}

// 2026-11-09 대표 실화면 확인에서 나온 작은 점 3건
test("@디자인 홈: 오픈 전 알림 카드('준비 중이에요') 없음", async ({ page }) => {
  for (const key of Object.keys(B.names)) {
    await page.goto(`/${key}/`); await expect(page.locator(".brand-round").first()).toBeVisible(); await page.waitForLoadState("networkidle");
    await expect(page.locator("#view"), key).not.toContainText("준비 중이에요 ›");
  }
});
test("@디자인 검색 화면: 하단 메뉴 '홈'에 불", async ({ page }) => {
  await page.goto("/yuseong/#find/" + encodeURIComponent("영어")); await page.waitForLoadState("networkidle");
  await expect(page.locator('nav.nav .navi[data-tab="home"]')).toHaveClass(/\bon\b/);
  await expect(page.locator('nav.nav .navi[data-tab="my"]')).not.toHaveClass(/\bon\b/);
});
test("@디자인 하위 화면 위쪽 사진 띠: AI 표기가 화면 안쪽(오른쪽 끝에서 14px 이상)", async ({ page }) => {
  for (const w of [1280, 1540, 1920, 820]) {
    await page.setViewportSize({ width: w, height: 850 });
    await page.goto("/yuseong/?w=" + w + "#find/" + encodeURIComponent("영어")); await page.waitForLoadState("networkidle");
    const r = await page.evaluate(() => { const t = document.querySelector("#topscape .img-tag").getBoundingClientRect(); return { left: t.left, right: t.right, cw: document.documentElement.clientWidth, h: t.height }; });
    expect(r.right, `${w}px: 표기 오른쪽 끝`).toBeLessThanOrEqual(r.cw - 14);
    expect(r.h, `${w}px: 한 줄`).toBeLessThan(30);
  }
});
