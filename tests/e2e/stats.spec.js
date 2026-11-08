// 아이랑 방문 통계(GoatCounter) 자동 검사 — 앱을 연 뒤 통계가 제대로·안전하게 쌓이는지 (v01후보, 2026-11-08)
// 실제 GoatCounter로는 아무것도 보내지 않는다: count.js 를 가짜로 바꿔 '보내려던 내용'만 기록해 검사한다.
const { test, expect } = require("@playwright/test");

const GU = ["djdonggu", "djjunggu", "djseogu", "yuseong", "daedeok"];
const FAKE = "window.__gc=[];window.goatcounter={count:function(o){window.__gc.push(o)}};";

test.beforeEach(async ({ page }) => {
  await page.route(/gc\.zgo\.at\/count\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: FAKE }));
  await page.route(/goatcounter\.com/, (r) => r.abort());          // 혹시 모를 실제 전송 차단
  await page.route(/raw\.githubusercontent\.com/, (r) => r.abort());
});
const sent = (page) => page.evaluate(() => (window.__gc || []).map((o) => ({ path: o.path, event: !!o.event })));
async function settle(page) { await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200); }   // 앱은 0.5초 간격으로 통계 준비를 기다림

for (const key of GU) {
  test(`${key}: 구별 통계 주소 분리`, async ({ page }) => {
    await page.goto(`/${key}/`);
    const dest = await page.locator("script[data-goatcounter]").getAttribute("data-goatcounter");
    expect(dest, "이 구 전용 통계 사이트").toBe(`https://${key}-edu-app.goatcounter.com/count`);
  });
}

test("앱을 열면 방문(하루·새로/다시)과 첫 화면이 집계됨", async ({ page }) => {
  await page.goto("/yuseong/");
  await settle(page);
  const s = await sent(page);
  const paths = s.map((x) => x.path);
  expect(paths, "첫 화면 보기").toContain("/home");
  expect(paths, "하루 방문자").toContain("방문-하루");
  expect(paths.some((p) => p === "방문-새로" || p === "방문-다시"), "신규/재방문 구분").toBe(true);
  expect(paths.some((p) => /^방문-열기-\d+$/.test(p)), "하루 열기 횟수").toBe(true);
  // 같은 날 다시 열면 '하루 방문자'는 다시 세지 않음(중복 방지)
  await page.reload(); await settle(page);
  const again = (await sent(page)).map((x) => x.path);
  expect(again.filter((p) => p === "방문-하루"), "같은 날 재방문 중복 집계").toEqual([]);
});

test("검색: 실행 횟수는 세고, 검색어는 절대 보내지 않음", async ({ page }) => {
  const WORD = "수학";
  await page.goto("/yuseong/");
  await settle(page);
  await page.locator('form.search-v2 input[name="q"]').fill(WORD);
  await page.locator("form.search-v2 button[type=submit]").click();
  await settle(page);
  const s = await sent(page);
  expect(s.map((x) => x.path), "검색 실행 집계").toContain("찾기");
  const leak = s.filter((x) => x.path.includes(WORD) || x.path.includes(encodeURIComponent(WORD)));
  expect(leak, "검색어가 통계로 나감(개인정보 위험)").toEqual([]);
});

test("메뉴 이동이 화면별로 집계됨(병원·혜택 등)", async ({ page }) => {
  await page.goto("/yuseong/");
  await settle(page);
  for (const tab of ["hosp", "bene", "saved", "my"]) await page.locator(`nav.nav .navi[data-tab="${tab}"]`).tap();
  await settle(page);
  const paths = (await sent(page)).map((x) => x.path);
  for (const p of ["/hosp", "/bene", "/saved", "/my"]) expect(paths, `${p} 화면 집계`).toContain(p);
});

test("보낸 통계에 전화번호·주소 같은 개인정보 형태가 없음", async ({ page }) => {
  await page.goto("/yuseong/");
  await settle(page);
  for (const tab of ["hosp", "bene", "my", "home"]) await page.locator(`nav.nav .navi[data-tab="${tab}"]`).tap();
  await page.locator('form.search-v2 input[name="q"]').fill("010-1234-5678");   // 가상 번호
  await page.locator("form.search-v2 button[type=submit]").click();
  await settle(page);
  const bad = (await sent(page)).filter((x) => /\d{2,4}-?\d{3,4}-?\d{4}|[가-힣]+(로|길)\s?\d+|@/.test(decodeURIComponent(x.path)));
  expect(bad, "개인정보 형태 전송").toEqual([]);
});

test("관리자 표시(?nocount=1)면 아무것도 집계하지 않음", async ({ page }) => {
  await page.goto("/yuseong/?nocount=1");
  await settle(page);
  expect(await sent(page), "관리자 방문 제외").toEqual([]);
});
