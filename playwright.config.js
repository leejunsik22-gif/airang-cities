// 아이랑 자동 화면 검사 설정 (개발용 · 운영 배포와 무관)
// 실행: npm run qa   (처음 한 번: npm ci && npx playwright install chromium)
const { defineConfig } = require("@playwright/test");
const PORT = 8790;
const phone = (w) => ({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, locale: "ko-KR" });
module.exports = defineConfig({
  testDir: "tests/e2e",
  outputDir: "tests/results",          // 실패 화면·기록 보존 위치
  timeout: 45_000,
  retries: 0,
  workers: 3,
  reporter: [["list"], ["html", { outputFolder: "tests/report", open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    serviceWorkers: "allow",
  },
  projects: [
    { name: "폰360", use: phone(360) },
    { name: "폰390", use: phone(390) },
    { name: "폰430", use: phone(430) },
    // PC 는 디자인 검수만(기능 검사는 손가락 터치를 쓰므로 휴대폰 폭에서만)
    { name: "PC1280", use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: "ko-KR" }, testMatch: /(design|pc)\.spec\.js/ },
  ],
  webServer: [{
    command: `python3 tools/qa/serve.py ${PORT}`,
    url: `http://127.0.0.1:${PORT}/entry/`,
    reuseExistingServer: true,
    timeout: 120_000,
  }, {
    // 2026-11-09 문의 A안 시험: 화면 + functions + D1 흉내(메모리). 운영·Cloudflare 계정과 무관
    command: "node tools/qa/pages_dev.mjs 8791",
    url: "http://127.0.0.1:8791/inquiry/",
    reuseExistingServer: false,
    timeout: 120_000,
  }],
});
