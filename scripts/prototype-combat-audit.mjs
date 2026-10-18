import { PROTOTYPE_CONTENT, simulateStrategy } from '../src/game/prototype/index.ts';
import { SEED_SETS, fail, json, writeJson } from './prototype-common.mjs';
import { join } from 'node:path';
import { ROOT } from './prototype-common.mjs';
import { prototypeReducer, getPrototypeActionError } from '../src/game/prototype/engine.ts';

/** V1 combat has no random draws, persistent shields, status effects, or changing
 * inventory. Same board/resources with more HP dominates one with less HP.
 * Only the current published encounter is searched; no future RNG is inspected. */
function solve(start) {
  const slim = state => ({ ...state, log: [], ledger: [], actionCounts: {} });
  const queue = [{ state: slim(start), parent: -1, action: null }];
  const best = new Map();
  const moves = ['moonlight', 'attack', 'defend', 'herbs', 'wine', 'jade-skin'];
  const period = PROTOTYPE_CONTENT.enemies.find(enemy => enemy.id === start.combat.enemyId).intents.length;
  for (let i = 0; i < queue.length; i += 1) {
    if (queue.length > 1000000) throw new Error('combat audit exceeded one million boards');
    const { state } = queue[i];
    if (state.ending?.outcome === 'survived') {
      const path = [];
      for (let at = i; queue[at].parent !== -1; at = queue[at].parent) path.push(queue[at].action);
      path.reverse();
      let replay = start;
      for (const action of path) replay = prototypeReducer(replay, action);
      if (replay.ending?.outcome !== 'survived') throw new Error('search/replay mismatch');
      return { won: true, nodes: queue.length, hp: replay.hp, path };
    }
    if (state.ending) continue;
    for (const move of moves) {
      const action = { type: 'COMBAT', move };
      if (getPrototypeActionError(state, action)) continue;
      const next = slim(prototypeReducer(state, action));
      if (next.rngDraws !== state.rngDraws) throw new Error('combat became stochastic; audit must be revised');
      if (next.ending?.outcome === 'death') continue;
      const key = JSON.stringify([next.combat?.enemyHp ?? 0, (next.combat?.turn ?? 0) % period, next.qi,
        next.resources.herbs, next.resources.wine, next.combat?.herbsUsed, next.combat?.wineUsed]);
      if ((best.get(key) ?? -1) >= next.hp) continue;
      best.set(key, next.hp);
      queue.push({ state: next, parent: i, action });
    }
  }
  return { won: false, nodes: queue.length };
}

try {
  if (process.argv.length > 2) throw new Error('prototype:audit-combat 不接受参数');
  if (PROTOTYPE_CONTENT.rulesVersion !== 'prototype-rules-1') throw new Error('新规则须重新审核搜索状态与支配关系');
  const boards = new Map();
  const runs = [];
  for (const seed of SEED_SETS.development) {
    const trace = simulateStrategy('labor', seed);
    const start = trace.steps.find(step => step.state.combat?.purpose === 'crisis')?.state;
    if (!start) throw new Error(`labor/${seed} 未进入最终战斗`);
    const key = json([start.combat, start.hp, start.qi, start.cultivation, start.inventory, start.resources, start.exposures]);
    if (!boards.has(key)) boards.set(key, { enemyHp: start.combat.enemyHp, ...solve(start) });
    const result = boards.get(key);
    runs.push({ seed, enemyHp: start.combat.enemyHp, won: result.won });
  }
  const survivalRate = runs.filter(run => run.won).length / runs.length;
  const report = { rulesVersion: PROTOTYPE_CONTENT.rulesVersion, contentVersion: PROTOTYPE_CONTENT.contentVersion,
    scope: 'Only final combat after legal labor preparation; V1 deterministic combat, HP dominance pruning. Not a search over all preparation strategies.',
    seeds: SEED_SETS.development, survivalRate, boards: [...boards.values()], runs };
  await writeJson(join(ROOT, 'artifacts/prototype/combat-audit.json'), report);
  console.log(`劳作准备后的最终战：${runs.length} 个开发种子，${boards.size} 个不同战局，最优操作可生还 ${(survivalRate * 100).toFixed(1)}%。`);
  console.log('报告：artifacts/prototype/combat-audit.json；只审核最终战，不代表全策略空间。');
  if (survivalRate > 0.4) throw new Error('劳作对照可通过更优战斗超过40%生还率，请修正政策或重新评估机制');
} catch (error) {
  fail(error);
}
