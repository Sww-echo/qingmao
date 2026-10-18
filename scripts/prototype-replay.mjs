import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PROTOTYPE_CONTENT, simulateStrategy } from '../src/game/prototype/index.ts';
import { ROOT, STRATEGIES, envelope, fail, hash, outputPath, parseOptions, readJson, verifyTrace, writeJson } from './prototype-common.mjs';

try {
  const options = parseOptions(process.argv.slice(2), ['--file', '--seed', '--policy', '--dump']);
  const dumping = options['--dump'] !== undefined;
  if (dumping || options['--seed'] !== undefined || options['--policy'] !== undefined) {
    if (!dumping || options['--seed'] === undefined || !STRATEGIES.includes(options['--policy']) || options['--file']) {
      throw new Error('--dump 需要 --seed uint32 和 --policy war-ready|network|labor，不能与 --file 混用');
    }
    const seed = Number(options['--seed']);
    if (!/^\d+$/.test(options['--seed']) || !Number.isInteger(seed) || seed > 0xffffffff) throw new Error('种子必须是 uint32 整数');
    const value = envelope(simulateStrategy(options['--policy'], seed));
    const result = verifyTrace(value, 'development dump');
    const destination = outputPath(options['--dump']);
    await writeJson(destination, value);
    console.log(`DUMP ${destination}: ${result.steps} 次合法操作，逐步状态一致（仅开发诊断）`);
  } else {
    let paths;
    if (options['--file']) paths = [outputPath(options['--file'])];
    else {
      const manifest = await readJson(join(ROOT, 'shared/prototype/manifest.json'));
      if (manifest.formatVersion !== 1 || manifest.scenarioId !== PROTOTYPE_CONTENT.scenarioId
        || manifest.rulesVersion !== PROTOTYPE_CONTENT.rulesVersion
        || manifest.contentVersion !== PROTOTYPE_CONTENT.contentVersion || !Array.isArray(manifest.files)) {
        throw new Error('冻结清单格式或版本不匹配');
      }
      const expectedPaths = new Set(['shared/prototype/content.json',
        'shared/fixtures/prototype/war-ready-42.json', 'shared/fixtures/prototype/network-42.json', 'shared/fixtures/prototype/labor-42.json']);
      paths = [];
      for (const item of manifest.files) {
        if (!item || !expectedPaths.delete(item.path) || !/^[a-f0-9]{64}$/.test(item.sha256)) {
          throw new Error('冻结清单包含未知、重复文件或非法 SHA256');
        }
        const path = join(ROOT, item.path);
        const raw = await readFile(path, 'utf8');
        if (hash(raw) !== item.sha256) throw new Error(`${item.path}: SHA256 与冻结清单不同`);
        if (item.path.startsWith('shared/fixtures/prototype/')) paths.push(path);
      }
      if (expectedPaths.size) throw new Error('冻结清单缺少必需文件');
      if (!paths.length) throw new Error('清单中没有动作轨迹');
    }
    for (const path of paths) {
      const result = verifyTrace(await readJson(path), path);
      console.log(`PASS ${path}: ${result.steps} 次合法操作，逐步状态一致`);
    }
  }
} catch (error) {
  fail(error);
}
