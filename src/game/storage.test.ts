import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENEMIES, EVENTS, GU, RECIPES, SHOP } from './content';
import { createGame, gameReducer } from './engine';
import { createSave, EMPTY_META, loadSave, parseSave, serializeSave, updateMeta, writeSave } from './storage';
import type { GameState, SaveData } from './types';

const BACKUP_KEY = 'qingmao-game:save:v1';

function save(seed = 1): SaveData {
  const game = createGame({ name: '山客', origin: 'disciple', seed });
  const result = createSave(game, updateMeta(EMPTY_META, game));
  result.savedAt = '2026-10-10T01:00:00.000Z';
  return result;
}

function ended(seed: number): GameState {
  let game = createGame({ name: '归客', origin: 'trader', seed });
  for (let i = 0; i < 10; i += 1) game = gameReducer(game, { type: 'END_DAY' });
  return game;
}

function memoryStorage(initial: [string, string][] = []) {
  const values = new Map(initial);
  const api = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
    clear: vi.fn(() => values.clear()),
  };
  vi.stubGlobal('localStorage', api);
  return { values, api };
}

type TransactionDouble = {
  error: Error | null;
  oncomplete: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
};

function controlledDatabase(initial?: unknown) {
  const values = new Map<string, unknown>();
  if (initial !== undefined) values.set('current', initial);
  const writes: { value: string; key: string; transaction: TransactionDouble; request: { onsuccess: (() => void) | null } }[] = [];
  const database = {
    close: vi.fn(), onversionchange: null as (() => void) | null,
    objectStoreNames: { contains: (name: string) => name === 'saves' },
    createObjectStore: vi.fn(),
    transaction: vi.fn((store: string, mode: string) => {
      expect(store).toBe('saves');
      const transaction: TransactionDouble = { error: null, oncomplete: null, onerror: null, onabort: null };
      return Object.assign(transaction, {
        objectStore: (name: string) => {
          expect(name).toBe('saves');
          return {
            get: (key: string) => {
              expect(mode).toBe('readonly');
              const request = { result: undefined as unknown, onsuccess: null as (() => void) | null };
              queueMicrotask(() => {
                request.result = values.get(key);
                request.onsuccess?.();
                transaction.oncomplete?.();
              });
              return request;
            },
            put: (value: string, key: string) => {
              expect(mode).toBe('readwrite');
              const request = { onsuccess: null as (() => void) | null };
              writes.push({ value, key, transaction, request });
              return request;
            },
          };
        },
      });
    }),
  };
  const api = {
    open: vi.fn((name: string, version: number) => {
      expect(name).toBe('qingmao-game-v1');
      expect(version).toBe(1);
      const request = {
        result: database, error: null, onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null, onblocked: null as (() => void) | null,
        onupgradeneeded: null as (() => void) | null,
      };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    }),
  };
  vi.stubGlobal('indexedDB', api);
  return {
    values, writes, api,
    commit(index: number) {
      const write = writes[index]!;
      values.set(write.key, write.value);
      write.transaction.oncomplete?.();
    },
  };
}

async function flush() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

afterEach(() => vi.unstubAllGlobals());

describe('save-file validation', () => {
  it('round trips a normal save without sharing mutable state', () => {
    const original = save();
    const restored = parseSave(serializeSave(original));
    expect(restored).toEqual(original);
    restored.game.resources.stones += 10;
    restored.meta.discoveredGu.push('moon-glow');
    expect(restored.game.resources).not.toBe(original.game.resources);
    expect(restored.meta.discoveredGu).not.toBe(original.meta.discoveredGu);
    expect(original.meta.discoveredGu).not.toContain('moon-glow');
  });

  it('snapshots both game and progress immutably', () => {
    const game = createGame({ name: '听雨', origin: 'scout', seed: 14 });
    const progress = updateMeta(EMPTY_META, game);
    const snapshot = createSave(game, progress);
    game.resources.stones = 0;
    game.inventory.moonlight = 50;
    progress.discoveredGu.length = 0;
    expect(snapshot.game.resources.stones).toBeGreaterThan(0);
    expect(snapshot.game.inventory.moonlight).not.toBe(50);
    expect(snapshot.meta.discoveredGu.length).toBeGreaterThan(0);
    expect(EMPTY_META).toEqual({ completedRuns: 0, endings: [], discoveredGu: [], lastRecordedRun: null, recordedRunIds: [] });
  });

  it('orders snapshots even when the wall clock has not advanced', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now());
    try {
      const game = createGame({ name: '山客', origin: 'disciple', seed: 5 });
      const earlier = createSave(game, EMPTY_META);
      const later = createSave(game, EMPTY_META);
      expect(Date.parse(later.savedAt)).toBeGreaterThan(Date.parse(earlier.savedAt));
    } finally {
      clock.mockRestore();
    }
  });

  it('preserves an unresolved event and resumes through the reducer', () => {
    const original = save();
    original.game = gameReducer(original.game, { type: 'EXPLORE' });
    expect(original.game.activeEvent).not.toBeNull();
    const restored = parseSave(serializeSave(original));
    const event = EVENTS.find(item => item.id === restored.game.activeEvent)!;
    const exit = event.choices.find(choice => !choice.requirements?.length && !choice.encounterId && Object.keys(choice.effects).length === 0)!;
    const next = gameReducer(restored.game, { type: 'CHOOSE', choiceId: exit.id });
    expect(next.activeEvent).toBeNull();
    expect(next.seenEvents).toContain(event.id);
  });

  it('round trips a battle with pending rewards and its next intent', () => {
    const original = save();
    const event = EVENTS.find(item => item.choices.some(choice => choice.encounterId))!;
    const choice = event.choices.find(item => item.encounterId)!;
    original.game = gameReducer({
      ...original.game, activeEvent: event.id, location: event.location, day: event.dayMin ?? 1,
    }, { type: 'CHOOSE', choiceId: choice.id });
    original.game = gameReducer(original.game, { type: 'COMBAT', move: 'attack' });
    expect(original.game.combat).not.toBeNull();
    const restored = parseSave(serializeSave(original));
    expect(restored.game.combat).toEqual(original.game.combat);
    const action = { type: 'COMBAT', move: 'defend' } as const;
    expect(gameReducer(restored.game, action)).toEqual(gameReducer(original.game, action));
  });

  it('allows upkeep history for ingredients already consumed by refinement', () => {
    const original = save();
    const recipe = RECIPES[0]!;
    const ingredients = Object.keys(recipe.gu);
    original.game = gameReducer({
      ...original.game, rank: 2, hp: 36, maxHp: 36, qi: 16, maxQi: 16,
      resources: { stones: 100, herbs: 100, ore: 100, wine: 100 }, inventory: { ...recipe.gu },
      equipped: ingredients, usedToday: ingredients,
    }, { type: 'CRAFT', recipeId: recipe.id, safe: true });
    expect(original.game.usedToday).toEqual(ingredients);
    expect(original.game.inventory[ingredients[0]!]).toBeUndefined();
    expect(parseSave(serializeSave(original)).game).toEqual(original.game);
  });

  it('accepts final defeat saves and keeps survival distinct from success', () => {
    const original = save();
    original.game = ended(11);
    expect(parseSave(serializeSave(original)).game.ending?.outcome).toBe('survived');
    original.game.hp = 0;
    original.game.ending = { id: 'departure', reason: '败退', outcome: 'defeat' };
    expect(parseSave(serializeSave(original)).game.hp).toBe(0);
  });

  it('rejects malformed JSON, unsupported versions, bad dates, and oversized UTF-8 data', () => {
    expect(() => parseSave('{')).toThrow('JSON');
    expect(() => parseSave(JSON.stringify({ ...save(), version: 2 }))).toThrow('版本');
    expect(() => parseSave(JSON.stringify({ ...save(), savedAt: 'yesterday' }))).toThrow('保存时间');
    expect(() => parseSave('中'.repeat(400_000))).toThrow('1 MB');
  });

  it.each([
    ['missing required field', (current: SaveData) => ({ ...current.game, hungry: undefined })],
    ['negative currency', (current: SaveData) => ({ ...current.game, resources: { ...current.game.resources, stones: -1 } })],
    ['fractional action', (current: SaveData) => ({ ...current.game, actions: 0.5 })],
    ['out-of-range day', (current: SaveData) => ({ ...current.game, day: 11 })],
    ['unknown location', (current: SaveData) => ({ ...current.game, location: 'outside' })],
    ['unknown gu', (current: SaveData) => ({ ...current.game, inventory: { ghost: 1 } })],
    ['negative inventory', (current: SaveData) => ({ ...current.game, inventory: { moonlight: -1 } })],
    ['unowned equipment', (current: SaveData) => ({ ...current.game, inventory: {} })],
    ['duplicate equipment', (current: SaveData) => ({ ...current.game, equipped: ['moonlight', 'moonlight'] })],
    ['missing daily maintenance', (current: SaveData) => ({ ...current.game, usedToday: [] })],
    ['unknown history event', (current: SaveData) => ({ ...current.game, seenEvents: ['ghost-event'] })],
    ['unknown active event', (current: SaveData) => ({ ...current.game, activeEvent: 'ghost-event' })],
    ['unknown relationship', (current: SaveData) => ({ ...current.game, relations: { ghost: 10 } })],
    ['health above cap', (current: SaveData) => ({ ...current.game, hp: 100 })],
    ['invalid maximum health', (current: SaveData) => ({ ...current.game, maxHp: 100 })],
    ['death without settlement', (current: SaveData) => ({ ...current.game, hp: 0 })],
    ['negative purchase count', (current: SaveData) => ({ ...current.game, purchases: { [SHOP[0]!.id]: -1 } })],
    ['oversold item', (current: SaveData) => ({ ...current.game, purchases: { [SHOP[0]!.id]: SHOP[0]!.stock + 1 } })],
    ['unknown field', (current: SaveData) => ({ ...current.game, privateCommand: 'not part of the schema' })],
  ] as const)('rejects %s', (_label, build) => {
    const original = save();
    expect(() => parseSave(JSON.stringify({ ...original, game: build(original) }))).toThrow('存档格式错误');
  });

  it('rejects conflicting stages, unknown enemies, and broken combat payloads', () => {
    const original = save();
    const enemy = ENEMIES[0]!;
    const combat = {
      enemyId: enemy.id, enemyHp: enemy.hp, enemyGuard: 0, playerGuard: 0, turn: 0,
      victoryEffects: {}, victoryText: '', defeatEffects: {}, log: [],
    };
    const withBattle = { ...original, game: { ...original.game, combat } };
    expect(() => parseSave(JSON.stringify(withBattle))).not.toThrow();
    expect(() => parseSave(JSON.stringify({ ...original, game: { ...withBattle.game, activeEvent: EVENTS[0]!.id } }))).toThrow('当前阶段');
    expect(() => parseSave(JSON.stringify({ ...original, game: { ...withBattle.game, ending: { id: 'departure', reason: '结束', outcome: 'survived' } } }))).toThrow('当前阶段');
    expect(() => parseSave(JSON.stringify({ ...original, game: { ...original.game, combat: { ...combat, enemyId: 'ghost' } } }))).toThrow('enemyId');
    expect(() => parseSave(JSON.stringify({ ...original, game: { ...original.game, combat: { ...combat, victoryEffects: { gu: { ghost: 1 } } } } }))).toThrow('ghost');
  });

  it('rejects invalid unlock records and upgrades legacy last-run metadata', () => {
    const original = save();
    expect(() => parseSave(JSON.stringify({ ...original, meta: { ...original.meta, completedRuns: -1 } }))).toThrow('完成次数');
    expect(() => parseSave(JSON.stringify({ ...original, meta: { ...original.meta, endings: ['other'] } }))).toThrow('已解锁结局');
    expect(() => parseSave(JSON.stringify({ ...original, meta: { ...original.meta, recordedRunIds: ['same', 'same'] } }))).toThrow('重复');
    const upgraded = parseSave(JSON.stringify({
      ...original, meta: { completedRuns: 2, endings: ['departure'], discoveredGu: [], lastRecordedRun: 'old-run' },
    }));
    expect(upgraded.meta.recordedRunIds).toEqual(['old-run']);
  });
});

describe('persistent unlock progress', () => {
  it('counts a finished run once even after another run and reimporting the first', () => {
    const first = ended(10);
    const second = ended(20);
    const once = updateMeta(EMPTY_META, first);
    const duplicate = updateMeta(once, first);
    const twice = updateMeta(duplicate, second);
    const importedOld = updateMeta(twice, first);
    expect(once.completedRuns).toBe(1);
    expect(duplicate).toEqual(once);
    expect(twice.completedRuns).toBe(2);
    expect(importedOld).toEqual(twice);
    expect(importedOld.endings).toEqual([]);
    expect(importedOld.recordedRunIds).toEqual([first.runId, second.runId]);
    expect(EMPTY_META.completedRuns).toBe(0);
  });

  it.each(['survived', 'defeat'] as const)('counts a %s journey without unlocking a successful departure', (outcome) => {
    const game = ended(31);
    if (outcome === 'defeat') {
      game.hp = 0;
      game.ending = { id: 'departure', reason: '败退离山。', outcome };
    }
    expect(game.ending?.outcome).toBe(outcome);
    const progress = updateMeta(EMPTY_META, game);
    expect(progress.completedRuns).toBe(1);
    expect(progress.recordedRunIds).toEqual([game.runId]);
    expect(progress.lastRecordedRun).toBe(game.runId);
    expect(progress.endings).toEqual([]);
    expect(updateMeta(progress, game)).toEqual(progress);

    // Replaying an earlier backup can turn this same journey into a success.
    const successfulReplay: GameState = {
      ...game, hp: game.maxHp,
      ending: { id: 'departure', reason: '重新安排盘缠后，主动随队离山。', outcome: 'success' },
    };
    const recovered = updateMeta(progress, successfulReplay);
    expect(recovered.completedRuns).toBe(1);
    expect(recovered.recordedRunIds).toEqual([game.runId]);
    expect(recovered.endings).toEqual(['departure']);
    expect(progress.endings).toEqual([]);
  });

  it.each(['inheritance', 'clan', 'departure'] as const)('unlocks a successful %s route once', (id) => {
    const game: GameState = {
      ...createGame({ name: '得偿所愿', origin: 'disciple', seed: 42 }),
      ending: { id, reason: '达成这条路线。', outcome: 'success' },
    };
    const progress = updateMeta(EMPTY_META, game);
    expect(progress.completedRuns).toBe(1);
    expect(progress.endings).toEqual([id]);
    expect(updateMeta(progress, game)).toEqual(progress);
  });

  it('unlocks another successful ending after restoring the same run without counting it again', () => {
    const checkpoint = save(77);
    const firstFinish: GameState = {
      ...checkpoint.game,
      ending: { id: 'clan', reason: '在宗族立足。', outcome: 'success' },
    };
    const firstProgress = updateMeta(EMPTY_META, firstFinish);
    const restored = parseSave(serializeSave(checkpoint)).game;
    expect(restored.runId).toBe(firstFinish.runId);
    const resumedProgress = updateMeta(firstProgress, restored);
    expect(resumedProgress).toEqual(firstProgress);
    const secondFinish: GameState = {
      ...restored,
      ending: { id: 'inheritance', reason: '读档后选择独掌传承。', outcome: 'success' },
    };
    const secondProgress = updateMeta(resumedProgress, secondFinish);
    expect(secondProgress.completedRuns).toBe(1);
    expect(secondProgress.recordedRunIds).toEqual([restored.runId]);
    expect(secondProgress.endings).toEqual(['clan', 'inheritance']);
    expect(firstProgress.endings).toEqual(['clan']);
    expect(updateMeta(secondProgress, secondFinish)).toEqual(secondProgress);

    const otherJourney = ended(78);
    const afterOtherJourney = updateMeta(secondProgress, otherJourney);
    expect(afterOtherJourney.completedRuns).toBe(2);
    expect(afterOtherJourney.endings).toEqual(['clan', 'inheritance']);
    expect(updateMeta(afterOtherJourney, firstFinish)).toEqual(afterOtherJourney);
  });

  it('records discovered gu during an unfinished journey without counting a completion', () => {
    const game = createGame({ name: '收集者', origin: 'scout', seed: 4 });
    const before = structuredClone(game);
    const progress = updateMeta(EMPTY_META, game);
    expect(progress.completedRuns).toBe(0);
    expect(progress.endings).toEqual([]);
    expect(new Set(progress.discoveredGu)).toEqual(new Set(Object.keys(game.inventory)));
    expect(progress.discoveredGu.every(id => GU.some(gu => gu.id === id))).toBe(true);
    expect(game).toEqual(before);
  });
});

describe('browser persistence and transaction ordering', () => {
  it('uses the project backup when IndexedDB is unavailable and touches no other key', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const memory = memoryStorage([['unrelated-app', 'keep me']]);
    const original = save();
    await writeSave(original);
    expect(await loadSave()).toEqual(original);
    expect(memory.values.get('unrelated-app')).toBe('keep me');
    expect(memory.api.setItem.mock.calls.map(([key]) => key)).toEqual([BACKUP_KEY]);
    expect(memory.api.clear).not.toHaveBeenCalled();
    expect(memory.api.removeItem).not.toHaveBeenCalled();
  });

  it('resolves only on transaction completion and serializes concurrent snapshots', async () => {
    const memory = memoryStorage();
    const database = controlledDatabase();
    const first = save(1);
    const second = save(2);
    second.savedAt = '2026-10-10T02:00:00.000Z';
    let completed = false;
    const firstWrite = writeSave(first).then(() => { completed = true; });
    const secondWrite = writeSave(second);
    second.game.name = '后来改动';
    await flush();
    expect(database.writes).toHaveLength(1);
    database.writes[0]!.request.onsuccess?.();
    await flush();
    expect(completed).toBe(false);
    expect(memory.api.setItem).not.toHaveBeenCalled();
    database.commit(0);
    await firstWrite;
    await flush();
    expect(database.writes).toHaveLength(2);
    database.commit(1);
    await secondWrite;
    const loaded = await loadSave();
    expect(loaded?.game.seed).toBe(2);
    expect(loaded?.game.name).toBe('山客');
    expect(database.writes.map(write => write.key)).toEqual(['current', 'current']);
  });

  it('reads the latest timestamp across both stores and supports an empty primary', async () => {
    const earlier = save(1);
    const newer = save(2);
    newer.savedAt = '2026-10-10T03:00:00.000Z';
    const database = controlledDatabase(serializeSave(earlier));
    const memory = memoryStorage([[BACKUP_KEY, serializeSave(newer)]]);
    expect((await loadSave())?.game.seed).toBe(2);
    database.values.set('current', serializeSave(newer));
    memory.values.set(BACKUP_KEY, serializeSave(earlier));
    expect((await loadSave())?.game.seed).toBe(2);
    database.values.delete('current');
    expect((await loadSave())?.game.seed).toBe(1);
  });

  it('reports corruption without replacing it with the other copy or clearing data', async () => {
    const database = controlledDatabase('{broken');
    const memory = memoryStorage([[BACKUP_KEY, serializeSave(save())]]);
    await expect(loadSave()).rejects.toThrow('已损坏');
    expect(database.values.get('current')).toBe('{broken');
    expect(memory.api.setItem).not.toHaveBeenCalled();
    expect(memory.api.clear).not.toHaveBeenCalled();
    expect(memory.api.removeItem).not.toHaveBeenCalled();
  });

  it('does not poison later saves after both storage mechanisms reject a write', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const memory = memoryStorage();
    memory.api.setItem.mockImplementationOnce(() => { throw new Error('quota'); });
    await expect(writeSave(save(1))).rejects.toThrow('均写入失败');
    await expect(writeSave(save(2))).resolves.toBeUndefined();
    expect((await loadSave())?.game.seed).toBe(2);
  });

  it('reports unreadable storage, and returns null when neither store contains a save', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const memory = memoryStorage();
    expect(await loadSave()).toBeNull();
    memory.api.getItem.mockImplementationOnce(() => { throw new Error('permission'); });
    await expect(loadSave()).rejects.toThrow('均不可用');
  });
});
