import { beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import App from './App';
import ActionFeedback, { feedbackFor } from './ActionFeedback';
import ChapterPanel from './ChapterPanel';
import ChapterEnding from './ChapterEnding';
import FangChapter, { FangEndingReview } from './FangChapter';
import { CampActions, ForgePanel, GuPanel, JournalPanel, QuestPanel, ShopPanel } from './GamePanels';
import { getCampaignEvents } from './game/campaign';
import { createGame, gameReducer, getActionError, getEventActionCost } from './game/engine';
import type { GameAction, GameState } from './game/types';

// This checks rendered content and affordances, not browser layout, effects, or clicks.
const ROUTE = [
  ['fy-rebirth', 'recall-future'],
  ['fy-awakening', 'accept-result'],
  ['fy-claim-moonlight', 'keep-a-reserve'],
  ['fy-family', 'refuse-adoption'],
  ['fy-rain-refining', 'wait-for-qi'],
  ['fy-inn', 'rent-quiet-room'],
  ['fy-bamboo-wine', 'buy-after-dispute'],
  ['fy-lure', 'spread-the-bait'],
  ['fy-follow', 'follow-from-distance'],
  ['fy-cave', 'check-the-exit'],
  ['fy-recording', 'study-the-recording'],
  ['fy-refine-liquor', 'rest-between-attempts'],
  ['fy-cicada', 'steady-the-aperture'],
  ['fy-report', 'report-moonlight'],
] as const;

const checkpoints = new Map<string, GameState>();
const onAction = () => { throw new Error('Static rendering must not dispatch player actions'); };

function act(game: GameState, action: GameAction): GameState {
  expect(getActionError(game, action), JSON.stringify(action)).toBeNull();
  const next = gameReducer(game, action);
  expect(next).not.toBe(game);
  return next;
}

function checkpoint(eventId: string): GameState {
  const game = checkpoints.get(eventId);
  if (!game) throw new Error(`Missing played checkpoint ${eventId}`);
  return game;
}

function rendered(node: ReactNode): string {
  return renderToStaticMarkup(node);
}

function textContent(html: string): string {
  return html.replace(/<svg\b[\s\S]*?<\/svg>/g, '').replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

function buttons(html: string) {
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(match => ({
    attributes: match[1]!, label: textContent(match[2]!), disabled: /\bdisabled(?:=|\s|$)/.test(match[1]!),
  }));
}

function definitionValues(html: string): Record<string, string> {
  return Object.fromEntries([...html.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)]
    .map(match => [textContent(match[1]!), textContent(match[2]!)]));
}

beforeAll(() => {
  let game = createGame({ campaign: 'fang-yuan', seed: 12185 });
  checkpoints.set('opening', game);
  for (const [eventId, choiceId] of ROUTE) {
    if (game.activeEvent !== eventId) {
      const event = getCampaignEvents(game).find(item => item.id === eventId)!;
      if (game.actions < getEventActionCost(event)) game = act(game, { type: 'END_DAY' });
      if (game.location !== event.location) game = act(game, { type: 'TRAVEL', location: event.location });
      game = act(game, { type: 'EXPLORE', eventId });
    }
    game = act(game, { type: 'CHOOSE', choiceId });
    checkpoints.set(eventId, game);
  }
});

describe('Fang Yuan UI server-rendered regression checks', () => {
  it('presents the fixed protagonist and chapter scope on the actual default homepage', () => {
    const html = rendered(<App />);
    const text = textContent(html);
    expect(text).toContain('固定主角 · 古月方源');
    expect(text).toContain('今生从未开窍开始');
    expect(text).toContain('本段可玩至首次炼蛊报验');
    expect(text).toContain('深层传承与后续章节尚未开放');
    expect(buttons(html).filter(button => button.label === '开始方源篇')).toHaveLength(1);
    expect(html).not.toMatch(/<input\b[^>]*type="(?:text|radio)"/);
    expect(text).not.toMatch(/选择出身|填写姓名|守拙|寻幽|行商|石灯|三条去路/);
    // App is still awaiting its effect-driven save load during server rendering.
    expect(text).toContain('正在翻开上次的手札');
  });

  it('shows an unopened aperture and an empty usable Gu bag before the ceremony', () => {
    const game = checkpoint('opening');
    const html = rendered(<><QuestPanel game={game} /><GuPanel game={game} onAction={onAction} /></>);
    const text = textContent(html);
    expect(definitionValues(html)['空窍']).toBe('未开窍');
    expect(definitionValues(html)['已炼化并持有']).toBe('0 种蛊');
    expect(text).toContain('开窍后到学堂领取');
    expect(text).toContain('当前没有已炼化并入囊的蛊');
    expect(buttons(html).some(button => button.label === '装备' || button.label === '突破二转')).toBe(false);
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(text).not.toMatch(/石灯|宗族立足|随队离山|独掌传承/);
  });

  it('distinguishes finding a Gu from refining it, then exposes only the two earned equipment choices', () => {
    const claimed = rendered(<GuPanel game={checkpoint('fy-claim-moonlight')} onAction={onAction} />);
    expect(textContent(claimed)).toContain('已领取，尚未炼化');
    expect(textContent(claimed)).not.toContain('已寻获，尚未炼化');
    expect(buttons(claimed).some(button => button.label === '装备')).toBe(false);

    const found = rendered(<GuPanel game={checkpoint('fy-cave')} onAction={onAction} />);
    expect(textContent(found)).toContain('已领取，尚未炼化');
    expect(textContent(found)).toContain('已寻获，尚未炼化');
    expect(buttons(found).some(button => button.label === '装备')).toBe(false);

    const refined = rendered(<GuPanel game={checkpoint('fy-cicada')} onAction={onAction} />);
    expect(buttons(refined).filter(button => button.label === '装备' && !button.disabled)).toHaveLength(2);
    expect(textContent(refined)).toContain('已炼化 · 已入蛊囊');
    expect(textContent(refined)).toContain('春秋蝉 · 六转本命，重伤沉眠');
    expect(textContent(refined)).not.toMatch(/尚未炼化|月芒蛊|白玉蛊|兜率花|九叶生机草/);

    const equipped = act(checkpoint('fy-cicada'), { type: 'EQUIP', guId: 'moonlight' });
    const equipment = rendered(<GuPanel game={equipped} onAction={onAction} />);
    expect(buttons(equipment).filter(button => button.label === '卸下' && !button.disabled)).toHaveLength(1);
    expect(buttons(equipment).filter(button => button.label === '装备' && !button.disabled)).toHaveLength(1);
  });

  it('keeps old recipes and purchasable story Gu out of the forge and shop', () => {
    const forge = rendered(<ForgePanel game={checkpoint('fy-cicada')} onAction={onAction} />);
    expect(textContent(forge)).toContain('本段尚未开放合炼');
    expect(textContent(forge)).toContain('炼化发生在主线中');
    expect(textContent(forge)).not.toMatch(/月光生芒|豕力凝玉|石纹留月|追加材料|稳炼保证成功/);
    expect(buttons(forge)).toHaveLength(0);

    const shop = rendered(<ShopPanel game={checkpoint('fy-inn')} onAction={onAction} />);
    expect(textContent(shop)).toContain('青竹酒');
    expect(textContent(shop)).toContain('止血药草');
    expect(textContent(shop)).not.toMatch(/酒虫|月光蛊|小光蛊|白玉蛊|月芒蛊|兜率花/);
    expect(buttons(shop).filter(button => button.label === '购入' && !button.disabled)).toHaveLength(2);
  });

  it('renders actual family consequences without adding a second Fang Yuan or old commissions', () => {
    const game = checkpoint('fy-family');
    const html = rendered(<JournalPanel game={game} />);
    const people = [...html.matchAll(/<article class="npc-card">([\s\S]*?)<\/article>/g)].map(match => match[1]!);
    const names = people.map(person => textContent(person.match(/<h4>([\s\S]*?)<\/h4>/)?.[1] ?? ''));
    expect(names).toEqual(expect.arrayContaining(['古月方正', '古月冻土', '学堂家老']));
    expect(names).not.toContain('方源');
    expect(names).not.toContain('古月方源');
    for (const oldName of ['古月秋衡', '兰渡', '严砚', '古月正岑', '苏蘅']) expect(names).not.toContain(oldName);
    const uncle = textContent(people.find(person => person.includes('<h4>古月冻土</h4>')) ?? '');
    expect(uncle).toContain('关系紧张');
    expect(uncle).toContain('当前关系记录为 -4');
    expect(textContent(html)).toContain('六块元石');
    expect(textContent(html)).not.toMatch(/石灯|互不封堵退路|雨路验路单|遗藏取药匣|宗族立足/);
  });

  it('shows one chapter objective with real aperture progress instead of the old three endings', () => {
    const html = rendered(<QuestPanel game={checkpoint('fy-claim-moonlight')} />);
    const text = textContent(html);
    expect(html).toContain('aria-label="方源篇当前目标"');
    expect(text).toContain('接下来：家宅交涉');
    expect(definitionValues(html)['空窍']).toBe('一转初阶');
    expect(definitionValues(html)['已炼化并持有']).toBe('0 种蛊');
    expect(text).toContain('深层花酒传承尚未开放');
    expect(text).not.toMatch(/三条去路|宗族立足|独掌传承|随队离山|石灯|35 元石|十日/);
    expect(rendered(<ChapterPanel game={checkpoint('fy-claim-moonlight')} onAction={onAction} />)).toBe('');
  });

  it('keeps the next free mainline control enabled when ordinary actions have run out', () => {
    let game = checkpoint('fy-rain-refining');
    while (game.actions > 0) game = act(game, { type: 'ACTIVITY' });
    const there = act(game, { type: 'TRAVEL', location: 'market' });
    const before = structuredClone(there);
    const html = rendered(<FangChapter game={there} onAction={onAction} />);
    expect(there).toEqual(before);
    const next = buttons(html).find(button => button.attributes.includes('data-fang-next="fy-inn"'));
    expect(next).toMatchObject({ label: '继续主线', disabled: false });
    expect(textContent(html)).toContain('这段剧情不消耗行动');
    expect(there.actions).toBe(0);
  });

  it('offers herb treatment after a real injury at zero actions and reports only the health actually restored', () => {
    let game = act(checkpoint('fy-lure'), { type: 'TRAVEL', location: 'market' });
    game = act(game, { type: 'BUY', itemId: 'fy-herbs' });
    game = act(game, { type: 'TRAVEL', location: 'stream' });
    game = act(game, { type: 'EXPLORE', eventId: 'fy-follow' });
    expect(buttons(rendered(<CampActions game={game} onAction={onAction} />)).find(button => button.label === '药草疗伤')?.disabled).toBe(true);
    game = act(game, { type: 'CHOOSE', choiceId: 'keep-close' });
    expect(game.hp).toBe(game.maxHp - 2);
    expect(game.actions).toBe(0);

    const camp = rendered(<CampActions game={game} onAction={onAction} />);
    expect(buttons(camp).find(button => button.label === '药草疗伤')?.disabled).toBe(false);
    expect(textContent(camp)).toContain('2 药草 · 恢复最多 8 生命 · 不耗行动');
    const recovered = act(game, { type: 'USE_HERBS' });
    const receipt = rendered(<ActionFeedback feedback={feedbackFor(game, recovered, { type: 'USE_HERBS' }, 1)} game={recovered} />);
    expect(textContent(receipt)).toContain('药草疗伤');
    expect(textContent(receipt)).toContain('药草 -2');
    expect(textContent(receipt)).toContain('生命 +2');
    expect(textContent(receipt)).not.toContain('生命 +8');
    expect(recovered.actions).toBe(0);
    expect(recovered.hp).toBe(recovered.maxHp);
    const fullHealthCamp = rendered(<CampActions game={recovered} onAction={onAction} />);
    expect(buttons(fullHealthCamp).find(button => button.label === '药草疗伤')?.disabled).toBe(true);
    expect(textContent(fullHealthCamp)).toContain('生命已满，无需消耗药草');
  });

  it.each([9_998, 9_999])('shows the real training gain at %i cultivation and disables training once full', cultivation => {
    const game = { ...checkpoint('fy-cicada'), cultivation };
    const camp = rendered(<CampActions game={game} onAction={onAction} />);
    expect(buttons(camp).find(button => button.label === '温养空窍')?.disabled).toBe(false);
    expect(textContent(camp)).toContain(`3 真元 → ${10_000 - cultivation} 修为`);
    const full = act(act(game, { type: 'TRAIN' }), { type: 'END_DAY' });
    const fullCamp = rendered(<CampActions game={full} onAction={onAction} />);
    expect(buttons(fullCamp).find(button => button.label === '温养空窍')?.disabled).toBe(true);
    expect(textContent(fullCamp)).toContain('本章修为已达上限');
    expect(textContent(fullCamp)).not.toMatch(/3 真元 → [034] 修为/);
  });

  it('builds the ending review from a real completed run, including earned inventory, balances and relationships', () => {
    const game = checkpoint('fy-report');
    expect(game.ending).toMatchObject({ id: 'fy-first-gu', outcome: 'success' });
    expect(game.resources.stones).toBe(37);
    const before = structuredClone(game);
    const html = rendered(<FangEndingReview game={game} />);
    const text = textContent(html);
    const values = definitionValues(html);
    expect(game).toEqual(before);
    expect(values['元石余额']).toBe(String(game.resources.stones));
    expect(values['当前修为']).toBe(String(game.cultivation));
    expect(values['境界']).toBe('一转初阶');
    expect(text).toContain('报验时领取二十块元石');
    expect(text).toContain('14 / 14');
    expect(text).toContain('深层传承与下一章尚未开放');
    expect(text).toContain('关系记录 -4');
    expect(text).toContain('关系记录 +4');
    const guList = html.match(/<ul class="chapter-gu-list">([\s\S]*?)<\/ul>/)?.[1] ?? '';
    expect(textContent(guList)).toContain('月光蛊 × 1');
    expect(textContent(guList)).toContain('酒虫 × 1');
    expect(textContent(guList)).not.toContain('春秋蝉');
    expect(text).not.toMatch(/石灯|独掌传承|宗族立足|随队离山|守关木傀/);
    expect(rendered(<ChapterEnding game={game} />)).toBe('');
    expect(rendered(<FangEndingReview game={checkpoint('fy-cave')} />)).toBe('');
  });
});
