import { existsSync } from 'node:fs';
import { chromium, defineConfig } from '@playwright/test';

const executablePath = process.env.QINGMAO_CHROMIUM_PATH ?? [
  chromium.executablePath(),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].find((candidate) => existsSync(candidate));

if (!executablePath || !existsSync(executablePath)) {
  throw new Error('没有可用的本机 Chromium。请将 QINGMAO_CHROMIUM_PATH 指向已有浏览器；此测试不会下载浏览器。');
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 7_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://qingmao.test',
    browserName: 'chromium',
    headless: true,
    launchOptions: { executablePath },
    viewport: { width: 1440, height: 1000 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    contextOptions: { reducedMotion: 'reduce' },
    serviceWorkers: 'block',
    acceptDownloads: true,
    actionTimeout: 7_000,
    navigationTimeout: 10_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
