import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "ru-RU",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      // Профиль iPhone на движке Chromium: проверяем вёрстку и касания на ширине 393 px.
      name: "iphone",
      use: { ...devices["iPhone 15"], browserName: "chromium" },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    // Всегда свежая сборка: уже запущенный сервер мог остаться от старой версии кода.
    reuseExistingServer: false,
    timeout: 180_000,
    // Тесты всегда идут на встроенном движке, без платных вызовов модели.
    env: { AI_PROVIDER: "rules", INTAKE_RATE_LIMIT_PER_MINUTE: "1000" },
  },
});
