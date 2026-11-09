// 병원 표시 보완 검사 v01후보 (2026-11-09, 피트 038 표본 검수 지시)
// 병원은 운영에서 공개 보류 중이라, 이 검사에서만 '공개된 것처럼' 보류 수집본(review/yuseong/hospitals.json)을 넣어 화면을 확인한다(운영 변경 없음).
// ① 원자료 빈 칸은 '휴진'이 아니라 '정보 없음'  ② 야간·토·일·공휴일을 각각 표시  ③ 신고 과목만으로는 소아청소년과 검색에 안 들어감
const { test, expect } = require("@playwright/test");
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, "../..");
const HOSP = (() => { try { return execFileSync("git", ["show", "origin/main:review/yuseong/hospitals.json"], { cwd: ROOT }).toString(); } catch (e) { return fs.readFileSync(path.join(ROOT, "review/yuseong/hospitals.json"), "utf8"); } })();
const STATUS = JSON.parse(fs.readFileSync(path.join(ROOT, "data/yuseong/_status.json"), "utf8"));
STATUS.files = STATUS.files || {}; STATUS.files["hospitals.json"] = Object.assign({}, STATUS.files["hospitals.json"] || {}, { published: true });

test.use({ serviceWorkers: "block" });   // 서비스워커가 자료 요청을 가로채면 이 검사의 가짜 자료가 안 들어감

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "폰390에서 한 번만");
  await page.route(/goatcounter|gc\.zgo\.at/, (r) => r.abort());
  await page.route(/raw\.githubusercontent\.com\/.+\/data\/yuseong\/(.+)$/, (r) => {
    const f = r.request().url().split("/").pop().split("?")[0];
    if (f === "_status.json") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(STATUS) });
    if (f === "hospitals.json") return r.fulfill({ status: 200, contentType: "application/json", body: HOSP });
    return r.abort();
  });
});

async function openClinic(page, name) {
  await page.goto("/yuseong/#hosp"); await expect(page.locator("#view")).toContainText("동네 병원");
  await page.waitForFunction(() => typeof HOSP !== "undefined" && HOSP && (HOSP.clinics || []).length > 0);
  await page.evaluate((n) => { const i = HOSP.clinics.findIndex((x) => x.n === n); hsDetail("clinics", i); }, name);
  return page.locator("#sheet");
}

test("테크노본정형외과의원: 금 20:00 종료는 야간에 표시, 일·공휴일 빈 칸은 '정보 없음'", async ({ page }) => {
  const sh = await openClinic(page, "테크노본정형외과의원");
  await expect(sh.locator(".hours")).not.toContainText("휴진");
  await expect(sh.locator(".hours")).toContainText("정보");
  const sp = sh.locator(".hs-special");
  await expect(sp).toContainText("야간(밤 8시 이후)금 ~20:00");
  await expect(sp).toContainText("토요일09:00~13:00");
  await expect(sp).toContainText("일요일정보 없음(전화 확인)");
  await expect(sp).toContainText("공휴일정보 없음(전화 확인)");
});

test("소아청소년과 거르기: 대표 과목 기준(정형외과·외과·이비인후과 의원은 빠짐)", async ({ page }) => {
  await page.goto("/yuseong/#hosp"); await page.waitForFunction(() => typeof HOSP !== "undefined" && HOSP && (HOSP.clinics || []).length > 0);
  await page.evaluate(() => { hsGu = "전체"; hsQ = ""; hsOf = "전체"; hsSet("dept", "소아청소년과"); hsMore = 9999; viewHosp(); });
  const txt = await page.locator("#view").innerText();
  expect(txt, "정형외과의원이 소아과 목록에 없어야 함").not.toContain("테크노본정형외과의원");
  expect(txt, "소아청소년과의원은 그대로 보여야 함").toMatch(/소아청소년과의원|소아과의원/);
});

test("목록의 '오늘' 표시: 빈 칸이면 '휴진' 대신 '정보 없음'", async ({ page }) => {
  await page.goto("/yuseong/#hosp"); await page.waitForFunction(() => typeof HOSP !== "undefined" && HOSP && (HOSP.clinics || []).length > 0);
  const t = await page.evaluate(() => hsToday({ h: ["", "", "", "", "", "", "", ""] }).text);
  expect(t).toBe("오늘 진료시간 정보 없음(전화 확인)");
});
