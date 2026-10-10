import { describe, expect, it } from 'vitest';
import { createGame, gameReducer, getActionError } from './engine';
import { getJourneyAdvice, getMapEventCounts } from './guidance';
import type { GameState } from './types';

const start = (): GameState => createGame({ name: '问路人', origin: 'disciple', seed: 12185 });

describe('journey guidance', () => {
  it('offers a real opening event without spending the player’s action', () => {
    const game = start();
    const before = structuredClone(game);
    const advice = getJourneyAdvice(game, 'open')!;
    expect(advice.destination).toMatchObject({ kind: 'action', action: { type: 'EXPLORE', eventId: 'academy-roster' } });
    if (advice.destination.kind !== 'action') throw new Error('Expected an action');
    expect(getActionError(game, advice.destination.action)).toBeNull();
    expect(game).toEqual(before);
  });

  it('asks for a day-end preview when no scheduled actions remain', () => {
    const game = { ...start(), actions: 0 };
    const advice = getJourneyAdvice(game, 'inheritance')!;
    expect(advice.destination).toMatchObject({ kind: 'action', action: { type: 'END_DAY' }, label: '查看日暮结算' });
    expect(game.day).toBe(1);
    expect(game.resources.stones).toBe(start().resources.stones);
  });

  it('recommends recovery before sending a badly hurt player into another encounter', () => {
    const game = { ...start(), hp: 4, clues: 3 };
    expect(getJourneyAdvice(game, 'inheritance')?.destination).toMatchObject({ kind: 'action', action: { type: 'REST' } });
  });

  it('does not recommend unaffordable work to an exhausted, penniless player', () => {
    const game = { ...start(), qi: 0, resources: { stones: 0, herbs: 0, wine: 0, ore: 0 } };
    const advice = getJourneyAdvice(game, 'open')!;
    expect(advice.destination).toMatchObject({ kind: 'action', action: { type: 'REST' } });
    if (advice.destination.kind !== 'action') throw new Error('Expected an action');
    expect(getActionError(game, advice.destination.action)).toBeNull();
  });

  it('guides a prepared departure to its event instead of spending the reserved fare', () => {
    let game: GameState = { ...start(), day: 6, clues: 1, resources: { ...start().resources, stones: 35 } };
    const travel = getJourneyAdvice(game, 'departure')!;
    expect(travel.destination).toMatchObject({ kind: 'action', action: { type: 'TRAVEL', location: 'market' } });
    if (travel.destination.kind !== 'action') throw new Error('Expected an action');
    game = gameReducer(game, travel.destination.action);
    const explore = getJourneyAdvice(game, 'departure')!;
    expect(explore.destination).toMatchObject({ kind: 'action', action: { type: 'EXPLORE', eventId: 'market-departure' } });
    if (explore.destination.kind !== 'action') throw new Error('Expected an action');
    game = gameReducer(game, explore.destination.action);
    expect(game.activeEvent).toBe('market-departure');
    expect(game.ending).toBeNull();
    expect(game.resources.stones).toBe(35);
  });

  it('keeps a safe final clan choice available even when the player is injured', () => {
    const game = { ...start(), day: 10, actions: 1, hp: 3, clues: 2, trust: 35 };
    expect(getJourneyAdvice(game, 'clan')?.destination).toMatchObject({ kind: 'action', action: { type: 'TRAVEL', location: 'clan' } });
  });

  it('provides different next steps for clan and departure goals', () => {
    const game = { ...start(), day: 3, clues: 2, seenEvents: ['academy-roster'], trust: 20, resources: { ...start().resources, stones: 6 } };
    expect(getJourneyAdvice(game, 'clan')?.kind).toBe('route');
    expect(getJourneyAdvice(game, 'departure')?.kind).toBe('resources');
  });

  it('hides guidance and map event counts while an event or combat awaits resolution', () => {
    let game = gameReducer(start(), { type: 'TRAVEL', location: 'bamboo' });
    expect(getMapEventCounts(game).bamboo).toBeGreaterThan(0);
    game = gameReducer(game, { type: 'EXPLORE', eventId: 'bamboo-boar' });
    expect(getJourneyAdvice(game, 'open')).toBeNull();
    expect(Object.values(getMapEventCounts(game))).toEqual([0, 0, 0, 0, 0, 0]);
    game = gameReducer(game, { type: 'CHOOSE', choiceId: 'hunt-boar' });
    expect(game.combat).not.toBeNull();
    expect(getJourneyAdvice(game, 'open')).toBeNull();
  });
});
