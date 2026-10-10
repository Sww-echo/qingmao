import { describe, expect, it } from 'vitest';
import { createGame, gameReducer, getActionError } from './engine';
import { createSave, EMPTY_META, parseSave, serializeSave, updateMeta } from './storage';
import type { GameAction, GameState, SaveData } from './types';

function act(game: GameState, action: GameAction): GameState {
  expect(getActionError(game, action), JSON.stringify(action)).toBeNull();
  return gameReducer(game, action);
}

function pendingCargoBattle(): SaveData {
  let game = createGame({ name: '回归审查', origin: 'disciple', seed: 9 });
  game = act(game, { type: 'TRAVEL', location: 'market' });
  game = act(game, { type: 'EXPLORE', eventId: 'market-cargo' });
  game = act(game, { type: 'CHOOSE', choiceId: 'recover-cargo' });
  expect(game.combat?.enemyId).toBe('courier-thief');
  return createSave(game, updateMeta(EMPTY_META, game));
}

describe('campaign isolation in pending combat flags', () => {
  it.each([
    ['victoryEffects', 'addFlags'],
    ['defeatEffects', 'addFlags'],
    ['victoryEffects', 'removeFlags'],
    ['defeatEffects', 'removeFlags'],
  ] as const)('rejects protagonist flags in legacy %s.%s before they can break the next save', (effectKey, flagKey) => {
    const save = pendingCargoBattle();
    save.game.combat![effectKey][flagKey] = ['fy-reborn'];
    expect(() => parseSave(JSON.stringify(save))).toThrow(`战斗.${effectKey}.${flagKey}`);
  });

  it('keeps supported legacy flag additions and removals in both pending outcomes', () => {
    const save = pendingCargoBattle();
    for (const key of ['victoryEffects', 'defeatEffects'] as const) {
      save.game.combat![key].addFlags = ['merchant-pact', 'milestone-battle'];
      save.game.combat![key].removeFlags = ['fang-trade', 'chapter-one'];
    }
    expect(parseSave(serializeSave(save))).toEqual(save);
  });

  it('imports a real legacy battle, settles its reward flags, and saves the resulting journey again', () => {
    const original = pendingCargoBattle();
    const restored = parseSave(serializeSave(original));
    let game = restored.game;
    for (let turn = 0; turn < 4; turn += 1) game = act(game, { type: 'COMBAT', move: 'gu', guId: 'moonlight' });
    expect(game.combat).toBeNull();
    expect(game.ending).toBeNull();
    expect(game.flags).toContain('merchant-pact');
    expect(game.resources.stones).toBe(original.game.resources.stones + 14);
    expect(original.game.flags).not.toContain('merchant-pact');
    const afterBattle = createSave(game, updateMeta(restored.meta, game));
    expect(parseSave(serializeSave(afterBattle))).toEqual(afterBattle);
  });
});
