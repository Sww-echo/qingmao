import { describe, expect, it } from 'vitest';
import { EVENTS } from './content';
import { createGame, gameReducer, getActionError, getAvailableEvents, getChoiceError, getUpkeep } from './engine';
import type { GameAction, GameState, LocationId } from './types';

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

function winWithMoonlight(game: GameState): GameState {
  let turns = 0;
  while (game.combat && turns < 24) {
    const moon: GameAction = { type: 'COMBAT', move: 'gu', guId: 'moonlight' };
    game = act(game, getActionError(game, moon) ? { type: 'COMBAT', move: 'attack' } : moon);
    turns += 1;
  }
  expect(game.combat).toBeNull();
  expect(game.ending?.outcome).not.toBe('defeat');
  return game;
}

function rainOffer(): GameState {
  let game = createGame({ name: '雨路试行', origin: 'scout', seed: 1 });
  game = takeEvent(game, 'bamboo-tracks', 'read-tracks');
  game = advanceTo(game, 2);
  game = travel(game, 'market');
  // New optional contracts must not replace the original market lead by default.
  expect(getAvailableEvents(game)[0]?.id).toBe('market-ledger');
  return openEvent(game, 'market-rain-bond');
}

function completedRainSurvey(): GameState {
  let game = act(rainOffer(), { type: 'CHOOSE', choiceId: 'post-bond' });
  game = takeEvent(game, 'stream-rain-survey', 'jump-the-ridge');
  game = travel(game, 'market');
  game = act(game, { type: 'ACTIVITY' });
  return game;
}

function recoveredMedicine(): {
  beforeSmoke: GameState;
  afterSmoke: GameState;
  dayFour: GameState;
} {
  let game = createGame({ name: '药匣试行', origin: 'disciple', seed: 6 });
  game = takeEvent(game, 'bamboo-tracks', 'read-tracks');
  game = travel(game, 'market');
  game = act(game, { type: 'BUY', itemId: 'buy-wine' });
  game = advanceTo(game, 2);
  game = takeEvent(game, 'bamboo-remedy-pledge', 'prepare-remedy-kit');
  game = act(game, { type: 'ACTIVITY' }); // Harvest the herbs needed for smoke protection and refining.
  game = act(game, { type: 'TRAIN' });
  game = advanceTo(game, 3);
  const beforeSmoke = openEvent(game, 'cave-remedy-cache');
  const afterSmoke = act(beforeSmoke, { type: 'CHOOSE', choiceId: 'cross-medicine-smoke' });
  game = act(afterSmoke, { type: 'TRAIN' });
  game = act(game, { type: 'TRAIN' });
  return { beforeSmoke, afterSmoke, dayFour: advanceTo(game, 4) };
}

describe('optional contracts and their earned outcomes', () => {
  it('charges the rain-road stake, unlocks payment on the stated day, and funds a real departure', () => {
    const offered = rainOffer();
    const bonded = act(offered, { type: 'CHOOSE', choiceId: 'post-bond' });
    expect(bonded.resources.stones).toBe(offered.resources.stones - 8);
    expect(bonded.resources.ore).toBe(offered.resources.ore - 1);
    expect(bonded.flags).toContain('rain-route-bonded');
    expect(bonded.flags).not.toContain('rain-route-verified');

    let game = openEvent(bonded, 'stream-rain-survey');
    const beforeCrossing = game;
    game = act(game, { type: 'CHOOSE', choiceId: 'jump-the-ridge' });
    expect(game.hp).toBe(beforeCrossing.hp - 2);
    expect(game.qi).toBe(beforeCrossing.qi - 3);
    expect(game.clues).toBe(beforeCrossing.clues + 1);
    expect(game.flags).toContain('rain-route-verified');
    game = travel(game, 'market');
    expect(getAvailableEvents(game).some((event) => event.id === 'market-rain-settlement')).toBe(false);
    game = act(game, { type: 'ACTIVITY' });
    game = advanceTo(game, 3);
    expect(getAvailableEvents(game).some((event) => event.id === 'market-rain-settlement')).toBe(false);
    game = advanceTo(game, 4);
    const beforePayment = game.resources.stones;
    game = takeEvent(game, 'market-rain-settlement', 'collect-route-fee');
    expect(game.resources.stones).toBe(beforePayment + 20);
    expect(game.flags).toContain('rain-route-settled');
    expect(getAvailableEvents(game).some((event) => event.id === 'market-rain-settlement')).toBe(false);
    game = advanceTo(game, 6);
    expect(getAvailableEvents(game)[0]?.id).toBe('market-departure');
    game = takeEvent(game, 'market-departure', 'book-passage');
    expect(game.ending).toMatchObject({ id: 'departure', outcome: 'success' });
    expect(game.day).toBe(6);
  });

  it('makes clan endorsement an exclusive alternative to twelve stones of rain-road payment', () => {
    const offered = openEvent(advanceTo(completedRainSurvey(), 4), 'market-rain-settlement');
    const cash = act(offered, { type: 'CHOOSE', choiceId: 'collect-route-fee' });
    const endorsement = act(offered, { type: 'CHOOSE', choiceId: 'take-clan-endorsement' });
    expect(cash.resources.stones - endorsement.resources.stones).toBe(12);
    expect(endorsement.trust - cash.trust).toBe(12);
    expect(endorsement.relations['steward-zheng']).toBe((offered.relations['steward-zheng'] ?? 0) + 8);
    expect(endorsement.flags).toContain('rain-route-endorsed');
    expect(cash.flags).not.toContain('rain-route-endorsed');
    expect(getAvailableEvents(endorsement).some((event) => event.id === 'market-rain-settlement')).toBe(false);
  });

  it('only grants the rain-road evidence after victory, and forfeits payment after retreat', () => {
    const bonded = act(rainOffer(), { type: 'CHOOSE', choiceId: 'post-bond' });
    const battle = takeEvent(bonded, 'stream-rain-survey', 'clear-the-shallows');
    expect(battle.combat?.enemyId).toBe('stream-wolf');
    expect(battle.flags).not.toContain('rain-route-verified');
    expect(battle.resources).toEqual(bonded.resources);

    // Seed 1's first retreat roll succeeds with the scout's equipped jumping grass.
    const retreated = act(battle, { type: 'COMBAT', move: 'retreat' });
    expect(retreated.combat).toBeNull();
    expect(retreated.flags).toContain('rain-route-failed');
    expect(retreated.flags).not.toContain('rain-route-verified');
    expect(retreated.resources).toEqual(bonded.resources);
    const laterMarket = travel(advanceTo(retreated, 4), 'market');
    expect(getAvailableEvents(laterMarket).some((event) => event.id === 'market-rain-settlement')).toBe(false);

    const won = winWithMoonlight(battle);
    expect(won.flags).toContain('rain-route-verified');
    expect(won.flags).not.toContain('rain-route-failed');
    expect(won.clues).toBe(bonded.clues + 1);
    expect(getAvailableEvents(travel(advanceTo(won, 4), 'market')).some((event) => event.id === 'market-rain-settlement')).toBe(true);
  });

  it('really surrenders a pledged Gu and does not pay out when the medicine recovery is abandoned', () => {
    let game = createGame({ name: '以蛊作价', origin: 'disciple', seed: 2 });
    game = takeEvent(game, 'bamboo-tracks', 'read-tracks');
    game = advanceTo(game, 2);
    const offered = openEvent(game, 'bamboo-remedy-pledge');
    const upkeepBefore = getUpkeep(offered);
    game = act(offered, { type: 'CHOOSE', choiceId: 'pledge-little-light' });
    expect(game.inventory['little-light'] ?? 0).toBe(0);
    expect(game.equipped).not.toContain('little-light');
    expect(game.resources).toEqual(offered.resources);
    expect(getUpkeep(game)).toBe(upkeepBefore); // Carrying it earlier still incurs this day's upkeep.
    expect(game.flags).toContain('medicine-pledged');
    game = advanceTo(game, 3);
    game = takeEvent(game, 'cave-remedy-cache', 'leave');
    expect(game.flags).not.toContain('medicine-box-recovered');
    expect(game.inventory['little-light'] ?? 0).toBe(0);
    expect(getAvailableEvents(game).some((event) => event.id === 'cave-remedy-cache')).toBe(false);
    game = travel(advanceTo(game, 4), 'clan');
    expect(getAvailableEvents(game).some((event) => event.id === 'clan-remedy-settlement')).toBe(false);
  });

  it('turns the costly medicine recovery into refining inputs and a successful inheritance run', () => {
    const { beforeSmoke, afterSmoke, dayFour } = recoveredMedicine();
    expect(afterSmoke.hp).toBe(beforeSmoke.hp - 7);
    expect(afterSmoke.qi).toBe(beforeSmoke.qi - 2);
    expect(afterSmoke.resources.herbs).toBe(beforeSmoke.resources.herbs - 1);
    expect(afterSmoke.suspicion).toBe(beforeSmoke.suspicion + 3);
    expect(afterSmoke.clues).toBe(beforeSmoke.clues + 1);
    expect(afterSmoke.flags).toContain('medicine-box-recovered');
    expect(afterSmoke.inventory['white-boar'] ?? 0).toBe(0);
    let game = takeEvent(dayFour, 'clan-remedy-settlement', 'claim-refining-gu');
    expect(game.inventory['white-boar']).toBe(1);
    expect(game.inventory['jade-skin']).toBe(1);
    expect(game.flags).toContain('medicine-settled');
    game = act(game, { type: 'CRAFT', recipeId: 'refine-white-jade', safe: true });
    expect(game.inventory['white-jade']).toBe(1);
    game = travel(game, 'market');
    game = act(game, { type: 'ACTIVITY' });
    game = advanceTo(game, 5);
    game = act(game, { type: 'BREAKTHROUGH' });
    game = act(game, { type: 'EQUIP', guId: 'white-jade' });
    game = act(game, { type: 'ACTIVITY' });
    game = act(game, { type: 'ACTIVITY' });
    game = advanceTo(game, 6);
    expect(game.hungry).toEqual([]);
    game = takeEvent(game, 'market-ledger', 'buy-ledger');
    game = travel(game, 'cave');
    expect(getAvailableEvents(game)[0]?.id).toBe('cave-guardian');
    game = takeEvent(game, 'cave-guardian', 'challenge');
    game = winWithMoonlight(game);
    expect(game.ending).toMatchObject({ id: 'inheritance', outcome: 'success' });
    expect(game.day).toBe(6);
  });

  it('can exchange that same medicine for clan standing instead of private Gu', () => {
    let game = takeEvent(recoveredMedicine().dayFour, 'clan-remedy-settlement', 'supply-public-medicine');
    expect(game.trust).toBe(30);
    expect(game.inventory['white-boar'] ?? 0).toBe(0);
    expect(game.inventory['jade-skin'] ?? 0).toBe(0);
    expect(game.flags).toContain('medicine-public-stock');
    game = takeEvent(game, 'academy-roster', 'take-patrol');
    game = travel(game, 'clan');
    expect(getAvailableEvents(game)[0]?.id).toBe('clan-standing');
    game = takeEvent(game, 'clan-standing', 'accept-seat');
    expect(game.ending).toMatchObject({ id: 'clan', outcome: 'success' });
    expect(game.day).toBe(4);
  });

  it('lets a legitimately acquired scouting Gu avoid the medicine smoke at a material cost', () => {
    let game = createGame({ name: '听风取药', origin: 'scout', seed: 3 });
    for (let i = 0; i < 3; i += 1) game = act(game, { type: 'TRAIN' });
    game = advanceTo(game, 2);
    game = act(game, { type: 'TRAIN' });
    game = act(game, { type: 'BREAKTHROUGH' });
    game = travel(game, 'market');
    game = act(game, { type: 'ACTIVITY' });
    game = advanceTo(game, 3);
    game = act(game, { type: 'ACTIVITY' });
    game = act(game, { type: 'ACTIVITY' });
    game = act(game, { type: 'BUY', itemId: 'buy-earth-ear' });
    game = act(game, { type: 'BUY', itemId: 'buy-wine' });
    game = act(game, { type: 'EQUIP', guId: 'earth-ear' });
    game = takeEvent(game, 'bamboo-tracks', 'listen-tracks');
    game = advanceTo(game, 4);
    game = takeEvent(game, 'bamboo-remedy-pledge', 'prepare-remedy-kit');
    const beforeVent = openEvent(game, 'cave-remedy-cache');
    game = act(beforeVent, { type: 'CHOOSE', choiceId: 'vent-medicine-room' });
    expect(game.hp).toBe(beforeVent.hp);
    expect(game.suspicion).toBe(beforeVent.suspicion);
    expect(game.resources.ore).toBe(beforeVent.resources.ore - 1);
    expect(game.qi).toBe(beforeVent.qi - 2);
    expect(game.flags).toContain('medicine-box-recovered');
    const settlement = openEvent(game, 'clan-remedy-settlement');
    const resale = EVENTS.find((event) => event.id === 'clan-remedy-settlement')!.choices.find((choice) => choice.id === 'sell-through-caravan')!;
    expect(getChoiceError(settlement, resale)).not.toBeNull();
    expect(gameReducer(settlement, { type: 'CHOOSE', choiceId: resale.id })).toBe(settlement);
  });

  it('uses earlier merchant and healer pacts for cheaper preparation and a priced resale choice', () => {
    let game = createGame({ name: '旧交新账', origin: 'trader', seed: 4 });
    game = takeEvent(game, 'market-cargo', 'replace-cargo');
    game = travel(game, 'bamboo');
    game = act(game, { type: 'ACTIVITY' });
    game = takeEvent(game, 'bamboo-tracks', 'read-tracks');
    game = advanceTo(game, 2);
    game = takeEvent(game, 'bamboo-herbalist', 'give-herbs');
    const beforeBond = game;
    game = takeEvent(game, 'market-rain-bond', 'use-merchant-credit');
    expect(game.resources.stones).toBe(beforeBond.resources.stones - 4);
    const beforePledge = game;
    game = takeEvent(game, 'bamboo-remedy-pledge', 'share-healer-supplies');
    expect(game.resources.herbs).toBe(beforePledge.resources.herbs - 1);
    expect(game.resources.wine).toBe(beforePledge.resources.wine);
    game = advanceTo(game, 3);
    game = takeEvent(game, 'cave-remedy-cache', 'cross-medicine-smoke');
    game = advanceTo(game, 4);
    const beforeSale = game;
    game = takeEvent(game, 'clan-remedy-settlement', 'sell-through-caravan');
    expect(game.resources.stones).toBe(beforeSale.resources.stones + 26);
    expect(game.trust).toBe(beforeSale.trust - 6);
    expect(game.suspicion).toBe(beforeSale.suspicion + 4);
    expect(game.relations['steward-zheng']).toBe((beforeSale.relations['steward-zheng'] ?? 0) - 6);
    expect(game.flags).toContain('medicine-diverted');
    expect(game.flags).not.toContain('medicine-public-stock');
    expect(game.flags).toContain('merchant-pact');
    expect(game.flags).toContain('healer-pact');
  });
});
