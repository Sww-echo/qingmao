import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { FANG_EVENTS, FANG_LOCATIONS, FANG_STEPS } from '../src/game/fang-content';
import type { SaveData } from '../src/game/types';
import { test } from './fixtures';

const quietRoute = [
  ['fy-rebirth', 'recall-future'], ['fy-awakening', 'accept-result'],
  ['fy-claim-moonlight', 'keep-a-reserve'], ['fy-family', 'refuse-adoption'],
  ['fy-rain-refining', 'wait-for-qi'], ['fy-inn', 'rent-quiet-room'],
  ['fy-bamboo-wine', 'buy-after-dispute'], ['fy-lure', 'spread-the-bait'],
  ['fy-follow', 'follow-from-distance'], ['fy-cave', 'check-the-exit'],
  ['fy-recording', 'remember-the-outline'], ['fy-refine-liquor', 'rest-between-attempts'],
  ['fy-cicada', 'conceal-the-aura'], ['fy-report', 'answer-briefly'],
] as const;

async function dismissNotice(page: Page) {
  // The toast is fixed at the bottom and can cover action buttons; close it and wait for it to leave.
  const toast = page.locator('.toast');
  if (await toast.isVisible()) await toast.getByRole('button', { name: '关闭提示', exact: true }).click();
  await expect(toast).toBeHidden();
}

async function startFang(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '青茅山', level: 1, exact: true })).toBeVisible();
  await expect(page.getByLabel('留下你的名字', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '开始方源篇', exact: true }).click();
  await expect(page.locator('[data-event-id="fy-rebirth"]')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('古月方源');
}

async function endDay(page: Page) {
  await page.getByRole('button', { name: '结束当日', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '收起行囊，歇一夜', exact: true });
  await expect(dialog).not.toContainText('最后一批');
  await dialog.getByRole('button', { name: '确认休整', exact: true }).click();
  await expect(page.getByLabel('今日剩余 3 次行动', { exact: true })).toBeVisible();
  await dismissNotice(page);
}

async function visit(page: Page, id: typeof FANG_LOCATIONS[number]['id']) {
  const location = FANG_LOCATIONS.find(item => item.id === id)!;
  await page.getByRole('navigation', { name: '游戏功能' }).getByRole('button', { name: '山中行走', exact: true }).click();
  const button = page.getByRole('group', { name: '青茅山六处地点' }).getByRole('button', { name: `前往${location.name}`, exact: true });
  if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

async function openStep(page: Page, id: string) {
  const event = FANG_EVENTS.find(item => item.id === id)!;
  const dialog = page.getByRole('dialog', { name: event.title, exact: true });
  if (await page.locator(`[data-event-id="${id}"]`).isVisible()) return dialog;
  await visit(page, event.location);
  if ((event.actionCost ?? 1) > 0 && await page.getByLabel('今日剩余 0 次行动', { exact: true }).isVisible()) await endDay(page);
  const next = page.locator(`[data-fang-next="${id}"]`);
  await expect(next).toHaveText('继续主线');
  await next.click();
  await expect(dialog.locator(`[data-event-id="${id}"]`)).toBeVisible();
  return dialog;
}

async function resolveStep(page: Page, id: string, choice: string) {
  const dialog = await openStep(page, id);
  await dialog.locator(`[data-choice-id="${choice}"]`).click();
  await expect(dialog).toBeHidden();
  await dismissNotice(page);
}

async function playSteps(page: Page, start: number, end: number) {
  for (const [event, choice] of quietRoute.slice(start, end)) await resolveStep(page, event, choice);
}

async function exportSave(page: Page, info: TestInfo, filename: string) {
  const manage = page.getByRole('button', { name: '管理存档', exact: true });
  const fromManager = await manage.isVisible();
  const dialog = page.getByRole('dialog', { name: '行旅手札', exact: true });
  if (fromManager) await manage.click();
  const pending = page.waitForEvent('download');
  if (fromManager) await dialog.getByRole('button', { name: '导出存档', exact: true }).click();
  else await page.getByRole('button', { name: '保存此行手札', exact: true }).click();
  const download = await pending;
  const path = info.outputPath(filename);
  await download.saveAs(path);
  const raw = await readFile(path, 'utf8');
  if (fromManager) await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  await dismissNotice(page);
  return { raw, save: JSON.parse(raw) as SaveData };
}

async function checkMobile(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))).toEqual({ viewport: 320, page: 320, body: 320 });
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) {
    const size = await dialog.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth }));
    expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
  }
  const player = page.locator('.fang-player');
  if (await player.isVisible()) {
    const identity = await player.locator('.player-identity').boundingBox();
    const meters = await player.locator('.player-meters').boundingBox();
    expect(identity).not.toBeNull();
    expect(meters).not.toBeNull();
    expect(identity!.width, 'the character name needs the full mobile row').toBeGreaterThan(220);
    expect(meters!.y).toBeGreaterThanOrEqual(identity!.y + identity!.height);
    const aptitude = player.locator('.fang-aptitude');
    if (await aptitude.isVisible()) {
      const box = await aptitude.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeCloseTo(identity!.width, 0);
      expect(box!.y).toBeGreaterThanOrEqual(identity!.y + identity!.height);
      expect(meters!.y).toBeGreaterThanOrEqual(box!.y + box!.height);
    } else {
      const note = await player.locator('.fang-unawakened').boundingBox();
      expect(note).not.toBeNull();
      expect(note!.width).toBeCloseTo(meters!.width, 0);
    }
  }
}

test('starts as Fang Yuan, preserves an unrefined Gu through save/reload/import, and never presents custom origins', async ({ page }, info) => {
  await startFang(page);
  await expect(page.locator('.player-panel')).toContainText('未开窍');
  await expect(page.locator('.player-panel')).not.toContainText('一转');
  await resolveStep(page, ...quietRoute[0]);
  await expect(page.getByRole('button', { name: '温养空窍', exact: true })).toHaveCount(0);
  await expect(page.getByRole('group', { name: '青茅山六处地点' }).getByRole('button', { name: '前往花酒石洞', exact: true })).toBeDisabled();
  await playSteps(page, 1, 3);
  await expect(page.locator('.player-panel')).toContainText('44%');
  const { raw, save } = await exportSave(page, info, 'unrefined-fang.json');
  expect(save.game).toMatchObject({ campaign: 'fang-yuan', name: '古月方源', rank: 1, maxQi: 12, inventory: {} });
  expect(save.game.flags).toEqual(expect.arrayContaining(['fy-moonlight-claimed']));
  expect(save.game.flags).not.toContain('fy-cicada-revealed');
  await expect(page.getByRole('button', { name: '已存档', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /继续上次行程/ }).click();
  await expect(page.getByRole('heading', { name: '古月方源', level: 2, exact: true })).toBeVisible();
  await page.getByRole('button', { name: '管理存档', exact: true }).click();
  await page.getByLabel('选择游戏存档', { exact: true }).setInputFiles({ name: 'unrefined-fang.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  const confirmation = page.getByRole('dialog', { name: '从这页手札继续？', exact: true });
  await expect(confirmation).toContainText('方源篇');
  await confirmation.getByRole('button', { name: '确认载入', exact: true }).click();
  await page.getByRole('navigation', { name: '游戏功能' }).getByRole('button', { name: '蛊虫行囊', exact: true }).click();
  await expect(page.locator('.gu-panel')).toContainText('尚未炼化');
  await expect(page.getByRole('button', { name: '装备', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('fang-unrefined-desktop.png'), fullPage: true });
});

test('finishes all fourteen beats, refines both Gu, uses purification and reports Moonlight with zero actions', async ({ page }, info) => {
  await startFang(page);
  await playSteps(page, 0, 13);
  await page.getByRole('navigation', { name: '游戏功能' }).getByRole('button', { name: '蛊虫行囊', exact: true }).click();
  for (const name of ['酒虫', '月光蛊']) {
    const card = page.locator('article.gu-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
    await card.getByRole('button', { name: '装备', exact: true }).click();
    await expect(card.getByText('已携带', { exact: true })).toBeVisible();
  }
  await visit(page, 'market');
  await page.getByRole('button', { name: '温养空窍', exact: true }).click();
  await expect(page.getByLabel('今日剩余 0 次行动', { exact: true })).toBeVisible();
  await resolveStep(page, ...quietRoute[13]);
  await expect(page.getByRole('heading', { name: '月光在明，春秋在隐', level: 1, exact: true })).toBeVisible();
  await expect(page.locator('.fang-ending')).toContainText('深层传承与下一章尚未开放');
  const { save } = await exportSave(page, info, 'fang-first-chapter.json');
  expect(save.game).toMatchObject({ campaign: 'fang-yuan', rank: 1, cultivation: 4, day: 2, actions: 0, inventory: { moonlight: 1, 'liquor-worm': 1 }, ending: { id: 'fy-first-gu', outcome: 'success' } });
  expect(save.game.resources.stones).toBe(37);
  expect(save.game.flags).toEqual(expect.arrayContaining(FANG_STEPS.map(step => step.flag)));
  expect(save.meta.endings).toEqual(['fy-first-gu']);
  expect(save.game.relations).not.toHaveProperty('fang-yuan');
});

test('can defer a paid story choice and recover through normal preparation', async ({ page }, info) => {
  await startFang(page);
  await playSteps(page, 0, 6);
  await page.getByRole('button', { name: '逛逛货摊', exact: true }).click();
  const wine = page.locator('article.shop-card').filter({ has: page.getByRole('heading', { name: '青竹酒', exact: true }) });
  await wine.getByRole('button', { name: '购入', exact: true }).click();
  await wine.getByRole('button', { name: '购入', exact: true }).click();
  const dialog = await openStep(page, 'fy-bamboo-wine');
  await expect(dialog.locator('[data-choice-id="buy-after-dispute"]')).toBeDisabled();
  await dialog.locator('[data-choice-id="prepare-later"]').click();
  await dismissNotice(page);
  await visit(page, 'clan');
  await page.locator('.location-actions').getByRole('button', { name: '整理份例', exact: true }).click();
  await resolveStep(page, 'fy-bamboo-wine', 'buy-after-dispute');
  const { save } = await exportSave(page, info, 'fang-recovered.json');
  expect(save.game.resources).toMatchObject({ stones: 0, wine: 3 });
  expect(save.game.flags).toContain('fy-wine-bought');
  expect(save.game.seenEvents.filter(id => id === 'fy-bamboo-wine')).toHaveLength(1);
});

test('uses purchased herbs to heal a real story injury with zero actions and preserves the result', async ({ page }, info) => {
  await startFang(page);
  await playSteps(page, 0, 8);
  await resolveStep(page, 'fy-follow', 'keep-close');
  await expect(page.getByLabel('今日剩余 0 次行动', { exact: true })).toBeVisible();
  await visit(page, 'market');
  await page.getByRole('button', { name: '逛逛货摊', exact: true }).click();
  const herbs = page.locator('article.shop-card').filter({ has: page.getByRole('heading', { name: '止血药草', exact: true }) });
  await herbs.getByRole('button', { name: '购入', exact: true }).click();
  await visit(page, 'market');
  const { save: before } = await exportSave(page, info, 'fang-before-herbs.json');
  expect(before.game).toMatchObject({ hp: 26, maxHp: 28, actions: 0, resources: { herbs: 2 } });
  const heal = page.locator('.camp-actions').getByRole('button', { name: '药草疗伤', exact: true });
  await expect(heal).toBeEnabled();
  await heal.click();
  await expect(heal).toBeDisabled();
  await expect(page.getByLabel('今日剩余 0 次行动', { exact: true })).toBeVisible();
  await dismissNotice(page);
  await expect(page.getByRole('button', { name: '已存档', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /继续上次行程/ }).click();
  const { save: after } = await exportSave(page, info, 'fang-after-herbs.json');
  expect(after.game).toMatchObject({ hp: 28, maxHp: 28, actions: 0, day: before.game.day, resources: { herbs: 0 } });
  expect(after.game.flags).toEqual(before.game.flags);
  expect(after.game.seenEvents).toEqual(before.game.seenEvents);
});

test('keeps the complete Fang Yuan chapter usable at 320px and does not force departure on day ten', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await startFang(page);
  await checkMobile(page);
  await resolveStep(page, 'fy-rebirth', 'hide-emotions');
  for (let day = 1; day <= 10; day += 1) await endDay(page);
  await expect(page.locator('.player-panel')).toContainText('未开窍');
  const { save } = await exportSave(page, info, 'fang-day-eleven.json');
  expect(save.game).toMatchObject({ campaign: 'fang-yuan', day: 11, rank: 0, ending: null });
  for (const [id, choice] of quietRoute.slice(1)) {
    const dialog = await openStep(page, id);
    await checkMobile(page);
    await dialog.locator(`[data-choice-id="${choice}"]`).click();
    await dismissNotice(page);
  }
  await expect(page.getByRole('heading', { name: '月光在明，春秋在隐', level: 1, exact: true })).toBeVisible();
  await checkMobile(page);
  await page.screenshot({ path: info.outputPath('fang-ending-mobile.png'), fullPage: true });
});
