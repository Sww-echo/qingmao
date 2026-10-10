import { describe, expect, it } from 'vitest';
import { getChapterEpilogue, getChapterProgress } from './chapter';
import { EVENTS } from './content';
import { createGame, gameReducer, getActionError } from './engine';
import { createSave, EMPTY_META, parseSave, serializeSave } from './storage';
import type { EndingId, GameAction, GameState } from './types';

function act(game: GameState, action: GameAction): GameState {
  expect(getActionError(game, action)).toBeNull();
  return gameReducer(game, action);
}

function start(): GameState {
  return act(createGame({ name: '归山', origin: 'disciple', seed: 81, chapter: true }), { type: 'CHOOSE', choiceId: 'seek-own-path' });
}

function take(game: GameState, eventId: string, choiceId: string): GameState {
  const event = EVENTS.find(item => item.id === eventId)!;
  let next = game.location === event.location ? game : act(game, { type: 'TRAVEL', location: event.location });
  next = act(next, { type: 'EXPLORE', eventId });
  return act(next, { type: 'CHOOSE', choiceId });
}

function finished(flags: string[] = [], day = 6, outcome: 'success' | 'survived' | 'defeat' = 'success', id: EndingId = 'clan'): GameState {
  const game = start();
  return {
    ...game, day, flags: [...game.flags, ...flags],
    ending: { id: outcome === 'success' ? id : 'departure', outcome, reason: outcome === 'defeat' ? '伤势过重，此行败退。' : outcome === 'survived' ? '十日期满，存活离山。' : '完成了自己选择的去路。' },
  };
}

function thread(game: GameState, id: string) {
  const result = getChapterEpilogue(game)!.threads.find(item => item.id === id);
  expect(result, `missing ending thread: ${id}`).toBeDefined();
  return result!;
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(item => freeze(item));
  }
  return value;
}

describe('chapter progression derived from the actual journey', () => {
  it('leaves legacy runs without a chapter tracker and unfinished runs without an epilogue', () => {
    const legacy = createGame({ name: '旧行者', origin: 'scout', seed: 7 });
    expect(getChapterProgress(legacy)).toBeNull();
    expect(getChapterEpilogue(legacy)).toBeNull();
    expect(getChapterEpilogue(start())).toBeNull();
  });

  it('advances through legal scenes but completes the final beat only after a successful ending', () => {
    const initial = createGame({ name: '起行', origin: 'disciple', chapter: true });
    expect(getChapterProgress(initial)).toMatchObject({ stage: 1, nextEventId: null });
    expect(getChapterProgress(initial)!.beats[0]).toMatchObject({ done: false, current: true });
    let game = act(initial, { type: 'CHOOSE', choiceId: 'seek-clan-place' });
    expect(getChapterProgress(game)).toMatchObject({ stage: 2, nextEventId: null });
    game = take(game, 'bamboo-tracks', 'read-tracks');
    expect(getChapterProgress(game)).toMatchObject({ stage: 2, nextEventId: 'chapter-council' });
    const remaining = game.actions;
    game = take(game, 'chapter-council', 'consider-public');
    expect(getChapterProgress(game)).toMatchObject({ stage: 3, nextEventId: 'chapter-resolution' });
    expect(getChapterProgress(game)!.beats[2]).toMatchObject({ done: false, current: true });
    game = take(game, 'chapter-resolution', 'prepare-clan');
    const progress = getChapterProgress(game)!;
    expect(progress.beats.map(item => item.done)).toEqual([true, true, false]);
    expect(progress.beats.map(item => item.current)).toEqual([false, false, true]);
    expect(progress.nextEventId).toBeNull();
    expect(progress.stageDescription).toContain('宗族立足');
    expect(progress.stageDescription).toContain('可选准备');
    expect(game.actions).toBe(remaining);
    expect(game.ending).toBeNull();
    expect(progress.milestones.every(item => !item.done)).toBe(true);

    for (const outcome of ['survived', 'defeat'] as const) {
      for (const unfinished of [initial, game]) {
        const ended: GameState = { ...unfinished, activeEvent: null, ending: { id: 'departure', outcome, reason: '此行未能完成。' } };
        expect(getChapterProgress(ended)!.beats[2]).toMatchObject({ done: false, current: false });
        expect(getChapterProgress(ended)!.nextEventId).toBeNull();
      }
    }
    const completed: GameState = { ...game, ending: { id: 'clan', outcome: 'success', reason: '宗族约定已正式签下。' } };
    expect(getChapterProgress(completed)!.beats.map(item => item.done)).toEqual([true, true, true]);
    expect(getChapterProgress(completed)!.beats.some(item => item.current)).toBe(false);
  });

  it('offers a free chapter scene even at zero actions, but no action while occupied or ended', () => {
    let game = take(start(), 'bamboo-tracks', 'read-tracks');
    game = { ...game, actions: 0 };
    expect(getChapterProgress(game)!.nextEventId).toBe('chapter-council');
    const occupied = { ...game, activeEvent: 'chapter-council', location: 'clan' as const };
    expect(getChapterProgress(occupied)!.nextEventId).toBeNull();
    const fighting = take(start(), 'bamboo-boar', 'hunt-boar');
    expect(fighting.combat).not.toBeNull();
    expect(getChapterProgress(fighting)!.nextEventId).toBeNull();
    expect(getChapterProgress(finished())!.nextEventId).toBeNull();
  });

  it('counts earned preparation flags and real rank, not merely current possessions', () => {
    const game = start();
    expect(game.equipped.length).toBeGreaterThan(0);
    expect(getChapterProgress(game)!.milestones.every(item => !item.done)).toBe(true);
    const prepared = {
      ...game, rank: 2 as const,
      flags: [...game.flags, 'milestone-equipped', 'milestone-upkeep', 'milestone-trained', 'milestone-battle', 'milestone-crafted'],
    };
    expect(getChapterProgress(prepared)!.milestones.every(item => item.done)).toBe(true);
    expect(getChapterProgress(prepared)!.stage).toBe(2);
    expect(prepared.ending).toBeNull();
  });
});

describe('accountability without inventing repayment', () => {
  it.each([
    ['kept-pouch', 'pouch', 'chapter-pouch-inquiry'],
    ['false-ledger', 'ledger', 'chapter-ledger-inquiry'],
  ])('distinguishes unanswered, repaid, confessed and concealed %s', (flag, prefix, eventId) => {
    const unanswered = finished([flag], 1);
    const pending = getChapterProgress(unanswered)!.looseEnds[0]!;
    expect(pending).toMatchObject({ eventId, status: 'pending' });
    expect(pending.description).toContain('尚未对这笔旧账作出交代');
    expect(pending.description).not.toContain('在追问中');
    expect(thread(unanswered, `${prefix}-account`).tone).toBe('warn');

    const paid = finished([flag, `${prefix}-account-settled`, `${prefix}-repaid`]);
    expect(getChapterProgress(paid)!.looseEnds[0]!.status).toBe('settled');
    expect(thread(paid, `${prefix}-account`)).toMatchObject({ tone: 'good' });
    expect(thread(paid, `${prefix}-account`).text).toContain('后来已归还或折价赔付');
    expect(thread(paid, `${prefix}-account`).text).toContain('先前行为仍有记录');

    const confessed = finished([flag, `${prefix}-account-settled`, `${prefix}-confessed`]);
    expect(getChapterProgress(confessed)!.looseEnds[0]!.status).toBe('settled');
    expect(thread(confessed, `${prefix}-account`).text).toContain('认责但未偿还');
    expect(thread(confessed, `${prefix}-account`).tone).toBe('warn');

    const concealed = finished([flag, `${prefix}-account-settled`, `${prefix}-concealed`]);
    expect(getChapterProgress(concealed)!.looseEnds[0]!.status).toBe('avoided');
    expect(thread(concealed, `${prefix}-account`).text).toContain('没有因此免罪');
    expect(thread(concealed, `${prefix}-account`).tone).toBe('warn');

    const onlyAnswered = finished([flag, `${prefix}-account-settled`]);
    expect(thread(onlyAnswered, `${prefix}-account`).text).toContain('没有足额偿还的凭据');
  });

  it('does not invent bad accounts for a player who returned goods or kept an honest ledger', () => {
    const game = finished(['returned-pouch', 'honest-ledger']);
    expect(getChapterProgress(game)!.looseEnds).toEqual([]);
    expect(getChapterEpilogue(game)!.threads.some(item => item.id.endsWith('-account'))).toBe(false);
    expect(getChapterEpilogue(game)!.people.find(item => item.id === 'steward-zheng')!.text).toContain('当初将包袱送还');
  });
});

describe('chapter ending facts', () => {
  it.each([
    ['inheritance', '实际战胜了守关木傀'],
    ['clan', '正式签下宗族约定'],
    ['departure', '实际付清三十五块元石路费'],
  ] as const)('describes the actual %s ending separately from the original plan', (ending, expected) => {
    const game = finished(['chapter-council-read', 'chapter-public', 'chapter-ready', 'chapter-plan-clan'], 6, 'success', ending);
    const epilogue = getChapterEpilogue(game)!;
    expect(epilogue.heading).toContain('本章完成');
    expect(thread(game, 'route').text).toContain(expected);
    expect(thread(game, 'intention').text).toContain('起行时，你想走「独掌遗藏」');
    expect(thread(game, 'intention').text).toContain('「宗族立足」作过准备');
    if (ending !== 'inheritance') expect(thread(game, 'intention').text).toContain('最终选择与最初动机不同');
    expect(epilogue.future).toContain('第二章尚未开放');
    expect(epilogue.future).toContain('导出存档');
  });

  it('keeps actual timeouts and defeat distinct from paid departure', () => {
    let timeout = start();
    for (let day = 0; day < 10; day += 1) timeout = act(timeout, { type: 'END_DAY' });
    expect(timeout.ending?.outcome).toBe('survived');
    expect(getChapterEpilogue(timeout)!.heading).toContain('十日期满');
    expect(thread(timeout, 'route').text).toContain('未达成三条主动结局');
    expect(thread(timeout, 'route').text).toContain('没有自动买到商队名额');
    const defeat = finished([], 4, 'defeat');
    expect(getChapterEpilogue(defeat)!.heading).toContain('败退');
    expect(thread(defeat, 'route').text).toContain('未赢下的战斗不会补发奖励');
    expect(thread(defeat, 'route').text).not.toContain('实际付清');
    expect(thread(defeat, 'intention').text).toContain('尚未把计划变成主动结局');
  });
});

describe('accurate commission closure', () => {
  it('does not turn verification into payment, including before opening and after expiry', () => {
    const flags = ['rain-route-bonded', 'rain-route-verified'];
    expect(thread(finished(flags, 3), 'rain-route').text).toContain('第 4 日才开放结款');
    expect(thread(finished(flags, 4), 'rain-route').text).toContain('尚未在市集结款');
    expect(thread(finished(flags, 10), 'rain-route').text).toContain('错过了第 4–9 日');
    expect(thread(finished(['rain-route-bonded'], 9), 'rain-route').text).toContain('错过验路期限');
    expect(thread(finished(flags, 4), 'rain-route').tone).toBe('warn');
  });

  it('keeps failed, abandoned, waived and two successful rain outcomes separate', () => {
    const failed = { ...finished(['rain-route-bonded', 'rain-route-failed']), seenEvents: ['stream-rain-survey'] };
    expect(thread(failed, 'rain-route').text).toContain('验路战斗未能完成');
    const abandoned = { ...finished(['rain-route-bonded']), seenEvents: ['stream-rain-survey'] };
    expect(thread(abandoned, 'rain-route').text).toContain('放弃了验路');
    const waived = { ...finished(['rain-route-bonded', 'rain-route-verified']), seenEvents: ['stream-rain-survey', 'market-rain-settlement'] };
    expect(thread(waived, 'rain-route').text).toContain('谢绝了这次结款');
    const paid = finished(['rain-route-bonded', 'rain-route-verified', 'rain-route-settled']);
    expect(thread(paid, 'rain-route').text).toContain('包含押金在内的二十块元石');
    expect(thread(paid, 'rain-route').tone).toBe('good');
    const endorsed = { ...paid, flags: [...paid.flags, 'rain-route-endorsed'] };
    expect(thread(endorsed, 'rain-route').text).toContain('八块元石');
    expect(thread(endorsed, 'rain-route').text).toContain('共同署名');
    expect(thread(endorsed, 'rain-route').text).not.toContain('二十块元石');
  });

  it('keeps recovered medicine undelivered even on day ten, and records waived delivery accurately', () => {
    const flags = ['medicine-pledged', 'medicine-box-recovered'];
    expect(thread(finished(flags, 3), 'medicine').text).toContain('第 4 日才开放交付');
    expect(thread(finished(flags, 10), 'medicine').text).toContain('尚未交付药棚');
    expect(thread(finished(flags, 10), 'medicine').text).not.toContain('取匣期限已过');
    expect(thread(finished(['medicine-pledged'], 9), 'medicine').text).toContain('取匣期限已过');
    const abandoned = { ...finished(['medicine-pledged'], 4), seenEvents: ['cave-remedy-cache'] };
    expect(thread(abandoned, 'medicine').text).toContain('放弃取匣');
    const waived = { ...finished(flags, 4), seenEvents: ['cave-remedy-cache', 'clan-remedy-settlement'] };
    expect(thread(waived, 'medicine').text).toContain('把封匣留给药棚');
    expect(thread(waived, 'medicine').text).toContain('没有领取蛊、元石或贡献');
  });

  it('shows only the chosen medicine reward and omits commissions never accepted', () => {
    const flags = ['medicine-pledged', 'medicine-box-recovered', 'medicine-settled'];
    expect(thread(finished(flags), 'medicine').text).toContain('白豕蛊与玉皮蛊各一只');
    expect(thread(finished([...flags, 'medicine-public-stock']), 'medicine').text).toContain('这次没有领取白豕、玉皮');
    expect(thread(finished([...flags, 'medicine-diverted']), 'medicine').text).toContain('公仓未得到这批药');
    expect(thread(finished([...flags, 'medicine-diverted']), 'medicine').tone).toBe('neutral');
    expect(getChapterEpilogue(finished())!.threads.some(item => ['rain-route', 'medicine'].includes(item.id))).toBe(false);
  });
});

describe('people and immutable save-derived snapshots', () => {
  it('omits untouched NPCs and does not upgrade declined meetings into completed promises', () => {
    const fresh = getChapterEpilogue(finished())!;
    expect(fresh.people.map(item => item.id)).toEqual(['mentor-qiu']);
    const game = {
      ...finished(['merchant-pact', 'healer-pact', 'mentor-promise']),
      seenEvents: ['chapter-arrival', 'market-commission', 'stream-healer-return', 'academy-private-lesson'],
    };
    const people = getChapterEpilogue(game)!.people;
    expect(people.find(item => item.id === 'merchant-yan')!.text).toContain('放弃了那次佣金');
    expect(people.find(item => item.id === 'healer-su')!.text).toContain('会面已经结束');
    expect(people.find(item => item.id === 'healer-su')!.text).not.toContain('伤势痊愈');
    expect(people.find(item => item.id === 'mentor-qiu')!.text).not.toContain('完整听过');
    expect(people.some(item => item.id === 'fang-yuan')).toBe(false);
  });

  it('allows relation-only evidence without inventing a meeting, alliance or fate', () => {
    const game = { ...finished(), relations: { 'fang-yuan': 90, 'scout-lan': -40 } };
    const people = getChapterEpilogue(game)!.people;
    const fang = people.find(item => item.id === 'fang-yuan')!;
    expect(fang.relation).toBe(90);
    expect(fang.text).toContain('尚未结下具体的互惠约定');
    expect(fang.text).not.toMatch(/同盟|救命|死亡|死去|托付/);
    expect(people.find(item => item.id === 'scout-lan')!.text).toContain('仍有隔阂');
  });

  it('returns independent data and leaves a frozen game unchanged', () => {
    const game = freeze(finished(['chapter-ready', 'chapter-plan-inheritance', 'medicine-pledged', 'medicine-box-recovered']));
    const before = JSON.stringify(game);
    const progress = getChapterProgress(game)!;
    const epilogue = getChapterEpilogue(game)!;
    progress.beats[0]!.title = 'changed';
    progress.milestones[0]!.done = true;
    epilogue.carryover.gu[0]!.count = 999;
    epilogue.carryover.choices.push('changed');
    epilogue.people[0]!.text = 'changed';
    expect(JSON.stringify(game)).toBe(before);
    expect(getChapterEpilogue(game)!.carryover.gu[0]!.count).not.toBe(999);
    expect(getChapterEpilogue(game)!.carryover.choices).not.toContain('changed');
    expect(epilogue.carryover.stones).toBe(game.resources.stones);
  });

  it('recreates the same progress and ending from an unchanged v1 save', () => {
    const game = {
      ...finished(['chapter-council-read', 'chapter-caravan', 'chapter-ready', 'chapter-plan-departure', 'kept-pouch', 'pouch-account-settled', 'pouch-confessed', 'rain-route-bonded', 'rain-route-verified', 'medicine-pledged', 'medicine-box-recovered']),
      relations: { 'mentor-qiu': 4, 'steward-zheng': -18, 'merchant-yan': 3 },
      seenEvents: ['chapter-arrival', 'chapter-council', 'chapter-resolution', 'chapter-pouch-inquiry', 'market-rain-bond', 'stream-rain-survey', 'bamboo-remedy-pledge', 'cave-remedy-cache'],
    };
    const saved = createSave(game, EMPTY_META);
    const restored = parseSave(serializeSave(saved));
    expect(saved.version).toBe(2);
    expect(getChapterProgress(restored.game)).toEqual(getChapterProgress(game));
    expect(getChapterEpilogue(restored.game)).toEqual(getChapterEpilogue(game));
    expect(restored.game.flags).not.toBe(game.flags);
  });
});
