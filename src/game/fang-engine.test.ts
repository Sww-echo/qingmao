import { describe, expect, it } from 'vitest';
import {
  getCampaignEndings, getCampaignEnemies, getCampaignEvents, getCampaignGu,
  getCampaignNpcs, getCampaignRecipes, getCampaignShop, getLocationError, isFangYuan,
} from './campaign';
import { FANG_STEPS } from './fang-content';
import {
  createGame, gameReducer, getActionError, getAvailableEvents,
  getChoiceError, getEventActionCost, getTrainingGain,
} from './engine';
import { getJourneyAdvice } from './guidance';
import { WOLF_TIDE_DAY, judgeWolfTide, scoreWolfTide } from './world-clock';
import type { GameAction, GameState, LocationId } from './types';

// Each entry names an actual player choice. Route proofs below only dispatch actions.
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
  expect(getActionError(game, action), `day ${game.day}: ${JSON.stringify(action)}`).toBeNull();
  const next = gameReducer(game, action);
  expect(next, JSON.stringify(action)).not.toBe(game);
  return next;
}

function travel(game: GameState, location: LocationId): GameState {
  return game.location === location ? game : act(game, { type: 'TRAVEL', location });
}

/** Ends days until the location gate and event window both open; never skips past a deadline. */
function waitFor(game: GameState, eventId: string): GameState {
  const event = getCampaignEvents(game).find(entry => entry.id === eventId)!;
  while ((event.dayMin !== undefined && game.day < event.dayMin) || getLocationError(game, event.location)) {
    expect(game.day, `waiting for ${eventId}`).toBeLessThan(event.dayMax ?? WOLF_TIDE_DAY);
    game = act(game, { type: 'END_DAY' });
  }
  return game;
}

function openEvent(game: GameState, eventId: string): GameState {
  if (game.activeEvent === eventId) return game;
  const event = getCampaignEvents(game).find(entry => entry.id === eventId);
  expect(event, eventId).toBeDefined();
  if (!event) throw new Error(`Missing event ${eventId}`);
  game = waitFor(game, eventId);
  if (game.actions < getEventActionCost(event)) game = act(game, { type: 'END_DAY' });
  game = travel(game, event.location);
  expect(getAvailableEvents(game).some(entry => entry.id === eventId), eventId).toBe(true);
  return act(game, { type: 'EXPLORE', eventId });
}

function chooseEvent(game: GameState, eventId: string, choiceId: string): GameState {
  return act(openEvent(game, eventId), { type: 'CHOOSE', choiceId });
}

function playThrough(eventId: string, seed = 12185): GameState {
  let game = createGame({ campaign: 'fang-yuan', seed });
  for (const [id, choice] of ROUTE) {
    game = chooseEvent(game, id, choice);
    if (id === eventId) return game;
  }
  throw new Error(`Unknown route checkpoint ${eventId}`);
}

function continueAfter(game: GameState, eventId: string): GameState {
  const index = ROUTE.findIndex(([id]) => id === eventId);
  expect(index).toBeGreaterThanOrEqual(0);
  for (const [id, choice] of ROUTE.slice(index + 1)) game = chooseEvent(game, id, choice);
  return game;
}

function reject(game: GameState, action: GameAction): void {
  const before = structuredClone(game);
  expect(getActionError(game, action), JSON.stringify(action)).not.toBeNull();
  expect(gameReducer(game, action), JSON.stringify(action)).toBe(game);
  expect(game).toEqual(before);
}

function endDays(game: GameState, until: number): GameState {
  while (game.day < until && !game.ending) game = act(game, { type: 'END_DAY' });
  return game;
}

describe('Fang Yuan campaign identity and isolation', () => {
  it('starts as the unawakened protagonist without borrowing an origin loadout', () => {
    const game = createGame({ campaign: 'fang-yuan', seed: 12185 });
    expect(isFangYuan(game)).toBe(true);
    expect(game).toMatchObject({
      version: 2, campaign: 'fang-yuan', name: '古月方源', origin: 'disciple',
      location: 'clan', day: 1, actions: 3, rank: 0,
      hp: 28, maxHp: 28, qi: 0, maxQi: 0, cultivation: 0,
      resources: { stones: 0, herbs: 0, ore: 0, wine: 0 },
      inventory: {}, equipped: [], hungry: [], usedToday: [], relations: {},
      activeEvent: 'fy-rebirth', ending: null, combat: null, worldEvents: [],
    });
    expect(game.flags).not.toContain('chapter-one');
    expect(game.flags).not.toContain('fy-awakened');
    expect(game.journal.map(entry => entry.text).join('\n')).not.toMatch(/石灯|无名行者|巡山邀约/);
    expect(game.journal[0]?.text).toContain('距狼潮');
    reject(game, { type: 'CHOOSE', choiceId: 'seek-own-path' });
    reject(game, { type: 'END_DAY' });
  });

  it('keeps legacy creation intact and gives the two campaigns distinct run identities', () => {
    const old = createGame({ name: '古月方源', origin: 'disciple', seed: 12185 });
    const current = createGame({ campaign: 'fang-yuan', seed: 12185 });
    expect(old.campaign).toBeUndefined();
    expect(isFangYuan(old)).toBe(false);
    expect(old).toMatchObject({ rank: 1, maxQi: 12, activeEvent: null });
    expect(old.inventory.moonlight).toBe(1);
    expect(old.runId).not.toBe(current.runId);
    expect(getCampaignEvents(old).some(event => event.id === 'cave-guardian')).toBe(true);
    expect(getCampaignEvents(old).some(event => event.id.startsWith('fy-'))).toBe(false);
    expect(getCampaignEndings(old).map(ending => ending.id)).toEqual(['inheritance', 'clan', 'departure']);
  });

  it('exposes protagonist content without an NPC copy of himself or the old three routes', () => {
    const game = createGame({ campaign: 'fang-yuan', seed: 12185 });
    const events = getCampaignEvents(game);
    expect(events.length).toBeGreaterThanOrEqual(14);
    expect(events.every(event => event.id.startsWith('fy-'))).toBe(true);
    expect(getCampaignNpcs(game).length).toBeGreaterThan(0);
    expect(getCampaignNpcs(game).some(npc => npc.id === 'fang-yuan' || /^(古月)?方源$/.test(npc.name))).toBe(false);
    expect(new Set(getCampaignGu(game).map(gu => gu.id))).toEqual(new Set(['moonlight', 'liquor-worm']));
    expect(getCampaignRecipes(game)).toEqual([]);
    expect(getCampaignEnemies(game)).toEqual([]);
    expect(getCampaignShop(game).some(item => item.guId === 'liquor-worm' || item.guId === 'moonlight')).toBe(false);
    expect(getCampaignEndings(game).map(ending => ending.id)).toEqual(['fy-wolf-tide-stood', 'fy-wolf-tide-survived']);
    // No story choice writes an ending directly; the world clock settles the run.
    expect(events.flatMap(event => event.choices).some(choice => choice.encounterId || choice.victoryEnding || choice.ending)).toBe(false);
  });
});

describe('Fang Yuan survival played through actual actions', () => {
  it('unlocks the aperture through the ceremony, without permitting pre-awakening cultivation or resource farming', () => {
    let game = playThrough('fy-rebirth');
    for (const action of [
      { type: 'TRAIN' }, { type: 'ACTIVITY' }, { type: 'EQUIP', guId: 'moonlight' },
      { type: 'FEED' }, { type: 'BREAKTHROUGH' },
      { type: 'CRAFT', recipeId: 'refine-moon-glow', safe: true },
    ] satisfies GameAction[]) reject(game, action);
    for (const location of ['market', 'bamboo', 'stream', 'cave'] as const) {
      expect(getLocationError(game, location)).not.toBeNull();
      reject(game, { type: 'TRAVEL', location });
    }
    game = act(game, { type: 'REST' });
    expect(game).toMatchObject({ rank: 0, qi: 0, maxQi: 0 });
    game = act(game, { type: 'END_DAY' });
    expect(game).toMatchObject({ day: 2, rank: 0, maxQi: 0, qi: 0, ending: null });
    expect(game.worldEvents).toContain('fy-awakening-fair');
    game = chooseEvent(game, 'fy-awakening', 'accept-result');
    expect(game).toMatchObject({ rank: 1, qi: 12, maxQi: 12, maxHp: 28, inventory: {} });
    expect(game.flags).toContain('fy-awakened');
    expect(game.resources.stones).toBe(0);
  });

  it('ends the run as a dead end when the awakening fair closes with the aperture still shut', () => {
    let game = playThrough('fy-rebirth');
    game = endDays(game, 6);
    expect(game.ending).toMatchObject({ id: 'fy-missed-awakening', outcome: 'defeat' });
    expect(game.rank).toBe(0);
    reject(game, { type: 'END_DAY' });
  });

  it('treats the claimed moonlight and recovered liquor worm as unrefined until the cicada scene', () => {
    let game = playThrough('fy-claim-moonlight');
    expect(game.flags).toContain('fy-moonlight-held-unrefined');
    expect(game.inventory).toEqual({});
    reject(game, { type: 'EQUIP', guId: 'moonlight' });
    game = playThrough('fy-cave');
    expect(game.flags).toContain('fy-liquor-held-unrefined');
    expect(game.inventory).toEqual({});
    reject(game, { type: 'EQUIP', guId: 'liquor-worm' });
    const beforeRefinement = playThrough('fy-refine-liquor');
    expect(beforeRefinement.inventory).toEqual({});
    const refined = chooseEvent(beforeRefinement, 'fy-cicada', 'steady-the-aperture');
    expect(refined.inventory).toEqual({ moonlight: 1, 'liquor-worm': 1 });
    expect(refined.flags).toEqual(expect.arrayContaining(['fy-liquor-refined', 'fy-moonlight-refined', 'fy-vital-cicada']));
    expect(refined.equipped).toEqual([]);
    expect(refined.rank).toBe(1);
    reject(refined, { type: 'EXPLORE', eventId: 'fy-cicada' });
    reject(refined, { type: 'EQUIP', guId: 'spring-autumn-cicada' });
  });

  it('preserves meaningful family choices without granting the disputed inheritance', () => {
    const before = playThrough('fy-claim-moonlight');
    const refused = chooseEvent(before, 'fy-family', 'refuse-adoption');
    const delayed = chooseEvent(before, 'fy-family', 'delay-decision');
    expect(refused.resources.stones).toBe(6);
    expect(delayed.resources.stones).toBe(6);
    expect(refused.flags).toContain('fy-refused-adoption');
    expect(delayed.flags).toContain('fy-delayed-family-pressure');
    expect(refused.relations['fy-dong-tu']).toBeLessThan(delayed.relations['fy-dong-tu']!);
    expect(delayed.suspicion).toBeGreaterThan(refused.suspicion);
    expect(before.resources.stones).toBe(0);
    reject(refused, { type: 'EXPLORE', eventId: 'fy-family' });
  });

  it('lets unrelated opportunities run in parallel instead of in a fixed order', () => {
    let game = playThrough('fy-awakening');
    // The inn and the wine do not require the family talk or the rain refinement; only money.
    game = chooseEvent(game, 'fy-family', 'refuse-adoption');
    game = chooseEvent(game, 'fy-inn', 'rent-quiet-room');
    expect(game.flags).toContain('fy-lodged');
    expect(game.flags).not.toContain('fy-rain-prepared');
    expect(game.flags).not.toContain('fy-moonlight-claimed');
    game = chooseEvent(game, 'fy-bamboo-wine', 'buy-after-dispute');
    expect(game.flags).toContain('fy-wine-bought');
    expect(game.flags).not.toContain('fy-moonlight-claimed');
    // The liquor refinement genuinely depends on recovering the worm; the recording does not gate it.
    game = chooseEvent(game, 'fy-lure', 'spread-the-bait');
    game = chooseEvent(game, 'fy-follow', 'follow-from-distance');
    game = chooseEvent(game, 'fy-cave', 'check-the-exit');
    expect(getAvailableEvents(travel(game, 'market')).some(event => event.id === 'fy-refine-liquor')).toBe(true);
    expect(game.flags).not.toContain('fy-recording-seen');
  });

  it('closes a timed opportunity permanently once its window passes', () => {
    let game = playThrough('fy-awakening');
    expect(getAvailableEvents(travel(game, 'academy')).some(event => event.id === 'fy-claim-moonlight')).toBe(true);
    game = endDays(game, 21);
    expect(game.flags).toContain('missed-fy-claim-moonlight');
    expect(game.flags).not.toContain('fy-moonlight-claimed');
    expect(getAvailableEvents(travel(game, 'academy')).some(event => event.id === 'fy-claim-moonlight')).toBe(false);
    reject(game, { type: 'EXPLORE', eventId: 'fy-claim-moonlight' });
    expect(game.ending).toBeNull();
  });

  it('lets a penniless player defer the wine purchase, earn funds and finish the same route', () => {
    let game = playThrough('fy-inn');
    expect(game.resources.stones).toBe(4);
    game = act(game, { type: 'BUY', itemId: 'fy-herbs' });
    game = act(game, { type: 'BUY', itemId: 'fy-herbs' });
    expect(game.resources.stones).toBe(0);
    game = openEvent(game, 'fy-bamboo-wine');
    reject(game, { type: 'CHOOSE', choiceId: 'buy-after-dispute' });
    game = act(game, { type: 'CHOOSE', choiceId: 'prepare-later' });
    expect(game.seenEvents).toContain('fy-bamboo-wine');
    expect(game.flags).not.toContain('fy-wine-bought');
    expect(getAvailableEvents(game).some(event => event.id === 'fy-bamboo-wine')).toBe(true);
    game = travel(game, 'clan');
    game = act(game, { type: 'ACTIVITY' });
    expect(game.resources.stones).toBe(2);
    game = chooseEvent(game, 'fy-bamboo-wine', 'buy-after-dispute');
    expect(game.resources).toMatchObject({ stones: 0, wine: 1, herbs: 4 });
    game = continueAfter(game, 'fy-bamboo-wine');
    expect(game.flags).toContain('fy-first-gu-complete');
    expect(game.ending).toBeNull();
    expect(game.resources.stones).toBe(35);
  });

  it('completes all fourteen opportunities with earned Gu, then keeps playing toward the wolf tide', () => {
    let game = createGame({ campaign: 'fang-yuan', seed: 12185 });
    for (const [eventId, choiceId] of ROUTE) {
      const before = structuredClone(game);
      game = chooseEvent(game, eventId, choiceId);
      expect(before.flags).not.toContain(FANG_STEPS.find(step => step.eventId === eventId)!.flag);
      expect(game.ending, eventId).toBeNull();
      if (!game.flags.includes('fy-cicada-revealed')) expect(game.inventory, eventId).toEqual({});
    }
    expect(game.flags).toEqual(expect.arrayContaining(FANG_STEPS.map(step => step.flag)));
    expect(game.flags).toContain('milestone-first-gu');
    expect(game.inventory).toEqual({ moonlight: 1, 'liquor-worm': 1 });
    expect(game.resources).toEqual({ stones: 37, herbs: 0, ore: 0, wine: 0 });
    expect(game).toMatchObject({ rank: 1, hp: 28, maxHp: 28, maxQi: 12, combat: null, ending: null });
    expect(game.day).toBeLessThan(WOLF_TIDE_DAY);
    reject(game, { type: 'EXPLORE', eventId: 'fy-report' });
    // The run continues: training and the day loop still work after the milestone.
    game = act(game, { type: 'EQUIP', guId: 'liquor-worm' });
    if (game.actions === 0) game = act(game, { type: 'END_DAY' });
    game = act(game, { type: 'TRAIN' });
    expect(game.cultivation).toBeGreaterThan(0);
  });

  it('settles the run at the wolf tide by standing, scoring the real stake rather than the route', () => {
    let game = playThrough('fy-report');
    game = act(game, { type: 'EQUIP', guId: 'liquor-worm' });
    game = act(game, { type: 'EQUIP', guId: 'moonlight' });
    // Earn enough to pay upkeep across the long wait and keep the worm awake.
    while (game.day < WOLF_TIDE_DAY) {
      while (game.actions > 0 && game.resources.stones < 200) game = act(travel(game, 'clan'), { type: 'ACTIVITY' });
      game = act(game, { type: 'END_DAY' });
    }
    expect(game).toMatchObject({ day: WOLF_TIDE_DAY, ending: null });
    expect(game.worldEvents).toEqual(expect.arrayContaining(['fy-awakening-fair', 'fy-merchant-window', 'fy-year-end-trial', 'fy-wolf-tide-omen']));
    const settled = act(game, { type: 'END_DAY' });
    expect(settled.day).toBe(WOLF_TIDE_DAY);
    expect(settled.ending?.id).toMatch(/^fy-wolf-tide-/);
    expect(settled.ending?.outcome).toBe(judgeWolfTide({
      rank: 1, guKinds: 2, stones: game.resources.stones, suspicion: game.suspicion, hasLiquorWorm: true, sawInheritance: true,
    }).outcome);
    reject(settled, { type: 'END_DAY' });
  });

  it('settles a prepared-nothing run as death at the wolf tide', () => {
    let game = playThrough('fy-awakening');
    game = endDays(game, WOLF_TIDE_DAY);
    expect(game.ending).toBeNull();
    game = act(game, { type: 'END_DAY' });
    expect(game.ending).toMatchObject({ id: 'fy-wolf-tide-death', outcome: 'defeat' });
    expect(game.flags.filter(flag => flag.startsWith('missed-')).length).toBeGreaterThan(0);
  });

  it('scores the wolf tide from rank, Gu, stones, suspicion and key milestones', () => {
    expect(scoreWolfTide({ rank: 0, guKinds: 0, stones: 0, suspicion: 0, hasLiquorWorm: false, sawInheritance: false })).toBe(0);
    expect(scoreWolfTide({ rank: 1, guKinds: 2, stones: 37, suspicion: 5, hasLiquorWorm: true, sawInheritance: true })).toBe(6);
    expect(scoreWolfTide({ rank: 1, guKinds: 2, stones: 130, suspicion: 70, hasLiquorWorm: true, sawInheritance: true })).toBe(6);
    expect(scoreWolfTide({ rank: 2, guKinds: 4, stones: 130, suspicion: 0, hasLiquorWorm: true, sawInheritance: true })).toBe(15);
    expect(judgeWolfTide({ rank: 0, guKinds: 0, stones: 0, suspicion: 0, hasLiquorWorm: false, sawInheritance: false }).id).toBe('fy-wolf-tide-death');
    expect(judgeWolfTide({ rank: 1, guKinds: 2, stones: 37, suspicion: 5, hasLiquorWorm: true, sawInheritance: true }).id).toBe('fy-wolf-tide-survived');
    expect(judgeWolfTide({ rank: 2, guKinds: 4, stones: 130, suspicion: 0, hasLiquorWorm: true, sawInheritance: true }).id).toBe('fy-wolf-tide-stood');
  });

  it('requires actual refinement before the report opens and rejects any borrowed legacy ending', () => {
    const game = playThrough('fy-claim-moonlight');
    const report = getCampaignEvents(game).find(event => event.id === 'fy-report')!;
    const choice = report.choices.find(entry => entry.id === 'report-moonlight')!;
    // The gate lives on the event (gu + cicada flag), so the event is unavailable until refinement.
    expect(getAvailableEvents(travel(game, 'academy')).some(event => event.id === 'fy-report')).toBe(false);
    reject(game, { type: 'EXPLORE', eventId: 'fy-report' });
    reject(game, { type: 'EXPLORE', eventId: 'academy-roster' });
    // No story choice may carry an ending in this campaign, legacy or otherwise.
    expect(getChoiceError(game, { ...choice, ending: 'clan' })).not.toBeNull();
    expect(getChoiceError(game, { ...choice, ending: 'fy-wolf-tide-stood' })).not.toBeNull();
    reject({ ...game, inventory: { moonlight: 1 } }, { type: 'EQUIP', guId: 'moonlight' });
  });

  it('uses a fed, equipped liquor worm to improve cultivation without changing aptitude or rank', () => {
    let game = playThrough('fy-cicada');
    expect(getTrainingGain(game)).toBe(3);
    game = act(game, { type: 'EQUIP', guId: 'liquor-worm' });
    expect(getTrainingGain(game)).toBe(4);
    if (game.actions === 0) game = act(game, { type: 'END_DAY' });
    const before = game;
    game = act(game, { type: 'TRAIN' });
    expect(game.cultivation - before.cultivation).toBe(4);
    expect(before.qi - game.qi).toBe(3);
    expect(game).toMatchObject({ rank: 1, maxHp: 28, maxQi: 12 });
    for (let days = 0; days < 25 && !game.hungry.includes('liquor-worm'); days += 1) {
      game = act(game, { type: 'END_DAY' });
    }
    expect(game.hungry).toContain('liquor-worm');
    expect(game.ending).toBeNull();
    expect(getTrainingGain(game)).toBe(3);
  });

  it('keeps second-rank breakthrough, old recipes and deeper inheritance outside this stage', () => {
    const real = playThrough('fy-cicada');
    const supplied: GameState = {
      ...real, actions: 3, cultivation: 100,
      resources: { stones: 100, herbs: 100, ore: 100, wine: 100 },
    };
    reject(supplied, { type: 'BREAKTHROUGH' });
    reject(supplied, { type: 'CRAFT', recipeId: 'refine-moon-mark', safe: true });
    const atCave = travel(supplied, 'cave');
    expect(getAvailableEvents(atCave)).toEqual([]);
    reject(atCave, { type: 'EXPLORE', eventId: 'cave-guardian' });
    expect(atCave.rank).toBe(1);
  });

  it('guides toward the opportunity whose window closes soonest', () => {
    let game = playThrough('fy-awakening');
    const advice = getJourneyAdvice(game, 'open');
    expect(advice).not.toBeNull();
    // The moonlight claim closes on day 20, earlier than the family talk (30) or the open-ended inn.
    expect(advice!.title).toBe('领下月光');
    game = endDays(game, 18);
    const urgent = getJourneyAdvice(game, 'open');
    expect(urgent!.description).toContain('只剩');
  });

  it('guides an unaffordable mainline choice back to real resource gathering before reopening it', () => {
    let game = playThrough('fy-inn');
    game = act(game, { type: 'BUY', itemId: 'fy-herbs' });
    game = act(game, { type: 'BUY', itemId: 'fy-herbs' });
    game = chooseEvent(game, 'fy-bamboo-wine', 'prepare-later');
    for (let moves = 0; moves < 4; moves += 1) {
      const advice = getJourneyAdvice(game, 'clan');
      expect(advice).not.toBeNull();
      expect(`${advice!.title} ${advice!.description}`).not.toMatch(/35|宗族信任|公仓|离山路费/);
      if (advice!.destination.kind !== 'action') throw new Error('Expected resource gathering or a mainline action');
      game = act(game, advice!.destination.action);
    }
    expect(game.activeEvent).toBe('fy-bamboo-wine');
    game = act(game, { type: 'CHOOSE', choiceId: 'buy-after-dispute' });
    expect(game.flags).toContain('fy-wine-bought');
  });
});
