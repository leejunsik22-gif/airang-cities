// 155: 효숲 로고(나무)·앱 아이콘 교체 + 이용 안내 '효숲 이야기' — 옛 주황 로고가 남지 않았는지
const { test, expect } = require("@playwright/test");

/* 그림을 캔버스에 그려 초록(숲) 점과 주황(옛 로고) 점 수를 셈 */
async function colors(page, src) {
  return page.evaluate(async (src) => {
    const im = new Image(); im.src = src; await im.decode();
    const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext("2d"); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
    let green = 0, orange = 0;
    for (let i = 0; i < d.length; i += 4) { const [r, g, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]]; if (a < 128) continue;
      if (g > r + 15 && g > b) green++; if (r > 200 && g > 100 && g < 190 && b < 90) orange++; }
    return { green, orange };
  }, src);
}

test.beforeEach(async ({ page }) => { await page.route(/goatcounter\.com|gc\.zgo\.at|raw\.githubusercontent\.com/, (r) => r.abort()); });

test("155 로고: 홈 머리글·입구 로고·앱 아이콘·구 카드 그림이 초록 나무, 옛 주황 로고 없음", async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "그림 확인은 한 번만");
  await page.goto("/yuseong/");
  for (const src of ["assets/brand/logo-symbol.png", "icon-192.png", "icon-512.png", "../entry/img/logo-symbol.png", "../entry/icon-192.png", "../entry/img/tile-yuseong.png", "../entry/img/tile-djdonggu.png"]) {
    const c = await colors(page, src);
    expect(c.green, src + " 초록").toBeGreaterThan(200);
    expect(c.orange, src + " 주황").toBeLessThan(20);
  }
});

test("155 이용 안내에 '효숲 이야기'(효·숲 뜻, 세 세대), 입구 아래에 한 줄 소개", async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "글자 확인은 한 폭에서");
  await page.goto("/yuseong/#about");
  await expect(page.locator("#view")).toContainText("효숲 이야기", { timeout: 10000 });
  const t = await page.locator("#view").innerText();
  for (const w of ["효(孝)", "여러 그루가 함께 자라는", "세 세대", "Hyo Forest"]) expect(t).toContain(w);
  await page.goto("/entry/");
  await expect(page.locator(".foot")).toContainText("세 세대가 함께 자라는 숲");
});
