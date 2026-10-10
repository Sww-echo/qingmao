import { describe, expect, it } from 'vitest';
import { getCampaignEndings, getCampaignEvents } from './campaign';
import { createGame, gameReducer, getActionError, getEventActionCost } from './engine';
import { createSave, EMPTY_META, parseSave, serializeSave, updateMeta } from './storage';
import type { GameAction, GameState, MetaProgress } from './types';

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

function act(game: GameState, action: GameAction): GameState {
  expect(getActionError(game, action), JSON.stringify(action)).toBeNull();
  const next = gameReducer(game, action);
  expect(next, JSON.stringify(action)).not.toBe(game);
  return next;
}

function openEvent(game: GameState, eventId: string): GameState {
  if (game.activeEvent === eventId) return game;
  const event = getCampaignEvents(game).find(entry => entry.id === eventId)!;
  if (game.actions < getEventActionCost(event)) game = act(game, { type: 'END_DAY' });
  if (game.location !== event.location) game = act(game, { type: 'TRAVEL', location: event.location });
  return act(game, { type: 'EXPLORE', eventId });
}

function playThrough(eventId: string, seed = 12185): GameState {
  let game = createGame({ campaign: 'fang-yuan', seed });
  for (const [id, choiceId] of ROUTE) {
    game = act(openEvent(game, id), { type: 'CHOOSE', choiceId });
    if (id === eventId) return game;
  }
  throw new Error(`Unknown checkpoint ${eventId}`);
}

function roundTrip(game: GameState) {
  const save = createSave(game, updateMeta(EMPTY_META, game));
  const restored = parseSave(serializeSave(save));
  expect(restored).toEqual(save);
  expect(restored.game).not.toBe(game);
  expect(restored.game.resources).not.toBe(game.resources);
  expect(restored.game.flags).not.toBe(game.flags);
  return restored;
}

function tamper(game: GameState, changes: Record<string, unknown>): string {
  const save = createSave(game, updateMeta(EMPTY_META, game));
  return JSON.stringify({ ...save, game: { ...save.game, ...changes } });
}

describe('Fang Yuan save compatibility', () => {
  it('roundtrips the rank-zero opening in the version-one envelope', () => {
    const restored = roundTrip(createGame({ campaign: 'fang-yuan', seed: 12185 }));
    expect(restored.version).toBe(1);
    expect(restored.game).toMatchObject({
      campaign: 'fang-yuan', name: '古月方源', rank: 0,
      maxHp: 28, hp: 28, qi: 0, maxQi: 0, activeEvent: 'fy-rebirth',
    });
  });

  it('roundtrips an existing anonymous-protagonist save without silently converting it', () => {
    const old = createGame({ name: '旧档行者', origin: 'trader', seed: 12185, chapter: true });
    const restored = roundTrip(old).game;
    expect(restored.campaign).toBeUndefined();
    expect(restored.name).toBe('旧档行者');
    expect(restored.activeEvent).toBe('chapter-arrival');
    expect(restored.flags).toContain('chapter-one');
    expect(restored.inventory['liquor-worm']).toBe(1);
  });

  it.each([
    ['unknown campaign', { campaign: 'other-novel' }],
    ['null campaign', { campaign: null }],
    ['a renamed protagonist', { name: '自建角色' }],
    ['missing campaign marker', { campaign: undefined }],
    ['unawakened primeval essence', { qi: 12, maxQi: 12 }],
    ['a first-rank protagonist before awakening', { rank: 1, qi: 12, maxQi: 12 }],
    ['a legacy chapter marker', { flags: ['chapter-one'] }],
  ])('rejects %s rather than reinterpreting the opening', (_label, changes) => {
    const game = createGame({ campaign: 'fang-yuan', seed: 12185 });
    expect(() => parseSave(tamper(game, changes))).toThrow();
  });

  it('resumes each pending and resolved scene, including rank zero, unrefined Gu, and the real conclusion', () => {
    let game = createGame({ campaign: 'fang-yuan', seed: 12185 });
    for (const [eventId, choiceId] of ROUTE) {
      game = openEvent(game, eventId);
      game = roundTrip(game).game;
      expect(game.activeEvent).toBe(eventId);
      game = act(game, { type: 'CHOOSE', choiceId });
      game = roundTrip(game).game;
      expect(game.seenEvents).toContain(eventId);
    }
    expect(game.ending).toMatchObject({ id: 'fy-first-gu', outcome: 'success' });
    expect(game.resources.stones).toBe(37);
    expect(game.inventory).toEqual({ moonlight: 1, 'liquor-worm': 1 });
  });

  it('accepts day eleven and restores a main scene there without creating an expiration ending', () => {
    let game = playThrough('fy-awakening');
    while (game.day < 11) game = act(game, { type: 'END_DAY' });
    game = openEvent(game, 'fy-claim-moonlight');
    const restored = roundTrip(game).game;
    expect(restored).toMatchObject({ day: 11, rank: 1, qi: 12, ending: null, activeEvent: 'fy-claim-moonlight' });
    const continued = act(restored, { type: 'CHOOSE', choiceId: 'keep-a-reserve' });
    expect(continued.flags).toContain('fy-moonlight-claimed');
    expect(continued.ending).toBeNull();
    expect(() => parseSave(tamper(continued, { day: 10_001 }))).toThrow();
    const legacy = createGame({ name: '旧档行者', origin: 'disciple' });
    expect(() => parseSave(tamper(legacy, { day: 11 }))).toThrow();
  });

  it('saves a deferred paid scene as unresolved and allows it to reopen after restoring', () => {
    let game = playThrough('fy-inn');
    game = act(game, { type: 'BUY', itemId: 'fy-herbs' });
    game = act(game, { type: 'BUY', itemId: 'fy-herbs' });
    game = act(openEvent(game, 'fy-bamboo-wine'), { type: 'CHOOSE', choiceId: 'prepare-later' });
    game = roundTrip(game).game;
    expect(game.seenEvents).toContain('fy-bamboo-wine');
    expect(game.flags).not.toContain('fy-wine-bought');
    game = act(game, { type: 'ACTIVITY' });
    game = act(openEvent(game, 'fy-bamboo-wine'), { type: 'CHOOSE', choiceId: 'buy-after-dispute' });
    expect(roundTrip(game).game.flags).toContain('fy-wine-bought');
  });

  it.each([
    ['legacy event history', (game: GameState) => ({ seenEvents: [...game.seenEvents, 'academy-roster'] })],
    ['a pending legacy event', () => ({ activeEvent: 'academy-roster' })],
    ['a relationship with himself as an old NPC', () => ({ relations: { 'fang-yuan': 8 } })],
    ['an old mentor relationship', () => ({ relations: { 'mentor-qiu': 8 } })],
    ['legacy store purchases', () => ({ purchases: { 'buy-wine': 1 } })],
    ['an out-of-chapter Gu', () => ({ inventory: { 'jade-skin': 1 } })],
    ['an unrefined Gu made usable by editing inventory', () => ({ inventory: { moonlight: 1 } })],
    ['a legacy success route', () => ({ ending: { id: 'clan', outcome: 'success', reason: '宗族立足' } })],
    ['a forced caravan timeout', () => ({ ending: { id: 'departure', outcome: 'survived', reason: '十日已到' } })],
    ['a forced caravan success', () => ({ ending: { id: 'departure', outcome: 'success', reason: '支付路费' } })],
    ['second-rank stats', () => ({ rank: 2, maxHp: 36, hp: 36, maxQi: 16, qi: 16 })],
    ['a premature success conclusion', () => ({ ending: { id: 'fy-first-gu', outcome: 'success', reason: '未报验的奖励' } })],
    ['a mainline flag without its event', (game: GameState) => ({ flags: [...game.flags, 'fy-family-settled'] })],
    ['a locked map location', () => ({ location: 'cave' })],
    ['a main scene without its prerequisite', () => ({ activeEvent: 'fy-report' })],
  ])('rejects %s in a protagonist save', (_label, changes) => {
    const game = playThrough('fy-awakening');
    expect(() => parseSave(tamper(game, changes(game)))).toThrow();
  });

  it('rejects an otherwise well-formed legacy guardian combat inside the protagonist campaign', () => {
    const game = playThrough('fy-awakening');
    const combat = {
      enemyId: 'guardian', enemyHp: 38, enemyGuard: 0, playerGuard: 0, turn: 0,
      victoryEffects: {}, victoryText: '守关木傀倒下。', victoryEnding: 'inheritance',
      defeatEffects: {}, log: [],
    };
    expect(() => parseSave(tamper(game, { combat }))).toThrow();
  });

  it('rejects crossing a protagonist save into legacy mode or a legacy save into protagonist mode', () => {
    const game = playThrough('fy-awakening');
    expect(() => parseSave(tamper(game, { campaign: undefined }))).toThrow();
    const legacy = createGame({ name: '古月方源', origin: 'disciple', chapter: true });
    expect(() => parseSave(tamper(legacy, { campaign: 'fang-yuan' }))).toThrow();
    expect(() => parseSave(tamper(legacy, { activeEvent: null, seenEvents: ['fy-rebirth'] }))).toThrow();
    expect(() => parseSave(tamper(legacy, { activeEvent: null, ending: { id: 'fy-first-gu', outcome: 'success', reason: '混入的章节成果' } }))).toThrow();
  });

  it('requires consistent earned refinement records and unique copies of both Gu', () => {
    const refined = playThrough('fy-cicada');
    roundTrip(refined);
    for (const changes of [
      { inventory: { moonlight: 2, 'liquor-worm': 1 } },
      { inventory: { moonlight: 1 } },
      { flags: refined.flags.filter(flag => flag !== 'fy-liquor-refined') },
      { flags: refined.flags.filter(flag => flag !== 'fy-cicada-revealed') },
      { seenEvents: refined.seenEvents.filter(eventId => eventId !== 'fy-refine-liquor') },
      { activeEvent: 'fy-cicada' },
    ]) expect(() => parseSave(tamper(refined, changes))).toThrow();
    const completed = playThrough('fy-report');
    expect(() => parseSave(tamper(completed, { ending: null }))).toThrow();
  });

  it('keeps legacy achievements while recording the new chapter once and displaying only its own conclusion', () => {
    const prior: MetaProgress = {
      completedRuns: 1, endings: ['clan'], discoveredGu: ['jade-skin'],
      lastRecordedRun: 'legacy-completed-run', recordedRunIds: ['legacy-completed-run'],
    };
    const game = playThrough('fy-report');
    const combined = updateMeta(prior, game);
    expect(combined.completedRuns).toBe(2);
    expect(combined.endings).toEqual(['clan', 'fy-first-gu']);
    expect(combined.discoveredGu).toEqual(expect.arrayContaining(['jade-skin', 'moonlight', 'liquor-worm']));
    expect(updateMeta(combined, game)).toEqual(combined);
    const restored = parseSave(serializeSave(createSave(game, combined)));
    expect(restored.meta).toEqual(combined);
    expect(getCampaignEndings(restored.game).filter(ending => restored.meta.endings.includes(ending.id)).map(ending => ending.id)).toEqual(['fy-first-gu']);
    const legacy = createGame({ name: '旧档行者', origin: 'disciple' });
    expect(getCampaignEndings(legacy).filter(ending => combined.endings.includes(ending.id)).map(ending => ending.id)).toEqual(['clan']);
  });
});
