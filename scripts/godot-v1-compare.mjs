import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { PROTOTYPE_CONTENT, simulateStrategy } from '../src/game/prototype/index.ts';
import { ROOT, SEED_SETS, STRATEGIES, envelope, fail, hash, outputPath, parseOptions, readJson, verifyTrace, writeJson } from './prototype-common.mjs';

export const GODOT_VERSION = '4.7.2.stable.official.ed1daf0bf';

function git(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unavailable';
  }
}

export function sourceIdentity() {
  const commit = git(['rev-parse', 'HEAD']);
  const status = git(['status', '--porcelain=v1']);
  return { commit, dirty: status !== 'unavailable' && status.length > 0 };
}

export function buildExpected(set = 'development') {
  if (!['development', 'holdout', 'all'].includes(set)) throw new Error('种子集必须是 development、holdout 或 all');
  const seedSets = set === 'all' ? SEED_SETS : { [set]: SEED_SETS[set] };
  const runs = [];
  for (const [cohort, seeds] of Object.entries(seedSets)) {
    for (const strategyId of STRATEGIES) {
      for (const seed of seeds) {
        const trace = simulateStrategy(strategyId, seed);
        const stateHashes = [hash(trace.initialState), ...trace.steps.map(step => hash(step.state))];
        const chainHashes = [stateHashes[0]];
        for (const [index, action] of trace.actions.entries()) {
          chainHashes.push(hash(`${chainHashes[index]}\n${hash(action)}\n${stateHashes[index + 1]}\n`));
        }
        runs.push({ runId: `${cohort}/${strategyId}/${seed}`, set: cohort, strategyId, seed,
          actions: trace.actions, stateHashes, chainHashes, summary: trace.summary });
      }
    }
  }
  return { formatVersion: 1, scenarioId: PROTOTYPE_CONTENT.scenarioId,
    rulesVersion: PROTOTYPE_CONTENT.rulesVersion, contentVersion: PROTOTYPE_CONTENT.contentVersion,
    contentSha256: hash(PROTOTYPE_CONTENT), seedSets, runs };
}

export function runGodotComparison(expectedPath, reportPath, binary = process.env.GODOT_BIN ?? join(homedir(), 'Applications/Godot.app/Contents/MacOS/Godot')) {
  return new Promise((accept, reject) => {
    const args = ['--headless', '--path', join(ROOT, 'godot'), '--script', 'res://tests/v1_compare.gd', '--',
      `--expected=${resolve(expectedPath)}`, `--report=${resolve(reportPath)}`];
    const child = spawn(binary, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), 20 * 60 * 1000);
    child.stdout.on('data', chunk => { stdout += chunk; process.stdout.write(chunk); });
    child.stderr.on('data', chunk => { stderr += chunk; process.stderr.write(chunk); });
    child.once('error', error => { clearTimeout(timer); reject(new Error(`Godot 启动失败 (${binary}): ${error.message}`)); });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      accept({ code, signal, stdout, stderr, binary });
    });
  });
}

export function firstDifference(expected, actual, path = '$') {
  if (Object.is(expected, actual)) return null;
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) return { path: `${path}.length`, expected: expected.length, actual: actual.length };
    for (let index = 0; index < expected.length; index++) {
      const difference = firstDifference(expected[index], actual[index], `${path}[${index}]`);
      if (difference) return difference;
    }
    return null;
  }
  if (expected !== null && actual !== null && typeof expected === 'object' && typeof actual === 'object'
    && !Array.isArray(expected) && !Array.isArray(actual)) {
    for (const key of [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()) {
      const keyPath = `${path}[${JSON.stringify(key)}]`;
      if (!Object.hasOwn(expected, key) || !Object.hasOwn(actual, key)) {
        return { path: keyPath, expected: Object.hasOwn(expected, key) ? expected[key] : '<missing>', actual: Object.hasOwn(actual, key) ? actual[key] : '<missing>' };
      }
      const difference = firstDifference(expected[key], actual[key], keyPath);
      if (difference) return difference;
    }
    return null;
  }
  return { path, expected, actual };
}

export async function diagnoseFailure(report, directory) {
  const failure = report.failure;
  if (!failure || !STRATEGIES.includes(failure.strategyId) || !Number.isInteger(failure.seed)
    || failure.seed < 0 || failure.seed > 0xffffffff) return null;
  const value = envelope(simulateStrategy(failure.strategyId, failure.seed));
  verifyTrace(value, 'first-difference dump');
  const dumpPath = join(directory, 'first-difference-expected-trace.json');
  await writeJson(dumpPath, value);
  let expected;
  let actual;
  if (failure.kind === 'action') {
    expected = value.trace.actions[failure.step - 1] ?? null;
    actual = failure.actualAction ?? null;
  } else if (failure.kind === 'summary') {
    expected = value.trace.summary;
    actual = failure.actualSummary;
  } else {
    expected = failure.step === 0 ? value.trace.initialState : value.trace.steps[failure.step - 1]?.state;
    actual = failure.actualState;
  }
  const difference = firstDifference(expected, actual);
  const diagnostic = { runId: failure.runId, step: failure.step, kind: failure.kind,
    expectedFile: report.expectedFile, dumpPath, expectedHash: failure.expectedHash,
    actualHash: failure.actualHash, difference,
    note: difference ? 'Full-state/action first difference' : 'Full values match the TS dump; inspect the expected hash/chain artifact for corruption.' };
  await writeJson(join(directory, 'first-difference.json'), diagnostic);
  console.error(`First difference ${failure.runId} step ${failure.step}: ${difference?.path ?? diagnostic.note}; dump: ${dumpPath}`);
  return diagnostic;
}

export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args, ['--set', '--out'], ['--help']);
  if (options['--help']) {
    console.log('npm run godot:compare -- [--set development|holdout|all] [--out directory]');
    return;
  }
  const set = options['--set'] ?? 'development';
  const binary = process.env.GODOT_BIN ?? join(homedir(), 'Applications/Godot.app/Contents/MacOS/Godot');
  const version = spawnSync(binary, ['--version'], { encoding: 'utf8', timeout: 30000 });
  if (version.error || version.status !== 0 || version.stdout.trim() !== GODOT_VERSION) {
    throw new Error(`Godot 版本必须为 ${GODOT_VERSION}: ${version.stdout.trim() || version.error?.message || `exit ${version.status}`}`);
  }
  const started = performance.now();
  const source = sourceIdentity();
  const startedAt = new Date().toISOString();
  const expected = buildExpected(set);
  const directory = outputPath(options['--out'] ?? 'artifacts/godot');
  const expectedPath = join(directory, `v1-expected-${set}.json`);
  const reportPath = join(directory, `v1-compare-${set}.json`);
  await writeJson(expectedPath, expected);
  await rm(reportPath, { force: true });
  const command = [binary, '--headless', '--path', join(ROOT, 'godot'), '--script', 'res://tests/v1_compare.gd', '--',
    `--expected=${expectedPath}`, `--report=${reportPath}`];
  console.log(`Expected ${set}: ${expected.runs.length} runs, ${expected.runs.reduce((sum, run) => sum + run.actions.length, 0)} actions; ${expectedPath}`);
  const execution = await runGodotComparison(expectedPath, reportPath, binary);
  let report;
  try { report = await readJson(reportPath); }
  catch { throw new Error(`Godot 未生成报告（exit=${execution.code}, signal=${execution.signal}）; run a headless editor import first`); }
  report = { ...report, startedAt, finishedAt: new Date().toISOString(), source, set,
    command, exitCode: execution.code, untested: [
      '真实窗口键鼠试玩与画面/字体/焦点验收',
      'GameSession、存档恢复与 Web 刷新持久化（W3）',
      'V2 内容、规则与平衡（W6）',
    ] };
  await writeJson(reportPath, report);
  if (execution.code !== 0 || report?.ok !== true) {
    await diagnoseFailure(report, directory);
    throw new Error(`Godot V1 对照失败：${report.failure?.message ?? report.error ?? `exit ${execution.code}`}`);
  }
  // A stale or partial output must never be presented as equivalence evidence.
  const actions = expected.runs.reduce((sum, run) => sum + run.actions.length, 0);
  const expectedHash = hash(expected);
  if (report.formatVersion !== 1 || report.expectedFile !== expectedPath
    || report.godotVersion !== GODOT_VERSION || report.set !== set || report.packId !== 'prototype'
    || !report.os || !report.cpu || !report.renderer || !report.startedAt || !report.finishedAt
    || !Array.isArray(report.untested) || report.untested.length === 0 || report.source?.commit !== source.commit
    || report.source?.dirty !== source.dirty || report.exitCode !== 0
    || JSON.stringify(report.command) !== JSON.stringify(command)
    || report.expectedSha256 !== expectedHash || hash(await readFile(expectedPath, 'utf8')) !== expectedHash
    || report.contentSha256 !== expected.contentSha256 || report.scenarioId !== expected.scenarioId
    || report.rulesVersion !== expected.rulesVersion || report.contentVersion !== expected.contentVersion
    || hash(report.seedSets) !== hash(expected.seedSets)
    || report.runs !== expected.runs.length || report.actions !== actions || report.states !== actions + expected.runs.length
    || execution.stderr.includes('SCRIPT ERROR') || execution.stderr.includes('Parse Error')) {
    throw new Error('Godot 返回了不完整或不匹配的对照报告');
  }
  console.log(`PASS ${set}: ${report.runs} runs, ${report.actions} actions, ${report.states} full states; ${((performance.now() - started) / 1000).toFixed(2)}s; report: ${reportPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(fail);
