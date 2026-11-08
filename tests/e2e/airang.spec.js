// 아이랑 대전 5개 구 — 휴대폰 자동 검사 (v01후보, 2026-11-08)
// 기존 60/60 화면 검사(가로 넘침·깨진 이미지·44px·글자 넘침·JS 오류)와 겹치지 않는 항목만 다룬다.
// 자동 판정이 어려운 것(사진의 자연스러움·얼굴 표정, 실제 갤럭시 동작)은 실기기 검수로 남긴다.
const { test, expect } = require("@playwright/test");

const GU = {
  djdonggu: "대전 동구", djjunggu: "대전 중구", djseogu: "대전 서구", yuseong: "유성", daedeok: "대덕",
};

// 모든 검사 공통: 실제 방문 통계로 새지 않게 막고(GoatCounter), 자료는 시험 서버 것만 쓰게 한다.
test.beforeEach(async ({ page }, info) => {
  await page.route(/goatcounter\.com|gc\.zgo\.at/, (r) => r.abort());
  await page.route(/raw\.githubusercontent\.com/, (r) => r.abort());   // 앱이 ./data 로 대체해서 읽음
  info.errors_ = [];
  page.on("pageerror", (e) => info.errors_.push(String(e)));
});

async function openGu(page, key, hash = "") {
  await page.goto(`/${key}/${hash}`);
  await expect(page.locator("#view")).not.toBeEmpty();
  if (!hash || hash === "#home") await expect(page.locator(".brand-round").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
}

// 1. 대전 5개 구 진입·이동 -------------------------------------------------
test("입구에서 5개 구 카드로 이동", async ({ page }) => {
  await page.goto("/entry/");
  for (const [key, name] of Object.entries(GU)) {
    const card = page.locator(`a[href$="/${key}/"]`).first();
    await expect(card, `${name} 카드`).toBeVisible();
  }
  await page.locator('a[href$="/yuseong/"]').first().click();
  await expect(page).toHaveURL(/\/yuseong\/$/);
  await expect(page.locator(".brand-round").first()).toContainText("유성");
});

for (const [key, name] of Object.entries(GU)) {
  test(`${name}: 첫 화면·로고·자료 요청 오류 없음`, async ({ page }, info) => {
    const bad = [];
    page.on("response", (r) => { if (r.url().startsWith("http://127.0.0.1") && r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
    await openGu(page, key);
    await expect(page.locator(".brand-round").first()).toContainText(name.replace("대전 ", ""));
    // 확정 로고(주황 하트) — 실제 그림이 그려졌는지, 정해진 크기인지
    const logo = await page.locator(".brand3 .logo3").first().evaluate((i) => ({ ok: i.complete && i.naturalWidth > 0, w: i.getBoundingClientRect().width, src: i.getAttribute("src") }));
    expect(logo.ok, "로고 그림 불러오기").toBe(true);
    expect(logo.src).toContain("logo-symbol.png");
    expect(logo.w).toBeGreaterThanOrEqual(34);
    expect(bad, "시험 서버 응답 오류(404 등)").toEqual([]);
    expect(info.errors_, "화면 스크립트 오류").toEqual([]);
  });
}

// 2. 확정 로고와 한글 글꼴 -----------------------------------------------------
test("제목·로고 글꼴 지정과 실제 불러오기", async ({ page }) => {
  const fontReq = [];
  page.on("requestfailed", (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) fontReq.push(r.url()); });
  await openGu(page, "yuseong");
  const fam = await page.locator(".hero-v3 h1").first().evaluate((e) => getComputedStyle(e).fontFamily);
  expect(fam, "제목 글꼴 지정").toMatch(/^"?Gothic A1/);
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => /Gothic A1/.test(f.family) && f.status === "loaded").length);
  if (fontReq.length) {
    test.info().annotations.push({ type: "실기기 확인", description: "이 검사 환경에서 Google Fonts 접속이 막혀 글꼴 실제 로딩은 판정 불가 — 갤럭시에서 확인" });
    test.skip(true, "글꼴 서버 접속 차단(검사 환경)");
  }
  expect(loaded, "Gothic A1 실제 로딩").toBeGreaterThan(0);
});

// 3. 사진 로딩·표시 크기·얼굴 영역 ------------------------------------------
test("사진: 깨짐 없음·화질 충분·AI 표기가 상단 바와 안 겹침", async ({ page }, info) => {
  await openGu(page, "yuseong");
  // 아래까지 내려 지연 로딩 사진도 불러오기
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(400);
  // naturalWidth 는 srcset 배율로 나눠진 값이라, 실제로 고른 파일을 다시 열어 진짜 가로 화소를 잰다
  const imgs = await page.evaluate(() => Promise.all([...document.images].filter((i) => i.getBoundingClientRect().width > 40).map((i) => new Promise((res) => {
    const src = i.currentSrc || i.src, base = { src: src.split("/").pop(), ok: i.complete && i.naturalWidth > 0, shown: Math.round(i.getBoundingClientRect().width) };
    const t = new Image(); t.onload = () => res({ ...base, nat: t.naturalWidth }); t.onerror = () => res({ ...base, nat: 0 }); t.src = src;
  }))));
  const broken = imgs.filter((i) => !i.ok);
  expect(broken, "깨진 사진").toEqual([]);
  // 화질: 화면에 보이는 폭 × 2배 이상의 원본(고해상도 휴대폰에서 흐리지 않게). 아이콘류(작은 그림)는 제외
  const dpr = await page.evaluate(() => Math.min(window.devicePixelRatio, 2));
  const blurry = imgs.filter((i) => i.shown >= 200 && i.nat < i.shown * dpr);
  expect(blurry, "확대돼 흐려질 사진").toEqual([]);
  // 첫 사진은 휴대폰용 고해상도 판(m2)을 써야 함
  const hero = await page.locator(".hero-v3 img.ph").first().evaluate((i) => (i.currentSrc || i.src).split("/").pop());
  expect(hero, "첫 화면 사진 파일").toMatch(/home-m2?\.webp/);
  // 얼굴 영역 보호: AI 표기·상단 바가 서로 겹치지 않는지(얼굴 자체 판정은 실기기·육안)
  const box = await page.evaluate(() => {
    const t = document.querySelector(".top3")?.getBoundingClientRect(), a = [...document.querySelectorAll(".hero-v3 *")].find((e) => /AI 생성/.test(e.textContent) && e.children.length === 0)?.getBoundingClientRect();
    return t && a ? { overlap: a.top < t.bottom && a.bottom > t.top } : null;
  });
  if (box) expect(box.overlap, "AI 표기와 상단 바 겹침").toBe(false);
  await info.attach("첫화면-사진", { body: await page.screenshot(), contentType: "image/png" });   // 육안 검토용
  info.annotations.push({ type: "실기기 확인", description: "사진의 자연스러움·얼굴 잘림은 첨부 화면과 갤럭시로 육안 판정" });
});

// 4. 학원 검색과 지역 설정 유지 ---------------------------------------------
test("학원 검색: 홈 검색칸 → 결과에 학원 묶음", async ({ page }, info) => {
  await openGu(page, "yuseong");
  const box = page.locator('form.search-v2 input[name="q"]');
  await box.fill("수학");
  await page.locator("form.search-v2 button[type=submit]").click();
  await expect(page).toHaveURL(/#find\//);
  await expect(page.locator("#view")).toContainText("학원·교습소", { timeout: 15_000 });
  expect(info.errors_).toEqual([]);
});

test("학교급 설정이 새로고침 뒤에도 유지", async ({ page }) => {
  await openGu(page, "yuseong", "#region");
  await page.locator("#view button", { hasText: "중등" }).first().click();
  await page.reload();
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.endsWith("edu.level")); return k && localStorage.getItem(k); }), "휴대폰에 저장된 학교급").toBe("중학교");
  await page.goto("/yuseong/#home");
  await expect(page.locator(".top3")).toContainText("중등");
});

// 5. 하단 메뉴·빠른 메뉴 터치 ------------------------------------------------
test("하단 메뉴 5개를 눌러 각 화면으로 이동", async ({ page }, info) => {
  await openGu(page, "yuseong");
  for (const tab of ["hosp", "bene", "saved", "my", "home"]) {
    await page.locator(`nav.nav .navi[data-tab="${tab}"]`).tap();
    await expect(page, `메뉴 ${tab}`).toHaveURL(new RegExp(`#${tab}$`));
    await expect(page.locator("#view")).not.toBeEmpty();
  }
  expect(info.errors_).toEqual([]);
});

test("빠른 메뉴: 손가락으로 밀어 끝까지 보이고, 눌러서 이동", async ({ page }) => {
  await openGu(page, "yuseong");
  const chips = page.locator(".q-chips").first();
  await chips.scrollIntoViewIfNeeded();
  const b = await chips.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const y = b.y + b.height / 2, x0 = b.x + b.width * 0.85;
  const touch = (type, x) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  await touch("touchStart", x0);
  for (let i = 1; i <= 15; i++) await touch("touchMove", x0 - i * 22);
  await touch("touchEnd");
  await page.waitForTimeout(500);
  const st = await chips.evaluate((q) => {
    const scrollable = q.scrollWidth > q.clientWidth + 1, swiped = q.scrollLeft;
    q.scrollLeft = 99999; const l = q.lastElementChild.getBoundingClientRect(), r = q.getBoundingClientRect();
    return { scrollable, swiped, last: l.right <= r.right + 1 };
  });
  if (st.scrollable) expect(st.swiped, "손가락으로 밀면 옆으로 움직임").toBeGreaterThan(0);
  expect(st.last, "마지막 빠른 메뉴가 끝까지 밀면 다 보임").toBe(true);
  await chips.evaluate((q) => { q.scrollLeft = 0; });
  const before = page.url();
  await page.locator(".q-chips .q-chip").first().tap();
  await expect.poll(() => page.url(), { message: "빠른 메뉴 눌러 이동" }).not.toBe(before);
});

// 6. 준비 중 정보 비공개 -----------------------------------------------------
test("보류 자료(병원)는 화면·검색·요청 모두 비공개", async ({ page }) => {
  const reqs = [];
  page.on("request", (r) => reqs.push(r.url()));
  await openGu(page, "yuseong");
  const st = await page.evaluate(() => fetch("./data/_status.json").then((r) => r.json()));
  test.skip(st.files["hospitals.json"].published !== false, "병원 자료가 공개 상태(보류 아님)");
  await page.locator('nav.nav .navi[data-tab="hosp"]').tap();
  await expect(page.locator("#view")).toContainText("준비 중");
  expect(await page.locator('#view a[href^="tel:"]').count(), "보류 화면에 전화번호 노출").toBe(0);
  await page.goto("/yuseong/#find/" + encodeURIComponent("소아과"));
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#view")).not.toContainText("병원·의원");
  expect(reqs.filter((u) => /hospitals\.json/.test(u)), "보류 자료 요청").toEqual([]);
});

// 7. 뒤로가기·새로고침·오프라인 ----------------------------------------------
test("뒤로가기: 검색 → 홈으로 돌아옴(앱이 꺼지지 않음)", async ({ page }) => {
  await openGu(page, "yuseong");
  await page.locator('form.search-v2 input[name="q"]').fill("영어");
  await page.locator("form.search-v2 button[type=submit]").click();
  await expect(page).toHaveURL(/#find\//);
  await page.goBack();
  await expect(page).toHaveURL(/\/yuseong\/(#home)?$/);
  await expect(page.locator(".hero-v3")).toBeVisible();
});

test("새로고침: 보던 화면 유지", async ({ page }) => {
  await openGu(page, "yuseong", "#find/" + encodeURIComponent("영어"));
  await expect(page.locator("#view")).toContainText("찾기");
  await page.reload();
  await expect(page).toHaveURL(/#find\//);
  await expect(page.locator("#view")).toContainText("찾기");
});

test("오프라인: 한 번 연 앱은 인터넷이 끊겨도 열림", async ({ page, context }) => {
  await openGu(page, "yuseong");
  await page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready);
  await page.reload();                       // 서비스워커가 페이지를 맡은 상태로
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".brand-round").first(), "오프라인에서 앱 화면").toBeVisible({ timeout: 15_000 });
  await context.setOffline(false);
});
