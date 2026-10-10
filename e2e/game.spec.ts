import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import type { SaveData } from '../src/game/types';
import { createGame } from '../src/game/engine';
import { createSave, EMPTY_META, serializeSave } from '../src/game/storage';
import { test } from './fixtures';

async function dismissNotice(page: Page) {
  const close = page.getByRole('button', { name: '关闭提示', exact: true });
  if (await close.isVisible()) await close.click();
}

async function startJourney(page: Page, name: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '青茅山', level: 1, exact: true })).toBeVisible();
  // Import a genuine legacy v1 new-game save through the public UI.
  // New-game controls now create Fang Yuan; compatibility checks retain the old chapter.
  const legacy = createSave(createGame({ name, origin: 'disciple', chapter: true, seed: 20261010 }), EMPTY_META);
  await page.getByRole('button', { name: '管理存档', exact: true }).click();
  await page.getByLabel('选择游戏存档', { exact: true }).setInputFiles({
    name: 'legacy-chapter-v1.json', mimeType: 'application/json', buffer: Buffer.from(serializeSave(legacy)),
  });
  const confirmation = page.getByRole('dialog', { name: '从这页手札继续？', exact: true });
  await expect(confirmation).toContainText(name);
  await confirmation.getByRole('button', { name: '确认载入', exact: true }).click();
  const arrival = page.getByRole('dialog', { name: '十日之内，一盏旧灯', exact: true });
  await expect(arrival).toBeVisible();
  if (page.viewportSize()?.width === 320) await expectNoHorizontalOverflow(page);
  await arrival.locator('[data-choice-id="seek-own-path"]').click();
  await expect(arrival).toBeHidden();
  await dismissNotice(page);
  await expect(page.getByRole('heading', { name, level: 2, exact: true })).toBeVisible();
  await expect(page.getByLabel('今日剩余 3 次行动', { exact: true })).toBeVisible();
}

async function visit(page: Page, location: string) {
  await page.getByRole('navigation', { name: '游戏功能' }).getByRole('button', { name: '山中行走', exact: true }).click();
  const target = page.getByRole('group', { name: '青茅山六处地点' }).getByRole('button', { name: `前往${location}`, exact: true });
  if (await target.getAttribute('aria-pressed') !== 'true') await target.click();
  await expect(target).toHaveAttribute('aria-pressed', 'true');
}

async function openEvent(page: Page, location: string, title: string) {
  await visit(page, location);
  const preview = page.locator('.exploration-preview strong');
  if (await preview.innerText() === title) {
    await page.getByRole('button', { name: '在此探查', exact: true }).click();
  } else {
    const alternatives = page.locator('details.other-events');
    if (!await alternatives.evaluate(element => element.hasAttribute('open'))) await alternatives.locator('summary').click();
    await alternatives.locator('.other-event-button').filter({ hasText: title }).click();
  }
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function resolveEvent(page: Page, location: string, title: string, choice: string) {
  const dialog = await openEvent(page, location, title);
  await dialog.getByRole('button', { name: choice }).click();
  await expect(dialog).toBeHidden();
  await dismissNotice(page);
}

async function planChapterRoute(page: Page, route: 'inheritance' | 'clan' | 'departure') {
  const actionsBefore = await page.locator('.action-dots').getAttribute('aria-label');
  const council = await openEvent(page, '议事楼', '消息落在同一张桌上');
  const stance = route === 'inheritance' ? 'keep-independent' : route === 'clan' ? 'consider-public' : 'consider-caravan';
  await council.locator(`[data-choice-id="${stance}"]`).click();
  await dismissNotice(page);
  const resolution = await openEvent(page, '学堂', '临行前的交代');
  await resolution.locator(`[data-choice-id="prepare-${route}"]`).click();
  await dismissNotice(page);
  await expect(page.locator('.action-dots')).toHaveAttribute('aria-label', actionsBefore!);
  await expect(page.locator('.chapter-panel')).toContainText('决意去留');
}

async function endDay(page: Page) {
  await page.getByRole('button', { name: '结束当日', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '收起行囊，歇一夜', exact: true });
  await expect(dialog.getByText('今日供养', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '确认休整', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel('今日剩余 3 次行动', { exact: true })).toBeVisible();
}

async function exportSave(page: Page, testInfo: TestInfo) {
  await page.getByRole('button', { name: '管理存档', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '行旅手札', exact: true });
  const pendingDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '导出存档', exact: true }).click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toMatch(/^qingmao-day-\d+-\d+\.json$/);
  const path = testInfo.outputPath('journey-backup.json');
  await download.saveAs(path);
  const raw = await readFile(path, 'utf8');
  await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  await dismissNotice(page);
  return { raw, save: JSON.parse(raw) as SaveData };
}

async function resumeAfterReload(page: Page, remainingActions: number) {
  await expect(page.getByRole('button', { name: '已存档', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /继续上次行程/ }).click();
  await expect(page.getByLabel(`今日剩余 ${remainingActions} 次行动`, { exact: true })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(async () => page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))).toEqual({ width: 320, page: 320, body: 320 });
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) {
    const dimensions = await dialog.evaluate((element) => ({ width: element.clientWidth, scroll: element.scrollWidth }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
  }
}

test('continues a legacy v1 chapter and preserves actual choices through reload, export, and confirmed import', async ({ page }, testInfo) => {
  await startJourney(page, '验收行舟');
  await resolveEvent(page, '学堂', '巡山名册上的空位', '接下巡山差事');
  await resolveEvent(page, '青竹林', '朝向旧坡的两行足迹', '沿足迹辨清入口方向');
  await expect(page.getByRole('progressbar', { name: '已核实情报', exact: true })).toHaveAttribute('aria-valuenow', '1');
  const { raw, save } = await exportSave(page, testInfo);
  expect(save.game).toMatchObject({ name: '验收行舟', origin: 'disciple', day: 1, actions: 1, clues: 1, location: 'bamboo' });
  expect(save.game.flags).toEqual(expect.arrayContaining(['chapter-one', 'chapter-arrival-read', 'chapter-motive-inheritance', 'patrol-order', 'bamboo-bearing']));

  await page.getByRole('button', { name: '温养空窍', exact: true }).click();
  await expect(page.getByLabel('今日剩余 0 次行动', { exact: true })).toBeVisible();
  await resumeAfterReload(page, 0);
  await expect(page.getByRole('heading', { name: '验收行舟', level: 2, exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: '青茅山六处地点' }).getByRole('button', { name: '前往青竹林', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: '管理存档', exact: true }).click();
  await page.getByLabel('选择游戏存档', { exact: true }).setInputFiles({
    name: 'journey-backup.json', mimeType: 'application/json', buffer: Buffer.from(raw),
  });
  const confirmation = page.getByRole('dialog', { name: '从这页手札继续？', exact: true });
  await expect(confirmation).toContainText('验收行舟');
  await confirmation.getByRole('button', { name: '确认载入', exact: true }).click();
  await expect(page.getByLabel('今日剩余 1 次行动', { exact: true })).toBeVisible();
  await dismissNotice(page);
  await resumeAfterReload(page, 1);
  await expect(page.getByRole('progressbar', { name: '已核实情报', exact: true })).toHaveAttribute('aria-valuenow', '1');
  await page.screenshot({ path: testInfo.outputPath('desktop-journey.png'), fullPage: true });
});

test('buys and equips protection, follows enemy intent, and wins the inheritance through the UI', async ({ page }) => {
  await startJourney(page, '知进退');
  await resolveEvent(page, '青竹林', '朝向旧坡的两行足迹', '沿足迹辨清入口方向');
  await resolveEvent(page, '听雨涧', '水线之下的刻字', '用药汁拓下水位刻痕');
  await resolveEvent(page, '山寨市集', '被裁去一角的运货单', '花八块元石买下断页');
  await page.getByRole('button', { name: '逛逛货摊', exact: true }).click();
  const shopCard = page.locator('article.shop-card').filter({ has: page.getByRole('heading', { name: '玉皮蛊', exact: true }) });
  await shopCard.getByRole('button', { name: '购入', exact: true }).click();
  await expect(shopCard.getByRole('button', { name: '已经售罄', exact: true })).toBeDisabled();
  await page.getByRole('navigation', { name: '游戏功能' }).getByRole('button', { name: '蛊虫行囊', exact: true }).click();
  const ownedCard = page.locator('article.gu-card').filter({ has: page.getByRole('heading', { name: '玉皮蛊', exact: true }) });
  await ownedCard.getByRole('button', { name: '装备', exact: true }).click();
  await expect(ownedCard.getByText('已携带', { exact: true })).toBeVisible();
  await endDay(page);
  await planChapterRoute(page, 'inheritance');
  await resolveEvent(page, '石灯遗藏', '石灯第三次亮起', '进入灯室，挑战守关木傀');

  const arena = page.locator('.combat-panel');
  await expect(arena.getByRole('heading', { name: '守关木傀', exact: true })).toBeVisible();
  await expect(arena.locator('.enemy-intent')).toContainText('双臂合锁');
  await expect(page.getByRole('button', { name: '结束当日', exact: true })).toBeDisabled();
  const moves = ['月光蛊', '玉皮蛊', '普通攻击', '月光蛊', '月光蛊', '玉皮蛊', '普通攻击', '防御回气', '月光蛊', '防御回气', '普通攻击', '防御回气', '月光蛊'];
  for (const [index, move] of moves.entries()) {
    await arena.getByRole('button', { name: move, exact: move === '普通攻击' || move === '防御回气' }).click();
    if (index === 0) {
      await expect(arena.locator('.enemy-intent')).toContainText('落灯重锤');
      await expect(arena.getByRole('progressbar', { name: '对手生命', exact: true })).toHaveAttribute('aria-valuenow', '31');
    }
    if (index === 1) await expect(page.getByRole('progressbar', { name: '生命', exact: true })).toHaveAttribute('aria-valuenow', '27');
  }
  await expect(page.getByRole('heading', { name: '独掌传承', level: 1, exact: true })).toBeVisible();
  await expect(page.getByText('达成结局', { exact: true })).toBeVisible();
  await expect(page.getByText('已走过 1 段旅途 · 已抵达 1 / 3 种结局', { exact: true })).toBeVisible();
  await expect(page.locator('.chapter-ending')).toContainText('第二章尚未开放');
});

test.describe('a 320px phone', () => {
  test.use({ viewport: { width: 320, height: 800 }, isMobile: true, hasTouch: true });

  test('keeps title, panels, event dialogs, and a completed clan route within the viewport', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '青茅山', level: 1, exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath('mobile-title.png'), fullPage: true });
    await startJourney(page, 'W'.repeat(18));
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: '管理存档', exact: true }).click();
    const saveDialog = page.getByRole('dialog', { name: '行旅手札', exact: true });
    await expect(saveDialog).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await saveDialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    for (const pane of ['蛊虫行囊', '合炼蛊虫', '商队货摊', '行旅手记', '山中行走']) {
      await page.getByRole('navigation', { name: '游戏功能' }).getByRole('button', { name: pane, exact: true }).click();
      await expect(page.getByRole('navigation', { name: '游戏功能' })).toBeInViewport({ ratio: 0.99 });
      await expectNoHorizontalOverflow(page);
    }
    await page.getByRole('button', { name: '在此探查', exact: true }).click();
    const opening = page.getByRole('dialog', { name: '巡山名册上的空位', exact: true });
    await expect(opening).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await opening.getByRole('button', { name: '接下巡山差事' }).click();
    await expect(opening).toBeHidden();
    await dismissNotice(page);
    await resolveEvent(page, '青竹林', '朝向旧坡的两行足迹', '沿足迹辨清入口方向');
    await resolveEvent(page, '听雨涧', '水线之下的刻字', '用药汁拓下水位刻痕');
    await endDay(page);
    await planChapterRoute(page, 'clan');
    await resolveEvent(page, '议事楼', '有人肯为你的报告作证', '交上自己署名的简报');
    await page.getByRole('button', { name: '协助清点公仓', exact: true }).click();
    await resolveEvent(page, '议事楼', '宗族愿给你的位置', '签下约定，在宗族立足');
    await expect(page.getByRole('heading', { name: '宗族立足', level: 1, exact: true })).toBeVisible();
    await expect(page.getByText('达成结局', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath('mobile-clan-ending.png'), fullPage: true });
  });
});

test('route guidance opens real events and keeps the day-end confirmation', async ({ page }) => {
  await startJourney(page, '择路人');
  const guide = page.getByRole('region', { name: '行路建议', exact: true });
  await guide.getByRole('button', { name: '随队离山', exact: true }).click();
  await guide.getByRole('button', { name: '前往青竹林', exact: true }).click();
  await expect(page.getByLabel('今日剩余 3 次行动', { exact: true })).toBeVisible();
  await guide.getByRole('button', { name: '探查这条消息', exact: true }).click();
  const event = page.getByRole('dialog', { name: '朝向旧坡的两行足迹', exact: true });
  await event.getByRole('button', { name: '沿足迹辨清入口方向' }).click();
  await dismissNotice(page);
  await planChapterRoute(page, 'departure');
  await page.getByRole('button', { name: '温养空窍', exact: true }).click();
  await page.getByRole('button', { name: '温养空窍', exact: true }).click();
  await guide.getByRole('button', { name: '查看日暮结算', exact: true }).click();
  const night = page.getByRole('dialog', { name: '收起行囊，歇一夜', exact: true });
  await expect(night.getByText('今日供养', { exact: true })).toBeVisible();
  await night.getByRole('button', { name: '再想一想', exact: true }).click();
  await expect(page.getByLabel('今日剩余 0 次行动', { exact: true })).toBeVisible();
  await guide.getByRole('button', { name: '查看日暮结算', exact: true }).click();
  await night.getByRole('button', { name: '确认休整', exact: true }).click();
  await expect(page.getByLabel('今日剩余 3 次行动', { exact: true })).toBeVisible();
});

test('combat supplies consume inventory, recover resources, and still allow the enemy’s turn', async ({ page }) => {
  await startJourney(page, '备药人');
  await visit(page, '山寨市集');
  await page.getByRole('button', { name: '逛逛货摊', exact: true }).click();
  const wineCard = page.locator('article.shop-card').filter({ has: page.getByRole('heading', { name: '竹筒清酿', exact: true }) });
  await wineCard.getByRole('button', { name: '购入', exact: true }).click();
  await visit(page, '青竹林');
  await page.locator('details.other-events > summary').click();
  await page.getByRole('button', { name: /拱翻药篓的山豕/ }).click();
  await page.getByRole('dialog', { name: '拱翻药篓的山豕', exact: true }).getByRole('button', { name: '逼开山豕，取回货物' }).click();
  await dismissNotice(page);
  const arena = page.locator('.combat-panel');
  const hp = arena.getByRole('progressbar', { name: '你的生命', exact: true });
  const qi = arena.getByRole('progressbar', { name: '你的真元', exact: true });
  const herbs = page.locator('.resource-row > span').filter({ hasText: '药草' }).locator('b');
  const wine = page.locator('.resource-row > span').filter({ hasText: '清酒' }).locator('b');
  await expect(wine).toHaveText('1');
  const herbsBefore = Number(await herbs.innerText());
  const wineBefore = Number(await wine.innerText());
  await expect(arena.getByRole('button', { name: '药草止血', exact: true })).toBeDisabled();
  await expect(arena.getByRole('button', { name: '饮酒回气', exact: true })).toBeDisabled();
  await arena.getByRole('button', { name: '普通攻击', exact: true }).click();
  await expect(hp).toHaveAttribute('aria-valuenow', '23');
  await arena.getByRole('button', { name: '药草止血', exact: true }).click();
  await expect(hp).toHaveAttribute('aria-valuenow', '28');
  await expect(herbs).toHaveText(String(herbsBefore - 2));
  await expect(arena.locator('.guard-counts')).toContainText('敌方护势 2');
  await arena.getByRole('button', { name: '月光蛊' }).click();
  await expect(hp).toHaveAttribute('aria-valuenow', '22');
  await arena.getByRole('button', { name: '饮酒回气', exact: true }).click();
  await expect(qi).toHaveAttribute('aria-valuenow', '12');
  await expect(hp).toHaveAttribute('aria-valuenow', '17');
  await expect(wine).toHaveText(String(wineBefore - 1));
  await expect(page.getByLabel('今日剩余 2 次行动', { exact: true })).toBeVisible();
});

test('chapter conversations stay free at zero actions and final choices require the chapter discussion', async ({ page }, testInfo) => {
  await startJourney(page, '先问后行');
  await resolveEvent(page, '青竹林', '朝向旧坡的两行足迹', '沿足迹辨清入口方向');
  await resolveEvent(page, '听雨涧', '水线之下的刻字', '用药汁拓下水位刻痕');
  await resolveEvent(page, '山寨市集', '被裁去一角的运货单', '花八块元石买下断页');
  await endDay(page);
  const gate = await openEvent(page, '石灯遗藏', '石灯第三次亮起');
  await expect(gate.locator('[data-choice-id="challenge"]')).toBeDisabled();
  await expect(gate).toContainText('临行前的交代');
  await gate.locator('[data-choice-id="leave"]').click();
  await dismissNotice(page);
  await page.getByRole('button', { name: '温养空窍', exact: true }).click();
  await page.getByRole('button', { name: '温养空窍', exact: true }).click();
  await expect(page.getByLabel('今日剩余 0 次行动', { exact: true })).toBeVisible();
  await planChapterRoute(page, 'inheritance');
  const { save } = await exportSave(page, testInfo);
  expect(save.game).toMatchObject({ day: 2, actions: 0, ending: null });
  expect(save.game.flags).toEqual(expect.arrayContaining(['chapter-arrival-read', 'chapter-council-read', 'chapter-ready']));
  await resumeAfterReload(page, 0);
  await expect(page.getByRole('region', { name: '行路建议', exact: true }).getByRole('button', { name: '查看日暮结算', exact: true })).toBeVisible();
});

test('a stolen pouch can be repaid and remains part of the saved chapter ending', async ({ page }, testInfo) => {
  await startJourney(page, '有欠有还');
  await resolveEvent(page, '学堂', '巡山名册上的空位', '接下巡山差事');
  await resolveEvent(page, '青竹林', '朝向旧坡的两行足迹', '沿足迹辨清入口方向');
  await resolveEvent(page, '听雨涧', '水线之下的刻字', '用药汁拓下水位刻痕');
  await endDay(page);
  await resolveEvent(page, '听雨涧', '石缝里的包袱', '取走蛊与元石');
  await planChapterRoute(page, 'clan');
  const inquiry = await openEvent(page, '议事楼', '公仓来问那只包袱');
  await inquiry.locator('[data-choice-id="return-pouch-goods"]').click();
  await dismissNotice(page);
  await resolveEvent(page, '议事楼', '有人肯为你的报告作证', '交上自己署名的简报');
  await endDay(page);
  await page.getByRole('button', { name: '协助清点公仓', exact: true }).click();
  const { save } = await exportSave(page, testInfo);
  expect(save.game.flags).toEqual(expect.arrayContaining(['kept-pouch', 'pouch-account-settled', 'pouch-repaid', 'chapter-ready']));
  expect(save.game.flags).not.toContain('returned-pouch');
  expect(save.game.inventory['jade-skin']).toBeUndefined();
  await resolveEvent(page, '议事楼', '宗族愿给你的位置', '签下约定，在宗族立足');
  await expect(page.getByRole('heading', { name: '宗族立足', level: 1, exact: true })).toBeVisible();
  const recap = page.locator('.chapter-ending');
  await recap.getByText('承诺与旧账', { exact: true }).click();
  await expect(recap.getByRole('heading', { name: /包袱/ })).toBeVisible();
  await expect(recap).toContainText(/偿|归还/);
  await expect(recap).toContainText('第二章尚未开放');
});
