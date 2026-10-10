import { describe, expect, it } from 'vitest';
import { getCampaignEvents, getLocationError, MAX_FANG_DAY } from './campaign';
import {
  createGame, gameReducer, getActionError, getCombatForecast, getEventActionCost,
  getTrainingGain, getUpkeep,
} from './engine';
import { getJourneyAdvice } from './guidance';
import { createSave, EMPTY_META, parseSave, serializeSave, updateMeta } from './storage';
import type { GameAction, GameState } from './types';

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

function openScene(game: GameState, eventId: string): GameState {
  if (game.activeEvent === eventId) return game;
  const event = getCampaignEvents(game).find(item => item.id === eventId)!;
  while ((event.dayMin !== undefined && game.day < event.dayMin) || getLocationError(game, event.location)) game = act(game, { type: 'END_DAY' });
  if (game.actions < getEventActionCost(event)) game = act(game, { type: 'END_DAY' });
  if (game.location !== event.location) game = act(game, { type: 'TRAVEL', location: event.location });
  return act(game, { type: 'EXPLORE', eventId });
}

function route(
  game: GameState, first: string, last: string, choices: Record<string, string> = {},
): GameState {
  const start = ROUTE.findIndex(([id]) => id === first);
  const end = ROUTE.findIndex(([id]) => id === last);
  for (const [id, choiceId] of ROUTE.slice(start, end + 1)) {
    game = act(openScene(game, id), { type: 'CHOOSE', choiceId: choices[id] ?? choiceId });
  }
  return game;
}

function playThrough(last: string): GameState {
  return route(createGame({ campaign: 'fang-yuan', seed: 12185 }), 'fy-rebirth', last);
}

function injuredWithPurchasedHerbs(): GameState {
  const lodged = playThrough('fy-inn');
  const supplied = act(lodged, { type: 'BUY', itemId: 'fy-herbs' });
  let game = route(supplied, 'fy-bamboo-wine', 'fy-follow', { 'fy-follow': 'keep-close' });
  // Spend any action the day gates left over, so the herbs are tested at zero actions.
  while (game.actions > 0) game = act(game, { type: 'REST' });
  return { ...game, hp: 26 };
}

function reject(game: GameState, action: GameAction): void {
  const before = structuredClone(game);
  expect(getActionError(game, action)).toBeTruthy();
  expect(gameReducer(game, action)).toBe(game);
  expect(game).toEqual(before);
}

function roundTrip(game: GameState): GameState {
  const save = createSave(game, updateMeta(EMPTY_META, game));
  const restored = parseSave(serializeSave(save));
  expect(restored).toEqual(save);
  return restored.game;
}

describe('usable herbs outside combat', () => {
  it('uses purchased herbs for a real story injury even after the last daily action', () => {
    const injured = injuredWithPurchasedHerbs();
    expect(injured).toMatchObject({ actions: 0, hp: 26, resources: { herbs: 2, stones: 0 } });
    const before = structuredClone(injured);
    const healed = act(injured, { type: 'USE_HERBS' });
    expect(healed).toMatchObject({ hp: 28, actions: 0, day: injured.day, qi: injured.qi });
    expect(healed.resources).toEqual({ ...injured.resources, herbs: 0 });
    expect(healed.rng).toBe(injured.rng);
    expect(healed.journal.at(-1)?.text).toContain('恢复 2 点生命');
    expect(injured).toEqual(before);
    roundTrip(healed);
    reject(healed, { type: 'USE_HERBS' });
  });

  it('caps one application at eight health and preserves unrelated resources', () => {
    // Exact health is a boundary fixture; the route and herbs were obtained through actions.
    const injured = { ...injuredWithPurchasedHerbs(), hp: 9 };
    const healed = act(injured, { type: 'USE_HERBS' });
    expect(healed.hp).toBe(17);
    expect(healed.actions).toBe(injured.actions);
    expect(healed.resources).toEqual({ ...injured.resources, herbs: 0 });
    expect(healed.journal.at(-1)?.text).toContain('恢复 8 点生命');
  });

  it('does not consume herbs at full health', () => {
    const game = act(playThrough('fy-inn'), { type: 'BUY', itemId: 'fy-herbs' });
    expect(game.hp).toBe(game.maxHp);
    reject(game, { type: 'USE_HERBS' });
  });

  it.each([0, 1])('rejects treatment with only %i herbs', herbs => {
    // Quantity fixture isolates the minimum supply requirement from the real injury.
    const injured = injuredWithPurchasedHerbs();
    reject({ ...injured, resources: { ...injured.resources, herbs } }, { type: 'USE_HERBS' });
  });

  it('cannot use herbs to bypass a pending scene or the settled run', () => {
    const prepared = route(injuredWithPurchasedHerbs(), 'fy-cave', 'fy-cicada', {
      'fy-cave': 'search-before-rest',
    });
    expect(prepared.resources.herbs).toBe(2);
    // Overnight recovery may have healed the route injury; re-injure to isolate the gating rule.
    const wounded = { ...prepared, hp: Math.min(prepared.hp, prepared.maxHp - 2) };
    expect(wounded.hp).toBeLessThan(wounded.maxHp);
    const reporting = openScene(wounded, 'fy-report');
    reject(reporting, { type: 'USE_HERBS' });
    // The report is a milestone, not an ending: the run continues and herbs work again afterwards.
    const reported = act(reporting, { type: 'CHOOSE', choiceId: 'report-moonlight' });
    expect(reported.ending).toBeNull();
    expect(reported.flags).toContain('milestone-first-gu');
    expect(getActionError(reported, { type: 'USE_HERBS' })).toBeNull();
    // Once the wolf tide has settled the run, nothing can be used.
    const settled = { ...reported, ending: { id: 'fy-wolf-tide-death' as const, reason: '狼潮', outcome: 'defeat' as const } };
    reject(settled, { type: 'USE_HERBS' });
  });

  it('keeps legacy combat healing on the original combat turn instead of allowing free treatment', () => {
    let game = createGame({ origin: 'disciple', seed: 12185 });
    game = act(openScene(game, 'bamboo-boar'), { type: 'CHOOSE', choiceId: 'hunt-boar' });
    game = act(game, { type: 'COMBAT', move: 'attack' });
    expect(game.hp).toBeLessThan(game.maxHp);
    expect(game.resources.herbs).toBe(2);
    reject(game, { type: 'USE_HERBS' });
    const forecast = getCombatForecast(game)!;
    expect(forecast.intent.type).toBe('guard');
    const healed = act(game, { type: 'COMBAT', move: 'herbs' });
    expect(healed.hp).toBe(Math.min(game.maxHp, game.hp + 8));
    expect(healed.resources.herbs).toBe(0);
    expect(healed.combat?.turn).toBe(game.combat!.turn + 1);
    expect(healed.combat?.enemyGuard).toBe(forecast.intent.power);
    expect(healed.combat?.enemyHp).toBe(game.combat!.enemyHp);
    expect(healed.actions).toBe(game.actions);
  });

  it('also treats ordinary legacy exploration injuries without a combat action', () => {
    let game = act(createGame({ origin: 'disciple' }), { type: 'TRAVEL', location: 'bamboo' });
    game = act(game, { type: 'ACTIVITY' });
    expect(game.hp).toBe(26);
    const healed = act(game, { type: 'USE_HERBS' });
    expect(healed.hp).toBe(28);
    expect(healed.actions).toBe(game.actions);
    expect(healed.resources.herbs).toBe(game.resources.herbs - 2);
  });
});

describe('the wolf tide is a hard deadline, not a recording limit', () => {
  it('keeps the mainline, upkeep and training working right up to the last day, then settles', () => {
    let game = playThrough('fy-cicada');
    game = act(game, { type: 'EQUIP', guId: 'moonlight' });
    game = act(game, { type: 'EQUIP', guId: 'liquor-worm' });
    expect(getUpkeep(game)).toBe(2);
    // Reach the deadline with real day-end actions, earning enough to keep both Gu fed.
    while (game.day < MAX_FANG_DAY) {
      while (game.actions > 0 && game.resources.stones < 60) {
        if (game.location !== 'clan') game = act(game, { type: 'TRAVEL', location: 'clan' });
        game = act(game, { type: 'ACTIVITY' });
      }
      game = act(game, { type: 'END_DAY' });
    }
    expect(game).toMatchObject({ day: MAX_FANG_DAY, actions: 3, qi: 12, ending: null, hungry: [] });
    expect(game.flags).toContain('milestone-upkeep');
    while (game.actions > 0) game = act(game, { type: 'TRAIN' });
    expect(game).toMatchObject({ day: MAX_FANG_DAY, actions: 0, qi: 3, ending: null });
    const advice = getJourneyAdvice(game, 'open');
    expect(advice?.destination).toMatchObject({ kind: 'action', action: { type: 'END_DAY' } });
    const settled = act(roundTrip(game), { type: 'END_DAY' });
    expect(settled.day).toBe(MAX_FANG_DAY);
    expect(settled.ending?.id).toMatch(/^fy-wolf-tide-/);
    reject(settled, { type: 'END_DAY' });
    reject(settled, { type: 'TRAIN' });
    roundTrip(settled);
  });

  it('still ends the legacy journey at the original tenth-day deadline', () => {
    let game = createGame({ origin: 'disciple' });
    while (game.day < 10) game = act(game, { type: 'END_DAY' });
    game = act(game, { type: 'END_DAY' });
    expect(game).toMatchObject({ day: 10, ending: { id: 'departure', outcome: 'survived' } });
    reject(game, { type: 'END_DAY' });
  });
});

describe('actual training gains at the Fang Yuan chapter cap', () => {
  it.each([
    [false, 9998, 2],
    [false, 9999, 1],
    [true, 9997, 3],
    [true, 9998, 2],
    [true, 9999, 1],
  ] as const)('with purification=%s and cultivation=%i, reports and applies only %i points', (purified, cultivation, gain) => {
    let prepared = playThrough('fy-cicada');
    if (purified) prepared = act(prepared, { type: 'EQUIP', guId: 'liquor-worm' });
    // Exact cultivation is a boundary fixture, not a claim that the mainline grants it.
    const game = { ...prepared, cultivation, actions: 3 };
    expect(getTrainingGain(game)).toBe(gain);
    const trained = act(game, { type: 'TRAIN' });
    expect(trained.cultivation).toBe(10_000);
    expect(trained.actions).toBe(2);
    expect(trained.qi).toBe(game.qi - 3);
    expect(trained.journal.at(-1)?.text).toContain(`修为增加 ${gain}`);
    if (purified) expect(trained.journal.at(-1)?.text).toContain('酒虫提纯');
    expect(getTrainingGain(trained)).toBe(0);
    expect(getActionError(trained, { type: 'TRAIN' })).toContain('上限');
    reject(trained, { type: 'TRAIN' });
    roundTrip(trained);
  });

  it('does not apply the Fang Yuan cap or purification rule to legacy training', () => {
    // Numeric boundary fixture isolates campaign rules; normal legacy play has only ten days.
    const game = { ...createGame({ origin: 'trader' }), cultivation: 9999 };
    expect(game.equipped).toContain('liquor-worm');
    expect(getTrainingGain(game)).toBe(3);
    const trained = act(game, { type: 'TRAIN' });
    expect(trained.cultivation).toBe(10_002);
    expect(trained.journal.at(-1)?.text).toContain('修为增加 3');
  });
});
