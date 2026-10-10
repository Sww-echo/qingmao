import { describe, expect, it } from 'vitest';
import { ENEMIES, ENDINGS, EVENTS, GU, LOCATIONS, NPCS, ORIGINS, RECIPES, SHOP } from './content';
import type { Effects, Requirement } from './types';

const guIds = new Set(GU.map((gu) => gu.id));
const locationIds = new Set(LOCATIONS.map((location) => location.id));
const npcIds = new Set(NPCS.map((npc) => npc.id));
const enemyIds = new Set(ENEMIES.map((enemy) => enemy.id));
const endingIds = new Set(ENDINGS.map((ending) => ending.id));

function checkEffects(effects: Effects, context: string) {
  for (const [id, amount] of Object.entries(effects.gu ?? {})) {
    expect(guIds.has(id), `${context}: unknown gu ${id}`).toBe(true);
    expect(Number.isInteger(amount), `${context}: fractional gu inventory`).toBe(true);
  }
  for (const [id, amount] of Object.entries(effects.relations ?? {})) {
    expect(npcIds.has(id), `${context}: unknown NPC ${id}`).toBe(true);
    expect(Number.isFinite(amount), context).toBe(true);
  }
  for (const value of Object.values(effects.resources ?? {})) {
    expect(Number.isFinite(value), context).toBe(true);
  }
}

function checkRequirements(requirements: Requirement[] | undefined, context: string) {
  for (const requirement of requirements ?? []) {
    if (requirement.kind === 'gu') {
      expect(guIds.has(requirement.id), `${context}: unknown required gu`).toBe(true);
      expect(requirement.count ?? 1, context).toBeGreaterThan(0);
    }
    if (requirement.kind === 'stat' && requirement.min !== undefined && requirement.max !== undefined) {
      expect(requirement.min, `${context}: impossible stat range`).toBeLessThanOrEqual(requirement.max);
    }
  }
}

describe('playable content integrity', () => {
  it('ships the agreed map, gu collection, recipes, and all three endings', () => {
    expect(new Set(LOCATIONS.map((location) => location.id))).toEqual(
      new Set(['academy', 'market', 'bamboo', 'stream', 'cave', 'clan']),
    );
    expect(LOCATIONS).toHaveLength(6);
    expect(GU).toHaveLength(12);
    expect(guIds).toEqual(new Set([
      'moonlight', 'little-light', 'jade-skin', 'white-boar', 'liquor-worm',
      'vitality-grass', 'earth-ear', 'flower-bag', 'jumping-grass',
      'moon-glow', 'white-jade', 'moon-mark',
    ]));
    expect(EVENTS.length).toBeGreaterThanOrEqual(34);
    expect(RECIPES.length).toBeGreaterThanOrEqual(3);
    expect(endingIds).toEqual(new Set(['inheritance', 'clan', 'departure']));
    expect(ENDINGS).toHaveLength(3);
  });

  it('uses unique nonempty IDs within every collection and every event', () => {
    for (const collection of [GU, LOCATIONS, ORIGINS, NPCS, EVENTS, RECIPES, SHOP, ENEMIES, ENDINGS]) {
      const ids = collection.map((entry) => entry.id);
      expect(ids.every((id) => id.trim().length > 0)).toBe(true);
      expect(new Set(ids).size, ids.join(', ')).toBe(ids.length);
    }
    for (const event of EVENTS) {
      expect(new Set(event.choices.map((choice) => choice.id)).size, event.id).toBe(event.choices.length);
      expect(event.choices.length, event.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('resolves every location, gu, encounter, ending, and relationship reference', () => {
    for (const origin of ORIGINS) {
      for (const id of origin.gu) expect(guIds.has(id), origin.id).toBe(true);
    }
    for (const npc of NPCS) expect(locationIds.has(npc.location), npc.id).toBe(true);
    for (const location of LOCATIONS) checkEffects(location.activity.effects, location.id);
    for (const recipe of RECIPES) {
      expect(guIds.has(recipe.result), recipe.id).toBe(true);
      for (const id of Object.keys(recipe.gu)) expect(guIds.has(id), recipe.id).toBe(true);
    }
    for (const item of SHOP) {
      if (item.guId) expect(guIds.has(item.guId), item.id).toBe(true);
      checkEffects(item.effects, item.id);
    }
    for (const enemy of ENEMIES) checkEffects(enemy.reward, enemy.id);
    for (const event of EVENTS) {
      expect(locationIds.has(event.location), event.id).toBe(true);
      checkRequirements(event.requirements, event.id);
      for (const choice of event.choices) {
        const context = `${event.id}/${choice.id}`;
        checkRequirements(choice.requirements, context);
        checkEffects(choice.effects, context);
        checkEffects(choice.victoryEffects ?? {}, context);
        checkEffects(choice.defeatEffects ?? {}, context);
        if (choice.encounterId) expect(enemyIds.has(choice.encounterId), context).toBe(true);
        if (choice.ending) expect(endingIds.has(choice.ending), context).toBe(true);
        if (choice.victoryEnding) {
          expect(endingIds.has(choice.victoryEnding), context).toBe(true);
          expect(choice.encounterId, `${context}: victory ending without a battle`).toBeTruthy();
        }
      }
    }
  });

  it('gives each event an affordable, unconditional way out and a valid date window', () => {
    for (const event of EVENTS) {
      expect(event.dayMin ?? 1, event.id).toBeGreaterThanOrEqual(1);
      expect(event.dayMax ?? 10, event.id).toBeLessThanOrEqual(10);
      expect(event.dayMin ?? 1, event.id).toBeLessThanOrEqual(event.dayMax ?? 10);
      const fallback = event.choices.find((choice) =>
        !choice.requirements?.length && !choice.encounterId &&
        Object.values(choice.effects.resources ?? {}).every((amount) => amount >= 0) &&
        Object.values(choice.effects.gu ?? {}).every((amount) => amount >= 0) &&
        (choice.effects.qi ?? 0) >= 0,
      );
      expect(fallback, `${event.id}: no usable exit when the player has no resources`).toBeDefined();
    }
  });

  it('only gates story branches on flags that the shipped content can actually produce', () => {
    const effects = [
      ...LOCATIONS.map((location) => location.activity.effects),
      ...SHOP.map((item) => item.effects),
      ...ENEMIES.map((enemy) => enemy.reward),
      ...EVENTS.flatMap((event) => event.choices.flatMap((choice) =>
        [choice.effects, choice.victoryEffects ?? {}, choice.defeatEffects ?? {}],
      )),
    ];
    const producedFlags = new Set(effects.flatMap((effect) => effect.addFlags ?? []));
    for (const event of EVENTS) {
      const requirements = [
        ...(event.requirements ?? []),
        ...event.choices.flatMap((choice) => choice.requirements ?? []),
      ];
      for (const requirement of requirements) {
        if (requirement.kind === 'flag') {
          expect(producedFlags.has(requirement.key), `${event.id}: unreachable flag ${requirement.key}`).toBe(true);
        }
      }
    }
  });

  it('has usable enemies and recipes with real inputs and bounded success rates', () => {
    for (const enemy of ENEMIES) {
      expect(enemy.hp, enemy.id).toBeGreaterThan(0);
      expect(enemy.moves.length, enemy.id).toBeGreaterThan(0);
      for (const move of enemy.moves) {
        expect(move.label.length, enemy.id).toBeGreaterThan(0);
        expect(move.power, enemy.id).toBeGreaterThanOrEqual(0);
      }
    }
    for (const recipe of RECIPES) {
      expect(Object.keys(recipe.gu).length, recipe.id).toBeGreaterThan(0);
      expect(Object.values(recipe.gu).every((count) => Number.isInteger(count) && count > 0), recipe.id).toBe(true);
      expect(recipe.gu[recipe.result], `${recipe.id}: output already consumed as an ingredient`).toBeUndefined();
      expect(recipe.successRate, recipe.id).toBeGreaterThan(0);
      expect(recipe.successRate, recipe.id).toBeLessThanOrEqual(1);
      expect(Object.values(recipe.resources).every((cost) => cost >= 0), recipe.id).toBe(true);
      expect(Object.values(recipe.safeExtra).some((cost) => cost > 0), recipe.id).toBe(true);
    }
  });

  it('offers an explicit success route for each ending, including voluntary departure', () => {
    const offeredEndings = new Set(EVENTS.flatMap((event) =>
      event.choices.flatMap((choice) => [choice.ending, choice.victoryEnding].filter(Boolean)),
    ));
    expect(offeredEndings).toEqual(endingIds);
  });
});
