// 137 학원 전화번호 표시 규칙 (2026-11-18): 원자료 번호는 그대로 두고, 걸리지 않을 번호는 숨기고, 하이픈 위치만 바로잡는다.
const { test, expect } = require("@playwright/test");
test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "표시 규칙 시험 — 폰390에서 한 번만");
  await page.route(/goatcounter\.com|gc\.zgo\.at|raw\.githubusercontent\.com/, (r) => r.abort());
});
test("137 acaTel: 숨김·모양 정리·전화 숫자 보존", async ({ page }) => {
  await page.goto("/yuseong/#home");
  const r = await page.evaluate(() => Object.fromEntries(["042-2738-767", "042-543-777", "048-581-7771", "043-931-4118", "042-823-1234", "042-1234-5678", "010-1234-5678", "070-1234-5678", "1588-1234", "", "null"].map((t) => [t, acaTel(t)])));
  expect(r["042-2738-767"]).toBe('<a href="tel:0422738767">042-273-8767</a>');   /* 숫자 그대로, 모양만 */
  expect(r["042-823-1234"]).toBe('<a href="tel:0428231234">042-823-1234</a>');
  expect(r["042-1234-5678"]).toBe('<a href="tel:04212345678">042-1234-5678</a>');
  expect(r["010-1234-5678"]).toContain("010-1234-5678");
  expect(r["070-1234-5678"]).toContain("070-1234-5678");
  expect(r["1588-1234"]).toContain("1588-1234");
  for (const t of ["042-543-777", "048-581-7771", "043-931-4118", "", "null"]) expect(r[t], `${t} 숨김`).toBe("");
});
test("137 유성 학원 자료: 숨김 3곳·나머지 전화 줄 정상", async ({ page }) => {
  await page.goto("/yuseong/#home");
  const s = await page.evaluate(async () => {
    const L = (await (await fetch("./data/academies.json")).json()).academies.filter((a) => a.tel);
    const hid = L.filter((a) => !acaTel(a.tel)).map((a) => a.n);
    const bad = L.filter((a) => acaTel(a.tel)).filter((a) => acaTel(a.tel).match(/tel:(\d+)/)[1] !== a.tel.replace(/\D/g, ""));
    return { n: L.length, hid, bad: bad.length };
  });
  expect(s.bad, "전화 걸 때 숫자가 원자료와 달라진 곳").toBe(0);
  expect(s.hid.sort()).toEqual(["JK영어학원", "에듀플렉스에듀코치개별지도테크노학원", "해피플러스수학교습소"].sort());
});
