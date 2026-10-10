import { describe, expect, it } from 'vitest';
import { EVENTS } from './content';
import { createGame, gameReducer, getActionError, getAvailableEvents, getChoiceError, getUpkeep } from './engine';
import { getJourneyAdvice } from './guidance';
import type { JourneyFocus } from './guidance';
import { createSave, EMPTY_META, parseSave, serializeSave, updateMeta } from './storage';
import type { LegacyEndingId, GameAction, GameState, LocationId, OriginId } from './types';

function act(game: GameState, action: GameAction): GameState {
  expect(getActionError(game, action), `${game.day}日 ${JSON.stringify(action)}`).toBeNull();
  const next = gameReducer(game, action);
  expect(next).not.toBe(game);
  return next;
}

function reject(game: GameState, action: GameAction) {
  const before = structuredClone(game);
  expect(getActionError(game, action), JSON.stringify(action)).not.toBeNull();
  expect(gameReducer(game, action)).toBe(game);
  expect(game).toEqual(before);
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

function beginChapter(origin: OriginId = 'disciple', seed = 12185): GameState {
  return act(createGame({ name: '章节规则试行', origin, seed, chapter: true }), { type: 'CHOOSE', choiceId: 'seek-own-path' });
}

function finishMainScenes(game: GameState, ending: LegacyEndingId): GameState {
  const choices = { inheritance: 'keep-independent', clan: 'consider-public', departure: 'consider-caravan' };
  game = takeEvent(game, 'chapter-council', choices[ending]);
  return takeEvent(game, 'chapter-resolution', `prepare-${ending}`);
}

function milestones(game: GameState): string[] {
  return game.flags.filter((flag) => flag.startsWith('milestone-'));
}

function readAdvice(game: GameState, focus: JourneyFocus) {
  const before = structuredClone(game);
  const advice = getJourneyAdvice(game, focus);
  expect(advice).not.toBeNull();
  expect(game).toEqual(before);
  if (!advice) throw new Error('Expected guidance');
  if (advice.destination.kind === 'action') expect(getActionError(game, advice.destination.action)).toBeNull();
  return advice;
}

function followAdviceToEvent(game: GameState, focus: JourneyFocus, eventId: string): GameState {
  for (let count = 0; count < 3 && !game.activeEvent; count += 1) {
    const advice = readAdvice(game, focus);
    if (advice.destination.kind !== 'action') throw new Error('Expected a legal story action');
    game = act(game, advice.destination.action);
  }
  expect(game.activeEvent).toBe(eventId);
  return game;
}

function readyToRefine(seed = 4): GameState {
  let game = travel(beginChapter('disciple', seed), 'market');
  game = act(game, { type: 'ACTIVITY' });
  game = act(game, { type: 'BUY', itemId: 'buy-little-light' });
  game = act(game, { type: 'BUY', itemId: 'buy-ore' });
  return act(game, { type: 'BUY', itemId: 'buy-wine' });
}

const finalChoices = [
  ['cave-guardian', 'challenge', 'inheritance'],
  ['clan-standing', 'accept-seat', 'clan'],
  ['market-departure', 'book-passage', 'departure'],
] as const;

describe('chapter engine gates and saves', () => {
  it('opens the first scene automatically and resumes it from the existing version-one save format', () => {
    const initial = createGame({ name: '开场读档', origin: 'trader', seed: 33, chapter: true });
    expect(initial).toMatchObject({ version: 2, location: 'academy', actions: 3, activeEvent: 'chapter-arrival' });
    expect(initial.flags).toEqual(['chapter-one']);
    reject(initial, { type: 'TRAVEL', location: 'market' });
    const saved = createSave(initial, updateMeta(EMPTY_META, initial));
    const restored = parseSave(serializeSave(saved));
    expect(restored).toEqual(saved);
    expect(restored.version).toBe(2);
    expect(restored.game).not.toBe(initial);
    expect(restored.game.resources).not.toBe(initial.resources);
    const resumed = act(restored.game, { type: 'CHOOSE', choiceId: 'seek-long-road' });
    expect(resumed.flags).toContain('chapter-arrival-read');
    expect(resumed.seenEvents).toContain('chapter-arrival');
    expect(resumed.actions).toBe(3);
    expect(initial.activeEvent).toBe('chapter-arrival');
  });

  // These are rule boundaries with deliberately sufficient old-route stats,
  // not proof of a playable route. The complete runs below only use actions.
  it.each(finalChoices)('rejects %s before chapter readiness even when all old ending requirements are met', (eventId, choiceId) => {
    const ordinary = beginChapter();
    const eligible: GameState = { ...ordinary, day: 6, clues: 3, trust: 35, resources: { ...ordinary.resources, stones: 50 } };
    const pending = openEvent(eligible, eventId);
    const choice = EVENTS.find((event) => event.id === eventId)!.choices.find((entry) => entry.id === choiceId)!;
    expect(getChoiceError(pending, choice)).toContain('临行前的交代');
    reject(pending, { type: 'CHOOSE', choiceId });
    expect(pending.combat).toBeNull();
    expect(pending.ending).toBeNull();
    expect(pending.resources.stones).toBe(50);
    const postponed = act(pending, { type: 'CHOOSE', choiceId: 'leave' });
    expect(postponed.activeEvent).toBeNull();
    expect(postponed.ending).toBeNull();
  });

  it('keeps legacy startup and all three legacy final choices available without chapter flags', () => {
    const options = { name: '旧规则', origin: 'disciple' as const, seed: 12 };
    const legacy = createGame(options);
    expect(createGame({ ...options, chapter: false })).toEqual(legacy);
    expect(legacy.flags).toEqual([]);
    expect(legacy.activeEvent).toBeNull();
    for (const [eventId, choiceId, ending] of finalChoices) {
      const eligible: GameState = { ...legacy, day: 6, clues: 3, trust: 35, resources: { ...legacy.resources, stones: 50 } };
      const pending = openEvent(eligible, eventId);
      const chosen = act(pending, { type: 'CHOOSE', choiceId });
      if (ending === 'inheritance') expect(chosen.combat?.victoryEnding).toBe('inheritance');
      else expect(chosen.ending).toMatchObject({ id: ending, outcome: 'success' });
      expect(chosen.flags).not.toContain('chapter-ready');
      expect(milestones(chosen)).toEqual([]);
    }
    const trained = act(legacy, { type: 'TRAIN' });
    expect(milestones(act(trained, { type: 'END_DAY' }))).toEqual([]);
  });
});

describe('earned chapter preparation milestones', () => {
  it('records valid training and new equipment but does not reward rejected actions', () => {
    const initial = beginChapter();
    expect(milestones(initial)).toEqual([]);
    // A low-qi rule boundary checks refusal before the player has ever trained.
    reject({ ...initial, qi: 2 }, { type: 'TRAIN' });
    reject(initial, { type: 'EQUIP', guId: 'moonlight' });
    reject(initial, { type: 'EQUIP', guId: 'jade-skin' });
    expect(milestones(initial)).toEqual([]);
    const trained = act(initial, { type: 'TRAIN' });
    expect(trained.cultivation).toBe(initial.cultivation + 3);
    expect(milestones(trained)).toEqual(['milestone-trained']);
    let equipped = act(travel(initial, 'market'), { type: 'BUY', itemId: 'buy-jade-skin' });
    equipped = act(equipped, { type: 'EQUIP', guId: 'jade-skin' });
    expect(equipped.equipped).toContain('jade-skin');
    expect(milestones(equipped)).toEqual(['milestone-equipped']);
    reject(equipped, { type: 'EQUIP', guId: 'jade-skin' });
  });

  it('earns upkeep only after actual payment, including recovery from failed feeding', () => {
    const initial = beginChapter();
    reject(initial, { type: 'FEED' });
    const paid = act(initial, { type: 'END_DAY' });
    expect(paid.resources.stones).toBe(initial.resources.stones - getUpkeep(initial));
    expect(milestones(paid)).toEqual(['milestone-upkeep']);

    let poor = travel(initial, 'market');
    poor = act(poor, { type: 'BUY', itemId: 'buy-jade-skin' });
    poor = act(poor, { type: 'BUY', itemId: 'buy-ore' });
    poor = act(poor, { type: 'BUY', itemId: 'buy-little-light' });
    expect(poor.resources.stones).toBe(0);
    poor = act(poor, { type: 'UNEQUIP', guId: 'moonlight' });
    poor = act(poor, { type: 'UNEQUIP', guId: 'little-light' });
    poor = act(poor, { type: 'END_DAY' });
    expect(poor.hungry).toEqual(expect.arrayContaining(['moonlight', 'little-light']));
    expect(poor.flags).not.toContain('milestone-upkeep');
    reject(poor, { type: 'FEED' });
    // A day carrying no Gu must not pretend the still-hungry Gu were fed.
    expect(getUpkeep(poor)).toBe(0);
    poor = act(poor, { type: 'END_DAY' });
    expect(poor.flags).not.toContain('milestone-upkeep');
    expect(poor.hungry).toHaveLength(2);
    poor = act(poor, { type: 'ACTIVITY' });
    const beforeFeeding = poor.resources.stones;
    poor = act(poor, { type: 'FEED' });
    expect(poor.resources.stones).toBe(beforeFeeding - 2);
    expect(poor.hungry).toEqual([]);
    expect(milestones(poor)).toEqual(['milestone-upkeep']);
  });

  it('records a real practice victory only after the opponent is defeated', () => {
    let game = takeEvent(beginChapter(), 'bamboo-boar', 'hunt-boar');
    expect(game.flags).not.toContain('milestone-battle');
    game = act(game, { type: 'COMBAT', move: 'gu', guId: 'moonlight' });
    expect(game.combat).not.toBeNull();
    expect(game.flags).not.toContain('milestone-battle');
    game = act(game, { type: 'COMBAT', move: 'gu', guId: 'moonlight' });
    game = act(game, { type: 'COMBAT', move: 'gu', guId: 'moonlight' });
    expect(game.combat).toBeNull();
    expect(game.ending).toBeNull();
    expect(milestones(game)).toEqual(['milestone-battle']);
    expect(game.resources.stones).toBeGreaterThan(24);
  });

  it('does not award practice for retreating or losing a real encounter', () => {
    let escaped = takeEvent(beginChapter('scout', 1), 'bamboo-boar', 'hunt-boar');
    // Seed 1 succeeds at the scout's ordinary retreat chance with jumping grass.
    escaped = act(escaped, { type: 'COMBAT', move: 'retreat' });
    expect(escaped.combat).toBeNull();
    expect(escaped.ending).toBeNull();
    expect(escaped.flags).not.toContain('milestone-battle');
    let defeated = takeEvent(beginChapter(), 'bamboo-boar', 'hunt-boar');
    for (let turns = 0; turns < 36 && defeated.combat; turns += 1) {
      defeated = act(defeated, { type: 'COMBAT', move: 'defend' });
    }
    expect(defeated.ending).toMatchObject({ outcome: 'defeat' });
    expect(defeated.flags).not.toContain('milestone-battle');
  });

  it('records successful refining but not missing ingredients or a seeded real failure', () => {
    const initial = beginChapter();
    reject(initial, { type: 'CRAFT', recipeId: 'refine-moon-glow', safe: true });
    expect(initial.flags).not.toContain('milestone-crafted');
    const ingredients = readyToRefine(4);
    const failed = act(ingredients, { type: 'CRAFT', recipeId: 'refine-moon-glow', safe: false });
    expect(failed.journal.at(-1)?.text).toContain('失败');
    expect(failed.inventory).toEqual(ingredients.inventory);
    expect(failed.flags).not.toContain('milestone-crafted');
    const refined = act(ingredients, { type: 'CRAFT', recipeId: 'refine-moon-glow', safe: true });
    expect(refined.inventory['moon-glow']).toBe(1);
    expect(refined.inventory.moonlight ?? 0).toBe(0);
    expect(refined.inventory['little-light'] ?? 0).toBe(0);
    expect(milestones(refined)).toEqual(['milestone-crafted']);
    const restored = parseSave(serializeSave(createSave(refined, updateMeta(EMPTY_META, refined))));
    expect(restored.game.flags).toContain('milestone-crafted');
    expect(restored.game.usedToday).toEqual(refined.usedToday);
  });
});

describe('chapter advice respects schedule and route choices', () => {
  it('guides free conversations at zero actions and returns to a day-end preview afterward', () => {
    let game = takeEvent(beginChapter(), 'bamboo-tracks', 'read-tracks');
    game = act(game, { type: 'TRAIN' });
    game = act(game, { type: 'TRAIN' });
    expect(game.actions).toBe(0);
    const resources = { ...game.resources };
    game = followAdviceToEvent(game, 'departure', 'chapter-council');
    game = act(game, { type: 'CHOOSE', choiceId: 'consider-caravan' });
    game = followAdviceToEvent(game, 'departure', 'chapter-resolution');
    game = act(game, { type: 'CHOOSE', choiceId: 'prepare-departure' });
    expect(game).toMatchObject({ day: 1, actions: 0 });
    expect(game.resources).toEqual(resources);
    reject(game, { type: 'EXPLORE', eventId: 'academy-roster' });
    const advice = readAdvice(game, 'departure');
    expect(advice.destination).toMatchObject({ kind: 'action', action: { type: 'END_DAY' }, label: '查看日暮结算' });
    expect(game.day).toBe(1);
    expect(game.resources).toEqual(resources);
  });

  it('keeps practice optional and never sends a peaceful focus into combat or refining', () => {
    const prepared = finishMainScenes(takeEvent(beginChapter(), 'bamboo-tracks', 'read-tracks'), 'inheritance');
    // Read-only recommendation boundary: old ending stats and gear are supplied
    // here to exercise competing suggestions, not used as a victory fixture.
    const boundary: GameState = {
      ...prepared, day: 4, hp: 28, qi: 12, clues: 3, trust: 20,
      resources: { stones: 100, herbs: 20, ore: 20, wine: 20 },
      inventory: { ...prepared.inventory, 'little-light': 2, 'jade-skin': 1 },
      equipped: [...prepared.equipped, 'jade-skin'], usedToday: [...prepared.usedToday, 'jade-skin'],
    };
    const practice = readAdvice(boundary, 'inheritance');
    expect(practice.title).toContain('可选准备');
    expect(practice.destination).toMatchObject({ kind: 'action', action: { type: 'EXPLORE', eventId: 'academy-assessment' } });
    if (practice.destination.kind !== 'action') throw new Error('Expected practice offer');
    const offered = act(boundary, practice.destination.action);
    expect(offered.combat).toBeNull();
    expect(act(offered, { type: 'CHOOSE', choiceId: 'leave' }).ending).toBeNull();
    for (const focus of ['clan', 'departure'] as const) {
      let game = boundary;
      let advice = readAdvice(game, focus);
      if (advice.destination.kind === 'action' && advice.destination.action.type === 'TRAVEL') {
        game = act(game, advice.destination.action);
        advice = readAdvice(game, focus);
      }
      expect(advice.destination.kind).toBe('action');
      if (advice.destination.kind !== 'action') throw new Error('Peaceful preparation must remain directly actionable');
      const action = advice.destination.action;
      expect(['COMBAT', 'CRAFT', 'BREAKTHROUGH']).not.toContain(action.type);
      if (action.type === 'EXPLORE') {
        const event = EVENTS.find((entry) => entry.id === action.eventId)!;
        expect(event.choices.every((choice) => !choice.encounterId)).toBe(true);
      }
    }
    const late = readAdvice({ ...boundary, day: 9 }, 'inheritance');
    expect(late.destination).toMatchObject({ kind: 'action', action: { type: 'TRAVEL', location: 'cave' } });
  });
});

// Complete chapter runs: no supplied flags, inventory, combat state or ending.
describe('complete chapter routes using only legal player actions', () => {
  it('finishes inheritance with the existing rank-one combat route after the chapter scenes', () => {
    let game = takeEvent(beginChapter(), 'bamboo-tracks', 'read-tracks');
    game = finishMainScenes(game, 'inheritance');
    game = takeEvent(game, 'stream-rubbing', 'make-rubbing');
    game = takeEvent(game, 'market-ledger', 'buy-ledger');
    game = act(game, { type: 'BUY', itemId: 'buy-jade-skin' });
    game = act(game, { type: 'EQUIP', guId: 'jade-skin' });
    game = act(game, { type: 'END_DAY' });
    expect(game.hungry).toEqual([]);
    game = takeEvent(game, 'cave-guardian', 'challenge');
    expect(game.ending).toBeNull();
    const moves = [
      'moonlight', 'jade-skin', 'attack', 'moonlight', 'moonlight', 'jade-skin',
      'attack', 'defend', 'moonlight', 'defend', 'attack', 'defend', 'moonlight',
    ] as const;
    for (const move of moves) {
      game = act(game, move === 'attack' || move === 'defend'
        ? { type: 'COMBAT', move }
        : { type: 'COMBAT', move: 'gu', guId: move });
    }
    expect(game.ending).toMatchObject({ id: 'inheritance', outcome: 'success' });
    expect(game.flags).toEqual(expect.arrayContaining(['chapter-ready', 'chapter-plan-inheritance', 'inheritance-secured']));
    expect(game.rank).toBe(1);
    expect(game.hp).toBeGreaterThan(0);
    expect(game.day).toBe(2);
    expect(game.flags).not.toContain('milestone-battle'); // Final victory is not a prior practice win.
    expect(game.flags).not.toContain('milestone-crafted');
  });

  it('completes the chapter and pays for departure on day six without fighting or refining', () => {
    let game = takeEvent(beginChapter('trader'), 'market-ledger', 'buy-ledger');
    game = finishMainScenes(game, 'departure');
    game = travel(game, 'market');
    while (game.day < 6) {
      game = act(game, { type: 'ACTIVITY' });
      game = act(game, { type: 'END_DAY' });
      expect(game.hungry).toEqual([]);
      expect(game.ending).toBeNull();
    }
    const fare = game.resources.stones;
    const advice = readAdvice(game, 'departure');
    expect(advice.destination).toMatchObject({ kind: 'action', action: { type: 'EXPLORE', eventId: 'market-departure' } });
    game = takeEvent(game, 'market-departure', 'book-passage');
    expect(game.ending).toMatchObject({ id: 'departure', outcome: 'success' });
    expect(game.day).toBe(6);
    expect(game.resources.stones).toBe(fare - 35);
    expect(game.flags).toContain('chapter-ready');
    expect(milestones(game)).toEqual(['milestone-upkeep']);
    const restored = parseSave(serializeSave(createSave(game, updateMeta(EMPTY_META, game))));
    expect(restored.game.ending).toEqual(game.ending);
    expect(restored.game.flags).toEqual(game.flags);
  });
});
