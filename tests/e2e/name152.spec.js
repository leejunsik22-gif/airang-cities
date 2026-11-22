// 152: 새 이름 '효숲' (대표 확정 11-22) — 사용자에게 보이는 곳에 옛 이름 '아이랑'이 남지 않는지
const { test, expect } = require("@playwright/test");
const B = "http://127.0.0.1:8791";   /* 문의 화면은 8791 시험 서버 */
const GUS = { djdonggu: "대전 동구", djjunggu: "대전 중구", djseogu: "대전 서구", yuseong: "유성", daedeok: "대덕" };
/* 업데이트 소식의 '아이랑 대전이 …' 두 줄(옛 소식·이름 바뀜 안내)은 기록이라 일부러 남김 → 판정에서 뺌 */
const visible = (t) => t.split("\n").filter((l) => !/아이랑 대전이 (준비 중이에요|'효숲'으로 이름을 바꿨어요)/.test(l)).join("\n");

test.beforeEach(async ({ page }) => {
  await page.route(/goatcounter\.com|gc\.zgo\.at|raw\.githubusercontent\.com/, (r) => r.abort());
});

test("152 이름: 5개 구 홈 제목·머리글이 '효숲 + 구 이름'(지금 이름 그대로: 대전 동구·대전 중구·대전 서구·유성·대덕), 화면에 '아이랑' 없음", async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "글자 확인은 한 폭에서");
  for (const [g, nm] of Object.entries(GUS)) {
    await page.goto(`/${g}/`);
    await expect(page.locator(".brand-round").first()).toContainText("효숲", { timeout: 10000 });
    expect(await page.title(), g).toBe(`효숲 ${nm}`);
    expect(visible(await page.locator("body").innerText()), g).not.toContain("아이랑");
  }
});

test("152 이름: 이용 안내·앱 설치 안내·업데이트 소식", async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "글자 확인은 한 폭에서");
  for (const h of ["#about", "#news"]) {
    await page.goto(`/yuseong/${h}`); await page.waitForTimeout(800);
    expect(visible(await page.locator("#view").innerText()), h).not.toContain("아이랑");
  }
  await page.goto("/yuseong/#news");
  await expect(page.locator("#view")).toContainText("'효숲'으로 이름을 바꿨어요");
});

test("152 이름: 입구·문의하기·관리자 화면·앱 설치 이름(manifest)", async ({ page, request }, info) => {
  test.skip(info.project.name !== "폰390", "글자 확인은 한 폭에서");
  await page.goto("/entry/"); await page.waitForTimeout(800);
  expect(await page.title()).toBe("효숲 대전");
  expect(await page.locator("body").innerText()).not.toContain("아이랑");
  for (const p of ["/inquiry/", "/inquiry/admin/"]) {
    await page.goto(B + p); await page.waitForTimeout(800);
    expect(await page.title(), p).toContain("효숲");
    expect(await page.locator("body").innerText(), p).not.toContain("아이랑");
  }
  const m = await (await request.get("/yuseong/manifest.webmanifest")).json();
  expect(m.name).toBe("효숲 유성");
  expect(JSON.stringify(m)).not.toContain("아이랑");
});

test("152 이름: 서버 거절 안내도 새 이름", async ({ request }, info) => {
  test.skip(info.project.name !== "폰390", "서버 검사는 한 번만");
  const r = await request.post(`${B}/api/inquiry`, { data: { kind: "use", body: "[가상] 연락은 010-1234-5678 로" }, headers: { origin: B } });
  expect(r.status()).toBe(400);
  const j = await r.json();
  expect(j.msg).toContain("효숲은");
  expect(j.msg).not.toContain("아이랑");
});
