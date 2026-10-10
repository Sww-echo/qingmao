import { access, readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test as base } from '@playwright/test';

const APP_ORIGIN = 'http://qingmao.test';
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// A real browser loads the actual Vite build through intercepted requests.
// No listening socket, development server, internet request, or injected game state.
export const test = base.extend<{ compiledGame: void }>({
  compiledGame: [async ({ context, page }, use) => {
    try {
      await access(resolve(DIST, 'index.html'));
    } catch {
      throw new Error('缺少 dist/index.html。请先运行 npm run build；浏览器测试只验收真实构建产物。');
    }
    const externalRequests: string[] = [];
    const missingAssets: string[] = [];
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== APP_ORIGIN) {
        externalRequests.push(url.toString());
        await route.abort('blockedbyclient');
        return;
      }
      const pathname = decodeURIComponent(url.pathname);
      const target = resolve(DIST, pathname.replace(/^\/+/, '') || 'index.html');
      if (target !== DIST && !target.startsWith(`${DIST.replace(/[\\/]$/, '')}${sep}`)) {
        await route.fulfill({ status: 403, body: 'Forbidden' });
        return;
      }
      try {
        const body = await readFile(target);
        await route.fulfill({
          status: 200,
          contentType: contentTypes[extname(target)] ?? 'application/octet-stream',
          headers: { 'cache-control': 'no-store' },
          body,
        });
      } catch {
        if (pathname === '/favicon.ico') {
          await route.fulfill({ status: 204, body: '' });
          return;
        }
        missingAssets.push(pathname);
        await route.fulfill({ status: 404, body: 'Build asset not found' });
      }
    });
    await use();
    expect(externalRequests, 'the single-player build must work without external services').toEqual([]);
    expect(missingAssets, 'all requested application assets must be in dist').toEqual([]);
    expect(runtimeErrors, 'the browser must not report uncaught application errors').toEqual([]);
  }, { auto: true }],
});
