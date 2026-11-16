// 131D 한글 조합 입력(IME) + 글자 크게(200·250·300%) 회귀시험 v02 (2026-11-14, 독립 QA 지적 반영)
// 배경: 123/124 검색칸 한글 끊김, 129 실제 갤럭시 '글자 최대'(약 300%)에서 홈 검색칸이 '소··'만 보임.
//       두 시험 모두 그동안 시험 주소 배포 확인(hosp-preview)에만 있었고 이 회귀시험에는 없었다.
// IME: 크롬 개발자 도구(CDP)로 'ㄱ→구→궈→권' 처럼 조합 중 글자를 흉내 낸다(실제 갤럭시 키보드와 같지 않음 — 최종 판정은 실기기).
// 글자 크게: 크롬 '텍스트 크기'처럼 화면 폭을 1/z 로 줄이고 화소 비율을 z 배로(124·129와 같은 방식).
// 휴대폰 3폭 중 폰390 한 번만 돈다(폭을 직접 정하므로 3번 돌릴 필요 없음).
const { test, expect } = require("@playwright/test");

const JAMO = { "권": ["ㄱ", "구", "궈", "권"], "오": ["ㅇ", "오"], "균": ["ㄱ", "규", "균"], "수": ["ㅅ", "수"], "학": ["ㅎ", "하", "학"], "영": ["ㅇ", "여", "영"], "어": ["ㅇ", "어"], "유": ["ㅇ", "유"], "치": ["ㅊ", "치"], "원": ["ㅇ", "우", "워", "원"] };

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== "폰390", "폭을 직접 정하는 시험 — 폰390에서 한 번만");
  await page.route(/goatcounter\.com|gc\.zgo\.at/, (r) => r.abort());
  await page.route(/raw\.githubusercontent\.com/, (r) => r.abort());
});

async function imeType(page, cdp, sel, word, wait = 300) {
  await page.click(sel);
  for (const ch of word) {
    for (const x of JAMO[ch] || [ch]) {
      await cdp.send("Input.imeSetComposition", { text: x, selectionStart: x.length, selectionEnd: x.length });
      await page.waitForTimeout(wait);
    }
    await cdp.send("Input.insertText", { text: ch });
    await page.waitForTimeout(wait);
  }
  await page.waitForTimeout(600);
}

test.describe("@IME 검색칸 한글 조합 입력", () => {
  // [화면, 입력칸, 단어, 조합 간격(ms), 칸이 없을 때 건너뛸지] — 학원은 목록이 커서 일부러 느리게(124에서 끊기던 조건)
  // 학교·학원 칸은 로컬 시험 서버에 항상 있어야 하므로 없으면 실패(id 변경·칸 사라짐을 숨기지 않음).
  // 유치원은 로컬 시험 서버에 유치원 자료가 없어 '불러오는 중'에 머물 수 있음 → 그때만 건너뜀.
  const CASES = [
    ["schools", "#q", "학교", 300, false],
    ["acas", "#acaq", "수학", 450, false],
    ["acas", "#acaq", "영어", 150, false],
    ["kinders", "#kinq", "유치원", 300, true],
  ];
  for (const [route, sel, word, wait, mayMiss] of CASES) {
    test(`${route} ${sel} '${word}' 조합 중 끊김 없음 (간격 ${wait}ms)`, async ({ page, context }) => {
      await page.goto(`/yuseong/#${route}`);
      await page.waitForLoadState("networkidle");
      const box = page.locator(sel);
      if (mayMiss) test.skip((await box.count()) === 0, `${sel} 없음 — 로컬 시험 서버에 유치원 자료 없음(운영·시험 주소에서 확인)`);
      else await expect(box, `${sel} 입력칸이 있어야 함`).toHaveCount(1, { timeout: 8000 });
      const cdp = await context.newCDPSession(page);
      await imeType(page, cdp, sel, word, wait);
      expect(await box.inputValue(), "입력칸 글자").toBe(word);
      expect(await page.evaluate((s) => document.activeElement === document.querySelector(s), sel), "입력 중 초점 유지").toBe(true);
    });
  }
  test("병원 #hq '권오균' (병원 화면이 열린 경우만)", async ({ page, context }) => {
    await page.goto("/yuseong/#hosp");
    await page.waitForLoadState("networkidle");
    test.skip((await page.locator("#hq").count()) === 0, "운영 main 은 병원 자료 보류 — 시험 주소(hosp-preview)에서 확인");
    const cdp = await context.newCDPSession(page);
    await imeType(page, cdp, "#hq", "권오균", 450);
    expect(await page.inputValue("#hq")).toBe("권오균");
  });
});

test.describe("@글자크게 200·250·300%", () => {
  // 기준: 200% 입력 폭 ≥ 60%(129 수정본 실측 62% — 여유 작음), 250%·300% ≥ 80%(두 줄 배치, 실측 88%·85%)
  for (const z of [2, 2.5, 3]) {
    test(`글자 ${z * 100}%: 홈 검색칸·행사 띠·학원 요약·가로 밀림·하단 메뉴`, async ({ browser }) => {
      const baseURL = test.info().project.use.baseURL;
      const ctx = await browser.newContext({ baseURL, viewport: { width: Math.round(412 / z), height: Math.round(915 / z) }, deviceScaleFactor: 2.625 * z, isMobile: true, hasTouch: true, locale: "ko-KR" });
      await ctx.route(/goatcounter\.com|gc\.zgo\.at|raw\.githubusercontent\.com/, (r) => r.abort());
      const page = await ctx.newPage();
      const problems = [];
      await page.goto("/yuseong/#home");
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => { try { closeInstall(); } catch (e) {} });
      // ① 홈 검색칸: 입력 폭이 칸의 60% 이상(300%는 두 줄 배치로 80% 이상), 찾기 버튼이 칸 안
      const s = await page.evaluate(() => {
        const f = document.querySelector(".search-v2"); if (!f) return null;
        const i = f.querySelector("input"), b = f.querySelector(".btn");
        const R = f.getBoundingClientRect(), I = i.getBoundingClientRect(), B = b.getBoundingClientRect();
        return { fw: R.width, iw: I.width, inside: B.right <= R.right + 1 && B.bottom <= R.bottom + 1 };
      });
      if (!s) problems.push("홈 검색칸 없음");
      else {
        const need = z >= 2.5 ? 0.8 : 0.6;
        if (s.iw < s.fw * need) problems.push(`홈 검색 입력 폭 ${Math.round(s.iw)}/${Math.round(s.fw)} < ${need * 100}%`);
        if (!s.inside) problems.push("찾기 버튼이 검색칸 밖으로 나감");
      }
      // ② 행사 띠 글자 잘림·AI 표시 겹침(124)
      const b1 = await page.evaluate(() => {
        const b = document.querySelector("button.banner3"); if (!b) return null;
        const R = b.getBoundingClientRect(), t = [...b.querySelectorAll(".bt b,.bt span")].map((e) => e.getBoundingClientRect()), tag = b.querySelector(".img-tag");
        const G = tag ? tag.getBoundingClientRect() : null, ov = (a, c) => c && !(a.right <= c.left || c.right <= a.left || a.bottom <= c.top || c.bottom <= a.top);
        return { cut: t.some((r) => r.bottom > R.bottom + 1), over: t.some((r) => ov(r, G)) };
      });
      if (b1 && (b1.cut || b1.over)) problems.push(`행사 띠 ${JSON.stringify(b1)}`);
      // ③ 화면별 가로 밀림 + ④ 학원·유치원 화면 하단 메뉴 '홈'(129)
      for (const r of ["home", "acas", "kinders", "schools", "my", "find/" + encodeURIComponent("영어")]) {
        await page.goto(`/yuseong/?z=${z}&r=${encodeURIComponent(r)}#${r}`);
        await page.waitForLoadState("networkidle");
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) problems.push(`#${decodeURIComponent(r)} 가로 밀림`);
        if (r === "acas" || r === "kinders") {
          const on = await page.evaluate(() => [...document.querySelectorAll(".navi.on")].map((b) => b.dataset.tab).join());
          if (on !== "home") problems.push(`#${r} 하단 메뉴 불 = ${on || "없음"} (기대 home)`);
        }
        if (r === "acas") {
          const one = await page.evaluate(() => { const c = document.querySelector(".aca-sum"); if (!c) return true; const v = [...c.querySelectorAll("div")].find((d) => /원$/.test(d.innerText) && !d.children.length); if (!v) return true; return v.getBoundingClientRect().height <= parseFloat(getComputedStyle(v).fontSize) * 1.6; });
          if (!one) problems.push("학원 요약 수강료 중간값이 두 줄 이상");
        }
      }
      await page.goto("/yuseong/?shot=1#home"); await page.waitForLoadState("networkidle");
      await test.info().attach(`홈-${z * 100}%`, { body: await page.screenshot(), contentType: "image/png" });
      await ctx.close();
      expect(problems, `글자 ${z * 100}% 문제`).toEqual([]);
    });
  }
});
