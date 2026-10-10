import { describe, expect, it } from 'vitest';
import { ENEMIES, EVENTS, GU, LOCATIONS, ORIGINS, RECIPES, SHOP } from './content';
import {
  createGame, gameReducer, getActionError, getAvailableEvents, getChoiceError, getCombatForecast,
  getEffectiveStats, getUpkeep,
} from './engine';
import type { CombatState, EventChoice, GameAction, GameState, Resources } from './types';

const richResources: Resources = { stones: 100, herbs: 40, ore: 40, wine: 40 };
const emptyResources: Resources = { stones: 0, herbs: 0, ore: 0, wine: 0 };

function scenario(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createGame({ name: '试炼者', origin: 'disciple', seed: 12185 }),
    resources: { ...richResources }, inventory: {}, equipped: [], usedToday: [], hungry: [],
    ...overrides,
  };
}

function step(state: GameState, action: GameAction): GameState {
  expect(getActionError(state, action), `day ${state.day}: ${JSON.stringify(action)}`).toBeNull();
  const next = gameReducer(state, action);
  expect(next, `accepted action should produce a new state: ${JSON.stringify(action)}`).not.toBe(state);
  expectNonnegative(next);
  return next;
}

function resolveEvent(state: GameState, location: GameState['location'], eventId: string, choiceId: string): GameState {
  let next = state;
  if (next.location !== location) next = step(next, { type: 'TRAVEL', location });
  next = step(next, { type: 'EXPLORE' });
  expect(next.activeEvent).toBe(eventId);
  return step(next, { type: 'CHOOSE', choiceId });
}

function battle(overrides: Partial<CombatState> = {}): CombatState {
  const enemy = ENEMIES[0]!;
  return {
    enemyId: enemy.id, enemyHp: enemy.hp, enemyGuard: 0, playerGuard: 0, turn: 0,
    victoryEffects: { resources: { stones: 13 }, addFlags: ['qa-victory'] },
    victoryText: '取回约定的报酬。', defeatEffects: { trust: -5 }, log: [],
    ...overrides,
  };
}

function facingIntent(type: 'attack' | 'guard' | 'drain', overrides: Partial<GameState> = {}): GameState {
  const enemy = ENEMIES.find(entry => entry.moves.some(move => move.type === type))!;
  const turn = enemy.moves.findIndex(move => move.type === type);
  return scenario({
    hp: 20, qi: 4, combat: battle({ enemyId: enemy.id, enemyHp: enemy.hp, turn }), ...overrides,
  });
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const nested of Object.values(value)) freezeDeep(nested);
  }
  return value;
}

function expectNonnegative(state: GameState) {
  for (const amount of [...Object.values(state.resources), ...Object.values(state.inventory)]) {
    expect(Number.isInteger(amount)).toBe(true);
    expect(amount).toBeGreaterThanOrEqual(0);
  }
  expect(state.hp).toBeGreaterThanOrEqual(0);
  expect(state.hp).toBeLessThanOrEqual(state.maxHp);
  expect(state.qi).toBeGreaterThanOrEqual(0);
  expect(state.qi).toBeLessThanOrEqual(state.maxQi);
}

describe('a new journey and the action economy', () => {
  it.each(ORIGINS.map((origin) => [origin.id] as const))('starts %s with a reproducible, independent save', (origin) => {
    const first = createGame({ name: '  山客  ', origin, seed: 47 });
    const second = createGame({ name: '  山客  ', origin, seed: 47 });
    expect(first).toEqual(second);
    expect(first.resources).not.toBe(second.resources);
    expect(first.inventory).not.toBe(second.inventory);
    expect(first).toMatchObject({ name: '山客', day: 1, actions: 3, hp: 28, qi: 12, rank: 1 });
    expect(first.equipped.length).toBeLessThanOrEqual(4);
    expect(first.usedToday).toEqual(first.equipped);
    expect(first.ending).toBeNull();
    expectNonnegative(first);
  });

  it('charges timed actions once, allows free travel, and waits for an explicit day end', () => {
    let state = scenario({ qi: 12, cultivation: 0 });
    state = step(state, { type: 'TRAVEL', location: 'market' });
    expect(state.actions).toBe(3);
    for (let i = 0; i < 3; i += 1) state = step(state, { type: 'TRAIN' });
    expect(state).toMatchObject({ day: 1, actions: 0, qi: 3, cultivation: 9 });
    expect(gameReducer(state, { type: 'REST' })).toBe(state);
    state = step(state, { type: 'TRAVEL', location: 'academy' });
    expect(state.day).toBe(1);
    state = step(state, { type: 'END_DAY' });
    expect(state).toMatchObject({ day: 2, actions: 3, qi: 12 });
  });

  it('does not spend actions or resources when a requirement is missing', () => {
    const cases: [GameState, GameAction][] = [
      [scenario({ qi: 2 }), { type: 'TRAIN' }],
      [scenario({ actions: 0 }), { type: 'REST' }],
      [scenario({ cultivation: 11 }), { type: 'BREAKTHROUGH' }],
      [scenario({ cultivation: 12, resources: { ...emptyResources, stones: 11 } }), { type: 'BREAKTHROUGH' }],
      [scenario({ location: 'market', resources: { ...emptyResources } }), { type: 'BUY', itemId: SHOP.find((item) => item.price > 0)!.id }],
      [scenario(), { type: 'CRAFT', recipeId: RECIPES[0]!.id, safe: false }],
      [scenario(), { type: 'EQUIP', guId: 'moonlight' }],
      [scenario(), { type: 'CHOOSE', choiceId: 'not-an-active-choice' }],
      [scenario(), { type: 'COMBAT', move: 'attack' }],
      [scenario({ location: 'market' }), { type: 'BUY', itemId: 'missing-item' }],
      [scenario(), { type: 'CRAFT', recipeId: 'missing-recipe', safe: true }],
      [scenario(), { type: 'EQUIP', guId: 'missing-gu' }],
      [scenario({ inventory: { moonlight: -1 } }), { type: 'EQUIP', guId: 'moonlight' }],
      [scenario({ combat: battle() }), { type: 'COMBAT', move: 'gu', guId: 'missing-gu' }],
    ];
    for (const [state, action] of cases) {
      const before = structuredClone(state);
      expect(getActionError(state, action), JSON.stringify(action)).toBeTruthy();
      expect(gameReducer(freezeDeep(state), action), JSON.stringify(action)).toBe(state);
      expect(state).toEqual(before);
    }
  });

  it('restores health and qi without exceeding their caps', () => {
    const rested = step(scenario({ hp: 25, qi: 10 }), { type: 'REST' });
    expect(rested).toMatchObject({ hp: 28, qi: 12, actions: 2 });
  });

  it('only sells in the market, respects stock, and does not spend schedule actions', () => {
    const item = SHOP.find((entry) => entry.stock > 0)!;
    const away = scenario({ location: 'academy' });
    expect(gameReducer(away, { type: 'BUY', itemId: item.id })).toBe(away);
    const before = scenario({ location: 'market', purchases: { [item.id]: item.stock - 1 } });
    const bought = step(before, { type: 'BUY', itemId: item.id });
    expect(bought.purchases[item.id]).toBe(item.stock);
    expect(bought.actions).toBe(before.actions);
    expect(bought.resources.stones).toBe(before.resources.stones - item.price + (item.effects.resources?.stones ?? 0));
    expect(gameReducer(bought, { type: 'BUY', itemId: item.id })).toBe(bought);
    expectNonnegative(bought);
  });
});

describe('equipment, daily upkeep, and hunger', () => {
  it('enforces four slots, ownership, rank, and no duplicate equipment', () => {
    let state = scenario({ inventory: Object.fromEntries(GU.map((gu) => [gu.id, 2])) });
    for (const id of ['moonlight', 'little-light', 'jade-skin', 'white-boar']) {
      state = step(state, { type: 'EQUIP', guId: id });
    }
    expect(state.equipped).toHaveLength(4);
    expect(gameReducer(state, { type: 'EQUIP', guId: 'moonlight' })).toBe(state);
    expect(gameReducer(state, { type: 'EQUIP', guId: 'liquor-worm' })).toBe(state);
    state = step(state, { type: 'UNEQUIP', guId: 'little-light' });
    expect(gameReducer(state, { type: 'EQUIP', guId: 'moon-glow' })).toBe(state);
  });

  it('charges a gu carried earlier even after it is unequipped, but only once', () => {
    let state = scenario({ inventory: { moonlight: 2 }, hp: 19, qi: 1, suspicion: 7 });
    state = step(state, { type: 'EQUIP', guId: 'moonlight' });
    const upkeep = GU.find((gu) => gu.id === 'moonlight')!.upkeep;
    state = step(state, { type: 'UNEQUIP', guId: 'moonlight' });
    state = step(state, { type: 'EQUIP', guId: 'moonlight' });
    state = step(state, { type: 'UNEQUIP', guId: 'moonlight' });
    expect(state.usedToday).toEqual(['moonlight']);
    expect(getUpkeep(state)).toBe(upkeep);
    const next = step(state, { type: 'END_DAY' });
    expect(next.resources.stones).toBe(100 - upkeep);
    expect(next).toMatchObject({ day: 2, actions: 3, hp: 23, qi: 12, suspicion: 4 });
    expect(next.usedToday).toEqual([]);
    expect(getUpkeep(next)).toBe(0);
  });

  it('keeps insufficient cash, sleeps unpaid gu, and removes their combat contribution', () => {
    const gu = GU.find((entry) => entry.id === 'white-boar')!;
    const awake = scenario({
      resources: { ...emptyResources, stones: gu.upkeep - 1 },
      inventory: { [gu.id]: 1 }, equipped: [gu.id], usedToday: [gu.id],
    });
    expect(getEffectiveStats(awake).attack).toBeGreaterThan(3);
    const sleeping = step(awake, { type: 'END_DAY' });
    expect(sleeping.resources.stones).toBe(awake.resources.stones);
    expect(sleeping.hungry).toEqual([gu.id]);
    expect(getEffectiveStats(sleeping).attack).toBe(3);
    expect(gameReducer(sleeping, { type: 'FEED' })).toBe(sleeping);
    const ready = { ...sleeping, resources: { ...sleeping.resources, stones: gu.upkeep } };
    const fed = step(ready, { type: 'FEED' });
    expect(fed.resources.stones).toBe(0);
    expect(fed.hungry).toEqual([]);
    expect(fed.actions).toBe(ready.actions);
    expect(getEffectiveStats(fed).attack).toBeGreaterThan(3);
  });

  it('wakes carried gu after a later successful daily payment', () => {
    const gu = GU.find((entry) => entry.id === 'moonlight')!;
    const state = scenario({
      resources: { ...emptyResources, stones: gu.upkeep },
      inventory: { [gu.id]: 1 }, equipped: [gu.id], usedToday: [gu.id], hungry: [gu.id],
    });
    const next = step(state, { type: 'END_DAY' });
    expect(next.hungry).toEqual([]);
    expect(next.resources.stones).toBe(0);
  });

  it('gives passive gu distinct benefits, which disappear while they sleep', () => {
    const benefits = [
      ['white-boar', 'attack'], ['white-jade', 'guard'], ['earth-ear', 'scouting'],
      ['flower-bag', 'storage'], ['jumping-grass', 'escape'],
    ] as const;
    const baseline = getEffectiveStats(scenario());
    for (const [guId, stat] of benefits) {
      const state = scenario({ rank: 2, inventory: { [guId]: 1 }, equipped: [guId] });
      expect(getEffectiveStats(state)[stat], guId).toBeGreaterThan(baseline[stat]);
      expect(getEffectiveStats({ ...state, hungry: [guId] }), guId).toEqual(baseline);
    }
  });

  it('turns storage capacity into extra collected resources without extra actions', () => {
    const location = LOCATIONS.find((entry) =>
      Object.values(entry.activity.effects.resources ?? {}).some((amount) => amount > 0),
    )!;
    const before = scenario({ rank: 2, location: location.id, inventory: { 'flower-bag': 1 } });
    const ordinary = step(before, { type: 'ACTIVITY' });
    const equipped = step(before, { type: 'EQUIP', guId: 'flower-bag' });
    const stored = step(equipped, { type: 'ACTIVITY' });
    const total = (resources: Resources) => Object.values(resources).reduce((sum, amount) => sum + amount, 0);
    expect(total(stored.resources)).toBeGreaterThan(total(ordinary.resources));
    expect(stored.actions).toBe(ordinary.actions);
  });
});

describe('refinement pays its advertised costs', () => {
  it.each(RECIPES.map((recipe) => [recipe.id] as const))('safe refinement of %s consumes inputs and succeeds', (recipeId) => {
    const recipe = RECIPES.find((entry) => entry.id === recipeId)!;
    const before = scenario({
      rank: 2, inventory: { ...recipe.gu }, equipped: Object.keys(recipe.gu), usedToday: Object.keys(recipe.gu),
    });
    const next = step(before, { type: 'CRAFT', recipeId, safe: true });
    expect(next.inventory[recipe.result]).toBe(1);
    for (const id of Object.keys(recipe.gu)) {
      expect(next.inventory[id] ?? 0).toBe(0);
      expect(next.equipped).not.toContain(id);
    }
    for (const key of Object.keys(richResources) as (keyof Resources)[]) {
      expect(next.resources[key]).toBe(before.resources[key] - (recipe.resources[key] ?? 0) - (recipe.safeExtra[key] ?? 0));
    }
    expect(next.actions).toBe(before.actions - 1);
    expect(getUpkeep(next)).toBe(getUpkeep(before));
    expectNonnegative(next);
  });

  it('ordinary success and failure both cost one action and auxiliaries; only success consumes gu', () => {
    const recipe = RECIPES.find((entry) => entry.successRate < 1)!;
    expect(recipe).toBeDefined();
    const attempts = Array.from({ length: 64 }, (_, seed) => {
      const before = scenario({ seed, rng: seed, inventory: { ...recipe.gu } });
      return { before, after: step(before, { type: 'CRAFT', recipeId: recipe.id, safe: false }) };
    });
    const success = attempts.find(({ after }) => after.inventory[recipe.result] === 1);
    const failure = attempts.find(({ after }) => !after.inventory[recipe.result]);
    expect(success, 'seeded normal refinement should have a successful outcome').toBeDefined();
    expect(failure, 'seeded normal refinement should also expose the failure branch').toBeDefined();
    for (const { before, after } of [success!, failure!]) {
      expect(after.actions).toBe(before.actions - 1);
      for (const key of Object.keys(richResources) as (keyof Resources)[]) {
        expect(after.resources[key]).toBe(before.resources[key] - (recipe.resources[key] ?? 0));
      }
      expectNonnegative(after);
    }
    expect(failure!.after.inventory).toEqual(failure!.before.inventory);
    expect(failure!.after.journal.at(-1)?.kind).toBe('bad');
    for (const id of Object.keys(recipe.gu)) expect(success!.after.inventory[id] ?? 0).toBe(0);
    const replay: GameAction = { type: 'CRAFT', recipeId: recipe.id, safe: false };
    expect(gameReducer(success!.before, replay)).toEqual(success!.after);
    expect(gameReducer(failure!.before, replay)).toEqual(failure!.after);
  });

  it('cannot refine without enough ingredients or the extra safe-refinement payment', () => {
    const recipe = RECIPES[0]!;
    const noMoney = scenario({ inventory: { ...recipe.gu }, resources: { ...emptyResources } });
    expect(gameReducer(noMoney, { type: 'CRAFT', recipeId: recipe.id, safe: false })).toBe(noMoney);
    const onlyBaseCost = { ...emptyResources, ...recipe.resources };
    const noExtra = scenario({ inventory: { ...recipe.gu }, resources: onlyBaseCost });
    expect(gameReducer(noExtra, { type: 'CRAFT', recipeId: recipe.id, safe: true })).toBe(noExtra);
    expect(noExtra.inventory).toEqual(recipe.gu);
  });
});

describe('event requirements and exits', () => {
  const simpleChoice: EventChoice = { id: 'check', label: '试行', description: '', effects: {}, outcome: '完成。' };

  it('checks resource thresholds, upper and lower stats, flags, gu counts, and awake equipment', () => {
    const state = scenario({
      trust: 20, suspicion: 8, flags: ['met-guide'], inventory: { moonlight: 1 }, equipped: ['moonlight'],
    });
    const allowed: EventChoice = {
      ...simpleChoice,
      requirements: [
        { kind: 'resource', key: 'stones', min: 100 },
        { kind: 'stat', key: 'trust', min: 20 },
        { kind: 'stat', key: 'suspicion', max: 8 },
        { kind: 'flag', key: 'met-guide' },
        { kind: 'flag', key: 'betrayed-guide', value: false },
        { kind: 'gu', id: 'moonlight', equipped: true },
      ],
    };
    expect(getChoiceError(state, allowed)).toBeNull();
    expect(getChoiceError({ ...state, resources: { ...state.resources, stones: 99 } }, allowed)).toBeTruthy();
    expect(getChoiceError({ ...state, trust: 19 }, allowed)).toBeTruthy();
    expect(getChoiceError({ ...state, suspicion: 9 }, allowed)).toBeTruthy();
    expect(getChoiceError({ ...state, flags: [] }, allowed)).toBeTruthy();
    expect(getChoiceError({ ...state, flags: [...state.flags, 'betrayed-guide'] }, allowed)).toBeTruthy();
    expect(getChoiceError({ ...state, hungry: ['moonlight'] }, allowed)).toBeTruthy();
    expect(getChoiceError({ ...state, equipped: [] }, allowed)).toBeTruthy();
    expect(getChoiceError(state, { ...simpleChoice, requirements: [{ kind: 'gu', id: 'moonlight', count: 2 }] })).toBeTruthy();
    expect(getChoiceError(state, { ...simpleChoice, effects: { resources: { stones: -101 } } })).toBeTruthy();
  });

  it('lets a resource-poor player leave every actual event without becoming stuck', () => {
    for (const event of EVENTS) {
      const state = scenario({
        activeEvent: event.id, location: event.location, day: event.dayMin ?? 1,
        resources: { ...emptyResources }, qi: 0, trust: 0, clues: 0,
      });
      const fallback = event.choices.find((choice) =>
        !choice.requirements?.length && !choice.encounterId &&
        Object.values(choice.effects.resources ?? {}).every((amount) => amount >= 0) &&
        Object.values(choice.effects.gu ?? {}).every((amount) => amount >= 0) &&
        (choice.effects.qi ?? 0) >= 0,
      );
      expect(fallback, event.id).toBeDefined();
      expect(getChoiceError(state, fallback!), event.id).toBeNull();
      const next = step(state, { type: 'CHOOSE', choiceId: fallback!.id });
      expect(next.activeEvent, event.id).toBeNull();
      expect(next.combat, event.id).toBeNull();
      expect(next.actions, event.id).toBe(state.actions);
      expect(next.seenEvents, event.id).toContain(event.id);
      expectNonnegative(next);
    }
  });

  it('uses an actual available event, spends exploration once, and locks travel until a choice is made', () => {
    const before = createGame({ name: '听风', origin: 'scout', seed: 12 });
    const available = getAvailableEvents(before);
    expect(available.length).toBeGreaterThan(0);
    const active = step(before, { type: 'EXPLORE' });
    expect(available.map((event) => event.id)).toContain(active.activeEvent);
    expect(active.actions).toBe(before.actions - 1);
    expect(getAvailableEvents(active)).toEqual([]);
    expect(gameReducer(active, { type: 'TRAVEL', location: 'market' })).toBe(active);
    expect(gameReducer(active, { type: 'END_DAY' })).toBe(active);
    expect(gameReducer(active, { type: 'CHOOSE', choiceId: 'not-in-this-event' })).toBe(active);
    const event = EVENTS.find((entry) => entry.id === active.activeEvent)!;
    const choice = event.choices.find((entry) => !entry.encounterId && !getChoiceError(active, entry))!;
    const resolved = step(active, { type: 'CHOOSE', choiceId: choice.id });
    expect(resolved.actions).toBe(active.actions);
    expect(resolved.activeEvent).toBeNull();
    if (!event.repeatable) expect(getAvailableEvents(resolved).map((entry) => entry.id)).not.toContain(event.id);
  });

  it('opens an explicitly selected lower-priority event while preserving the default recommendation', () => {
    const before = scenario({ day: 3, cultivation: 3 });
    const available = getAvailableEvents(before);
    const lowerPriority = available.find(event => event.priority < available[0]!.priority);
    expect(lowerPriority).toBeDefined();
    const recommended = step(before, { type: 'EXPLORE' });
    expect(recommended.activeEvent).toBe(available[0]!.id);

    const selected = step(freezeDeep(before), { type: 'EXPLORE', eventId: lowerPriority!.id });
    expect(selected.activeEvent).toBe(lowerPriority!.id);
    expect(selected.activeEvent).not.toBe(recommended.activeEvent);
    expect(selected.actions).toBe(before.actions - 1);
    expect(selected.resources).toEqual(before.resources);
    expect(selected.seenEvents).toEqual(before.seenEvents);
    expect(selected.journal.at(-1)?.text).toContain(lowerPriority!.title);
    expect(before.activeEvent).toBeNull();
  });

  it.each<[string, string, Partial<GameState>]>([
    ['unknown ID', 'not-an-event', {}],
    ['empty ID', '', {}],
    ['another location', 'market-ledger', { location: 'academy' }],
    ['missing prerequisite flag', 'academy-private-lesson', { flags: [] }],
    ['missing cultivation', 'academy-assessment', { day: 3, cultivation: 0 }],
    ['too early', 'academy-rations', { day: 1 }],
    ['already resolved', 'academy-roster', { seenEvents: ['academy-roster'] }],
    ['locked ending route', 'cave-guardian', { location: 'cave', clues: 2 }],
  ])('rejects a selected event with %s without spending anything', (_label, eventId, overrides) => {
    const before = scenario({ day: 3, cultivation: 3, ...overrides });
    const snapshot = structuredClone(before);
    const action: GameAction = { type: 'EXPLORE', eventId };
    expect(getAvailableEvents(before).some(event => event.id === eventId)).toBe(false);
    expect(getActionError(before, action)).toBeTruthy();
    expect(gameReducer(freezeDeep(before), action)).toBe(before);
    expect(before).toEqual(snapshot);
  });

  it('requires the promised information, reputation, money, and date before offering a final route', () => {
    const cases: [string, Partial<GameState>, boolean][] = [
      ['cave-guardian', { location: 'cave', clues: 2 }, false],
      ['cave-guardian', { location: 'cave', clues: 3 }, true],
      ['clan-standing', { location: 'clan', clues: 1, trust: 100 }, false],
      ['clan-standing', { location: 'clan', clues: 2, trust: 34 }, false],
      ['clan-standing', { location: 'clan', clues: 2, trust: 35 }, true],
      ['market-departure', { location: 'market', day: 5, clues: 1 }, false],
      ['market-departure', { location: 'market', day: 6, clues: 0 }, false],
      ['market-departure', { location: 'market', day: 6, clues: 1, resources: { ...richResources, stones: 34 } }, false],
      ['market-departure', { location: 'market', day: 6, clues: 1, resources: { ...richResources, stones: 35 } }, true],
    ];
    for (const [eventId, changes, expected] of cases) {
      const state = scenario(changes);
      expect(getAvailableEvents(state).some((event) => event.id === eventId), JSON.stringify(changes)).toBe(expected);
      const endingChoice = EVENTS.find((event) => event.id === eventId)!.choices.find((choice) => choice.id !== 'leave')!;
      expect(getChoiceError(state, endingChoice) === null, JSON.stringify(changes)).toBe(expected);
    }
  });

  it('allows a player to postpone any ending and return after preparing', () => {
    for (const [location, eventId] of [
      ['cave', 'cave-guardian'], ['clan', 'clan-standing'], ['market', 'market-departure'],
    ] as const) {
      const state = scenario({ location, day: 6, clues: 3, trust: 40 });
      const postponed = resolveEvent(state, location, eventId, 'leave');
      expect(postponed.ending).toBeNull();
      expect(postponed.combat).toBeNull();
      expect(getAvailableEvents(postponed).map((event) => event.id)).toContain(eventId);
      expect(postponed.resources).toEqual(state.resources);
      expect(postponed.clues).toBe(state.clues);
    }
  });

  it('lets awake scouting gu discover a real clue without the health cost of following tracks', () => {
    const state = scenario({
      activeEvent: 'bamboo-tracks', location: 'bamboo', rank: 2,
      inventory: { 'earth-ear': 1 }, equipped: ['earth-ear'],
    });
    const sleeping = { ...state, hungry: ['earth-ear'] };
    expect(gameReducer(sleeping, { type: 'CHOOSE', choiceId: 'listen-tracks' })).toBe(sleeping);
    const listening = step(state, { type: 'CHOOSE', choiceId: 'listen-tracks' });
    const walking = step(state, { type: 'CHOOSE', choiceId: 'read-tracks' });
    expect(listening.clues).toBe(state.clues + 1);
    expect(listening.clues).toBe(walking.clues);
    expect(listening.hp).toBe(state.hp);
    expect(listening.hp).toBeGreaterThan(walking.hp);
    expect(listening.qi).toBeGreaterThan(walking.qi);
  });
});

describe('combat intent, capabilities, and outcomes', () => {
  it('performs the advertised next enemy move and advances its intent once per valid action', () => {
    const enemy = ENEMIES.find((entry) => entry.moves.some((move) => move.type === 'attack'))!;
    const turn = enemy.moves.findIndex((move) => move.type === 'attack');
    const state = scenario({ combat: battle({ enemyId: enemy.id, enemyHp: enemy.hp + 50, turn }), qi: 0 });
    const attacked = step(state, { type: 'COMBAT', move: 'attack' });
    const defended = step(state, { type: 'COMBAT', move: 'defend' });
    expect(attacked.combat?.turn).toBe(turn + 1);
    expect(defended.combat?.turn).toBe(turn + 1);
    expect(attacked.combat?.log.some((entry) => entry.includes(enemy.moves[turn]!.label))).toBe(true);
    expect(attacked.hp).toBeLessThan(state.hp);
    expect(defended.hp).toBeGreaterThanOrEqual(attacked.hp);
    expect(attacked.qi).toBe(1);
    expect(defended.qi).toBe(2);
    expect(attacked.actions).toBe(state.actions);
    expect(defended.actions).toBe(state.actions);
  });

  it('executes guard and qi-drain intents rather than silently treating them as attacks', () => {
    for (const type of ['guard', 'drain'] as const) {
      const enemy = ENEMIES.find((entry) => entry.moves.some((move) => move.type === type))!;
      expect(enemy, `a shipped encounter must exercise ${type}`).toBeDefined();
      const turn = enemy.moves.findIndex((move) => move.type === type);
      const state = scenario({ combat: battle({ enemyId: enemy.id, enemyHp: 80, turn }), qi: 5 });
      const next = step(state, { type: 'COMBAT', move: 'attack' });
      expect(next.hp).toBe(state.hp);
      expect(next.combat?.turn).toBe(turn + 1);
      if (type === 'guard') expect(next.combat?.enemyGuard).toBeGreaterThan(0);
      else expect(next.qi).toBeLessThan(state.qi + 1);
    }
  });

  it.each(GU.filter((gu) => !gu.passive && gu.ability !== 'escape').map((gu) => [gu.id] as const))(
    '%s spends qi and delivers its advertised active ability', (guId) => {
      const gu = GU.find((entry) => entry.id === guId)!;
      const enemy = ENEMIES.find((entry) => entry.moves.some((move) => move.type === 'guard'))!;
      const turn = enemy.moves.findIndex((move) => move.type === 'guard');
      const state = scenario({
        rank: 2, hp: 8, qi: Math.max(3, gu.qiCost),
        inventory: { [gu.id]: 1 }, equipped: [gu.id],
        combat: battle({ enemyId: enemy.id, enemyHp: 80, turn }),
      });
      const next = step(state, { type: 'COMBAT', move: 'gu', guId });
      expect(next.combat?.turn).toBe(turn + 1);
      expect(next.actions).toBe(state.actions);
      expect(next.usedToday).toContain(gu.id);
      if (gu.ability !== 'restore') expect(next.qi).toBe(state.qi - gu.qiCost);
      if (gu.ability === 'strike') expect(next.combat!.enemyHp).toBeLessThan(state.combat!.enemyHp);
      else if (gu.ability === 'guard') expect(next.combat!.playerGuard).toBeGreaterThan(0);
      else if (gu.ability === 'heal') expect(next.hp).toBeGreaterThan(state.hp);
      else if (gu.ability === 'restore') expect(next.qi).toBeGreaterThan(state.qi);
      else throw new Error(`Unexercised active ability: ${gu.ability}`);
      expectNonnegative(next);
    },
  );

  it('pays enemy and event rewards only after the killing blow, without an extra enemy turn', () => {
    const enemy = ENEMIES[0]!;
    const state = scenario({ hp: 1, combat: battle({ enemyHp: 1, victoryEnding: 'inheritance' }) });
    const next = step(state, { type: 'COMBAT', move: 'attack' });
    expect(next.combat).toBeNull();
    expect(next.hp).toBeGreaterThanOrEqual(1);
    expect(next.flags).toContain('qa-victory');
    expect(next.resources.stones).toBe(state.resources.stones + (enemy.reward.resources?.stones ?? 0) + 13);
    expect(next.ending).toMatchObject({ id: 'inheritance', outcome: 'success' });
  });

  it('marks a lethal defeat and never awards the pending victory or an inheritance ending', () => {
    const enemy = ENEMIES.find((entry) => entry.moves.some((move) => move.type === 'attack'))!;
    const turn = enemy.moves.findIndex((move) => move.type === 'attack');
    const state = scenario({
      hp: 1, trust: 20,
      combat: battle({ enemyId: enemy.id, enemyHp: enemy.hp + 50, turn, victoryEnding: 'inheritance' }),
    });
    const next = step(state, { type: 'COMBAT', move: 'attack' });
    expect(next.ending).toMatchObject({ id: 'departure', outcome: 'defeat' });
    expect(next.combat).toBeNull();
    expect(next.resources).toEqual(state.resources);
    expect(next.flags).not.toContain('qa-victory');
    expect(next.trust).toBe(15);
    expect(next.hp).toBe(0);
  });

  it('rejects sleeping gu, passive activations, and unaffordable skills without advancing combat', () => {
    const common = { inventory: { moonlight: 1, 'white-boar': 1 }, equipped: ['moonlight', 'white-boar'] };
    const sleepy = scenario({ ...common, hungry: ['moonlight'], combat: battle() });
    const exhausted = scenario({ ...common, qi: 0, combat: battle() });
    expect(gameReducer(sleepy, { type: 'COMBAT', move: 'gu', guId: 'moonlight' })).toBe(sleepy);
    expect(gameReducer(exhausted, { type: 'COMBAT', move: 'gu', guId: 'moonlight' })).toBe(exhausted);
    expect(gameReducer(exhausted, { type: 'COMBAT', move: 'gu', guId: 'white-boar' })).toBe(exhausted);
    expect(gameReducer(sleepy, { type: 'END_DAY' })).toBe(sleepy);
  });

  it('resolves both retreat branches, and movement gu improve escape without granting victory rewards', () => {
    const trials = Array.from({ length: 64 }, (_, seed) => {
      const state = scenario({ seed, rng: seed, location: 'cave', combat: battle({ enemyHp: 80 }) });
      const withMovement = {
        ...state, inventory: { 'jumping-grass': 1 }, equipped: ['jumping-grass'], usedToday: ['jumping-grass'],
      };
      return {
        before: state,
        ordinary: step(state, { type: 'COMBAT', move: 'retreat' }),
        improved: step(withMovement, { type: 'COMBAT', move: 'retreat' }),
      };
    });
    const escaped = trials.find(({ ordinary }) => !ordinary.combat)!;
    const blocked = trials.find(({ ordinary }) => !!ordinary.combat)!;
    expect(escaped).toBeDefined();
    expect(blocked).toBeDefined();
    expect(escaped.ordinary.location).toBe('academy');
    expect(escaped.ordinary.resources).toEqual(escaped.before.resources);
    expect(escaped.ordinary.flags).not.toContain('qa-victory');
    expect(escaped.ordinary.ending).toBeNull();
    expect(blocked.ordinary.combat?.turn).toBe(1);
    expect(blocked.ordinary.flags).not.toContain('qa-victory');
    expect(trials.some(({ ordinary, improved }) => ordinary.combat && !improved.combat)).toBe(true);
  });
});

describe('combat supplies', () => {
  it.each(['herbs', 'wine'] as const)('%s restores its advertised amount before the displayed enemy attack', (move) => {
    const state = facingIntent('attack', {
      hp: 10, qi: 0, actions: 0, resources: { ...richResources, herbs: 2, wine: 1 },
    });
    const forecast = getCombatForecast(state)!;
    const next = step(freezeDeep(state), { type: 'COMBAT', move });
    expect(next.hp).toBe(state.hp + (move === 'herbs' ? 8 : 0) - forecast.incomingDamage);
    expect(next.qi).toBe(move === 'wine' ? 5 : 0);
    expect(next.resources.herbs).toBe(move === 'herbs' ? 0 : 2);
    expect(next.resources.wine).toBe(move === 'wine' ? 0 : 1);
    expect(next.resources.stones).toBe(state.resources.stones);
    expect(next.resources.ore).toBe(state.resources.ore);
    expect(next.actions).toBe(0);
    expect(next.combat?.turn).toBe(state.combat!.turn + 1);
    expect(next.combat?.enemyHp).toBe(state.combat!.enemyHp);
    expect(next.combat?.log.at(-1)).toContain(forecast.intent.label);
    expect(next.rng).toBe(state.rng);
  });

  it.each(['herbs', 'wine'] as const)('%s caps recovery without skipping the enemy guard turn', (move) => {
    const state = facingIntent('guard', { hp: 27, qi: 11 });
    const forecast = getCombatForecast(state)!;
    const next = step(state, { type: 'COMBAT', move });
    expect(next.hp).toBe(move === 'herbs' ? state.maxHp : state.hp);
    expect(next.qi).toBe(move === 'wine' ? state.maxQi : state.qi);
    expect(next.resources.herbs).toBe(state.resources.herbs - (move === 'herbs' ? 2 : 0));
    expect(next.resources.wine).toBe(state.resources.wine - (move === 'wine' ? 1 : 0));
    expect(next.combat?.enemyGuard).toBe(forecast.intent.power);
    expect(next.combat?.turn).toBe(state.combat!.turn + 1);
    expect(next.actions).toBe(state.actions);
  });

  it('lets the displayed drain move take qi after wine has restored it', () => {
    const state = facingIntent('drain', { qi: 1 });
    const forecast = getCombatForecast(state)!;
    const next = step(state, { type: 'COMBAT', move: 'wine' });
    expect(next.qi).toBe(Math.max(0, 6 - forecast.intent.power));
    expect(next.hp).toBe(state.hp);
    expect(next.combat?.log.at(-1)).toContain(forecast.intent.label);
    expect(next.combat?.turn).toBe(state.combat!.turn + 1);
    expect(next.resources.wine).toBe(state.resources.wine - 1);
  });

  it('rejects supplies outside battle, at full capacity, or without the ingredients', () => {
    const cases: [GameState, 'herbs' | 'wine'][] = [
      [scenario({ hp: 10 }), 'herbs'],
      [scenario({ qi: 0 }), 'wine'],
      [facingIntent('attack', { hp: 28 }), 'herbs'],
      [facingIntent('attack', { qi: 12 }), 'wine'],
      [facingIntent('attack', { resources: { ...richResources, herbs: 1 } }), 'herbs'],
      [facingIntent('attack', { resources: { ...richResources, wine: 0 } }), 'wine'],
    ];
    for (const [state, move] of cases) {
      const snapshot = structuredClone(state);
      const action = { type: 'COMBAT', move } as const;
      expect(getActionError(state, action)).toBeTruthy();
      expect(gameReducer(freezeDeep(state), action)).toBe(state);
      expect(state).toEqual(snapshot);
    }
  });
});

describe('combat forecasts', () => {
  it.each([false, true])('matches actual ordinary attacks and defenses with passive protection = %s', (protectedByGu) => {
    for (const enemy of ENEMIES) {
      for (const [turn, intent] of enemy.moves.entries()) {
        if (intent.type !== 'attack') continue;
        for (const playerGuard of [0, 8, 100]) {
          const state = scenario({
            rank: 2, hp: 36, maxHp: 36, qi: 4, maxQi: 16,
            inventory: protectedByGu ? { 'white-jade': 1 } : {},
            equipped: protectedByGu ? ['white-jade'] : [],
            usedToday: protectedByGu ? ['white-jade'] : [],
            combat: battle({ enemyId: enemy.id, enemyHp: enemy.hp + 50, turn, playerGuard }),
          });
          const forecast = getCombatForecast(freezeDeep(state))!;
          const attacked = step(state, { type: 'COMBAT', move: 'attack' });
          const defended = step(state, { type: 'COMBAT', move: 'defend' });
          expect(forecast.intent).toEqual(intent);
          expect(forecast.passiveGuard).toBe(protectedByGu ? GU.find(gu => gu.id === 'white-jade')!.power : 0);
          expect(state.hp - attacked.hp).toBe(forecast.incomingDamage);
          expect(state.hp - defended.hp).toBe(forecast.defendingDamage);
          expect(forecast.qiLoss).toBe(0);
          expect(forecast.danger).toBe(false);
          if (playerGuard === 100) expect(forecast.incomingDamage).toBe(1);
        }
      }
    }
  });

  it('removes a sleeping guard bonus and reports a lethal minimum-damage hit accurately', () => {
    const state = facingIntent('attack', {
      rank: 2, maxHp: 36, maxQi: 16, hp: 1,
      inventory: { 'white-jade': 1 }, equipped: ['white-jade'], usedToday: ['white-jade'], hungry: ['white-jade'],
    });
    state.combat = { ...state.combat!, playerGuard: 100 };
    const forecast = getCombatForecast(state)!;
    expect(forecast.passiveGuard).toBe(0);
    expect(forecast.incomingDamage).toBe(1);
    expect(forecast.danger).toBe(true);
    expect(getCombatForecast({ ...state, hp: 2 })?.danger).toBe(false);
    const next = step(state, { type: 'COMBAT', move: 'attack' });
    expect(next.hp).toBe(0);
    expect(next.ending?.outcome).toBe('defeat');
  });

  it('reports zero damage for non-attacks and bounds drain by current qi', () => {
    for (const type of ['guard', 'drain'] as const) {
      const base = facingIntent(type, { hp: 1 });
      const intent = getCombatForecast(base)!.intent;
      for (const qi of [0, 1, intent.power + 2]) {
        const forecast = getCombatForecast({ ...base, qi })!;
        expect(forecast.incomingDamage).toBe(0);
        expect(forecast.defendingDamage).toBe(0);
        expect(forecast.danger).toBe(false);
        expect(forecast.qiLoss).toBe(type === 'drain' ? Math.min(qi, intent.power) : 0);
      }
    }
    const state = facingIntent('drain', { qi: 8 });
    const forecast = getCombatForecast(state)!;
    expect(step(state, { type: 'COMBAT', move: 'attack' }).qi).toBe(9 - forecast.qiLoss);
    expect(step(state, { type: 'COMBAT', move: 'defend' }).qi).toBe(10 - forecast.qiLoss);
  });

  it('reports retreat chances as percentages and ignores sleeping movement gu', () => {
    const ordinary = facingIntent('guard');
    const movement = {
      ...ordinary, inventory: { 'jumping-grass': 1 }, equipped: ['jumping-grass'], usedToday: ['jumping-grass'],
    };
    expect(getCombatForecast(ordinary)?.retreatChance).toBe(60);
    const improved = getCombatForecast(movement)!.retreatChance;
    expect(improved).toBeGreaterThan(60);
    expect(improved).toBeLessThanOrEqual(100);
    expect(getCombatForecast({ ...movement, hungry: ['jumping-grass'] })?.retreatChance).toBe(60);
  });

  it('is read-only, keeps RNG unchanged, and does not expose mutable content references', () => {
    const state = freezeDeep(facingIntent('attack'));
    const snapshot = structuredClone(state);
    const forecast = getCombatForecast(state)!;
    expect(getCombatForecast(state)).toEqual(forecast);
    expect(state).toEqual(snapshot);
    const enemy = ENEMIES.find(item => item.id === state.combat!.enemyId)!;
    const intent = enemy.moves[state.combat!.turn % enemy.moves.length]!;
    expect(forecast.intent).not.toBe(intent);
    forecast.intent.label = '只修改返回的展示副本';
    expect(intent.label).not.toBe(forecast.intent.label);
    expect(state.rng).toBe(snapshot.rng);
    expect(getCombatForecast(scenario())).toBeNull();
    expect(getCombatForecast(scenario({ combat: battle({ enemyId: 'unknown' }) }))).toBeNull();
  });
});

describe('progression, deadlines, and immutable state', () => {
  it('breaks through by paying cultivation, stones, and an action before unlocking rank-two equipment', () => {
    const state = scenario({
      cultivation: 14, resources: { ...richResources, stones: 12 }, hp: 20, qi: 8,
      inventory: { 'moon-glow': 1 },
    });
    expect(gameReducer(state, { type: 'EQUIP', guId: 'moon-glow' })).toBe(state);
    const advanced = step(state, { type: 'BREAKTHROUGH' });
    expect(advanced).toMatchObject({
      rank: 2, cultivation: 2, actions: 2, hp: 28, maxHp: 36, qi: 12, maxQi: 16,
    });
    expect(advanced.resources.stones).toBe(0);
    expect(step(advanced, { type: 'EQUIP', guId: 'moon-glow' }).equipped).toContain('moon-glow');
    expect(gameReducer(advanced, { type: 'BREAKTHROUGH' })).toBe(advanced);
  });

  it('ends exactly after day ten as survival, never pretending the deadline was a success', () => {
    let state = createGame({ name: '归客', origin: 'trader', seed: 7 });
    for (let day = 1; day < 10; day += 1) {
      expect(state.day).toBe(day);
      state = step(state, { type: 'END_DAY' });
      expect(state.ending).toBeNull();
    }
    const final = step(state, { type: 'END_DAY' });
    expect(final.day).toBe(10);
    expect(final.ending).toMatchObject({ id: 'departure', outcome: 'survived' });
    for (const action of [{ type: 'END_DAY' }, { type: 'REST' }, { type: 'TRAVEL', location: 'market' }] as GameAction[]) {
      expect(gameReducer(final, action)).toBe(final);
    }
  });

  it('settles a lethal noncombat activity as defeat instead of leaving a zero-health journey playable', () => {
    const dangerous = LOCATIONS.find((location) => (location.activity.effects.hp ?? 0) < 0)!;
    expect(dangerous).toBeDefined();
    const state = scenario({ location: dangerous.id, hp: 1 });
    const next = step(state, { type: 'ACTIVITY' });
    expect(next.hp).toBe(0);
    expect(next.ending).toMatchObject({ id: 'departure', outcome: 'defeat' });
    expect(gameReducer(next, { type: 'REST' })).toBe(next);
  });

  it('does not mutate frozen input states, nested combat rewards, or content', () => {
    const state = scenario({ combat: battle({ enemyHp: 50 }), hp: 20 });
    const snapshot = structuredClone(state);
    const next = step(freezeDeep(state), { type: 'COMBAT', move: 'attack' });
    expect(state).toEqual(snapshot);
    expect(next.combat).not.toBe(state.combat);
    expect(next.combat?.victoryEffects).not.toBe(state.combat?.victoryEffects);
    expect(next.combat?.log).not.toBe(state.combat?.log);
    const startingOrigin = structuredClone(ORIGINS[0]);
    const ordinary = createGame({ name: '静观', origin: ORIGINS[0]!.id, seed: 8 });
    step(freezeDeep(ordinary), { type: 'END_DAY' });
    expect(ORIGINS[0]).toEqual(startingOrigin);
  });
});

// These routes deliberately start with createGame and use only accepted player
// actions. No scenario(), forced event, extra inventory, or edited final state.
describe('three reproducible victories using the shipped content', () => {
  it('collects three clues, buys protection, and defeats the guardian as a rank-one disciple', () => {
    let state = createGame({ name: '知进退', origin: 'disciple', seed: 12185 });
    state = resolveEvent(state, 'bamboo', 'bamboo-tracks', 'read-tracks');
    state = resolveEvent(state, 'stream', 'stream-rubbing', 'make-rubbing');
    state = resolveEvent(state, 'market', 'market-ledger', 'buy-ledger');
    state = step(state, { type: 'BUY', itemId: 'buy-jade-skin' });
    state = step(state, { type: 'EQUIP', guId: 'jade-skin' });
    state = step(state, { type: 'END_DAY' });
    expect(state.hungry).toEqual([]);
    state = resolveEvent(state, 'cave', 'cave-guardian', 'challenge');
    expect(state.ending).toBeNull();
    expect(state.flags).not.toContain('inheritance-secured');

    // Hit before the initial guard rises, shield heavy blows, clear guards with
    // ordinary attacks, and defend to recover qi before the finishing moonblade.
    const moves = [
      'moonlight', 'jade-skin', 'attack', 'moonlight', 'moonlight', 'jade-skin',
      'attack', 'defend', 'moonlight', 'defend', 'attack', 'defend', 'moonlight',
    ] as const;
    for (const move of moves) {
      state = step(state, move === 'attack' || move === 'defend'
        ? { type: 'COMBAT', move }
        : { type: 'COMBAT', move: 'gu', guId: move });
    }
    expect(state.ending).toMatchObject({ id: 'inheritance', outcome: 'success' });
    expect(state.flags).toContain('inheritance-secured');
    expect(state.rank).toBe(1);
    expect(state.hp).toBeGreaterThan(0);
    expect(state.day).toBeLessThanOrEqual(10);
    expect(state.combat).toBeNull();
  });

  it('fulfils a patrol commission and earns a clan position through information and work', () => {
    let state = createGame({ name: '守约者', origin: 'disciple', seed: 12185 });
    state = resolveEvent(state, 'academy', 'academy-roster', 'take-patrol');
    state = resolveEvent(state, 'bamboo', 'bamboo-tracks', 'read-tracks');
    state = resolveEvent(state, 'stream', 'stream-rubbing', 'make-rubbing');
    state = step(state, { type: 'END_DAY' });
    state = resolveEvent(state, 'clan', 'clan-patrol-report', 'file-report');
    expect(state.flags).toContain('report-filed');
    expect(state.trust).toBeLessThan(35);
    state = step(state, { type: 'ACTIVITY' });
    expect(state.trust).toBeGreaterThanOrEqual(35);
    state = resolveEvent(state, 'clan', 'clan-standing', 'accept-seat');
    expect(state.ending).toMatchObject({ id: 'clan', outcome: 'success' });
    expect(state.flags).toContain('clan-compact');
    expect(state.clues).toBeGreaterThanOrEqual(2);
    expect(state.day).toBeLessThanOrEqual(10);
  });

  it('buys useful information, works to cover upkeep, and pays for voluntary departure on day six', () => {
    let state = createGame({ name: '行远人', origin: 'trader', seed: 12185 });
    state = resolveEvent(state, 'market', 'market-ledger', 'buy-ledger');
    while (state.day < 6) {
      state = step(state, { type: 'ACTIVITY' });
      state = step(state, { type: 'END_DAY' });
      expect(state.ending).toBeNull();
      expect(state.hungry).toEqual([]);
    }
    const travelFunds = state.resources.stones;
    expect(travelFunds).toBeGreaterThanOrEqual(35);
    state = resolveEvent(state, 'market', 'market-departure', 'book-passage');
    expect(state.ending).toMatchObject({ id: 'departure', outcome: 'success' });
    expect(state.day).toBe(6);
    expect(state.resources.stones).toBe(travelFunds - 35);
    expect(state.hp).toBeGreaterThan(0);
  });
});
