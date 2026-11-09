// 아이랑 문의하기 A안(Pages Functions + D1) 자동 검사 v01후보 (2026-11-09)
// 시험 서버: tools/qa/pages_dev.mjs (8791) — 메모리 저장, 운영·Cloudflare 계정과 무관. 모든 문의는 [가상].
// 058 재시험에서 나온 문제(도배·개인정보·한글 길이·이메일 형식·없는 번호·100건 제한·보관 기간)를 각각 확인한다.
const { test, expect } = require("@playwright/test");
const B = "http://127.0.0.1:8791";
let n = 0;
const ip = (tag) => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${(++n % 250) + 1}-${tag}`;
const tag = () => `[가상-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}]`;
async function post(request, data, { origin = B, who } = {}) {
  const r = await request.post(`${B}/api/inquiry`, { data, headers: { origin, "x-test-ip": who || ip("api") } });
  return { status: r.status(), body: await r.json() };
}
async function adminCtx(browser, email = "admin@test.invalid", q = "") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "ko-KR" });
  await ctx.request.get(`${B}/__test/login?email=${encodeURIComponent(email)}${q}`);
  return ctx;
}
const only390 = (info) => test.skip(info.project.name !== "폰390", "관리자·서버 검사는 폰390에서 한 번만");

test.beforeEach(async ({ page }) => { await page.route(/fonts\.(googleapis|gstatic)\.com|goatcounter|gc\.zgo\.at/, (r) => r.abort()); });

// ── 이용자 화면 ──
test("입구 '문의하기' → 문의 화면으로 이동", async ({ page }) => {
  await page.goto("/entry/");
  await expect(page.locator("#btn-contact")).toHaveAttribute("href", "../inquiry/");
  const m = await page.locator("#btn-contact").evaluate((e) => ({ h: e.getBoundingClientRect().height, cut: e.scrollWidth > e.clientWidth + 1 }));
  expect(m.h).toBeLessThanOrEqual(50); expect(m.cut).toBe(false);
});

for (const [k, label, must] of [["fix", "정보 수정·오류 신고", "틀린 내용:"], ["use", "이용 문의", ""], ["ad", "광고·제휴 문의", "업체명:"]]) {
  test(`화면에서 접수: ${label}`, async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-test-ip": ip(k) });
    await page.goto(`${B}/inquiry/`);
    await expect(page.locator(".warn")).toHaveText("아이 이름·학교·건강 정보는 적지 말아 주세요.");
    await page.locator(`input[name=kind][value=${k}]`).check();
    if (must) await expect(page.locator("#body")).toHaveValue(new RegExp(must));
    await page.locator("#body").fill(`${tag()} ${label} 시험`);
    await page.locator("#send").click();
    await expect(page.locator(".done")).toContainText("문의가 접수됐어요");
    await expect(page.locator(".done .num")).toHaveText(/접수 번호 \d+/);
    const sx = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    expect(sx, "가로 밀림").toBe(false);
  });
}

test("오류 신고 주소로 열면 구·화면이 미리 채워짐", async ({ page }) => {
  await page.goto(`${B}/inquiry/?kind=fix&gu=${encodeURIComponent("유성")}&screen=${encodeURIComponent("학원 상세")}`);
  await expect(page.locator("input[value=fix]")).toBeChecked();
  await expect(page.locator("#body")).toHaveValue(/^구·화면: 유성 \/ 학원 상세\n틀린 내용:/);
  await page.locator("#send").click();   // 양식만 있고 내용을 안 적으면 안 보냄
  await expect(page.locator("#err")).toHaveText("문의 내용을 적어 주세요.");
});

test("입력 오류 안내: 유형 없음 · 전화번호 · 회신 이메일 형식", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-test-ip": ip("err") });
  await page.goto(`${B}/inquiry/`);
  await expect(page.locator("#body"), "유형 고르기 전엔 칸이 접혀 있음").toBeHidden();
  await page.locator("#send").click();
  await expect(page.locator("#err")).toHaveText("문의 유형을 골라 주세요.");
  await page.locator("input[value=use]").check();
  await expect(page.locator("#body"), "유형을 고르면 칸이 펼쳐짐").toBeVisible();
  await page.locator("#body").fill("[가상] 연락 주세요 010-0000-0000");
  await page.locator("#send").click();
  await expect(page.locator("#err")).toContainText("전화번호는 지워 주세요");
  await page.locator("#body").fill("[가상] 사용법 문의");
  await page.locator("#reply").fill("이메일아님");
  await page.locator("#send").click();
  await expect(page.locator("#err")).toContainText("회신 이메일 형식");
  await expect(page.locator("#reply")).toBeFocused();
});

// ── 서버 검사(058 문제 보완 확인) ──
test("서버: 한글 2000자 접수 · 2001자 거절 · 이메일 형식 · 주민번호 · 제휴 연락처 허용", async ({ request }, info) => {
  only390(info);
  expect((await post(request, { kind: "use", body: "가".repeat(2000) })).status, "한글 2000자").toBe(200);
  expect((await post(request, { kind: "use", body: "가".repeat(2001) })).status).toBe(400);
  expect((await post(request, { kind: "use", body: "[가상]", reply: "이메일아님" })).body.field).toBe("reply");
  expect((await post(request, { kind: "use", body: "[가상]", reply: "test@example.com" })).status).toBe(200);
  expect((await post(request, { kind: "fix", body: "[가상] 900101-1234567" })).body.msg).toContain("주민등록번호");
  expect((await post(request, { kind: "ad", body: "[가상] 담당 010-0000-0000" })).status, "제휴는 연락처 허용").toBe(200);
  expect((await post(request, { kind: "기타", body: "x" })).status).toBe(400);
  expect((await post(request, { kind: "use", body: "   " })).status).toBe(400);
  expect((await post(request, { kind: "use", body: "x" }, { origin: "https://evil.example" })).status, "다른 사이트에서 보냄").toBe(403);
  const big = await request.post(`${B}/api/inquiry`, { data: { kind: "use", body: "a".repeat(40000) }, headers: { origin: B, "x-test-ip": ip("big") } });
  expect(big.status()).toBe(413);
});

test("서버: 도배 막기 — 같은 기기 10분에 5건까지", async ({ request }, info) => {
  only390(info);
  const who = ip("flood"), codes = [];
  for (let i = 0; i < 8; i++) codes.push((await post(request, { kind: "use", body: `[가상] 도배 ${i}` }, { who })).status);
  expect(codes.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
  expect(codes.slice(5)).toEqual([429, 429, 429]);
  expect((await post(request, { kind: "use", body: "[가상] 다른 기기" })).status, "다른 기기는 영향 없음").toBe(200);
});

test("서버: 로봇용 숨은 칸이 채워지면 저장하지 않음", async ({ request, browser }, info) => {
  only390(info);
  const t = tag();
  expect((await post(request, { kind: "use", body: `${t} 로봇`, website: "http://spam" })).body.ticket).toBe(0);
  const ctx = await adminCtx(browser);
  const d = await (await ctx.request.get(`${B}/api/inquiry/admin`)).json();
  expect(d.items.some((x) => x.body.includes(t))).toBe(false);
  await ctx.close();
});

// ── 관리자 ──
test("관리자: 로그인 없음·다른 메일·다른 앱·만료 증표는 차단", async ({ browser, request }, info) => {
  only390(info);
  expect((await request.get(`${B}/api/inquiry/admin`)).status()).toBe(401);
  for (const [email, q, code] of [["someone@test.invalid", "", 403], ["admin@test.invalid", "&aud=other", 401], ["admin@test.invalid", "&exp=-60", 401]]) {
    const ctx = await adminCtx(browser, email, q);
    expect((await ctx.request.get(`${B}/api/inquiry/admin`)).status(), `${email}${q}`).toBe(code);
    await ctx.close();
  }
  const ctx = await browser.newContext(); await ctx.addCookies([{ name: "CF_Authorization", value: "a.b.c", url: B }]);
  expect((await ctx.request.get(`${B}/api/inquiry/admin`)).status(), "위조 증표").toBe(401);
  const page = await ctx.newPage(); await page.goto(`${B}/inquiry/admin/`);
  await expect(page.locator("#list")).toContainText("관리자 로그인이 필요해요");
  await ctx.close();
});

test("관리자: 새 문의 → 처리 중 → 완료, 필터·삭제·없는 번호", async ({ browser, request }, info) => {
  only390(info);
  const t = tag();
  const { body: { ticket } } = await post(request, { kind: "fix", body: `${t} <script>alert(1)</script> 상태 시험`, reply: "parent@example.com", gu: "유성", screen: "학원 상세" });
  const ctx = await adminCtx(browser); const page = await ctx.newPage();
  page.on("dialog", (d) => { throw new Error("대화상자 뜸: " + d.message()); });
  await page.goto(`${B}/inquiry/admin/`);
  await expect(page.locator('.tab.on'), "처음엔 '새 문의'부터").toHaveAttribute("data-s", "새 문의");
  expect(+(await page.locator("#newN").textContent()), "새 문의 건수 표시").toBeGreaterThan(0);
  const first = await page.evaluate(() => [document.querySelector("#today").getBoundingClientRect().top, document.querySelector("#list").getBoundingClientRect().top]);
  expect(first[0], "새 문의 건수가 목록보다 위").toBeLessThan(first[1]);
  const card = page.locator(`.item[data-id="${ticket}"]`);
  await expect(card).toBeVisible();
  await page.locator('.tab[data-s=""]').click();
  await expect(card).toContainText("<script>alert(1)</script>");        // 글자로만 보임
  expect(await card.locator("script").count()).toBe(0);
  await expect(card.locator(".meta")).toContainText("보낸 화면: 유성 / 학원 상세");
  await expect(card.locator(".meta a")).toHaveAttribute("href", /^mailto:parent@example\.com\?subject=/);
  for (const s of ["처리 중", "완료"]) {
    await card.locator("select").selectOption(s); await card.locator(".save").click();
    await expect(page.locator("#toast")).toContainText(`#${ticket} 상태를 저장했어요`);
    await expect(card.locator(".pill").nth(1)).toHaveText(s);
  }
  await page.locator('.tab[data-s="완료"]').click();
  await expect(card).toBeVisible();
  await page.locator('.tab[data-s="새 문의"]').click();
  await expect(card).toHaveCount(0);
  await page.locator('.tab[data-s=""]').click();
  await card.locator(".del").click(); await expect(card.locator(".del")).toHaveText("정말 삭제");
  await card.locator(".del").click();
  await expect(page.locator("#toast")).toContainText(`#${ticket} 문의를 지웠어요`);
  await expect(card).toHaveCount(0);
  const no = await ctx.request.post(`${B}/api/inquiry/admin`, { data: { action: "state", id: 999999, state: "완료" }, headers: { origin: B } });
  expect(no.status(), "없는 번호").toBe(404);
  const cross = await ctx.request.post(`${B}/api/inquiry/admin`, { data: { action: "delete", id: 1 }, headers: { origin: "https://evil.example" } });
  expect(cross.status(), "다른 사이트에서 삭제 시도").toBe(403);
  const badState = await ctx.request.post(`${B}/api/inquiry/admin`, { data: { action: "state", id: 1, state: "삭제" }, headers: { origin: B } });
  expect(badState.status()).toBe(400);
  const sx = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  expect(sx, "가로 밀림").toBe(false);
  await ctx.close();
});

test("관리자: 30건씩 쪽 나눔(058: 100건만 보이던 문제)", async ({ browser, request }, info) => {
  only390(info);
  for (let i = 0; i < 31; i++) await post(request, { kind: "use", body: `[가상] 쪽 ${i}` });
  const ctx = await adminCtx(browser); const page = await ctx.newPage();
  await page.goto(`${B}/inquiry/admin/`);
  await expect(page.locator(".item")).toHaveCount(30);
  await expect(page.locator("#pager")).toContainText("1 /");
  await page.locator('#pager [data-p="2"]').click();
  await expect(page.locator("#pager")).toContainText("2 /");
  await expect(page.locator(".item").first()).toBeVisible();
  await ctx.close();
});

test("보관 기간: 완료 90일 뒤·미처리 180일 뒤 자동 삭제, 그 전엔 남음 + 곧 삭제 표시", async ({ browser, request }, info) => {
  only390(info);
  const DAY = 86400000, ids = {};
  for (const k of ["done91", "done89", "open181", "open170", "open100"]) ids[k] = (await post(request, { kind: "use", body: `[가상] 보관 ${k}` })).body.ticket;
  const ctx = await adminCtx(browser);
  for (const k of ["done91", "done89"]) await ctx.request.post(`${B}/api/inquiry/admin`, { data: { action: "state", id: ids[k], state: "완료" }, headers: { origin: B } });
  for (const [k, d] of [["done91", 91], ["done89", 89], ["open181", 181], ["open170", 170], ["open100", 100]]) await ctx.request.get(`${B}/__test/age?id=${ids[k]}&ms=${d * DAY}`);
  const all = []; for (let p = 1; p < 10; p++) { const d = await (await ctx.request.get(`${B}/api/inquiry/admin?page=${p}`)).json(); all.push(...d.items.map((x) => x.id)); if (p >= d.pages) break; }
  expect(all.includes(ids.done91), "완료 91일 → 삭제").toBe(false);
  expect(all.includes(ids.open181), "미처리 181일 → 삭제").toBe(false);
  expect(all.includes(ids.done89), "완료 89일 → 남음").toBe(true);
  expect(all.includes(ids.open170), "미처리 170일 → 남음").toBe(true);
  // 곧 삭제(30일 안) 모아 보기: 170일 된 미처리는 들어가고(10일 뒤 삭제), 100일 된 건 안 들어감
  const soon = await (await ctx.request.get(`${B}/api/inquiry/admin?soon=1`)).json();
  const s170 = soon.items.find((x) => x.id === ids.open170);
  expect(s170 && s170.delete_in_days, "170일 → 10일 뒤 삭제 예정").toBe(10);
  expect(soon.items.some((x) => x.id === ids.open100)).toBe(false);
  const page = await ctx.newPage(); await page.goto(`${B}/inquiry/admin/`);
  await expect(page.locator("#soonbar")).toContainText("자동 삭제될 미처리 문의");
  await page.locator("#soonbar").click();
  await expect(page.locator(`.item[data-id="${ids.open170}"] .pill.dd`)).toHaveText("10일 뒤 삭제");
  await ctx.close();
});
