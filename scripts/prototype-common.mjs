import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTOTYPE_CONTENT, createPrototype, getPrototypeActionError, prototypeReducer, summarizePrototypeRun } from '../src/game/prototype/index.ts';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const STRATEGIES = ['war-ready', 'network', 'labor'];
export const SEED_SETS = {
  development: Array.from({ length: 100 }, (_, index) => index + 1),
  holdout: Array.from({ length: 100 }, (_, index) => index + 10001),
};

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export function json(value) {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

export function hash(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : json(value)).digest('hex');
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, json(value), 'utf8');
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function parseOptions(args, valueFlags, booleanFlags = []) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (Object.hasOwn(options, flag)) throw new Error(`重复参数：${flag}`);
    if (booleanFlags.includes(flag)) options[flag] = true;
    else if (valueFlags.includes(flag)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`参数 ${flag} 缺少值`);
      options[flag] = value;
    } else throw new Error(`未知参数：${flag}`);
  }
  return options;
}

export function envelope(trace) {
  return {
    formatVersion: 1,
    scenarioId: PROTOTYPE_CONTENT.scenarioId,
    rulesVersion: PROTOTYPE_CONTENT.rulesVersion,
    contentVersion: PROTOTYPE_CONTENT.contentVersion,
    trace,
  };
}

export function verifyTrace(value, label = 'trace') {
  if (!value || value.formatVersion !== 1
    || value.scenarioId !== PROTOTYPE_CONTENT.scenarioId
    || value.rulesVersion !== PROTOTYPE_CONTENT.rulesVersion
    || value.contentVersion !== PROTOTYPE_CONTENT.contentVersion) {
    throw new Error(`${label}: 格式、情境、规则或内容版本不匹配`);
  }
  const trace = value.trace;
  if (!trace || !STRATEGIES.includes(trace.strategyId)
    || !Number.isInteger(trace.seed) || trace.seed < 0 || trace.seed > 0xffffffff
    || !Array.isArray(trace.actions) || !Array.isArray(trace.steps)
    || trace.actions.length !== trace.steps.length || trace.actions.length > 1000) {
    throw new Error(`${label}: 非法种子、动作或快照数量`);
  }
  let state = createPrototype(trace.seed);
  if (json(state) !== json(trace.initialState)) throw new Error(`${label}: 初态不匹配`);
  for (const [index, action] of trace.actions.entries()) {
    const step = trace.steps[index];
    if (json(action) !== json(step.action)) throw new Error(`${label}: 第 ${index + 1} 步动作与快照不同`);
    const error = getPrototypeActionError(state, action);
    if (error) throw new Error(`${label}: 第 ${index + 1} 步被拒绝：${error}`);
    state = prototypeReducer(state, action);
    if (json(state) !== json(step.state)) throw new Error(`${label}: 第 ${index + 1} 步状态漂移`);
  }
  if (json(state) !== json(trace.finalState)) throw new Error(`${label}: 最终状态漂移`);
  if (!state.ending) throw new Error(`${label}: 轨迹没有完成情境`);
  if (json(summarizePrototypeRun(state)) !== json(trace.summary)) throw new Error(`${label}: 结果摘要与最终状态不同`);
  return { steps: trace.actions.length, state };
}

export function outputPath(path) {
  return resolve(ROOT, path);
}

export function fail(error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
