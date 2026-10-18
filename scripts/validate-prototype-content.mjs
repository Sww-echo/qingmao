import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { PROTOTYPE_CONTENT, validatePrototypeContent } from '../src/game/prototype/index.ts';
import { ROOT, fail, json } from './prototype-common.mjs';

try {
  if (process.argv.length > 2) throw new Error('content:validate 不接受参数');
  const sourceErrors = validatePrototypeContent(PROTOTYPE_CONTENT);
  if (sourceErrors.length) throw new Error(`内容源非法：${sourceErrors.join('；')}`);
  const exported = JSON.parse(await readFile(join(ROOT, 'shared/prototype/content.json'), 'utf8'));
  const exportedErrors = validatePrototypeContent(exported);
  if (exportedErrors.length) throw new Error(`导出内容非法：${exportedErrors.join('；')}`);
  if (json(exported) !== json(PROTOTYPE_CONTENT)) throw new Error('导出 JSON 与权威内容源不同');
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts/prototype-freeze.mjs'), '--check'], { cwd: ROOT, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('冻结夹具或清单校验失败');
  console.log('内容 ID、引用、参数与冻结文件验证通过。');
} catch (error) {
  fail(error);
}
