import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PROTOTYPE_CONTENT } from '../src/game/prototype/index.ts';
import { ROOT, fail, hash, outputPath, parseOptions, readJson, verifyTrace } from './prototype-common.mjs';

try {
  const options = parseOptions(process.argv.slice(2), ['--file']);
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
} catch (error) {
  fail(error);
}
