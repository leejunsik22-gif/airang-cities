// 164: 검색엔진 대표 주소 = https://hyoforest.com (cities.json base) + 입구 '동네 정보 모아보기' 링크 글자가 공개 메뉴(학원·학교 일정)만
const { test, expect } = require("@playwright/test");

test("164 입구 동네 정보 링크: hyoforest.com 주소, 유치원·소아과 글자 없음", async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "한 번만");
  await page.route(/goatcounter\.com|gc\.zgo\.at|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.goto("/entry/");
  const links = await page.locator(".guides a").evaluateAll((as) => as.map((a) => ({ t: a.innerText.trim(), h: a.getAttribute("href") })));
  expect(links.length).toBe(5);
  for (const l of links) {
    expect(l.h).toMatch(/^https:\/\/hyoforest\.com\/[a-z]+\/guide\/$/);
    expect(l.t).toContain("학원·학교 일정");
    expect(l.t).not.toMatch(/유치원|소아과|병원|혜택/);
  }
});

/* 164: 앱 안 '다른 지역 둘러보기' 링크는 상대 주소(/구/) — 보고 있는 주소(도메인) 그대로 이동해 저장 정보가 이어짐 */
test("164 다른 지역 링크: 같은 주소 안으로 이동(상대 주소)", async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "한 번만");
  await page.route(/goatcounter\.com|gc\.zgo\.at|raw\.githubusercontent\.com/, (r) => r.abort());
  await page.goto("/yuseong/#my"); await page.waitForTimeout(1200);
  const hrefs = await page.locator(".oc-list a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(hrefs.length).toBe(4);
  for (const h of hrefs) expect(h).toMatch(/^\/(djdonggu|djjunggu|djseogu|daedeok)\/$/);
  const abs = await page.locator(".oc-list a").first().evaluate((a) => a.href);
  expect(new URL(abs).origin).toBe(new URL(page.url()).origin);
});
