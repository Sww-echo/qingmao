import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PROTOTYPE_CONTENT, simulateStrategy, validatePrototypeContent } from '../src/game/prototype/index.ts';
import { ROOT, STRATEGIES, envelope, fail, hash, json, parseOptions, verifyTrace, writeJson } from './prototype-common.mjs';

try {
  const options = parseOptions(process.argv.slice(2), [], ['--check']);
  const errors = validatePrototypeContent(PROTOTYPE_CONTENT);
  if (errors.length) throw new Error(`内容验证失败：${errors.join('；')}`);
  const outputs = new Map([['shared/prototype/content.json', PROTOTYPE_CONTENT]]);
  for (const strategy of STRATEGIES) {
    const value = envelope(simulateStrategy(strategy, 42));
    verifyTrace(value, strategy);
    outputs.set(`shared/fixtures/prototype/${strategy}-42.json`, value);
  }
  const manifest = {
    formatVersion: 1,
    scenarioId: PROTOTYPE_CONTENT.scenarioId,
    rulesVersion: PROTOTYPE_CONTENT.rulesVersion,
    contentVersion: PROTOTYPE_CONTENT.contentVersion,
    files: [...outputs].map(([path, value]) => ({ path, sha256: hash(value) })),
  };
  outputs.set('shared/prototype/manifest.json', manifest);
  for (const [path, value] of outputs) {
    if (options['--check']) {
      const saved = await readFile(join(ROOT, path), 'utf8');
      if (saved !== json(value)) throw new Error(`${path} 与规则源漂移，请确认版本后运行 npm run prototype:freeze`);
    } else await writeJson(join(ROOT, path), value);
  }
  console.log(`${options['--check'] ? '验证' : '生成'} ${outputs.size} 个冻结文件；规则 ${manifest.rulesVersion}，内容 ${manifest.contentVersion}`);
} catch (error) {
  fail(error);
}
