/* 180: 아이 개인정보 기능 멈춤 자동 검사 (2026-11-27, 클로드)
   - 실제 이용자 자료는 쓰지 않는다. 아래 '가상아이' 자료만 시험용 브라우저에 넣는다.
   - 통계(GoatCounter)는 가짜로 바꿔 '보내려던 내용'만 기록한다. 실제 전송은 차단. */
const { test, expect } = require("@playwright/test");

const GU = ["djdonggu", "djjunggu", "djseogu", "yuseong", "daedeok"];
const FAKE = "window.__gc=[];window.goatcounter={count:function(o){window.__gc.push(o)}};";
const KIDS = JSON.stringify([{ id: "k1", name: "가상아이", school: "", grade: 2, color: 0, al: [1, 5], acas: [{ id: "A123", name: "가상학원" }] }]);
const MYEV = JSON.stringify([{ id: "e1", title: "가상 준비물", date: "2099-01-01", end: "2099-01-01", kid: "k1" }]);

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "기능 시험 — 폰390에서 한 번만");
  await page.route(/gc\.zgo\.at\/count\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: FAKE }));
  await page.route(/goatcounter\.com/, (r) => r.abort());
  await page.route(/raw\.githubusercontent\.com/, (r) => r.abort());
});
async function settle(page) { await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200); }
/* 앱이 쓰는 저장 칸 이름 앞부분(NS)을 그대로 읽어 가상 자료를 넣는다 */
async function seed(page, extra = {}) {
  await page.evaluate(([kids, myev, extra]) => {
    const ns = NS; localStorage.setItem(ns + "edu.kids", kids); localStorage.setItem(ns + "edu.myEv", myev); localStorage.setItem(ns + "edu.school", "가상학교코드");
    Object.entries(extra).forEach(([k, v]) => localStorage.setItem(ns + k, v));
  }, [KIDS, MYEV, extra]);
}
const lsGet = (page, k) => page.evaluate((k) => localStorage.getItem(NS + k), k);

for (const key of GU) {
  test(`${key}: 아이 추가 버튼이 없고, 아이 화면은 멈춤 안내만 보임`, async ({ page }) => {
    await page.goto(`/${key}/`); await settle(page);
    await expect(page.locator(".kidadd")).toHaveCount(0);
    await expect(page.getByText("아이 추가", { exact: false })).toHaveCount(0);
    await page.goto(`/${key}/#my`); await settle(page);
    await expect(page.getByText("아이 추가", { exact: false })).toHaveCount(0);
    await expect(page.getByText("아이 정보 기능을 잠시 멈췄어요")).toBeVisible();
    for (const r of ["kid/new", "kid/k1"]) {
      await page.goto(`/${key}/#${r}`); await settle(page);
      await expect(page.getByText("아이 정보 기능을 잠시 멈췄어요")).toBeVisible();
      await expect(page.locator("#view input, #view textarea, #view select"), "아이 정보 입력칸이 남아 있음").toHaveCount(0);
    }
  });

  test(`${key}: 예전 아이 정보가 있어도 쓰지 않고 학원 번호를 통계로 보내지 않음`, async ({ page }) => {
    await page.goto(`/${key}/`); await settle(page);
    await seed(page);
    await page.reload(); await settle(page);
    expect(await page.evaluate(() => kids().length), "kids() 가 예전 자료를 읽음").toBe(0);
    await expect(page.getByText("가상아이")).toHaveCount(0);
    const sent = await page.evaluate(() => (window.__gc || []).map((o) => o.path));
    expect(sent.filter((p) => /학원등록|A123/.test(p)), "학원 번호 통계 전송").toEqual([]);
    expect(await lsGet(page, "edu.kids"), "앱이 스스로 지우지는 않음(이용자 선택)").not.toBeNull();
  });

  test(`${key}: '이 휴대폰의 아이 정보 지우기'는 두 번 눌러야 지워지고, 내 일정 글은 남음`, async ({ page }) => {
    await page.goto(`/${key}/`); await settle(page);
    await seed(page, { "edu.acaReported": "1" });
    await page.goto(`/${key}/#kid/new`); await settle(page);
    const btn = page.getByRole("button", { name: /아이 정보 지우기|한 번 더 누르면/ });
    await btn.click();
    expect(await lsGet(page, "edu.kids"), "한 번 눌렀는데 지워짐").not.toBeNull();
    await page.getByRole("button", { name: "한 번 더 누르면 지워요" }).click();
    for (const k of ["edu.kids", "edu.school", "edu.acaReported"]) expect(await lsGet(page, k), k + " 남음").toBeNull();
    const ev = JSON.parse(await lsGet(page, "edu.myEv"));
    expect(ev.length, "내 일정이 지워짐").toBe(1);
    expect(ev[0].title).toBe("가상 준비물");
    expect(ev[0].kid, "일정의 아이 연결이 남음").toBe("all");
    await expect(page.getByText("이 휴대폰에는 남아 있는 아이 정보가 없어요.")).toBeVisible();
  });

  test(`${key}: 기기 이동 코드에 아이 정보가 들어가지도 받아지지도 않음`, async ({ page }) => {
    await page.goto(`/${key}/`); await settle(page);
    await seed(page);
    const out = await page.evaluate(() => { const b = atob(moveCode().replace(/-/g, "+").replace(/_/g, "/")); return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)))); });
    expect(Object.keys(out)).not.toContain("edu.kids");
    expect(Object.keys(out)).not.toContain("edu.school");
    expect(JSON.stringify(out)).not.toContain("가상아이");
    expect(JSON.parse(out["edu.myEv"])[0].kid, "보내는 일정에 아이 연결").toBe("all");
    /* 받는 쪽: 아이 정보가 든 코드를 줘도 저장하지 않음 */
    const stored = await page.evaluate(([kids, myev]) => {
      localStorage.clear();
      const o = { "edu.kids": kids, "edu.school": "가상학교코드", "edu.myEv": myev };
      let bin = ""; new TextEncoder().encode(JSON.stringify(o)).forEach((b) => { bin += String.fromCharCode(b); });
      moveApply(btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
      return { kids: localStorage.getItem(NS + "edu.kids"), school: localStorage.getItem(NS + "edu.school"), myev: localStorage.getItem(NS + "edu.myEv") };
    }, [KIDS, MYEV]);
    expect(stored.kids, "받은 아이 정보 저장").toBeNull();
    expect(stored.school, "받은 학교 저장").toBeNull();
    expect(JSON.parse(stored.myev)[0].kid).toBe("all");
  });
}
