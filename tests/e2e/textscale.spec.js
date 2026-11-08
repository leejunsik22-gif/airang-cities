// 글자 크게(갤럭시 '글자 크기' 확대 근사) 자동 검사 v01후보 (2026-11-08)
// 휴대폰 '글자 크기'를 키운 상태를 모든 글자 크기 ×1.3·×1.5 로 근사한다(화면 폭·사진은 그대로 — 실제 안드로이드 글자 확대와 같은 방식).
// 화면 전체 확대(zoom)는 사진 폭(100vw)까지 커져 거짓 경보가 나므로 쓰지 않는다. 최종 판정은 갤럭시 실기기.
// 판정: 가로로 밀리는 화면 없음 / 버튼·제목 글자가 잘리지 않음 / 하단 메뉴 글자 다 보임.
const { test, expect } = require("@playwright/test");

const SCREENS = ["home", "find/" + encodeURIComponent("영어"), "region", "hosp", "bene", "saved", "my"];

test.beforeEach(async ({ page }) => {
  await page.route(/goatcounter\.com|gc\.zgo\.at/, (r) => r.abort());
  await page.route(/raw\.githubusercontent\.com/, (r) => r.abort());
});

for (const scale of [1.3, 1.5]) {
  test(`글자 ${Math.round(scale * 100)}%: 7개 화면 가로 밀림·글자 잘림 없음`, async ({ page }, info) => {
    const bigger = () => page.evaluate((z) => {
      const els = [...document.querySelectorAll("body *")], px = els.map((e) => parseFloat(getComputedStyle(e).fontSize));
      els.forEach((e, i) => { e.style.fontSize = px[i] * z + "px"; });
    }, scale);
    const problems = [];
    for (const s of SCREENS) {
      await page.goto(`/yuseong/?t=${encodeURIComponent(s)}#${s}`);   // 매번 새로 열어 확대가 겹치지 않게
      await expect(page.locator("#view")).not.toBeEmpty();
      await page.waitForLoadState("networkidle");
      await bigger();
      const r = await page.evaluate(() => {
        const out = [];
        const de = document.documentElement;
        if (de.scrollWidth > de.clientWidth + 2) out.push(`가로 밀림 ${de.scrollWidth}>${de.clientWidth}`);
        for (const el of document.querySelectorAll("#view button, #view a, #view h1, #view h2, nav.nav .navi span, .top3 *")) {
          const cs = getComputedStyle(el);
          if (!el.offsetParent || el.children.length > 2) continue;
          const clipX = el.scrollWidth > el.clientWidth + 2 && /hidden|clip/.test(cs.overflowX) && cs.textOverflow !== "ellipsis";
          const clipY = el.scrollHeight > el.clientHeight + 2 && /hidden|clip/.test(cs.overflowY) && !cs.webkitLineClamp;
          if ((clipX || clipY) && el.textContent.trim()) out.push(`글자 잘림: "${el.textContent.trim().slice(0, 16)}"`);
        }
        return out;
      });
      r.forEach((p) => problems.push(`#${decodeURIComponent(s)} ${p}`));
    }
    await page.goto("/yuseong/?t=shot#home"); await page.waitForLoadState("networkidle"); await bigger();
    await info.attach(`홈-${scale}`, { body: await page.screenshot(), contentType: "image/png" });
    expect(problems, "글자 확대 문제").toEqual([]);
  });
}
