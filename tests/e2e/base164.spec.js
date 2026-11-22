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
