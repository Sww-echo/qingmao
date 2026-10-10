import { describe, expect, it } from 'vitest';
import { CHAPTER_EVENTS } from './chapter-content';
import { EVENTS } from './content';
import { createGame, gameReducer, getActionError, getAvailableEvents, getChoiceError, getUpkeep } from './engine';
import type { GameAction, GameState, LocationId, OriginId } from './types';

function act(game: GameState, action: GameAction): GameState {
  expect(getActionError(game, action), `${game.day}日 ${JSON.stringify(action)}`).toBeNull();
  const next = gameReducer(game, action);
  expect(next, JSON.stringify(action)).not.toBe(game);
  return next;
}

function travel(game: GameState, location: LocationId): GameState {
  return game.location === location ? game : act(game, { type: 'TRAVEL', location });
}

function openEvent(game: GameState, eventId: string): GameState {
  const event = EVENTS.find((entry) => entry.id === eventId)!;
  game = travel(game, event.location);
  expect(getAvailableEvents(game).some((entry) => entry.id === eventId), eventId).toBe(true);
  game = act(game, { type: 'EXPLORE', eventId });
  expect(game.activeEvent).toBe(eventId);
  return game;
}

function takeEvent(game: GameState, eventId: string, choiceId: string): GameState {
  return act(openEvent(game, eventId), { type: 'CHOOSE', choiceId });
}

function advanceTo(game: GameState, day: number): GameState {
  while (game.day < day) game = act(game, { type: 'END_DAY' });
  expect(game.ending).toBeNull();
  return game;
}

function beginChapter(origin: OriginId = 'disciple'): GameState {
  const game = createGame({ name: '第一章试行', origin, seed: 21, chapter: true });
  expect(game.activeEvent).toBe('chapter-arrival');
  return act(game, { type: 'CHOOSE', choiceId: 'seek-own-path' });
}

function economy(game: GameState) {
  return {
    day: game.day, actions: game.actions, hp: game.hp, qi: game.qi,
    rank: game.rank, cultivation: game.cultivation, clues: game.clues,
    trust: game.trust, suspicion: game.suspicion, resources: game.resources,
    inventory: game.inventory, equipped: game.equipped, relations: game.relations,
  };
}

function keptPouch(): GameState {
  let game = beginChapter();
  game = takeEvent(game, 'stream-rubbing', 'make-rubbing');
  return takeEvent(game, 'stream-hidden-pouch', 'keep-pouch');
}

// The stolen Gu really becomes a crafting ingredient; no inventory or story flags are injected.
function refinedPouchGu(): GameState {
  let game = travel(keptPouch(), 'market');
  game = act(game, { type: 'ACTIVITY' });
  game = act(game, { type: 'BUY', itemId: 'buy-white-boar' });
  game = act(game, { type: 'BUY', itemId: 'buy-herbs' });
  game = advanceTo(game, 2);
  game = act(game, { type: 'CRAFT', recipeId: 'refine-white-jade', safe: true });
  expect(game.inventory['jade-skin'] ?? 0).toBe(0);
  expect(game.inventory['white-jade']).toBe(1);
  return game;
}

function falseLedger(): GameState {
  return takeEvent(advanceTo(beginChapter(), 2), 'clan-grain', 'sign-old-ledger');
}

function fundedLedgerInquiry(): GameState {
  let game = travel(falseLedger(), 'bamboo');
  game = act(game, { type: 'ACTIVITY' });
  return openEvent(advanceTo(game, 3), 'chapter-ledger-inquiry');
}

function emptyLedgerInquiry(): GameState {
  let game = travel(falseLedger(), 'market');
  game = act(game, { type: 'BUY', itemId: 'buy-jade-skin' });
  game = act(game, { type: 'BUY', itemId: 'buy-white-boar' });
  game = act(game, { type: 'BUY', itemId: 'buy-ore' });
  game = takeEvent(game, 'market-ledger', 'barter-ledger');
  expect(game.resources.stones).toBe(0);
  expect(game.resources.herbs).toBe(0);
  return openEvent(advanceTo(game, 3), 'chapter-ledger-inquiry');
}

function expectOnlyConsequence(game: GameState, prefix: 'pouch' | 'ledger', selected: string) {
  const outcomes = ['repaid', 'confessed', 'concealed'].map((suffix) => `${prefix}-${suffix}`);
  expect(game.flags.filter((flag) => outcomes.includes(flag))).toEqual([`${prefix}-${selected}`]);
  expect(game.flags).toContain(`${prefix}-account-settled`);
  expect(game.flags).toContain(prefix === 'pouch' ? 'kept-pouch' : 'false-ledger');
}

describe('first chapter scenes and consequences', () => {
  it('keeps all five new scenes out of legacy games, including legacy misdeeds', () => {
    let game = createGame({ name: '旧行程', origin: 'disciple', seed: 21 });
    expect(game.activeEvent).toBeNull();
    game = takeEvent(game, 'stream-rubbing', 'make-rubbing');
    game = takeEvent(game, 'stream-hidden-pouch', 'keep-pouch');
    game = advanceTo(game, 2);
    game = takeEvent(game, 'clan-grain', 'sign-old-ledger');
    game = advanceTo(game, 3);
    expect(game.flags).toEqual(expect.arrayContaining(['kept-pouch', 'false-ledger']));
    expect(game.flags).not.toContain('chapter-one');
    const chapterIds = CHAPTER_EVENTS.map((event) => event.id);
    for (const location of ['academy', 'clan', 'market', 'bamboo', 'stream', 'cave'] as const) {
      game = travel(game, location);
      expect(getAvailableEvents(game).some((event) => chapterIds.includes(event.id))).toBe(false);
    }
  });

  it('opens with an affordable motivation and waits for real evidence before the council', () => {
    const initial = createGame({ name: '初来山中', origin: 'scout', seed: 4, chapter: true });
    const arrival = CHAPTER_EVENTS.find((event) => event.id === 'chapter-arrival')!;
    const motives: Record<string, string> = {
      'seek-own-path': 'chapter-motive-inheritance',
      'seek-clan-place': 'chapter-motive-clan',
      'seek-long-road': 'chapter-motive-departure',
    };
    for (const choice of arrival.choices) {
      const chosen = act(initial, { type: 'CHOOSE', choiceId: choice.id });
      expect(economy(chosen)).toEqual(economy(initial));
      expect(chosen.flags).toEqual(['chapter-one', 'chapter-arrival-read', motives[choice.id]]);
      expect(chosen.activeEvent).toBeNull();
    }
    let game = act(initial, { type: 'CHOOSE', choiceId: 'seek-own-path' });
    game = travel(game, 'clan');
    expect(getAvailableEvents(game).some((event) => event.id === 'chapter-council')).toBe(false);
    game = travel(game, 'academy');
    expect(getAvailableEvents(game).some((event) => event.id === 'chapter-resolution')).toBe(false);
    game = takeEvent(game, 'bamboo-tracks', 'read-tracks');
    game = travel(game, 'clan');
    expect(getAvailableEvents(game)[0]?.id).toBe('chapter-council');
  });

  it('can finish free chapter scenes with no daily actions and complete a different chosen route normally', () => {
    let game = beginChapter();
    game = takeEvent(game, 'academy-roster', 'take-patrol');
    game = takeEvent(game, 'bamboo-tracks', 'read-tracks');
    game = takeEvent(game, 'stream-rubbing', 'make-rubbing');
    expect(game.actions).toBe(0);
    const beforeCouncil = economy(game);
    game = takeEvent(game, 'chapter-council', 'keep-independent');
    expect(economy(game)).toEqual(beforeCouncil);
    expect(game.flags).toContain('chapter-independent');
    game = takeEvent(game, 'chapter-resolution', 'prepare-inheritance');
    expect(economy(game)).toEqual(beforeCouncil);
    expect(game.flags).toEqual(expect.arrayContaining(['chapter-ready', 'chapter-plan-inheritance']));
    expect(game.ending).toBeNull();
    expect(game.combat).toBeNull();

    game = advanceTo(game, 2);
    game = takeEvent(game, 'clan-patrol-report', 'file-report');
    game = act(game, { type: 'ACTIVITY' });
    expect(game.trust).toBe(37);
    game = takeEvent(game, 'clan-standing', 'accept-seat');
    expect(game.ending).toMatchObject({ id: 'clan', outcome: 'success' });
    expect(game.day).toBe(2);
    expect(game.rank).toBe(1);
    expect(game.seenEvents).toEqual(expect.arrayContaining(['chapter-arrival', 'chapter-council', 'chapter-resolution']));
    expect(game.flags).toContain('chapter-plan-inheritance'); // The earlier plan does not lock the final ending.
  });

  it('records only one council stance and one plan without granting rewards or signing an ending', () => {
    let game = takeEvent(beginChapter(), 'bamboo-tracks', 'read-tracks');
    const council = openEvent(game, 'chapter-council');
    const stances = ['chapter-independent', 'chapter-public', 'chapter-caravan'];
    const councilChoices = ['keep-independent', 'consider-public', 'consider-caravan'];
    for (let index = 0; index < councilChoices.length; index += 1) {
      const chosen = act(council, { type: 'CHOOSE', choiceId: councilChoices[index] });
      expect(chosen.flags.filter((flag) => stances.includes(flag))).toEqual([stances[index]]);
      expect(economy(chosen)).toEqual(economy(council));
      expect(chosen.ending).toBeNull();
    }
    game = act(council, { type: 'CHOOSE', choiceId: 'consider-public' });
    const resolution = openEvent(game, 'chapter-resolution');
    for (const route of ['inheritance', 'clan', 'departure']) {
      const chosen = act(resolution, { type: 'CHOOSE', choiceId: `prepare-${route}` });
      expect(chosen.flags.filter((flag) => flag.startsWith('chapter-plan-'))).toEqual([`chapter-plan-${route}`]);
      expect(chosen.flags).toContain('chapter-ready');
      expect(economy(chosen)).toEqual(economy(resolution));
      expect(chosen.ending).toBeNull();
    }
  });

  it('never accuses players who returned the pouch and supplied the real ledger goods', () => {
    let game = beginChapter();
    game = takeEvent(game, 'stream-rubbing', 'make-rubbing');
    game = takeEvent(game, 'stream-hidden-pouch', 'return-pouch');
    game = travel(game, 'bamboo');
    game = act(game, { type: 'ACTIVITY' });
    game = takeEvent(advanceTo(game, 2), 'clan-grain', 'replace-herbs');
    game = advanceTo(game, 3);
    expect(game.flags).toEqual(expect.arrayContaining(['returned-pouch', 'honest-ledger']));
    expect(getAvailableEvents(game).some((event) => event.id === 'chapter-pouch-inquiry')).toBe(false);
    expect(getAvailableEvents(game).some((event) => event.id === 'chapter-ledger-inquiry')).toBe(false);
  });

  it('returns the actual pouch contents, unequips the surrendered Gu, and cannot reimburse twice', () => {
    let game = keptPouch();
    game = act(game, { type: 'EQUIP', guId: 'jade-skin' });
    game = travel(game, 'clan');
    expect(getAvailableEvents(game).some((event) => event.id === 'chapter-pouch-inquiry')).toBe(false);
    game = advanceTo(game, 2);
    const beforeOpening = game;
    const inquiry = openEvent(game, 'chapter-pouch-inquiry');
    expect(inquiry.actions).toBe(beforeOpening.actions - 1);
    game = act(inquiry, { type: 'CHOOSE', choiceId: 'return-pouch-goods' });
    expect(game.resources.stones).toBe(inquiry.resources.stones - 7);
    expect(game.inventory['jade-skin'] ?? 0).toBe(0);
    expect(game.equipped).not.toContain('jade-skin');
    expect(getUpkeep(game)).toBe(getUpkeep(inquiry));
    expect(game.trust).toBe(inquiry.trust + 4);
    expect(game.suspicion).toBe(inquiry.suspicion - 8);
    expectOnlyConsequence(game, 'pouch', 'repaid');
    expect(game.flags).not.toContain('returned-pouch');
    expect(getAvailableEvents(game).some((event) => event.id === 'chapter-pouch-inquiry')).toBe(false);
    expect(gameReducer(game, { type: 'EXPLORE', eventId: 'chapter-pouch-inquiry' })).toBe(game);
    expect(gameReducer(game, { type: 'CHOOSE', choiceId: 'pay-pouch-compensation' })).toBe(game);
    // The settlement marker also protects a save whose seen-event list is incomplete.
    expect(getAvailableEvents({ ...game, seenEvents: [] }).some((event) => event.id === 'chapter-pouch-inquiry')).toBe(false);
  });

  it('allows a real cash repayment after the pouch Gu has already been refined', () => {
    let game = refinedPouchGu();
    game = act(game, { type: 'ACTIVITY' });
    game = act(game, { type: 'ACTIVITY' });
    const inquiry = openEvent(advanceTo(game, 3), 'chapter-pouch-inquiry');
    const returnChoice = EVENTS.find((event) => event.id === inquiry.activeEvent)!.choices.find((choice) => choice.id === 'return-pouch-goods')!;
    expect(getChoiceError(inquiry, returnChoice)).not.toBeNull();
    game = act(inquiry, { type: 'CHOOSE', choiceId: 'pay-pouch-compensation' });
    expect(game.resources.stones).toBe(inquiry.resources.stones - 21);
    expect(game.inventory).toEqual(inquiry.inventory);
    expect(game.inventory['white-jade']).toBe(1);
    expectOnlyConsequence(game, 'pouch', 'repaid');
  });

  it('leaves distinct free accountability and denial choices when neither money nor the original Gu remains', () => {
    let game = refinedPouchGu();
    game = act(game, { type: 'BUY', itemId: 'buy-ore' });
    expect(game.resources.stones).toBe(0);
    const inquiry = openEvent(game, 'chapter-pouch-inquiry');
    const event = EVENTS.find((entry) => entry.id === inquiry.activeEvent)!;
    for (const id of ['return-pouch-goods', 'pay-pouch-compensation']) {
      const choice = event.choices.find((entry) => entry.id === id)!;
      expect(getChoiceError(inquiry, choice)).not.toBeNull();
      expect(gameReducer(inquiry, { type: 'CHOOSE', choiceId: id })).toBe(inquiry);
    }
    const confessed = act(inquiry, { type: 'CHOOSE', choiceId: 'confess-pouch' });
    const concealed = act(inquiry, { type: 'CHOOSE', choiceId: 'conceal-pouch' });
    expectOnlyConsequence(confessed, 'pouch', 'confessed');
    expectOnlyConsequence(concealed, 'pouch', 'concealed');
    expect(confessed.resources).toEqual(inquiry.resources);
    expect(concealed.resources).toEqual(inquiry.resources);
    expect(confessed.inventory).toEqual(inquiry.inventory);
    expect(concealed.suspicion - confessed.suspicion).toBe(9);
    expect(concealed.relations['steward-zheng']).toBeLessThan(confessed.relations['steward-zheng']);
    for (const resolved of [confessed, concealed]) {
      expect(resolved.activeEvent).toBeNull();
      expect(resolved.trust).toBeLessThan(inquiry.trust);
      expect(getAvailableEvents(advanceTo(resolved, 3)).some((entry) => entry.id === 'chapter-pouch-inquiry')).toBe(false);
    }
  });

  it('waits until the next ledger audit and actually returns both payment and missing herbs', () => {
    const dayTwo = falseLedger();
    expect(getAvailableEvents(dayTwo).some((event) => event.id === 'chapter-ledger-inquiry')).toBe(false);
    const inquiry = fundedLedgerInquiry();
    expect(inquiry.day).toBe(3);
    expect(inquiry.actions).toBe(2);
    const settled = act(inquiry, { type: 'CHOOSE', choiceId: 'replace-ledger-goods' });
    expect(settled.resources.stones).toBe(inquiry.resources.stones - 15);
    expect(settled.resources.herbs).toBe(inquiry.resources.herbs - 3);
    expect(settled.trust).toBe(inquiry.trust + 4);
    expect(settled.suspicion).toBe(inquiry.suspicion - 8);
    expectOnlyConsequence(settled, 'ledger', 'repaid');
    expect(settled.flags).not.toContain('honest-ledger');
    expect(getAvailableEvents(settled).some((event) => event.id === 'chapter-ledger-inquiry')).toBe(false);
    expect(gameReducer(settled, { type: 'CHOOSE', choiceId: 'pay-ledger-compensation' })).toBe(settled);
    expect(getAvailableEvents({ ...settled, seenEvents: [] }).some((event) => event.id === 'chapter-ledger-inquiry')).toBe(false);
  });

  it('can settle the ledger for its full cash price after the available herbs have already been spent', () => {
    let game = takeEvent(falseLedger(), 'market-ledger', 'barter-ledger');
    expect(game.resources.herbs).toBe(0);
    game = advanceTo(game, 3);
    const inquiry = openEvent(game, 'chapter-ledger-inquiry');
    const settled = act(inquiry, { type: 'CHOOSE', choiceId: 'pay-ledger-compensation' });
    expect(settled.resources.stones).toBe(inquiry.resources.stones - 21);
    expect(settled.resources.herbs).toBe(inquiry.resources.herbs);
    expectOnlyConsequence(settled, 'ledger', 'repaid');
    expect(settled.activeEvent).toBeNull();
    expect(gameReducer(settled, { type: 'EXPLORE', eventId: 'chapter-ledger-inquiry' })).toBe(settled);
  });

  it('lets penniless ledger signers accept a loss or deny the evidence without becoming stuck', () => {
    const inquiry = emptyLedgerInquiry();
    const event = EVENTS.find((entry) => entry.id === inquiry.activeEvent)!;
    for (const id of ['replace-ledger-goods', 'pay-ledger-compensation']) {
      const choice = event.choices.find((entry) => entry.id === id)!;
      expect(getChoiceError(inquiry, choice)).not.toBeNull();
      expect(gameReducer(inquiry, { type: 'CHOOSE', choiceId: id })).toBe(inquiry);
    }
    const confessed = act(inquiry, { type: 'CHOOSE', choiceId: 'confess-ledger' });
    const concealed = act(inquiry, { type: 'CHOOSE', choiceId: 'conceal-ledger' });
    expectOnlyConsequence(confessed, 'ledger', 'confessed');
    expectOnlyConsequence(concealed, 'ledger', 'concealed');
    expect(confessed.resources).toEqual(inquiry.resources);
    expect(concealed.resources).toEqual(inquiry.resources);
    expect(concealed.suspicion - confessed.suspicion).toBe(10);
    expect(concealed.relations['mentor-qiu']).toBeLessThan(confessed.relations['mentor-qiu']);
    for (const resolved of [confessed, concealed]) {
      expect(resolved.activeEvent).toBeNull();
      expect(resolved.trust).toBeLessThan(inquiry.trust);
      expect(resolved.ending).toBeNull();
      expect(getAvailableEvents(advanceTo(resolved, 4)).some((entry) => entry.id === 'chapter-ledger-inquiry')).toBe(false);
    }
  });
});
