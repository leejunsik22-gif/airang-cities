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
  ],
  webServer: {
    command: `python3 tools/qa/serve.py ${PORT}`,
    url: `http://127.0.0.1:${PORT}/entry/`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
