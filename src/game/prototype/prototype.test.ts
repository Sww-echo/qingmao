import { describe, expect, it } from 'vitest';
import {
  PROTOTYPE_CONTENT, choosePrototypeStrategyAction, createPrototype, getAvailablePrototypeEvents,
  getPrototypeActionError, getPrototypeCombatForecast, getPrototypeMaxQi, getPrototypePublicView,
  getPrototypeUpkeep, isPrototypeGuUsable, nextPrototypeRandom, prototypeReducer, simulateBatch,
  simulateStrategy, summarizePrototypeRun, validatePrototypeContent,
} from './index.ts';
import type { PrototypeAction, PrototypeState, StrategyId } from './types.ts';

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeDeep(child);
  }
  return value;
}

function step(state: PrototypeState, action: PrototypeAction): PrototypeState {
  expect(getPrototypeActionError(state, action), JSON.stringify(action)).toBeNull();
  const snapshot = structuredClone(state);
  const next = prototypeReducer(freezeDeep(state), action);
  expect(next).not.toBe(state);
  expect(state).toEqual(snapshot);
  expect(next.actions).toBeGreaterThanOrEqual(0);
  expect(next.hp).toBeGreaterThanOrEqual(0);
  expect(next.qi).toBeGreaterThanOrEqual(0);
  for (const value of Object.values(next.resources)) {
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  }
  return next;
}

function event(state: PrototypeState, eventId: string, choiceId: string): PrototypeState {
  let next = state;
  const content = PROTOTYPE_CONTENT.events.find(event => event.id === eventId)!;
  if (next.location !== content.location) next = step(next, { type: 'TRAVEL', location: content.location });
  next = step(next, { type: 'OPEN_EVENT', eventId });
  return step(next, { type: 'CHOOSE', choiceId });
}

function opening(seed = 42): PrototypeState {
  return event(event(createPrototype(seed), 'briefing', 'acknowledge'), 'moonlight-issue', 'receive');
}

function resolve(state: PrototypeState, strategyId: StrategyId): PrototypeState {
  let next = state;
  for (let i = 0; i < 150 && !next.ending; i += 1) {
    next = step(next, choosePrototypeStrategyAction(strategyId, getPrototypePublicView(next)));
  }
  expect(next.ending).not.toBeNull();
  return next;
}

function crisisDecision(strategyId: StrategyId, seed = 42): PrototypeState {
  const trace = simulateStrategy(strategyId, seed);
  return structuredClone(trace.steps.find(step => step.state.activeEvent === 'crisis-arrival')!.state);
}

describe('P1 boundary, legal actions and immutable queries', () => {
  it('starts independently and never treats a malformed uint32 seed as a valid run', () => {
    const first = createPrototype(42);
    const second = createPrototype(42);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ day: 1, actions: 3, cultivation: 0, hp: 28, qi: 12, resources: { stones: 12 } });
    first.resources.stones = 0;
    expect(second.resources.stones).toBe(12);
    for (const seed of [-1, 0x100000000, 1.1, NaN, Infinity]) expect(() => createPrototype(seed)).toThrow();
  });

  it('keeps identity, logs and RNG untouched for malformed, unknown and unavailable actions', () => {
    const state = freezeDeep(createPrototype(5));
    const snapshot = structuredClone(state);
    const actions: unknown[] = [null, {}, { type: 'EVAL', script: 'arbitrary()' },
      { type: 'TRAVEL', location: 'cave' }, { type: 'TRAIN', grant: 500 },
      { type: 'CHOOSE', choiceId: 'receive' }, { type: 'COMBAT', move: 'attack' },
      { type: 'OPEN_EVENT', eventId: 'moonlight-issue' }, { type: 'BUY', item: 'jade-skin' },
      { type: 'EQUIP', guId: 'moonlight', equipped: 1 }, { type: 'GU_MODE', guId: 'moonlight', mode: 'wake' }];
    for (const candidate of actions) {
      const action = candidate as PrototypeAction;
      expect(getPrototypeActionError(state, action)).toBeTruthy();
      expect(prototypeReducer(state, action)).toBe(state);
    }
    expect(state).toEqual(snapshot);
  });

  it('charges doing an event once; viewing and deferring cannot mint rewards or consume time', () => {
    let state = event(createPrototype(1), 'briefing', 'acknowledge');
    const before = structuredClone(state);
    state = step(state, { type: 'OPEN_EVENT', eventId: 'moonlight-issue' });
    expect(state.actions).toBe(3);
    state = step(state, { type: 'DISMISS_EVENT' });
    expect(state.resources).toEqual(before.resources);
    expect(state.actions).toBe(3);
    expect(state.inventory).toEqual({});
    state = event(state, 'moonlight-issue', 'receive');
    expect(state.actions).toBe(2);
    expect(state.completedEvents.filter(id => id === 'moonlight-issue')).toHaveLength(1);
    expect(prototypeReducer(state, { type: 'OPEN_EVENT', eventId: 'moonlight-issue' })).toBe(state);
    expect(prototypeReducer(state, { type: 'CHOOSE', choiceId: 'receive' })).toBe(state);
  });

  it('leaves resources, time and RNG intact when an opened paid choice is unaffordable', () => {
    let state = opening();
    state = step(state, { type: 'END_DAY' });
    state = step(state, { type: 'OPEN_EVENT', eventId: 'jade-offer' });
    // Intentional boundary fixture: a saved event decision with insufficient funds.
    state = freezeDeep({ ...state, resources: { ...state.resources, stones: 0 } });
    const snapshot = structuredClone(state);
    expect(getPrototypeActionError(state, { type: 'CHOOSE', choiceId: 'buy-jade' })).toContain('不足');
    expect(prototypeReducer(state, { type: 'CHOOSE', choiceId: 'buy-jade' })).toBe(state);
    expect(state).toEqual(snapshot);
    expect(step(state, { type: 'DISMISS_EVENT' }).actions).toBe(state.actions);
  });

  it('honors the inclusive last date and never reopens a missed reward window', () => {
    let state = event(createPrototype(10), 'briefing', 'acknowledge');
    state = step(step(state, { type: 'END_DAY' }), { type: 'END_DAY' });
    expect(state.day).toBe(3);
    expect(getAvailablePrototypeEvents(state).some(event => event.id === 'moonlight-issue')).toBe(true);
    const onTime = event(state, 'moonlight-issue', 'receive');
    expect(onTime.inventory.moonlight).toBeDefined();
    const late = step(state, { type: 'END_DAY' });
    expect(late.day).toBe(4);
    expect(late.missedEvents).toContain('moonlight-issue');
    expect(prototypeReducer(late, { type: 'OPEN_EVENT', eventId: 'moonlight-issue' })).toBe(late);
    // A missed gift is a documented disadvantage, not a labor/REST soft lock.
    expect(step(late, { type: 'WORK' }).resources.stones).toBe(late.resources.stones + 2);
  });

  it('keeps travel and all public queries free, read-only and independent of private random state', () => {
    const state = freezeDeep(opening(1));
    const moved = step(state, { type: 'TRAVEL', location: 'inn' });
    expect(moved.actions).toBe(state.actions);
    expect(moved.rng).toBe(state.rng);
    const view = getPrototypePublicView(state);
    expect(view.state).not.toHaveProperty('rng');
    expect(view.state).not.toHaveProperty('seed');
    expect(view.state).not.toHaveProperty('rngDraws');
    const otherPrivateState = { ...state, seed: 999, rng: 987654321, rngDraws: 40 };
    expect(getPrototypePublicView(otherPrivateState)).toEqual(view);
    expect(choosePrototypeStrategyAction('war-ready', getPrototypePublicView(otherPrivateState)))
      .toEqual(choosePrototypeStrategyAction('war-ready', view));
    const events = getAvailablePrototypeEvents(state);
    events[0]!.title = 'change the returned copy';
    expect(PROTOTYPE_CONTENT.events.some(event => event.title === 'change the returned copy')).toBe(false);
  });
});

describe('food obligations, sealing and recovery', () => {
  it('charges all unsealed holdings even when unequipped, and sealing cannot erase the current day', () => {
    const state = opening();
    const unequipped = step(state, { type: 'EQUIP', guId: 'moonlight', equipped: false });
    expect(getPrototypeUpkeep(unequipped)).toBe(1);
    expect(step(unequipped, { type: 'END_DAY' }).resources.stones).toBe(11);
    const sealed = step(state, { type: 'GU_MODE', guId: 'moonlight', mode: 'seal' });
    expect(isPrototypeGuUsable(sealed, 'moonlight')).toBe(false);
    expect(getPrototypeUpkeep(sealed)).toBe(1);
    const dayTwo = step(sealed, { type: 'END_DAY' });
    expect(dayTwo.resources.stones).toBe(10); // 1 seal fee + the already incurred daily food.
    expect(getPrototypeUpkeep(dayTwo)).toBe(0);
    const dayThree = step(dayTwo, { type: 'END_DAY' });
    expect(dayThree.resources.stones).toBe(10);
    const awake = step(dayThree, { type: 'GU_MODE', guId: 'moonlight', mode: 'wake' });
    expect(awake.resources.stones).toBe(8);
    expect(getPrototypeUpkeep(awake)).toBe(1);
    expect(step(awake, { type: 'END_DAY' }).resources.stones).toBe(7);
  });

  it('can legally recover from zero stones and dormancy through safe work', () => {
    let state = step(opening(), { type: 'TRAVEL', location: 'inn' });
    for (let i = 0; i < 3; i += 1) state = step(state, { type: 'BUY', item: 'wine' });
    state = step(state, { type: 'BUY', item: 'herbs' });
    state = step(state, { type: 'END_DAY' });
    expect(state.resources.stones).toBe(0);
    state = step(state, { type: 'END_DAY' });
    expect(state.inventory.moonlight?.mode).toBe('dormant');
    expect(isPrototypeGuUsable(state, 'moonlight')).toBe(false);
    state = step(state, { type: 'WORK' });
    state = step(state, { type: 'GU_MODE', guId: 'moonlight', mode: 'wake' });
    expect(state.resources.stones).toBe(1);
    expect(isPrototypeGuUsable(state, 'moonlight')).toBe(true);
    state = step(state, { type: 'END_DAY' });
    expect(state.resources.stones).toBe(0);
    expect(state.inventory.moonlight?.mode).toBe('active');
    expect(state.ending).toBeNull();
  });

  it('settles the final food bill before crisis capabilities and forbids late preparation', () => {
    const prepared = crisisDecision('war-ready');
    // Deliberate final-day starvation fixture, immediately before END_DAY.
    const before = freezeDeep({ ...prepared, activeEvent: null, flags: prepared.flags.filter(flag => flag !== 'crisis-arrived'), crisis: 'approaching' as const,
      completedEvents: prepared.completedEvents.filter(id => id !== 'crisis-arrival'), resources: { ...prepared.resources, stones: 0 } });
    const decision = step(before, { type: 'END_DAY' });
    expect(decision.inventory.moonlight?.mode).toBe('dormant');
    expect(decision.inventory['jade-skin']?.mode).toBe('dormant');
    for (const action of [{ type: 'TRAIN' }, { type: 'GU_MODE', guId: 'moonlight', mode: 'wake' }, { type: 'DISMISS_EVENT' }] as PrototypeAction[]) {
      expect(prototypeReducer(decision, action)).toBe(decision);
    }
    expect(step(decision, { type: 'CHOOSE', choiceId: 'stand' }).combat).not.toBeNull();
  });
});

describe('causality, combat and persistent exposure', () => {
  it('uses growth, usable scouting gu and actual relationships in same-seed counterfactual outcomes', () => {
    const war = crisisDecision('war-ready');
    const network = crisisDecision('network');
    expect(resolve(war, 'war-ready').ending?.outcome).toBe('survived');
    // Counterfactual fixtures intentionally change one causal input; they are not normal-run evidence.
    const noCultivation = { ...war, cultivation: 0, qi: Math.min(12, war.qi) };
    expect(resolve(noCultivation, 'war-ready').ending?.outcome).toBe('death');
    expect(resolve(network, 'network').ending?.id).toBe('shelter-secured');
    const noRelationship = { ...network, relations: { ...network.relations, 'guard-captain': 0 } };
    expect(getPrototypeActionError(noRelationship, { type: 'CHOOSE', choiceId: 'take-shelter' })).toContain('关系');
    expect(resolve(noRelationship, 'network').ending?.outcome).toBe('death');
    const sleepingScout = structuredClone(network);
    sleepingScout.inventory['ear-grass']!.mode = 'dormant';
    expect(getPrototypeActionError(sleepingScout, { type: 'CHOOSE', choiceId: 'take-shelter' })).toContain('清醒');
    expect(resolve(sleepingScout, 'network').ending?.outcome).toBe('death');
  });

  it('gives liquor a real growth advantage which disappears when sealed or unequipped', () => {
    const trace = simulateStrategy('war-ready', 42);
    const state = structuredClone(trace.steps.find(step => step.state.inventory['liquor-worm']?.mode === 'active' && step.state.actions > 0 && step.state.location === 'academy')!.state);
    const grown = step(state, { type: 'TRAIN' });
    expect(grown.cultivation - state.cultivation).toBe(5);
    const without = step(state, { type: 'EQUIP', guId: 'liquor-worm', equipped: false });
    expect(step(without, { type: 'TRAIN' }).cultivation - without.cultivation).toBe(3);
    expect(getPrototypeMaxQi({ cultivation: 12 })).toBeGreaterThan(getPrototypeMaxQi({ cultivation: 0 }));
  });

  it('lets concern decay while preserving concrete evidence until it is paid to remove', () => {
    let state = opening();
    state = step(step(state, { type: 'END_DAY' }), { type: 'END_DAY' });
    state = event(state, 'bamboo-signs', 'trespass');
    expect(state.suspicion).toBe(3);
    expect(state.exposures.map(exposure => exposure.id)).toEqual(['unlicensed-survey']);
    for (let i = 0; i < 3; i += 1) state = step(state, { type: 'END_DAY' });
    expect(state.suspicion).toBe(0);
    expect(state.exposures).toHaveLength(1);
    state = step(state, { type: 'TRAVEL', location: 'inn' });
    const before = state;
    state = step(state, { type: 'CLEAR_EXPOSURE', exposureId: 'unlicensed-survey' });
    expect(state.resources.stones).toBe(before.resources.stones - 4);
    expect(state.actions).toBe(before.actions - 1);
    expect(state.exposures).toHaveLength(0);
    expect(prototypeReducer(state, { type: 'CLEAR_EXPOSURE', exposureId: 'unlicensed-survey' })).toBe(state);
  });

  it('publishes the same enemy intent that resolves, and sleeping armor changes actual damage', () => {
    const decision = crisisDecision('war-ready');
    const state = step(decision, { type: 'CHOOSE', choiceId: 'stand' });
    const forecast = getPrototypeCombatForecast(state)!;
    const hit = step(state, { type: 'COMBAT', move: 'attack' });
    expect(state.hp - hit.hp).toBe(forecast.incomingDamage);
    expect(hit.actions).toBe(state.actions);
    expect(hit.rng).toBe(state.rng);
    const noArmor = structuredClone(state);
    noArmor.inventory['jade-skin']!.mode = 'dormant';
    expect(getPrototypeCombatForecast(noArmor)!.incomingDamage).toBe(forecast.incomingDamage + 2);
    expect(step(noArmor, { type: 'COMBAT', move: 'attack' }).hp).toBe(hit.hp - 2);
    expect(prototypeReducer(noArmor, { type: 'COMBAT', move: 'jade-skin' })).toBe(noArmor);
  });

  it('pays a patrol reward only on victory and never on retreat or random survey combat', () => {
    const trace = simulateStrategy('war-ready', 42);
    const state = structuredClone(trace.steps.find(step => step.state.combat?.purpose === 'patrol')!.state);
    const escaped = step(state, { type: 'COMBAT', move: 'retreat' });
    expect(escaped.combat).toBeNull();
    expect(escaped.hp).toBe(state.hp - 6);
    expect(escaped.resources.stones).toBe(state.resources.stones - 2);
    expect(escaped.relations).toEqual(state.relations);
    expect(escaped.flags).not.toContain('patrol-cleared');
    expect(escaped.actionCounts['combat:retreat']).toBe(1);
    expect(prototypeReducer(escaped, { type: 'COMBAT', move: 'attack' })).toBe(escaped);
    // A one-hit remaining enemy is a combat-boundary fixture, not an injected success route.
    const ready = { ...state, combat: { ...state.combat!, enemyHp: 1 } };
    const won = step(ready, { type: 'COMBAT', move: 'attack' });
    expect(won.hp).toBe(ready.hp);
    expect(won.resources.stones).toBe(ready.resources.stones + 10);
    expect(won.relations['guard-captain']).toBe(ready.relations['guard-captain'] + 3);
    const incidental = { ...ready, combat: { ...ready.combat, purpose: 'survey' as const } };
    const incidentalWin = step(incidental, { type: 'COMBAT', move: 'attack' });
    expect(incidentalWin.resources.stones).toBe(incidental.resources.stones);
    expect(incidentalWin.relations).toEqual(incidental.relations);
  });

  it('makes active listening safer and more informative than an unaided random survey', () => {
    const trace = simulateStrategy('network', 42);
    const withGu = structuredClone(trace.steps.find(step => step.action.type === 'SCOUT')!.state);
    withGu.actions = 1; withGu.qi = 6; withGu.clues = 0;
    const safe = step(withGu, { type: 'SCOUT' });
    expect(safe.clues).toBe(2);
    expect(safe.rng).toBe(withGu.rng);
    expect(safe.hp).toBe(withGu.hp);
    const asleep = structuredClone(withGu);
    asleep.inventory['ear-grass']!.mode = 'dormant';
    const dangerous = step(asleep, { type: 'SCOUT' });
    expect(dangerous.clues).toBe(1);
    expect(dangerous.rngDraws).toBeGreaterThan(asleep.rngDraws);
    expect(dangerous.exposures).toHaveLength(1);
    expect(dangerous.hp < asleep.hp || dangerous.combat !== null).toBe(true);
  });

  it('resolves healing and qi supplies before exactly one published enemy strike, with per-fight limits', () => {
    const start = step(crisisDecision('war-ready'), { type: 'CHOOSE', choiceId: 'stand' });
    const injured = { ...start, hp: 27 };
    const healed = step(injured, { type: 'COMBAT', move: 'herbs' });
    expect(healed.hp).toBe(28 - getPrototypeCombatForecast(injured)!.incomingDamage);
    expect(healed.resources.herbs).toBe(injured.resources.herbs - 1);
    expect(healed.combat!.herbsUsed).toBe(1);
    expect(healed.combat!.turn).toBe(1);
    expect(healed.rngDraws).toBe(injured.rngDraws);
    const tired = { ...start, qi: getPrototypeMaxQi(start) - 1 };
    const drank = step(tired, { type: 'COMBAT', move: 'wine' });
    expect(drank.qi).toBe(getPrototypeMaxQi(start));
    expect(drank.hp).toBe(tired.hp - getPrototypeCombatForecast(tired)!.incomingDamage);
    expect(drank.resources.wine).toBe(tired.resources.wine - 1);
    expect(drank.combat!.wineUsed).toBe(1);
    for (const [move, state] of [
      ['herbs', start], ['wine', start],
      ['herbs', { ...injured, combat: { ...injured.combat!, herbsUsed: 3 } }],
      ['wine', { ...tired, combat: { ...tired.combat!, wineUsed: 3 } }],
    ] as const) expect(prototypeReducer(state, { type: 'COMBAT', move })).toBe(state);
  });

  it('reports actual final-combat supply use, including an untouched reserve', () => {
    const trace = simulateStrategy('war-ready', 42);
    expect(trace.finalState.resources.herbs).toBe(6);
    expect(trace.finalState.resources.wine).toBe(3);
    expect(trace.finalState.ending!.reasons.join(' ')).toContain('本场使用药草0份、酒0份');
    const battle = step(crisisDecision('war-ready'), { type: 'CHOOSE', choiceId: 'stand' });
    const almostWon = { ...battle, combat: { ...battle.combat!, enemyHp: 1, herbsUsed: 2, wineUsed: 1 } };
    expect(step(almostWon, { type: 'COMBAT', move: 'attack' }).ending!.reasons.join(' '))
      .toContain('本场使用药草2份、酒1份');
  });

  it('attributes a lethal shelter interception to the failed readiness check', () => {
    const decision = crisisDecision('network');
    // A low-health, exposed route is a deliberate boundary fixture. The public
    // requirements still pass, but readiness 5 + 3 - 1 is below every demand.
    const exposed = { ...decision, hp: 10, clues: 5, relations: { ...decision.relations, 'guard-captain': 3 },
      exposures: [{ id: 'unlicensed-survey', source: 'boundary fixture', day: 14 }] };
    const result = step(exposed, { type: 'CHOOSE', choiceId: 'take-shelter' });
    expect(result.ending?.id).toBe('overrun');
    expect(result.ending!.reasons[0]).toContain('遭截击损失10生命');
    expect(result.ending!.reasons[0]).not.toContain('探索或撤退');
    expect(result.log.filter(entry => entry.kind === 'risk').at(-1)!.message).not.toContain('转入战斗');
    expect(result.combat).toBeNull();
  });
});

describe('portable RNG, replay and honest strategy evidence', () => {
  it.each([
    [0, [1144304738, 1416247, 958946056]],
    [1, [2693262067, 11749833, 2265367787]],
    [12185, [2499861155, 1810223824, 1374101062]],
    [4294967295, [3850105811, 813802916, 3073704848]],
  ] as const)('matches the audited uint32 sequence from seed %i', (seed, numerators) => {
    let rng: number = seed;
    for (const expected of numerators) {
      const next = nextPrototypeRandom(rng);
      expect(next.numerator).toBe(expected);
      expect(next.value).toBe(expected / 4294967296);
      rng = next.rng;
    }
  });

  it.each(['war-ready', 'network', 'labor'] as const)('replays every legal %s action and balances its complete resource ledger', strategyId => {
    const trace = simulateStrategy(strategyId, 42);
    let replay = structuredClone(trace.initialState);
    for (const [index, action] of trace.actions.entries()) {
      expect(getPrototypeActionError(replay, action)).toBeNull();
      replay = prototypeReducer(replay, action);
      expect(replay).toEqual(trace.steps[index]!.state);
    }
    expect(replay).toEqual(trace.finalState);
    expect(summarizePrototypeRun(replay)).toEqual(trace.summary);
    expect(JSON.parse(JSON.stringify(trace))).toEqual(trace);
    for (const resource of ['stones', 'herbs', 'wine'] as const) {
      const delta = replay.ledger.filter(entry => entry.resource === resource).reduce((sum, entry) => sum + entry.amount, 0);
      expect(replay.resources[resource]).toBe(trace.initialState.resources[resource] + delta);
    }
    expect(replay.day).toBe(14);
    expect(replay.crisis).toBe('resolved');
    expect(prototypeReducer(replay, { type: 'END_DAY' })).toBe(replay);
    expect(prototypeReducer(replay, { type: 'WORK' })).toBe(replay);
  });

  it('keeps both investment routes viable across development seeds, while the funded labor control really fails', () => {
    const report = simulateBatch(['war-ready', 'network', 'labor'], Array.from({ length: 20 }, (_, index) => index + 1));
    expect(report.results[0]!.survivalRate).toBeGreaterThanOrEqual(0.7);
    expect(report.results[1]!.survivalRate).toBeGreaterThanOrEqual(0.7);
    expect(report.results[2]!.survivalRate).toBeLessThanOrEqual(0.4);
    expect(report.results[2]!.failures).toHaveLength(20);
    expect(report.results[2]!.meanStones).toBeGreaterThan(report.results[0]!.meanStones);
    const control = simulateStrategy('labor', 42);
    const beforeCrisis = crisisDecision('labor');
    expect(beforeCrisis.resources.herbs).toBe(6);
    expect(beforeCrisis.resources.wine).toBe(3);
    expect(beforeCrisis.completedEvents).toEqual(['briefing', 'moonlight-issue', 'alarm']);
    expect(control.finalState.actionCounts['combat:herbs']).toBe(3);
    expect(control.summary.reasons.some(reason => reason.includes('修为'))).toBe(true);
  });
});

describe('declarative content validation', () => {
  it('validates the shipped JSON content and its minimum playable scope', () => {
    expect(validatePrototypeContent()).toEqual([]);
    expect(validatePrototypeContent(JSON.parse(JSON.stringify(PROTOTYPE_CONTENT)))).toEqual([]);
    expect(PROTOTYPE_CONTENT.events.length).toBeGreaterThanOrEqual(12);
    expect(PROTOTYPE_CONTENT.gu.map(gu => gu.role).sort()).toEqual(['attack', 'growth', 'guard', 'scout']);
  });

  it('rejects duplicate IDs, missing references, unsupported effects and invalid costs', () => {
    const bad = structuredClone(PROTOTYPE_CONTENT);
    bad.events[1]!.id = bad.events[0]!.id;
    bad.events[2]!.location = 'elsewhere' as never;
    bad.events[2]!.choices[0]!.costs.stones = -2;
    bad.events[2]!.choices[0]!.effects.push({ kind: 'script', body: 'process.exit()' } as never);
    bad.gu[0]!.upkeep = Infinity;
    const errors = validatePrototypeContent(bad).join('\n');
    expect(errors).toContain('duplicate ID'); expect(errors).toContain('unknown reference');
    expect(errors).toContain('unknown effect'); expect(errors).toContain('finite integer');
    expect(errors).toContain('costs.stones');
  });

  it('rejects mandatory dependency cycles, impossible gates and time-inverted producers', () => {
    const cycle = structuredClone(PROTOTYPE_CONTENT);
    cycle.events[0]!.requirements.push({ kind: 'gu', id: 'moonlight', usable: true });
    expect(validatePrototypeContent(cycle).some(error => error.includes('cyclic'))).toBe(true);
    const impossible = structuredClone(PROTOTYPE_CONTENT);
    impossible.events[0]!.requirements.push({ kind: 'relation', id: 'guard-captain', min: 100 });
    expect(validatePrototypeContent(impossible).some(error => error.includes('unreachable'))).toBe(true);
    const inverted = structuredClone(PROTOTYPE_CONTENT);
    inverted.events[0]!.fromDay = 10; inverted.events[0]!.throughDay = 11;
    expect(validatePrototypeContent(inverted).some(error => error.includes('opens after'))).toBe(true);
  });

  it('requires the engine-triggered final decision and a free response after all optional windows are missed', () => {
    const missing = structuredClone(PROTOTYPE_CONTENT);
    missing.events = missing.events.filter(event => event.id !== 'crisis-arrival');
    expect(validatePrototypeContent(missing).join(' ')).toContain('missing engine-required crisis-arrival');
    const expensive = structuredClone(PROTOTYPE_CONTENT);
    expensive.events.find(event => event.id === 'crisis-arrival')!.choices[0]!.costs.stones = 1;
    expect(validatePrototypeContent(expensive).join(' ')).toContain('unconditional, free fight');
    const gated = structuredClone(PROTOTYPE_CONTENT);
    gated.events.find(event => event.id === 'crisis-arrival')!.requirements.push({ kind: 'flag', id: 'briefed', present: true });
    expect(validatePrototypeContent(gated).join(' ')).toContain('only the engine-generated arrival flag');
    const exposure = structuredClone(PROTOTYPE_CONTENT);
    exposure.exposures = [];
    expect(validatePrototypeContent(exposure).join(' ')).toContain('exposures.SCOUT');
  });

  it('does not mistake an optional gu branch for a requirement shared by every event choice', () => {
    const content = structuredClone(PROTOTYPE_CONTENT);
    content.events[0]!.choices.push({ ...structuredClone(content.events[0]!.choices[0]!), id: 'optional-later',
      requirements: [{ kind: 'gu', id: 'moonlight', usable: true }] });
    expect(validatePrototypeContent(content)).toEqual([]);
    for (const choice of content.events[0]!.choices) choice.requirements = [{ kind: 'gu', id: 'moonlight', usable: true }];
    expect(validatePrototypeContent(content).join(' ')).toContain('cyclic mandatory');
  });
});
