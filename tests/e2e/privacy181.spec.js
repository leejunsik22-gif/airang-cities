/* 181: 효숲 아이 정보 보호 개선 자동 검사 (2026-11-27, 클로드) — 01 v3 초안 v02 조건 C3·C4·C6·C7·C8·C9
   실제 이용자 자료는 쓰지 않는다. '가상아이' 자료만 시험 브라우저에 넣는다.
   통계(GoatCounter)는 가짜로 바꿔 '보내려던 내용'만 기록한다. 실제 전송은 차단. */
const { test, expect } = require("@playwright/test");

const GU = ["djdonggu", "djjunggu", "djseogu", "yuseong", "daedeok"];
const FAKE = "window.__gc=[];window.goatcounter={count:function(o){window.__gc.push(o)}};";
const KIDS = JSON.stringify([{ id: "k1", name: "가상아이", code: "", grade: 2, gy: 2026, color: 0, al: [1, 5], acas: [{ id: "A123", n: "가상학원" }] }]);
const MYEV = JSON.stringify([{ id: "e1", title: "가상 준비물", date: "2099-01-01", end: "2099-01-01", kid: "k1" }]);

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "기능 시험 — 폰390에서 한 번만");
  await page.route(/gc\.zgo\.at\/count\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: FAKE }));
  await page.route(/goatcounter\.com/, (r) => r.abort());
  await page.route(/raw\.githubusercontent\.com/, (r) => r.abort());
});
async function settle(page) { await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200); }
async function seed(page, extra = {}) {
  await page.evaluate(([kids, myev, extra]) => {
    localStorage.setItem(NS + "edu.kids", kids); localStorage.setItem(NS + "edu.myEv", myev);
    Object.entries(extra).forEach(([k, v]) => localStorage.setItem(NS + k, v));
  }, [KIDS, MYEV, extra]);
}
const ls = (page, k) => page.evaluate((k) => localStorage.getItem(NS + k), k);

for (const key of GU) {
  test(`${key}: C6 아이 학원 번호를 통계로 보내지 않음`, async ({ page }) => {
    await page.goto(`/${key}/`); await settle(page);
    await seed(page); await page.reload(); await settle(page);
    await page.goto(`/${key}/#my`); await settle(page);
    const sent = await page.evaluate(() => (window.__gc || []).map((o) => o.path));
    expect(sent.filter((p) => /학원등록|A123|가상/.test(p))).toEqual([]);
  });

  test(`${key}: C3·C4 보호자 확인 없이 저장 안 됨, 알레르기는 확인 뒤에만 고름`, async ({ page }) => {
    await page.goto(`/${key}/#kid/new`); await settle(page);
    await expect(page.getByText("같은 휴대폰을 쓰는 사람은 볼 수 있어요").first()).toBeVisible();
    await expect(page.getByText("알레르기는 건강 정보예요.")).toBeVisible();
    await expect(page.getByRole("button", { name: "난류" })).toHaveCount(0);
    await page.getByRole("button", { name: "확인하고 고르기" }).click();
    await expect(page.getByRole("button", { name: "난류" })).toBeVisible();
    await expect(page.getByText("학교의 알레르기 관리 절차와 의료진 안내를 대신하지 않아요.")).toBeVisible();
    await page.getByRole("button", { name: "등록하기" }).click();
    await expect(page.getByText("보호자 확인에 체크해 주세요")).toBeVisible();
    expect(await ls(page, "edu.kids")).toBeNull();
    await expect(page.locator("#kguard")).toHaveCount(1);
  });

  test(`${key}: C8 알레르기만 지우기·모두 지우기(두 번 확인, 일정 글 보존)`, async ({ page }) => {
    await page.goto(`/${key}/`); await settle(page);
    await seed(page); await page.goto(`/${key}/#my`); await page.reload(); await settle(page);
    await page.getByRole("button", { name: "알레르기만 지우기" }).click();
    expect(JSON.parse(await ls(page, "edu.kids"))[0].al).toEqual([1, 5]);
    await page.getByRole("button", { name: "한 번 더 누르면 지워요" }).click();
    expect(JSON.parse(await ls(page, "edu.kids"))[0].al).toEqual([]);
    await page.getByRole("button", { name: "아이 정보 모두 지우기" }).click();
    expect(await ls(page, "edu.kids")).not.toBeNull();
    await page.getByRole("button", { name: "한 번 더 누르면 지워요" }).click();
    expect(await ls(page, "edu.kids")).toBeNull();
    const ev = JSON.parse(await ls(page, "edu.myEv"));
    expect(ev[0].title).toBe("가상 준비물"); expect(ev[0].kid).toBe("all");
  });

  test(`${key}: C7 기본 이동 코드에 아이 정보 없음, 평문 아이 정보 받지 않음`, async ({ page }) => {
    await page.goto(`/${key}/`); await settle(page);
    await seed(page);
    const out = await page.evaluate(() => { const b = atob(moveCode().replace(/-/g, "+").replace(/_/g, "/")); return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)))); });
    expect(Object.keys(out)).not.toContain("edu.kids");
    expect(JSON.stringify(out)).not.toContain("가상아이");
    expect(JSON.parse(out["edu.myEv"])[0].kid).toBe("all");
    const got = await page.evaluate(([kids]) => {
      localStorage.clear();
      let bin = ""; new TextEncoder().encode(JSON.stringify({ "edu.kids": kids, "edu.school": "X" })).forEach((b) => { bin += String.fromCharCode(b); });
      moveApply(btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
      return [localStorage.getItem(NS + "edu.kids"), localStorage.getItem(NS + "edu.school")];
    }, [KIDS]);
    expect(got).toEqual([null, null]);
  });
}

test("C7 M2–M6 암호로 잠근 아이 정보 코드: 맞는 문구만 열림, 틀림·만료·변조는 저장 0", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/yuseong/"); await settle(page);
  await seed(page);
  const r = await page.evaluate(async () => {
    const t0 = Date.now(); const m = await kidMoveMake(t0);
    const res = { code: m.code, pass: m.pass, hasName: m.code.includes("가상") };
    localStorage.removeItem(NS + "edu.kids");
    res.wrong = await kidMoveOpen(m.code, "AAAAAAAAAAAA", t0); res.afterWrong = localStorage.getItem(NS + "edu.kids");
    res.old = await kidMoveOpen(m.code, m.pass, t0 + 864e5 + 1000); res.afterOld = localStorage.getItem(NS + "edu.kids");
    const bad = m.code.slice(0, -3) + (m.code.slice(-3, -2) === "A" ? "B" : "A") + m.code.slice(-2);
    res.tamper = await kidMoveOpen(bad, m.pass, t0); res.afterTamper = localStorage.getItem(NS + "edu.kids");
    res.ok = await kidMoveOpen(m.code, m.pass.toLowerCase().replace(/(.{4})/g, "$1 "), t0 + 1000);
    res.after = JSON.parse(localStorage.getItem(NS + "edu.kids") || "[]");
    return res;
  });
  expect(r.code.startsWith("K1_")).toBe(true);
  expect(r.hasName).toBe(false);
  expect(r.code).not.toContain(r.pass);
  expect(r.pass).toMatch(/^[2-9A-HJ-NP-Z]{12}$/);
  expect([r.wrong, r.afterWrong]).toEqual(["bad", null]);
  expect([r.old, r.afterOld]).toEqual(["old", null]);
  expect([r.tamper, r.afterTamper]).toEqual(["bad", null]);
  expect(r.ok).toBe("ok");
  expect(r.after[0].name).toBe("가상아이");
  const sent = await page.evaluate(() => (window.__gc || []).map((o) => o.path));
  expect(sent.filter((p) => /K1_|가상/.test(p))).toEqual([]);
});

test("C9 이용 안내: 알레르기 항목·방문 통계·지우는 법, '개인정보를 묻지 않아요' 제목 없음", async ({ page }) => {
  await page.goto("/yuseong/#about"); await settle(page);
  const body = await page.locator("#view").innerText();
  test.skip(!body.includes("이용 안내"), "이용 안내 화면 경로가 다름");
  expect(body).toContain("알레르기(건강 정보)");
  expect(body).toContain("GoatCounter");
  expect(body).toContain("아이 정보 모두 지우기");
  expect(body).not.toContain("개인정보를 묻지 않아요");
});

/* 181 보완: 글자 약 400%(폭 103px)에서 아이 화면·마이(지우기 버튼) 가로 넘침 없음 — 시험 주소 46000784300 에서 마이 45px 넘침 발견 후 고침 */
test.describe("글자 400%", () => {
  test.use({ viewport: { width: 103, height: 229 }, deviceScaleFactor: 10.5, isMobile: true, hasTouch: true });
  test("아이 화면·마이 가로 넘침 없음", async ({ page }) => {
    await page.goto("/yuseong/"); await settle(page);
    await seed(page, { "edu.installDone": "1" });
    const over = {};
    for (const r of ["kid/k1", "kid/new", "my"]) { await page.goto(`/yuseong/#${r}`); await page.reload(); await settle(page); over[r] = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth); }
    expect(Object.values(over).every((x) => x <= 2), JSON.stringify(over)).toBe(true);
  });
});
