// 병원 A+B안 견본 검사 v02후보 (2026-11-09, 대표 승인 '추천대로 견본')
// 병원은 운영에서 공개 보류 중 — 이 검사에서만 보류 수집본(review/yuseong/hospitals.json)에 두 공식 자료 대조 결과(cx)를 붙여 '공개된 것처럼' 확인(운영 변경 없음)
// A: 진료시간 숨김('방문 전 전화 확인'), 시간 거르기·'진료 예정' 표시 없음  B: 대조 불일치(cx=0) 의원은 목록에서 빠짐
// (v01 의 진료시간 표시 검사는 HOSP_HOURS=true 로 되돌릴 때 git 기록에서 다시 살림)
const { test, expect } = require("@playwright/test");
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, "../..");
const CROSS = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures_hosp_cross.json"), "utf8")).yuseong;   // {hpid: 비트(1=통과)}
const RAW = JSON.parse((() => { try { return execFileSync("git", ["show", "origin/main:review/yuseong/hospitals.json"], { cwd: ROOT }).toString(); } catch (e) { return fs.readFileSync(path.join(ROOT, "review/yuseong/hospitals.json"), "utf8"); } })());
RAW.clinics.forEach((x) => { if (x.id in CROSS) x.cx = CROSS[x.id] & 1; });
const FAILED = RAW.clinics.filter((x) => x.cx === 0).map((x) => x.n);
const STATUS = JSON.parse(fs.readFileSync(path.join(ROOT, "data/yuseong/_status.json"), "utf8"));
STATUS.files = STATUS.files || {}; STATUS.files["hospitals.json"] = Object.assign({}, STATUS.files["hospitals.json"] || {}, { published: true });

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "폰390에서 한 번만");
  await page.route(/goatcounter|gc\.zgo\.at/, (r) => r.abort());
  await page.route(/raw\.githubusercontent\.com\/.+\/data\/yuseong\/(.+)$/, (r) => {
    const f = r.request().url().split("/").pop().split("?")[0];
    if (f === "_status.json") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(STATUS) });
    if (f === "hospitals.json") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RAW) });
    return r.abort();
  });
});
const ready = (page) => page.waitForFunction(() => typeof HOSP !== "undefined" && HOSP && (HOSP.clinics || []).length > 0);

test("A: 상세에 진료시간 대신 '방문 전 전화 확인', 출처에 심평원 대조 일치", async ({ page }) => {
  await page.goto("/yuseong/#hosp"); await ready(page);
  await page.evaluate(() => { const i = HOSP.clinics.findIndex((x) => x.n === "가오아이소아청소년과의원" || x.cx === 1); hsDetail("clinics", i); });
  const sh = page.locator("#sheet");
  await expect(sh).toContainText("방문 전에 전화로 확인");
  await expect(sh.locator(".hours")).toHaveCount(0);
  await expect(sh.locator(".hs-special")).toHaveCount(0);
  await expect(sh).toContainText("건강보험심사평가원 자료와 이름·전화·주소 대조 일치");
});

test("A: 목록에 '진료 예정'·시간 거르기 없음", async ({ page }) => {
  await page.goto("/yuseong/#hosp"); await ready(page);
  const v = await page.locator("#view").innerText();
  for (const t of ["진료 예정", "20:00 이상 종료", "일요일·공휴일", "진료 시간 전체"]) expect(v, t).not.toContain(t);
  expect(await page.evaluate(() => hsToday({ h: Array(8).fill("00002359") }))).toBeNull();
});

test("B: 두 공식 자료가 다른 의원은 목록에서 빠짐", async ({ page }) => {
  test.skip(FAILED.length === 0, "유성 불일치 의원 없음");
  await page.goto("/yuseong/#hosp"); await ready(page);
  await page.evaluate(() => { hsGu = "전체"; hsQ = ""; hsDept = "전체"; hsMore = 9999; viewHosp(); });
  const v = await page.locator("#view").innerText();
  for (const n of FAILED) expect(v, n).not.toContain(n);
});

test("소아청소년과 거르기: 이름 대표 과목 기준 유지", async ({ page }) => {
  await page.goto("/yuseong/#hosp"); await ready(page);
  await page.evaluate(() => { hsGu = "전체"; hsQ = ""; hsSet("dept", "소아청소년과"); hsMore = 9999; viewHosp(); });
  const v = await page.locator("#view").innerText();
  expect(v).not.toContain("테크노본정형외과의원");
  expect(v).toMatch(/소아청소년과의원/);
});

test("홈 바로가기 '동네 소아과', 홈·검색 결과에 '지금 문 연'·야간·주말 표시 없음", async ({ page }) => {
  await page.goto("/yuseong/"); await expect(page.locator("#view")).not.toBeEmpty();
  const chip = page.locator(".q-chips .q-chip").first();
  await expect(chip).toHaveText(/동네 소아과/);
  const home = await page.locator("#view").innerText();
  for (const t of ["지금 문 연", "밤에 여는", "주말에 여는", "야간", "진료 예정"]) expect(home, t).not.toContain(t);
  await chip.click(); await ready(page);
  await expect(page).toHaveURL(/#hosp/);
  const v = await page.locator("#view").innerText();
  for (const t of ["지금 문 연", "밤에 여는", "주말", "야간", "20:00", "진료 예정"]) expect(v, t).not.toContain(t);
  expect(await page.evaluate(() => [hsDept, hsOf])).toEqual(["소아청소년과", "전체"]);   // 시간 거르기 없이 소아청소년과만
  await expect(page.locator("#view .btn-3d").filter({ hasText: "소아청소년과" }).first()).toBeVisible();
  // 통합 검색 '소아과'
  await page.goto("/yuseong/?t=s#find/" + encodeURIComponent("소아과")); await expect(page.locator("#view")).not.toBeEmpty(); await page.waitForTimeout(800);
  const f = await page.locator("#view").innerText();
  for (const t of ["지금 문 연", "밤에 여는", "야간", "진료 예정"]) expect(f, t).not.toContain(t);
});

test("휴대폰 상세: '방문 전 전화 확인'과 전화 버튼이 한 화면에 함께 보임", async ({ page }) => {
  await page.goto("/yuseong/#hosp"); await ready(page);
  await page.evaluate(() => hsDetail("clinics", HOSP.clinics.findIndex((x) => x.t)));
  const msg = page.locator("#sheet").getByText("방문 전에 전화로 확인"), call = page.locator("#sheet .acts a[href^='tel:']");
  await expect(msg).toBeInViewport(); await expect(call).toBeInViewport();
});

test("대조 기록 없는 옛 수집본이면 의원 목록을 비움(미대조 의원 노출 안 함)", async ({ page }) => {
  await page.route(/raw\.githubusercontent\.com\/.+\/data\/yuseong\/hospitals\.json/, (r) => { const o = JSON.parse(JSON.stringify(RAW)); o.clinics.forEach((x) => delete x.cx); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) }); });
  await page.goto("/yuseong/#hosp"); await page.waitForFunction(() => typeof HOSP !== "undefined" && HOSP && HOSP.updated);
  expect(await page.evaluate(() => HOSP.clinics.length)).toBe(0);
});


test("B: 불일치 의원은 통합 검색·상세 주소(저장·공유 링크)로도 안 열림", async ({ page }) => {
  const bad = RAW.clinics.filter((x) => x.cx === 0);
  test.skip(bad.length === 0, "유성 불일치 의원 없음");
  await page.goto("/yuseong/#hosp"); await ready(page);
  expect(await page.evaluate((ids) => HOSP.clinics.filter((x) => ids.includes(x.id)).length, bad.map((x) => x.id))).toBe(0);
  for (const x of bad) {
    await page.goto("/yuseong/?t=s#find/" + encodeURIComponent(x.n)); await page.waitForFunction(() => !document.querySelector("#view").innerText.includes("찾는 중"));
    await expect(page.locator("#view")).toContainText("맞는 결과가 없어요");   // 검색창에 적은 글자 말고 결과에는 안 나옴
    expect(await page.locator("#view button.lift, #view .row, #view li").filter({ hasText: x.n }).count(), "검색 " + x.n).toBe(0);
    await page.evaluate((k) => hsOpenByKey(k), x.n + "|" + (x.a || ""));
    await expect(page.locator(".toast, [role=status]").filter({ hasText: "지금 목록에 없는 곳" }).first()).toBeVisible();
    await expect(page.locator("#sheet", { hasText: x.n })).toHaveCount(0);   // 상세 창이 안 열림
  }
});

// ── 2026-11-10 피트: 1차 공개 범위는 대조 통과 의원만. 병원·약국·응급실은 파일에 있어도 화면에 안 열림 ──
test("범위: 병원·약국·응급실 탭이 없고, 파일에 들어 있어도 목록·검색·상세로 안 열림", async ({ page }) => {
  expect(RAW.hospitals.length + RAW.pharm.length + RAW.er.length, "시험 자료에 세 유형이 들어 있어야 함").toBeGreaterThan(0);
  await page.goto("/yuseong/#hosp"); await ready(page);
  const v = page.locator("#view");
  await expect(v).toContainText("병원·약국·응급실 정보는 공식 자료를 확인한 뒤 열어요");
  await expect(v).toContainText("동네 의원을 모았어요");
  for (const t of ["의원", "병원", "약국", "응급실"]) await expect(v.locator("button", { hasText: new RegExp("^\\s*" + t + "\\s*\\d") }), t + " 탭").toHaveCount(0);   // 유형 탭 줄 자체가 없음
  expect(await page.evaluate(() => [HOSP.hospitals.length, HOSP.pharm.length, HOSP.er.length])).toEqual([0, 0, 0]);
  await page.evaluate(() => { hsTab = "pharm"; viewHosp(); });   // 저장된 이전 상태로 약국 탭을 열려 해도 의원으로
  expect(await page.evaluate(() => hsTab)).toBe("clinic");
  for (const x of [RAW.hospitals[0], RAW.pharm[0], RAW.er[0]].filter(Boolean)) {
    await page.evaluate((k) => hsOpenByKey(k), x.n + "|" + (x.a || ""));
    await expect(page.locator("#sheet", { hasText: x.n })).toHaveCount(0);
  }
  const h = RAW.hospitals[0];
  if (h) { await page.goto("/yuseong/?t=s#find/" + encodeURIComponent(h.n)); await page.waitForFunction(() => !document.querySelector("#view").innerText.includes("찾는 중"));
    expect(await page.locator("#view button.lift, #view .row, #view li").filter({ hasText: h.n }).count(), "검색 " + h.n).toBe(0); }
  await page.goto("/yuseong/"); await expect(page.locator(".q-chips")).toBeVisible();
  await expect(page.locator(".q-chips .q-chip", { hasText: "약국" })).toHaveCount(0);
});

test("전화·길찾기: 소아과 상세의 전화번호·지도 검색어가 수집 자료와 같음(유성 전체)", async ({ page }) => {
  await page.goto("/yuseong/#hosp"); await ready(page);
  const kids = await page.evaluate(() => HOSP.clinics.map((x, i) => [x, i]).filter(([x]) => x.p === "소아청소년과").map(([x, i]) => ({ i, n: x.n, t: x.t, a: x.a })));
  expect(kids.length).toBe(19);
  for (const k of kids) {
    await page.evaluate((i) => hsDetail("clinics", i), k.i);
    const tel = await page.locator("#sheet .acts a[href^='tel:']").getAttribute("href");
    expect(tel, k.n).toBe("tel:" + k.t.replace(/[^\d-]/g, ""));
    const map = decodeURIComponent(await page.locator("#sheet .acts a", { hasText: "길찾기" }).getAttribute("href"));
    expect(map.startsWith("https://map.naver.com/p/search/" + k.n), k.n).toBe(true);
    await page.keyboard.press("Escape");
  }
});
