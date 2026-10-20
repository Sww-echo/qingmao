import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, fail, json, parseOptions, verifyTrace } from './prototype-common.mjs';
import { V1_VERSIONS, validateGodotContent } from './godot-content-validation.mjs';

const PACKS = {
  prototype: {
    contentDir: 'godot/content/generated/prototype',
    fixtureDir: 'godot/tests/fixtures/prototype',
    sources: [
      ['shared/prototype/content.json', 'godot/content/generated/prototype/content.json', 'content'],
      ...['war-ready', 'network', 'labor'].map(strategy => [
        `shared/fixtures/prototype/${strategy}-42.json`,
        `godot/tests/fixtures/prototype/${strategy}-42.json`, 'fixture',
      ]),
    ],
  },
  'qingmao14-v2': {
    contentDir: 'godot/content/generated/qingmao14-v2',
    fixtureDir: 'godot/tests/fixtures/qingmao14-v2',
    sources: [
      ['shared/scenarios/qingmao14-v2/content.json',
        'godot/content/generated/qingmao14-v2/content.json', 'content'],
    ],
  },
};
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function syncGodotContent({ root = ROOT, pack = 'prototype', check = false } = {}) {
  if (!['prototype', 'qingmao14-v2', 'all'].includes(pack)) throw new Error(`Unknown pack: ${pack}`);
  const packs = pack === 'all' ? Object.keys(PACKS) : [pack];
  let total = 0;
  let lastManifest = null;
  for (const packId of packs) {
    const result = await syncPack({ root, packId, check });
    total += result.files;
    lastManifest = result.manifest;
  }
  return { manifest: lastManifest, files: total };
}

async function syncPack({ root, packId, check }) {
  const definition = PACKS[packId];
  const outputs = new Map();
  const files = [];
  for (const [source, destination, kind] of definition.sources) {
    const bytes = await readFile(join(root, source));
    const value = JSON.parse(bytes.toString('utf8'));
    if (!bytes.equals(Buffer.from(json(value)))) throw new Error(`${source}: source is not canonical JSON`);
    if (kind === 'content') {
      const errors = validateGodotContent(value);
      if (errors.length) throw new Error(`${source}: ${errors.join('; ')}`);
    } else {
      verifyTrace(value, source);
      const strategy = source.split('/').at(-1).replace('-42.json', '');
      if (value.trace.strategyId !== strategy || value.trace.seed !== 42) throw new Error(`${source}: fixture identity mismatch`);
    }
    outputs.set(destination, bytes);
    files.push({ source, path: `res://${destination.slice('godot/'.length)}`, kind, sha256: sha256(bytes) });
  }
  let versions;
  if (packId === 'prototype') {
    const sourceManifest = await readFile(join(root, 'shared/prototype/manifest.json'));
    const expectedSourceManifest = {
      formatVersion: 1,
      ...V1_VERSIONS,
      files: files.map(file => ({ path: file.source, sha256: file.sha256 })),
    };
    if (!sourceManifest.equals(Buffer.from(json(expectedSourceManifest)))) {
      throw new Error('shared/prototype/manifest.json: source hashes/versions differ; check prototype:freeze');
    }
    versions = V1_VERSIONS;
  } else {
    versions = {
      scenarioId: 'qingmao-fourteen-day-v2',
      rulesVersion: 'qingmao-rules-2',
      contentVersion: 'qingmao-content-2',
    };
  }
  const manifest = { formatVersion: 1, packId, ...versions, files };
  outputs.set(`${definition.contentDir}/manifest.json`, Buffer.from(json(manifest)));

  // Generated directories are generated-only. Refuse stray files instead of
  // silently deleting them or leaving a stale resource that could enter an export.
  for (const directory of [definition.contentDir, definition.fixtureDir]) {
    const expected = [...outputs.keys()].filter(path => dirname(path) === directory).map(path => path.slice(directory.length + 1));
    let entries;
    try { entries = await readdir(join(root, directory)); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      entries = [];
    }
    const extra = entries.filter(entry => !expected.includes(entry));
    if (extra.length) throw new Error(`${directory}: unexpected generated files: ${extra.join(', ')}`);
  }
  for (const [path, bytes] of outputs) {
    if (check) {
      let saved;
      try { saved = await readFile(join(root, path)); } catch (error) {
        if (error.code === 'ENOENT') throw new Error(`${path}: missing generated output; run godot:sync-content`);
        throw error;
      }
      if (!saved.equals(bytes)) throw new Error(`${path}: generated content drift; run godot:sync-content`);
    } else {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), bytes);
    }
  }
  return { manifest, files: outputs.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseOptions(process.argv.slice(2), ['--pack'], ['--check']);
    const result = await syncGodotContent({ pack: options['--pack'] ?? 'prototype', check: !!options['--check'] });
    console.log(`${options['--check'] ? 'Checked' : 'Synced'} ${result.files} Godot files; ${result.manifest.rulesVersion}.`);
  } catch (error) {
    fail(error);
  }
}
