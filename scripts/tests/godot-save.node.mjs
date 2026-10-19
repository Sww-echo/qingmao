import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT } from '../prototype-common.mjs';

for (const stage of [
  'tmp-write', 'tmp-flush', 'tmp-read', 'backup-remove', 'current-rotate',
  'promotion-failed', 'final-invalid', 'promoted',
]) {
  test(`save process interruption → restart: ${stage}`, {
    skip: !process.env.GODOT_BIN && 'Set GODOT_BIN to run real-process save interruption checks',
  }, async t => {
    const root = await mkdtemp(join(tmpdir(), 'qingmao-save-restart-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const run = (mode, point) => spawnSync(process.env.GODOT_BIN, [
      '--headless', '--path', join(ROOT, 'godot'),
      '--script', 'res://tests/save_interruption.gd', '--', root, mode, point,
    ], { encoding: 'utf8', timeout: 30000 });
    const seeded = run('seed', '-');
    assert.equal(seeded.status, 0, seeded.stderr);
    const interrupted = run('interrupt', stage);
    assert.equal(interrupted.signal, 'SIGKILL', interrupted.stderr);
    assert.match(interrupted.stdout, new RegExp(`INTERRUPT ${stage}`));
    const restarted = run('verify', stage === 'promoted' ? '2' : '1');
    assert.equal(restarted.status, 0, restarted.stderr);
    assert.match(restarted.stdout, /RESTORED revision=/);
  });
}
