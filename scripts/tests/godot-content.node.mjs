import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { PROTOTYPE_CONTENT } from '../../src/game/prototype/content.ts';
import { validatePrototypeContent } from '../../src/game/prototype/validation.ts';
import { ROOT, json } from '../prototype-common.mjs';
import { validateGodotContent } from '../godot-content-validation.mjs';
import { sha256, syncGodotContent } from '../godot-sync-content.mjs';

async function sandbox(t) {
  const root = await mkdtemp(join(tmpdir(), 'qingmao-godot-sync-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(join(ROOT, 'shared'), join(root, 'shared'), { recursive: true });
  return root;
}

async function snapshot(root) {
  const result = {};
  async function visit(path) {
    for (const entry of await readdir(join(root, path), { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) await visit(child);
      else result[child] = sha256(await readFile(join(root, child)));
    }
  }
  await visit('godot');
  return result;
}

test('V1 delegates to the frozen validator, rejects unsupported versions and schema extensions', () => {
  assert.deepEqual(validateGodotContent(PROTOTYPE_CONTENT), []);
  const mutations = [
    content => { content.scenarioId = 'qingmao-fourteen-day-v2'; },
    content => { content.rulesVersion = 'qingmao-rules-2'; },
    content => { content.contentVersion = 'qingmao-content-2'; },
    content => { content.parameters.inquiryThreshold = 4; },
    content => { content.enemies.push({ ...content.enemies[0], id: 'crisis-alpha' }); },
    content => { content.enemies[1].next = 'crisis-alpha'; },
    content => { content.events[0].next = 'academy-briefing'; },
    content => { content.parameters.days = 13; },
    content => { content.parameters.trainingGain = 1.5; },
    content => { content.events[0].location = 'unknown'; },
    content => { content.events[0].choices[0].costs.suspicion = 2; },
    content => { content.events[0].choices[0].effects.push({ kind: 'flag', id: 'crisis-arrived' }); },
    content => { content.events[0].title = 'control\ncharacter'; },
    content => { content['非ASCII'] = true; },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const content = structuredClone(PROTOTYPE_CONTENT);
    mutate(content);
    assert.ok(validateGodotContent(content).length > 0, `negative case ${index}`);
    if (index >= 3 && index <= 11) {
      assert.deepEqual(validateGodotContent(content), validatePrototypeContent(content), `V1 delegation ${index}`);
    }
  }
});

test('malformed V1 JSON values return errors without throwing or mutating input', () => {
  for (const mutate of [
    content => { content.events[0].id = { toString: null }; },
    content => { content.events[0].requirements = [{ kind: 'gu', id: { toString: null }, usable: true }]; },
    content => { content.events[0].choices[0].effects = [null, [], 5]; },
    content => { content.events[0].choices = { toString: null }; },
    content => {
      let nested = {};
      content.unexpected = nested;
      for (let depth = 0; depth < 200; depth += 1) nested = nested.next = {};
    },
  ]) {
    const content = structuredClone(PROTOTYPE_CONTENT);
    mutate(content);
    const before = structuredClone(content);
    assert.ok(validateGodotContent(content).length > 0);
    assert.deepEqual(content, before);
  }
});

test('sync writes byte-identical copies with source hashes; check is read-only and detects drift', async t => {
  const root = await sandbox(t);
  const result = await syncGodotContent({ root });
  assert.equal(result.files, 5);
  for (const file of result.manifest.files) {
    const source = await readFile(join(root, file.source));
    const copy = await readFile(join(root, 'godot', file.path.slice('res://'.length)));
    assert.deepEqual(copy, source);
    assert.equal(sha256(source), file.sha256);
  }
  const before = await snapshot(root);
  await syncGodotContent({ root, check: true });
  assert.deepEqual(await snapshot(root), before);
  const path = join(root, 'godot/content/generated/prototype/content.json');
  const original = await readFile(path);
  await writeFile(path, Buffer.concat([original, Buffer.from(' ')]));
  const tampered = await snapshot(root);
  await assert.rejects(syncGodotContent({ root, check: true }), /drift/);
  assert.deepEqual(await snapshot(root), tampered, 'failed check must not repair or rewrite');
  await syncGodotContent({ root });
  assert.deepEqual(await snapshot(root), before);
});

test('check detects changed manifest, missing outputs, stale files, and never creates missing directories', async t => {
  const root = await sandbox(t);
  await assert.rejects(syncGodotContent({ root, check: true }), /missing/);
  await assert.rejects(readdir(join(root, 'godot')), /ENOENT/);
  await syncGodotContent({ root });
  const manifest = join(root, 'godot/content/generated/prototype/manifest.json');
  await writeFile(manifest, '{}\n');
  await assert.rejects(syncGodotContent({ root, check: true }), /drift/);
  await syncGodotContent({ root });
  await rm(join(root, 'godot/tests/fixtures/prototype/labor-42.json'));
  await assert.rejects(syncGodotContent({ root, check: true }), /missing/);
  await syncGodotContent({ root });
  await writeFile(join(root, 'godot/content/generated/prototype/stale.json'), '{}\n');
  await assert.rejects(syncGodotContent({ root, check: true }), /unexpected/);
});

test('bad source hash fails before any writes; unavailable V2/all/unknown packs fail', async t => {
  const root = await sandbox(t);
  await writeFile(join(root, 'shared/prototype/manifest.json'), '{}\n');
  await assert.rejects(syncGodotContent({ root }), /source hashes/);
  await assert.rejects(readdir(join(root, 'godot')), /ENOENT/);
  for (const pack of ['qingmao14-v2', 'all', 'no-such-pack']) {
    await assert.rejects(syncGodotContent({ root, pack }), /pack|W6/);
  }
});

test('CLI rejects unknown, duplicate, missing and conflicting values without writes', async () => {
  for (const args of [
    ['--unknown'], ['--pack'], ['--pack', '--check'],
    ['--pack', 'prototype', '--pack', 'prototype'], ['--check', '--check'],
    ['--pack', 'all'], ['--pack', 'qingmao14-v2'], ['--pack', 'unknown'],
    ['--pack=prototype'],
  ]) {
    const result = spawnSync(process.execPath, ['scripts/godot-sync-content.mjs', ...args], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(result.status, 1, `${args.join(' ')}: ${result.stderr}`);
  }
});

test('Godot runner distinguishes missing inputs, assertions and invalid arguments', {
  skip: !process.env.GODOT_BIN && 'Set GODOT_BIN to run process-level Godot checks',
}, async t => {
  const root = await mkdtemp(join(tmpdir(), 'qingmao-godot-runner-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'tests/suites'), { recursive: true });
  await cp(join(ROOT, 'godot/tests/run_all.gd'), join(root, 'tests/run_all.gd'));
  await writeFile(join(root, 'project.godot'), 'config_version=5\n');
  function run(args) {
    return spawnSync(process.env.GODOT_BIN, [
      '--headless', '--path', root, '--script', 'res://tests/run_all.gd', '--', ...args,
    ], { encoding: 'utf8', timeout: 30000 });
  }
  for (const name of ['canonical_json', 'state_codec', 'content_validation']) {
    const result = run([`--suite=${name}`]);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /missing input res:\/\/content\/generated\/prototype\/content.json/);
  }
  await mkdir(join(root, 'content/generated/prototype'), { recursive: true });
  await cp(join(ROOT, 'shared/prototype/content.json'), join(root, 'content/generated/prototype/content.json'));
  const missingFixture = run(['--suite=state_codec']);
  assert.equal(missingFixture.status, 2, missingFixture.stderr);
  assert.match(missingFixture.stderr, /missing input res:\/\/tests\/fixtures/);
  const missingManifest = run(['--suite=content_validation']);
  assert.equal(missingManifest.status, 2, missingManifest.stderr);
  assert.match(missingManifest.stderr, /missing input .*manifest.json/);
  for (const args of [['--suite=unknown'], ['--suite'], ['--unknown'], ['--suite=rng_vectors', '--suite=smoke']]) {
    const result = run(args);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /Suite configuration error/);
  }
  await writeFile(join(root, 'tests/suites/rng_vectors_suite.gd'),
    'extends RefCounted\nfunc run(_tree: SceneTree) -> Dictionary:\n\treturn {"checks": 1, "failures": PackedStringArray(["injected assertion"])}\n');
  const failed = run(['--suite=rng_vectors']);
  assert.equal(failed.status, 1, failed.stderr);
  assert.match(failed.stderr, /injected assertion/);
});

test('Godot loader rejects malformed fixture hashes without requiring runtime fixtures', {
  skip: !process.env.GODOT_BIN && 'Set GODOT_BIN to run process-level Godot checks',
}, async t => {
  const root = await mkdtemp(join(tmpdir(), 'qingmao-godot-loader-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of ['domain', 'infrastructure', 'content']) {
    await cp(join(ROOT, 'godot', directory), join(root, directory), { recursive: true });
  }
  await writeFile(join(root, 'project.godot'), 'config_version=5\n');
  await writeFile(join(root, 'probe.gd'), [
    'extends SceneTree',
    'const Loader = preload("res://infrastructure/content_loader.gd")',
    'func _init() -> void:',
    '\tvar result: Dictionary = Loader.load_pack("prototype")',
    '\tif not result.ok:',
    '\t\tprinterr(result.error)',
    '\tquit(0 if result.ok else 1)',
    '',
  ].join('\n'));
  const imported = spawnSync(process.env.GODOT_BIN, ['--headless', '--path', root, '--editor', '--quit'], {
    encoding: 'utf8', timeout: 30000,
  });
  assert.equal(imported.status, 0, imported.stderr);
  function run() {
    return spawnSync(process.env.GODOT_BIN, ['--headless', '--path', root, '--script', 'res://probe.gd'], {
      encoding: 'utf8', timeout: 30000,
    });
  }
  const valid = run();
  assert.equal(valid.status, 0, valid.stderr);
  const manifestPath = join(root, 'content/generated/prototype/manifest.json');
  const original = JSON.parse(await readFile(manifestPath, 'utf8'));
  for (const hash of ['x', '0'.repeat(63), 'A'.repeat(64), 'g'.repeat(64)]) {
    const manifest = structuredClone(original);
    manifest.files.find(file => file.kind === 'fixture').sha256 = hash;
    await writeFile(manifestPath, json(manifest));
    const invalid = run();
    assert.equal(invalid.status, 1, invalid.stderr);
    assert.match(invalid.stderr, /invalid file SHA256/);
  }
});
