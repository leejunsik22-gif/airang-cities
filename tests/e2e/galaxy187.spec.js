/* 187: 갤럭시 모의 시험 묶음 (2026-11-28, 클로드) — 피트 '대표 직접 작업 최소화' 지시 1~5
   대상: 181 아이 정보 보호 · 182 알레르기 확인 카드 · 184 처리방침 초안 화면
   실제 이용자 자료는 쓰지 않는다('가상아이'만). 통계(GoatCounter)는 가짜로 받아 '넘기려던 내용'만 기록하고,
   이 컴퓨터(127.0.0.1) 밖으로 나가는 요청은 모두 막고 주소·본문을 기록한다.
   결과 숫자는 QA187_OUT 폴더(기본 /tmp/qa187)에 JSON 으로 남긴다 — 저장소에는 커밋하지 않는다.
   주의: 화면 크기는 갤럭시 기종의 대표적인 'CSS 화면 크기'를 흉내 낸 값이다. 실기기와 같다고 보증하지 않는다. */
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const OUT = process.env.QA187_OUT || "/tmp/qa187";
fs.mkdirSync(OUT, { recursive: true });
const save = (name, obj) => fs.writeFileSync(path.join(OUT, name + ".json"), JSON.stringify(obj, null, 1));

const GU = ["djdonggu", "djjunggu", "djseogu", "yuseong", "daedeok"];
const FAKE = "window.__gc=[];window.goatcounter={count:function(o){window.__gc.push(o)}};";
/* 별명 10자(입력칸 최대) · 알레르기 19종 전부 — 가장 긴 경우 */
const KIDS = JSON.stringify([
  { id: "k1", name: "가상아이", code: "", grade: 2, gy: 2026, color: 0, al: [1, 5], acas: [{ id: "A123", n: "가상학원" }] },
  { id: "k2", name: "가상아이열글자별명", code: "", grade: 1, gy: 2026, color: 1, al: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19], acas: [] },
]);
/* 네트워크 시험용: 화면을 새로 열어도 기록이 남게 sessionStorage 에 쌓는다 */
const FAKE_KEEP = "window.goatcounter={count:function(o){var a=JSON.parse(sessionStorage.getItem('__gc')||'[]');a.push({path:o.path,title:o.title});sessionStorage.setItem('__gc',JSON.stringify(a))}};";
const MYEV = JSON.stringify([{ id: "e1", title: "가상 준비물", date: "2099-01-01", end: "2099-01-01", kid: "k1" }]);

async function guard(page) {
  await page.route(/gc\.zgo\.at\/count\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: FAKE }));
  await page.route(/goatcounter\.com|raw\.githubusercontent\.com|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
}
async function settle(page) { await page.waitForLoadState("networkidle"); await page.waitForTimeout(900); }
async function seed(page) {
  await page.evaluate(([kids, myev]) => {
    localStorage.setItem(NS + "edu.kids", kids); localStorage.setItem(NS + "edu.myEv", myev);
    localStorage.setItem(NS + "edu.installDone", "1");
  }, [KIDS, MYEV]);
}
/* 확인 단계가 있는 화면은 확인 버튼까지 눌러 '실제로 보이는 모습'으로 만든다 */
async function open(page, key, route) {
  await page.goto(`/${key}/?t=${Date.now()}#${route}`); await settle(page);
  if (route === "kid/new" || /^kid\/k\d$/.test(route)) {
    const b = page.getByRole("button", { name: "확인하고 고르기" });
    if (await b.count()) await b.click();
  }
  if (/\/card$/.test(route)) await page.getByRole("button", { name: "확인하고 카드 보기" }).click();
  await page.waitForTimeout(200);
}
const overflow = (page) => page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
/* 오른쪽 끝이 화면 밖으로 나간 버튼·입력칸 */
const cutButtons = (page) => page.evaluate(() => {
  const W = document.documentElement.clientWidth, out = [];
  for (const el of document.querySelectorAll("#view button, #view input, #view a.btn, #view label")) {
    if (!el.offsetParent) continue;
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > W + 1 || r.left < -1)) out.push((el.textContent || el.id || el.type).trim().slice(0, 20) + ` (${Math.round(r.left)}~${Math.round(r.right)} / 폭 ${W})`);
  }
  return out;
});

const SCREENS = ["home", "kid/new", "kid/k1", "kid/k2", "kid/k1/card", "kid/k2/card", "my", "about", "privacy"];

/* ---------- 1. 갤럭시 화면 크기 흉내 ---------- */
const DEVICES = [
  { n: "갤럭시S기본형_360x780", w: 360, h: 780, d: 3 },
  { n: "갤럭시S울트라_384x832", w: 384, h: 832, d: 3.75 },
  { n: "갤럭시A보급형_412x915", w: 412, h: 915, d: 2.625 },
  { n: "갤럭시Z폴드_바깥화면_344x882", w: 344, h: 882, d: 3 },
  { n: "갤럭시Z폴드_펼친화면_690x829", w: 690, h: 829, d: 2.5 },
  { n: "갤럭시Z플립_펼친화면_412x1004", w: 412, h: 1004, d: 2.625 },
];
for (const dv of DEVICES) {
  test.describe(`화면 크기 ${dv.n}`, () => {
    test.use({ viewport: { width: dv.w, height: dv.h }, deviceScaleFactor: dv.d, isMobile: true, hasTouch: true });
    test(`${dv.n}: 9개 화면 가로 넘침·버튼 잘림 없음`, async ({ page }, info) => {
      test.skip(info.project.name !== "폰390", "한 번만");
      await guard(page);
      await page.goto("/yuseong/"); await settle(page); await seed(page);
      const res = {};
      for (const s of SCREENS) { await open(page, "yuseong", s); res[s] = { 넘침px: await overflow(page), 잘린버튼: await cutButtons(page) }; }
      await open(page, "yuseong", "kid/k2/card");
      await info.attach(`${dv.n}_카드`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      fs.writeFileSync(path.join(OUT, `shot_${dv.n}_card.png`), await page.screenshot({ fullPage: true }));
      save(`device_${dv.n}`, res);
      const bad = Object.entries(res).filter(([, v]) => v.넘침px > 2 || v.잘린버튼.length);
      expect(bad, JSON.stringify(bad)).toEqual([]);
    });
  });
}

/* ---------- 2. 글자 확대: 화면 폭을 줄이는 방식(130·150·200·300·400%) ----------
   갤럭시 '글자 크기'는 글자만 커지고 화면 폭은 그대로다 → 폭 390 을 배율로 나눈 폭에서 같은 글자 크기로 보는 근사.
   400% 는 181 때와 같은 103px. */
const SCALES = [[130, 300], [150, 260], [200, 195], [300, 130], [400, 103]];
for (const [pct, w] of SCALES) {
  test.describe(`글자 ${pct}%`, () => {
    test.use({ viewport: { width: w, height: Math.round(w * 2.2) }, deviceScaleFactor: Math.round(390 / w * 30) / 10, isMobile: true, hasTouch: true });
    test(`글자 ${pct}%: 9개 화면 가로 넘침·버튼 잘림 없음 (5개 구)`, async ({ page }, info) => {
      test.skip(info.project.name !== "폰390", "한 번만");
      test.setTimeout(240_000);
      await guard(page);
      const res = {};
      for (const key of GU) {
        await page.goto(`/${key}/`); await settle(page); await seed(page);
        for (const s of SCREENS) { await open(page, key, s); const o = await overflow(page), c = await cutButtons(page); if (o > 2 || c.length) res[`${key}#${s}`] = { 넘침px: o, 잘린버튼: c }; }
      }
      await open(page, "yuseong", "kid/k1/card");
      fs.writeFileSync(path.join(OUT, `shot_text${pct}_card.png`), await page.screenshot({ fullPage: true }));
      await open(page, "yuseong", "kid/new");
      fs.writeFileSync(path.join(OUT, `shot_text${pct}_kidnew.png`), await page.screenshot({ fullPage: true }));
      save(`text_${pct}`, { 화면폭: w, 문제: res });
      expect(res, JSON.stringify(res)).toEqual({});
    });
  });
}

/* ---------- 3. 터치 영역 (글자 100%, 갤럭시 S 기본형 360) ----------
   기준: 안드로이드 권장 48dp, 이 앱 기존 기준 44px. 체크칸은 감싼 글자(label) 전체를 누를 곳으로 잰다. */
test.describe("터치 영역", () => {
  test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  test("181·182·184 화면의 누르는 곳 크기", async ({ page }, info) => {
    test.skip(info.project.name !== "폰390", "한 번만");
    await guard(page);
    await page.goto("/yuseong/"); await settle(page); await seed(page);
    const all = {};
    for (const s of ["kid/new", "kid/k1", "kid/k1/card", "my", "about", "privacy"]) {
      await open(page, "yuseong", s);
      all[s] = await page.evaluate(() => {
        const out = [];
        const seen = new Set();
        for (let el of document.querySelectorAll("#view button, #view a[href], #view a[onclick], #view input, #view select, #view textarea, #view [onclick]")) {
          if (el.matches("input[type=checkbox], input[type=radio]") && el.closest("label")) el = el.closest("label");
          if (seen.has(el) || !el.offsetParent) continue; seen.add(el);
          const r = el.getBoundingClientRect(); if (!r.width) continue;
          /* 글 속 밑줄 링크는 따로 표시(크기 기준 예외 — 글 줄 높이) */
          const inline = el.tagName === "A" && getComputedStyle(el).display === "inline";
          out.push({ 기존요일칸: /^toggleAcaDay/.test(el.getAttribute("onclick") || ""), 글: (el.textContent || el.getAttribute("aria-label") || el.id || el.type || "").trim().replace(/\s+/g, " ").slice(0, 24), 가로: Math.round(r.width), 세로: Math.round(r.height), 글속링크: inline });
        }
        return out;
      });
    }
    const under44 = [], under48 = [], old = [];
    for (const [s, list] of Object.entries(all)) for (const x of list) {
      if (x.글속링크) continue;
      /* 학원 요일 7칸(기존 화면, 181 이전부터) — 한 줄 7칸이라 폭 35px. 실패가 아니라 참고로 따로 적는다 */
      if (x.기존요일칸) { old.push(`${s}: ${x.글} ${x.가로}×${x.세로}`); continue; }
      if (Math.min(x.가로, x.세로) < 44) under44.push(`${s}: ${x.글} ${x.가로}×${x.세로}`);
      else if (Math.min(x.가로, x.세로) < 48) under48.push(`${s}: ${x.글} ${x.가로}×${x.세로}`);
    }
    save("touch", { 기준: "44px 미만=실패, 44~47=참고(안드로이드 권장 48)", "44미만": under44, "44~47": under48, 기존요일칸_참고: old, 전체: all });
    expect(under44, under44.join("\n")).toEqual([]);
  });
});

/* ---------- 4. 카드 만들기·그림 저장 (5개 구) ---------- */
for (const key of GU) {
  test(`${key}: 카드 그림 저장 — PNG 파일 정상, 가장 긴 경우(19종) 포함`, async ({ page }, info) => {
    test.skip(info.project.name !== "폰390", "한 번만");
    await guard(page);
    await page.goto(`/${key}/`); await settle(page); await seed(page);
    const res = {};
    for (const id of ["k1", "k2"]) {
      await open(page, key, `kid/${id}/card`);
      const dl = page.waitForEvent("download");
      await page.getByRole("button", { name: "그림으로 저장" }).click();
      const d = await dl; const p = path.join(OUT, `card_${key}_${id}.png`); await d.saveAs(p);
      const b = fs.readFileSync(p);
      const sig = b.subarray(0, 8).toString("hex"), W = b.readUInt32BE(16), H = b.readUInt32BE(20);
      res[id] = { 파일이름: d.suggestedFilename(), 바이트: b.length, 가로: W, 세로: H, PNG서명: sig === "89504e470d0a1a0a" };
      /* 그림 안 글자가 오른쪽으로 넘치지 않는지: 카드 그리기와 같은 글꼴로 각 줄 폭을 잰다 */
      res[id].최대줄폭 = await page.evaluate((id) => {
        const k = kids().find((x) => x.id === id), c = kidCardText(k), g = document.createElement("canvas").getContext("2d");
        g.font = "bold 46px sans-serif"; let m = g.measureText(c.name).width;
        g.font = "bold 24px sans-serif"; m = Math.max(m, g.measureText("먹으면 안 되는 급식 알레르기 성분").width);
        g.font = "20px sans-serif"; m = Math.max(m, g.measureText("보호자가 직접 만든 참고 카드입니다.").width);
        return Math.round(m);
      }, id);
      expect(res[id].PNG서명).toBe(true);
      expect(W).toBe(720);
      expect(res[id].최대줄폭).toBeLessThanOrEqual(640);
    }
    expect(res.k2.세로).toBeGreaterThan(res.k1.세로);   /* 19종은 줄이 늘어나 그림도 길어짐 */
    save(`card_${key}`, res);
  });
}

/* ---------- 5. 인쇄 ---------- */
test("카드 인쇄: 인쇄 버튼이 인쇄창을 부르고, 인쇄본(PDF) 1쪽 안에 카드 전체가 들어감", async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "한 번만");
  await guard(page);
  await page.goto("/yuseong/"); await settle(page); await seed(page);
  const res = {};
  for (const id of ["k1", "k2"]) {
    await open(page, "yuseong", `kid/${id}/card`);
    await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await page.getByRole("button", { name: "인쇄하기" }).click();
    const called = await page.evaluate(() => window.__printed);
    await page.emulateMedia({ media: "print" });
    const shown = await page.evaluate(() => {
      const vis = (sel) => [...document.querySelectorAll(sel)].some((e) => e.offsetParent && getComputedStyle(e).visibility !== "hidden");
      const c = document.getElementById("kidCard").getBoundingClientRect();
      return { 카드보임: vis("#kidCard"), 아래메뉴보임: vis("nav.nav"), 버튼보임: vis("#view button"), 카드위치: [Math.round(c.top), Math.round(c.bottom)] };
    });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    fs.writeFileSync(path.join(OUT, `print_${id}.pdf`), pdf);
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    await page.emulateMedia({ media: "screen" });
    res[id] = { 인쇄창호출: called, 쪽수: pages, ...shown };
    expect(called).toBe(1);
    expect(shown.카드보임).toBe(true);
    expect(shown.버튼보임, "인쇄본에 버튼이 같이 찍힘").toBe(false);
    expect(pages).toBe(1);
    /* 인쇄창이 닫히면(afterprint) 화면이 원래대로 */
    const after = await page.evaluate(() => { window.dispatchEvent(new Event("afterprint")); return document.body.classList.contains("pcard"); });
    expect(after).toBe(false);
  }
  save("print", res);
});

/* ---------- 6. 처리방침 화면 (5개 구) ---------- */
for (const key of GU) {
  test(`${key}: 처리방침 초안 — 12개 항목·초안 표시·확인 필요 칸, 이용 안내에서 열고 뒤로 돌아감`, async ({ page }, info) => {
    test.skip(info.project.name !== "폰390", "한 번만");
    await guard(page);
    await page.goto(`/${key}/#about`); await settle(page);
    await page.getByRole("button", { name: "개인정보 처리방침 전체 보기" }).click();
    await settle(page);
    expect(page.url()).toMatch(/#privacy$/);
    const r = await page.evaluate(() => {
      const t = document.getElementById("view").innerText;
      return { 항목: (t.match(/^\s*(1[0-2]|[1-9])\.\s/gm) || []).length, 초안: /초안/.test(t), 확인필요: (t.match(/〔[^〕]+〕/g) || []).length, 곁나루: /곁나루/.test(t), 효숲: /효숲/.test(t), 알레르기: /알레르기/.test(t), GoatCounter: /GoatCounter|방문 통계/.test(t) };
    });
    save(`privacy_${key}`, r);
    expect(r.항목).toBeGreaterThanOrEqual(12);
    expect(r.초안 && r.곁나루 && r.효숲 && r.알레르기 && r.GoatCounter).toBe(true);
    expect(r.확인필요).toBeGreaterThan(0);
    await page.goBack(); await settle(page);
    expect(page.url()).toMatch(/#about$/);
  });
}

/* ---------- 7. 개인정보 외부 전송 (네트워크) ----------
   아이 등록(화면에서 직접 입력) → 알레르기 고르기 → 저장 → 카드 → 그림 저장 → 인쇄 → 옮기기 코드(암호) 만들기 → 마이 → 지우기
   이 동안 브라우저가 보낸 모든 요청(주소·본문)과 통계 도구에 넘긴 내용을 모아 아이 정보 글자가 있는지 찾는다. */
for (const key of GU) {
  test(`${key}: 아이 정보·알레르기가 이 휴대폰 밖으로 나가지 않음 (요청 전부 기록)`, async ({ page, context }, info) => {
    test.skip(info.project.name !== "폰390", "한 번만");
    test.setTimeout(120_000);
    const reqs = [];
    context.on("request", (r) => reqs.push({ url: r.url(), method: r.method(), body: r.postData() || "", type: r.resourceType() }));
    await page.addInitScript(() => {   /* sendBeacon·WebSocket 도 기록 */
      window.__beacon = []; const sb = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = (u, d) => { window.__beacon.push(String(u) + " " + String(d || "")); return false; };
      window.__ws = []; window.WebSocket = function (u) { window.__ws.push(String(u)); throw new Error("blocked"); };
    });
    /* 나중에 등록한 길이 먼저 적용됨 → 전부 막기를 먼저, 가짜 통계를 나중에 */
    await page.route((u) => !/^http:\/\/127\.0\.0\.1/.test(u.href) && !/^(data|blob):/.test(u.href), (r) => r.abort());
    await page.route(/gc\.zgo\.at\/count\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: FAKE_KEEP }));
    await page.goto(`/${key}/`); await settle(page);
    await page.evaluate(() => localStorage.setItem(NS + "edu.installDone", "1"));
    /* 화면에서 직접 입력 */
    await page.goto(`/${key}/#kid/new`); await settle(page);
    await page.locator("#kname").fill("비밀별명가");
    await page.locator("#kq").pressSequentially("초", { delay: 50 });
    await page.locator("#kres [onclick]").first().click(); await page.waitForTimeout(300);
    await page.getByRole("button", { name: "2", exact: true }).first().click();
    await page.getByRole("button", { name: "확인하고 고르기" }).click();
    await page.getByRole("button", { name: "난류" }).click();
    await page.getByRole("button", { name: "땅콩" }).click();
    await page.locator("#kguard").check();
    await page.getByRole("button", { name: "등록하기" }).click(); await settle(page);
    const kidsNow = JSON.parse(await page.evaluate(() => localStorage.getItem(NS + "edu.kids")));
    expect(kidsNow[0].name).toBe("비밀별명가");
    const id = kidsNow[0].id;
    /* 카드 → 그림 저장 → 인쇄 */
    await open(page, key, `kid/${id}/card`);
    const dl = page.waitForEvent("download"); await page.getByRole("button", { name: "그림으로 저장" }).click(); await dl;
    await page.evaluate(() => { window.print = () => {}; }); await page.getByRole("button", { name: "인쇄하기" }).click();
    /* 옮기기 코드(암호로 잠금) 만들기 — 만들어진 코드가 밖으로 나가지 않는지 */
    const tok = await page.evaluate(async () => { const r = await kidMoveMake(Date.now()); return r && (r.code || r.token || JSON.stringify(r)); });
    await page.goto(`/${key}/#my`); await settle(page);
    await page.goto(`/${key}/#about`); await settle(page);
    await page.goto(`/${key}/#privacy`); await settle(page);
    await page.waitForTimeout(2500);
    const gc = await page.evaluate(() => JSON.parse(sessionStorage.getItem("__gc") || "[]"));
    const beacon = await page.evaluate(() => window.__beacon), ws = await page.evaluate(() => window.__ws);
    const titles = gc.map((g) => g.title);
    const SECRET = /비밀별명가|난류|땅콩|K1_/;
    const external = reqs.filter((r) => !/^http:\/\/127\.0\.0\.1/.test(r.url) && !/^(data|blob):/.test(r.url));
    const leaks = [
      ...reqs.filter((r) => SECRET.test(decodeURIComponent(r.url)) || SECRET.test(r.body)).map((r) => "요청: " + r.method + " " + r.url.slice(0, 120)),
      ...gc.filter((g) => SECRET.test(g.path) || SECRET.test(g.title || "")).map((g) => "통계: " + g.path),
      ...beacon.filter((b) => SECRET.test(b)), ...ws,
    ];
    if (tok && typeof tok === "string" && tok.length > 10) leaks.push(...reqs.filter((r) => r.url.includes(tok.slice(3, 20)) || r.body.includes(tok.slice(3, 20))).map((r) => "옮기기코드: " + r.url));
    save(`network_${key}`, {
      전체요청수: reqs.length,
      바깥주소요청: [...new Set(external.map((r) => r.method + " " + new URL(r.url).host + new URL(r.url).pathname.replace(/[^/]+\.(json|csv)$/, "<자료파일>")))],
      바깥요청본문있음: external.filter((r) => r.body).map((r) => r.url),
      통계로넘긴화면이름: [...new Set(gc.map((g) => g.path))],
      통계제목: [...new Set(titles)],
      sendBeacon: beacon, WebSocket: ws,
      아이정보발견: leaks,
    });
    expect(gc.length, "통계 가짜가 실제로 불렸는지(시험 자체 확인)").toBeGreaterThan(0);
    expect(leaks, leaks.join("\n")).toEqual([]);
    expect(external.filter((r) => r.body), "바깥 주소로 본문을 보낸 요청").toEqual([]);
  });
}
