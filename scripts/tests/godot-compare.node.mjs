import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT, hash, json } from '../prototype-common.mjs';
import { buildExpected, diagnoseFailure, firstDifference } from '../godot-v1-compare.mjs';

async function sandbox(t) {
  const directory = await mkdtemp(join(tmpdir(), 'qingmao-v1-compare-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function replay(args) {
  return spawnSync(process.execPath, ['scripts/prototype-replay.mjs', ...args], { cwd: ROOT, encoding: 'utf8' });
}

test('development dump is a verified complete trace and is byte-identical to seed42 golden data', async t => {
  const directory = await sandbox(t);
  for (const policy of ['war-ready', 'network', 'labor']) {
    const destination = join(directory, `${policy}.json`);
    const result = replay(['--seed', '42', '--policy', policy, '--dump', destination]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(destination, 'utf8'), await readFile(join(ROOT, `shared/fixtures/prototype/${policy}-42.json`), 'utf8'));
  }
});

test('dump and comparison CLI reject missing, duplicate, conflicting and unknown options without writes', async t => {
  const directory = await sandbox(t);
  const destination = join(directory, 'untouched.json');
  await writeFile(destination, 'untouched');
  for (const args of [
    ['--dump', destination], ['--seed', '42'],
    ['--seed', '-1', '--policy', 'labor', '--dump', destination],
    ['--seed', '4294967296', '--policy', 'labor', '--dump', destination],
    ['--seed', '1.5', '--policy', 'labor', '--dump', destination],
    ['--seed', '1e1', '--policy', 'labor', '--dump', destination],
    ['--seed', '42', '--policy', 'unknown', '--dump', destination],
    ['--seed', '42', '--policy', 'labor', '--dump', destination, '--file', destination],
    ['--dump', destination, '--dump', destination], ['--unknown'],
  ]) {
    assert.notEqual(replay(args).status, 0, JSON.stringify(args));
    assert.equal(await readFile(destination, 'utf8'), 'untouched');
  }
  for (const args of [['--set', 'invalid'], ['--set'], ['--set', 'all', '--set', 'all'], ['--unknown']]) {
    const result = spawnSync(process.execPath, ['scripts/godot-v1-compare.mjs', ...args], { cwd: ROOT, encoding: 'utf8' });
    assert.notEqual(result.status, 0, JSON.stringify(args));
  }
});

test('first difference preserves array order and reports nested, missing and type mismatches', () => {
  assert.equal(firstDifference({ a: [1, { b: 'x' }] }, { a: [1, { b: 'x' }] }), null);
  assert.equal(firstDifference({ a: [1, { b: 'x' }] }, { a: [1, { b: 'y' }] }).path, '$["a"][1]["b"]');
  assert.equal(firstDifference([1], [1, 2]).path, '$.length');
  assert.equal(firstDifference({ a: null }, {}).actual, '<missing>');
  assert.deepEqual(firstDifference(null, {}), { path: '$', expected: null, actual: {} });
  assert.equal(firstDifference([1, 2], [2, 1]).path, '$[0]');
});

test('cohort generator includes initial and every full-state hash, ordered action chains and summaries', () => {
  const expected = buildExpected('development');
  assert.equal(expected.runs.length, 300);
  assert.deepEqual(expected.seedSets.development, Array.from({ length: 100 }, (_, index) => index + 1));
  assert.equal(new Set(expected.runs.map(run => run.runId)).size, 300);
  for (const run of expected.runs) {
    assert.equal(run.stateHashes.length, run.actions.length + 1);
    assert.equal(run.chainHashes[0], run.stateHashes[0]);
    for (const [index, action] of run.actions.entries()) {
      assert.equal(run.chainHashes[index + 1], hash(`${run.chainHashes[index]}\n${hash(action)}\n${run.stateHashes[index + 1]}\n`));
    }
    assert.ok(['shelter-secured', 'held-the-line', 'overrun', 'lost-in-bamboo'].includes(run.summary.endingId));
  }
  assert.throws(() => buildExpected('unknown'));
});

test('comparison refuses a stale successful report when the engine does not write a new one', async t => {
  const directory = await sandbox(t);
  const expected = buildExpected('development');
  const actions = expected.runs.reduce((sum, run) => sum + run.actions.length, 0);
  await writeFile(join(directory, 'v1-compare-development.json'), json({
    ok: true, expectedSha256: hash(expected), runs: expected.runs.length,
    actions, states: actions + expected.runs.length,
  }));
  const result = spawnSync(process.execPath, ['scripts/godot-v1-compare.mjs', '--out', directory], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, GODOT_BIN: '/usr/bin/true' }, timeout: 60000,
  });
  assert.notEqual(result.status, 0, result.stderr);
  assert.match(result.stderr, /未生成报告/);
});

test('full-state diagnostics localize a changed deterministic log and retain the reference trace', async t => {
  const directory = await sandbox(t);
  const trace = JSON.parse(await readFile(join(ROOT, 'shared/fixtures/prototype/war-ready-42.json'), 'utf8')).trace;
  const actual = structuredClone(trace.steps[0].state);
  actual.log[0].message = 'isolated corruption';
  const report = { expectedFile: '/isolated/expected.json', failure: {
    kind: 'state', runId: 'test/war-ready/42', strategyId: 'war-ready', seed: 42, step: 1,
    actualState: actual, expectedHash: hash(trace.steps[0].state), actualHash: hash(actual),
  } };
  const diagnostic = await diagnoseFailure(report, directory);
  assert.equal(diagnostic.difference.path, '$["log"][0]["message"]');
  assert.equal(await readFile(diagnostic.dumpPath, 'utf8'), await readFile(join(ROOT, 'shared/fixtures/prototype/war-ready-42.json'), 'utf8'));
});

test('real Godot comparison fails at isolated action/state/chain corruption and rejects incomplete cohorts', { skip: !process.env.GODOT_BIN }, async t => {
  const directory = await sandbox(t);
  const baseline = buildExpected('development');
  const expectedPath = join(directory, 'expected.json');
  const reportPath = join(directory, 'report.json');
  const mutations = [
    { kind: 'action', step: 1, mutate: data => { data.runs[0].actions[0] = { type: 'END_DAY' }; } },
    { kind: 'state', step: 1, mutate: data => { data.runs[0].stateHashes[1] = '0'.repeat(64); } },
    { kind: 'chain', step: 1, mutate: data => { data.runs[0].chainHashes[1] = '0'.repeat(64); } },
  ];
  for (const item of mutations) {
    const expected = structuredClone(baseline);
    item.mutate(expected);
    await writeFile(expectedPath, json(expected));
    const result = spawnSync(process.env.GODOT_BIN, ['--headless', '--path', join(ROOT, 'godot'), '--script',
      'res://tests/v1_compare.gd', '--', `--expected=${expectedPath}`, `--report=${reportPath}`], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    assert.equal(report.failure.kind, item.kind);
    assert.equal(report.failure.step, item.step);
    assert.equal(report.failure.runId, 'development/war-ready/1');
    assert.match(result.stderr, /expectedFile=/);
    const diagnostic = await diagnoseFailure(report, directory);
    if (item.kind === 'action') assert.equal(diagnostic.difference, null, 'actual policy still matches frozen TS; expected artifact alone is corrupted');
    else assert.equal(diagnostic.difference, null);
  }
  const incomplete = structuredClone(baseline);
  incomplete.runs.pop();
  await writeFile(expectedPath, json(incomplete));
  const result = spawnSync(process.env.GODOT_BIN, ['--headless', '--path', join(ROOT, 'godot'), '--script',
    'res://tests/v1_compare.gd', '--', `--expected=${expectedPath}`, `--report=${reportPath}`], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 2, result.stderr);
  assert.match(JSON.parse(await readFile(reportPath, 'utf8')).error, /cover every seed/);
  assert.equal(hash(baseline.runs[0].actions[0]), hash(buildExpected('development').runs[0].actions[0]), 'all corruptions were detached from the baseline');
});

test('real Godot configuration errors do not overwrite the expected input', { skip: !process.env.GODOT_BIN }, async t => {
  const directory = await sandbox(t);
  const expectedPath = join(directory, 'expected.json');
  const original = 'expected input must remain unchanged';
  await writeFile(expectedPath, original);
  const result = spawnSync(process.env.GODOT_BIN, ['--headless', '--path', join(ROOT, 'godot'), '--script',
    'res://tests/v1_compare.gd', '--', `--expected=${expectedPath}`, `--report=${expectedPath}`], {
    cwd: ROOT, encoding: 'utf8', timeout: 60000,
  });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /paths must be different/);
  assert.equal(await readFile(expectedPath, 'utf8'), original);
});
