import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PROTOTYPE_CONTENT, simulateStrategy } from '../src/game/prototype/index.ts';
import { SEED_SETS, STRATEGIES, envelope, fail, json, outputPath, parseOptions, verifyTrace, writeJson } from './prototype-common.mjs';

try {
  const options = parseOptions(process.argv.slice(2), ['--set', '--seed', '--strategy', '--out'], ['--verify', '--help']);
  if (options['--help']) {
    console.log('npm run prototype:simulate -- [--set development|holdout|all] [--strategy all|war-ready|network|labor] [--seed uint32] [--out directory] [--verify]');
  } else {
    const cohort = options['--set'] ?? 'development';
    if (!['development', 'holdout', 'all'].includes(cohort)) throw new Error('种子集必须是 development、holdout 或 all');
    if (options['--seed'] && options['--set']) throw new Error('--seed 与 --set 不能同时使用');
    const selected = options['--strategy'] ?? 'all';
    if (selected !== 'all' && !STRATEGIES.includes(selected)) throw new Error('未知策略');
    const strategies = selected === 'all' ? STRATEGIES : [selected];
    const seed = options['--seed'] === undefined ? null : Number(options['--seed']);
    if (seed !== null && (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)) throw new Error('种子必须是 uint32 整数');
    if (options['--verify'] && (seed !== null || selected !== 'all')) throw new Error('--verify 需要完整种子集与全部策略');
    const cohorts = seed !== null ? { custom: [seed] } : cohort === 'all' ? SEED_SETS : { [cohort]: SEED_SETS[cohort] };
    const rows = [];
    for (const [set, seeds] of Object.entries(cohorts)) {
      for (const strategyId of strategies) {
        for (const currentSeed of seeds) {
          const trace = simulateStrategy(strategyId, currentSeed);
          verifyTrace(envelope(trace), `${set}/${strategyId}/${currentSeed}`);
          rows.push({ set, strategyId, seed: currentSeed, steps: trace.actions.length, ...trace.summary });
        }
      }
    }
    const summaries = [];
    for (const set of Object.keys(cohorts)) {
      for (const strategyId of strategies) {
        const runs = rows.filter(row => row.set === set && row.strategyId === strategyId);
        const mean = key => Math.round(runs.reduce((sum, row) => sum + row[key], 0) / runs.length * 100) / 100;
        const survivalRate = runs.filter(row => row.survived).length / runs.length;
        const endings = {};
        const actionCounts = {};
        const failures = {};
        for (const run of runs) {
          endings[run.endingId] = (endings[run.endingId] ?? 0) + 1;
          for (const [action, count] of Object.entries(run.actionCounts)) actionCounts[action] = (actionCounts[action] ?? 0) + count;
          if (!run.survived) {
            for (const reason of run.reasons) failures[reason] = (failures[reason] ?? 0) + 1;
          }
        }
        summaries.push({ set, strategyId, runs: runs.length, survivalRate, meanStones: mean('stones'), meanCultivation: mean('cultivation'), meanWounds: mean('wounds'), endings, actionCounts, failures });
      }
    }
    const report = { formatVersion: 1, scenarioId: PROTOTYPE_CONTENT.scenarioId, rulesVersion: PROTOTYPE_CONTENT.rulesVersion, contentVersion: PROTOTYPE_CONTENT.contentVersion, seedSets: cohorts, summaries, runs: rows };
    const lines = ['# 策略原型模拟报告', '', `规则：${report.rulesVersion}；内容：${report.contentVersion}。所有记录都已从初态逐步重放校验。`, '', '| 种子集 | 策略 | 局数 | 生还率 | 平均元石 | 平均修为 |', '| --- | --- | ---: | ---: | ---: | ---: |'];
    for (const item of summaries) lines.push(`| ${item.set} | ${item.strategyId} | ${item.runs} | ${(item.survivalRate * 100).toFixed(1)}% | ${item.meanStones} | ${item.meanCultivation} |`);
    lines.push('', '目标：战备/关系策略各 ≥70%，纯劳作对照 ≤40%。这只检验三类显式策略，不证明全策略空间已平衡，也不代替玩家体验验证。', '', '逐局结果、结局、失败原因、可用蛊、暴露与行动分配见同目录 report.json。');
    console.log(lines.join('\n'));
    if (options['--out']) {
      const destination = outputPath(options['--out']);
      await mkdir(destination, { recursive: true });
      await writeJson(join(destination, 'report.json'), report);
      await writeFile(join(destination, 'report.md'), `${lines.join('\n')}\n`, 'utf8');
      console.log(`\n报告目录：${destination}`);
    }
    if (options['--verify']) {
      const violations = summaries.filter(item => item.strategyId === 'labor' ? item.survivalRate > 0.4 : item.survivalRate < 0.7);
      if (violations.length) throw new Error(`策略目标未满足：${json(violations.map(item => ({ set: item.set, strategy: item.strategyId, rate: item.survivalRate })))}`);
    }
  }
} catch (error) {
  fail(error);
}
