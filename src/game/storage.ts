import { ORIGINS } from './content';
import {
  ALL_ENDINGS, ALL_GU, getCampaignEnemies, getCampaignEndings, getCampaignEvents, getCampaignGu,
  getCampaignLocations, getCampaignNpcs, getCampaignShop, getLocationError, isFangYuan, MAX_FANG_DAY,
} from './campaign';
import type { CampaignContext } from './campaign';
import { FANG_STEPS } from './fang-content';
import type { CombatState, Effects, GameState, JournalEntry, MetaProgress, Resources, RunEnding, SaveData } from './types';

const DATABASE_NAME = 'qingmao-game-v1';
const STORE_NAME = 'saves';
const SAVE_KEY = 'current';
const BACKUP_KEY = 'qingmao-game:save:v1';
const MAX_BYTES = 1024 * 1024;
const RESOURCE_KEYS = ['stones', 'herbs', 'ore', 'wine'] as const;
const EFFECT_STATS = ['hp', 'qi', 'cultivation', 'clues', 'trust', 'suspicion'] as const;
const MAX_COUNTER = 1_000_000_000;
const MAX_RUN_HISTORY = 20_000;

export const EMPTY_META: MetaProgress = {
  completedRuns: 0, endings: [], discoveredGu: [], lastRecordedRun: null, recordedRunIds: [],
};

function invalid(path: string, reason: string): never {
  throw new Error(`存档格式错误：${path}${reason}。`);
}

function object(value: unknown, path: string, allowed?: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid(path, '必须是对象');
  const result = value as Record<string, unknown>;
  if (allowed) {
    for (const key of Object.keys(result)) if (!allowed.includes(key)) invalid(`${path}.${key}`, '不是支持的字段');
  }
  return result;
}

function text(value: unknown, path: string, max = 4000, min = 0): string {
  if (typeof value !== 'string' || value.length < min || value.length > max) invalid(path, `必须是 ${min}–${max} 字符的文本`);
  return value;
}

function integer(value: unknown, path: string, min = 0, max = MAX_COUNTER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) invalid(path, `必须是 ${min}–${max} 之间的整数`);
  return value;
}

function member<T extends string | number>(value: unknown, allowed: readonly T[], path: string): T {
  for (const candidate of allowed) if (value === candidate) return candidate;
  invalid(path, '引用了未知或不支持的值');
}

function array(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) invalid(path, `必须是最多 ${max} 项的列表`);
  return value;
}

function strings(value: unknown, path: string, maxItems: number, maxLength: number, unique = true): string[] {
  const result = array(value, path, maxItems).map((item, index) => text(item, `${path}[${index}]`, maxLength, 1));
  if (unique && new Set(result).size !== result.length) invalid(path, '含有重复项');
  return result;
}

function campaignFlags(value: unknown, path: string, context: CampaignContext): string[] {
  const result = strings(value, path, 256, 100);
  if (isFangYuan(context)) {
    if (result.some(flag => !flag.startsWith('fy-') && !flag.startsWith('milestone-'))) invalid(path, '混入了其他篇章的记录');
  } else if (result.some(flag => flag.startsWith('fy-'))) invalid(path, '缺少方源篇的篇章信息');
  return result;
}

function references<T extends string>(value: unknown, allowed: readonly T[], path: string, max = allowed.length): T[] {
  const result = array(value, path, max).map((item, index) => member(item, allowed, `${path}[${index}]`));
  if (new Set(result).size !== result.length) invalid(path, '含有重复引用');
  return result;
}

function numberMap(value: unknown, path: string, allowed: readonly string[], min: number, max: number): Record<string, number> {
  const source = object(value, path, allowed);
  return Object.fromEntries(Object.entries(source).map(([key, amount]) => [key, integer(amount, `${path}.${key}`, min, max)]));
}

function resources(value: unknown, path: string): Resources {
  const source = object(value, path, RESOURCE_KEYS);
  return {
    stones: integer(source.stones, `${path}.stones`), herbs: integer(source.herbs, `${path}.herbs`),
    ore: integer(source.ore, `${path}.ore`), wine: integer(source.wine, `${path}.wine`),
  };
}

function effects(value: unknown, path: string, context: CampaignContext): Effects {
  const source = object(value, path, ['resources', ...EFFECT_STATS, 'addFlags', 'removeFlags', 'gu', 'relations']);
  const result: Effects = {};
  if (source.resources !== undefined) result.resources = numberMap(source.resources, `${path}.resources`, RESOURCE_KEYS, -1_000_000, 1_000_000);
  for (const key of EFFECT_STATS) if (source[key] !== undefined) result[key] = integer(source[key], `${path}.${key}`, -10_000, 10_000);
  if (source.addFlags !== undefined) result.addFlags = campaignFlags(source.addFlags, `${path}.addFlags`, context);
  if (source.removeFlags !== undefined) result.removeFlags = campaignFlags(source.removeFlags, `${path}.removeFlags`, context);
  if (source.gu !== undefined) result.gu = numberMap(source.gu, `${path}.gu`, getCampaignGu(context).map(gu => gu.id), -10_000, 10_000);
  if (source.relations !== undefined) result.relations = numberMap(source.relations, `${path}.relations`, getCampaignNpcs(context).map(npc => npc.id), -100, 100);
  return result;
}

function combat(value: unknown, context: CampaignContext): CombatState | null {
  if (value === null) return null;
  const source = object(value, '战斗', ['enemyId', 'enemyHp', 'enemyGuard', 'playerGuard', 'turn', 'victoryEffects', 'victoryText', 'victoryEnding', 'defeatEffects', 'log']);
  const enemyId = member(source.enemyId, getCampaignEnemies(context).map(enemy => enemy.id), '战斗.enemyId');
  const enemy = getCampaignEnemies(context).find(item => item.id === enemyId)!;
  const result: CombatState = {
    enemyId, enemyHp: integer(source.enemyHp, '战斗.enemyHp', 1, enemy.hp),
    enemyGuard: integer(source.enemyGuard, '战斗.enemyGuard', 0, 1000),
    playerGuard: integer(source.playerGuard, '战斗.playerGuard', 0, 1000),
    turn: integer(source.turn, '战斗.turn', 0, 1_000_000),
    victoryEffects: effects(source.victoryEffects, '战斗.victoryEffects', context),
    victoryText: text(source.victoryText, '战斗.victoryText'),
    defeatEffects: effects(source.defeatEffects, '战斗.defeatEffects', context),
    log: strings(source.log, '战斗.log', 12, 4000, false),
  };
  if (source.victoryEnding !== undefined) result.victoryEnding = member(source.victoryEnding, getCampaignEndings(context).map(ending => ending.id), '战斗.victoryEnding');
  return result;
}

function ending(value: unknown, context: CampaignContext): RunEnding | null {
  if (value === null) return null;
  const source = object(value, '结局', ['id', 'reason', 'outcome']);
  const result: RunEnding = {
    id: member(source.id, [...getCampaignEndings(context).map(item => item.id), 'departure'], '结局.id'),
    reason: text(source.reason, '结局.reason', 4000, 1),
    outcome: member(source.outcome, ['success', 'survived', 'defeat'] as const, '结局.outcome'),
  };
  if (result.id !== 'departure' && result.outcome !== 'success') invalid('结局', '的类别与结果不一致');
  if (isFangYuan(context) && result.id === 'departure' && result.outcome !== 'defeat') invalid('结局', '不能将方源篇结算为商队离山');
  return result;
}

function journal(value: unknown, day: number, nextLogId: number): JournalEntry[] {
  let previousId = 0;
  return array(value, '行记', 160).map((entry, index) => {
    const path = `行记[${index}]`;
    const source = object(entry, path, ['id', 'day', 'text', 'kind']);
    const id = integer(source.id, `${path}.id`, 1);
    if (id <= previousId || id >= nextLogId) invalid(`${path}.id`, '必须按时间递增且小于下一条记录编号');
    previousId = id;
    return {
      id, day: integer(source.day, `${path}.day`, 1, day), text: text(source.text, `${path}.text`, 6000),
      kind: member(source.kind, ['story', 'good', 'bad', 'info'] as const, `${path}.kind`),
    };
  });
}

function game(value: unknown): GameState {
  const source = object(value, '旅途', [
    'version', 'campaign', 'runId', 'seed', 'rng', 'name', 'origin', 'day', 'actions', 'location', 'hp', 'maxHp', 'qi', 'maxQi',
    'rank', 'cultivation', 'resources', 'clues', 'trust', 'suspicion', 'inventory', 'equipped', 'hungry', 'usedToday',
    'flags', 'relations', 'seenEvents', 'activeEvent', 'purchases', 'combat', 'ending', 'journal', 'nextLogId',
  ]);
  const campaign = source.campaign === undefined ? undefined : member(source.campaign, ['fang-yuan'] as const, '篇章');
  const context: CampaignContext = { campaign };
  const fang = isFangYuan(context);
  const rank = member(source.rank, fang ? [0, 1] as const : [1, 2] as const, '境界');
  const expectedHp = rank === 2 ? 36 : 28;
  const expectedQi = rank === 0 ? 0 : rank === 1 ? 12 : 16;
  const maxHp = integer(source.maxHp, '生命上限', expectedHp, expectedHp);
  const maxQi = integer(source.maxQi, '真元上限', expectedQi, expectedQi);
  const maxDay = fang ? MAX_FANG_DAY : 10;
  const day = integer(source.day, '日期', 1, maxDay);
  const nextLogId = integer(source.nextLogId, '下一条行记编号', 1);
  const name = text(source.name, '角色名', 18, 1);
  if (!name.trim()) invalid('角色名', '不能全部为空白');
  const guIds = getCampaignGu(context).map(gu => gu.id);
  const events = getCampaignEvents(context);
  const shop = getCampaignShop(context);
  const result: GameState = {
    version: member(source.version, [1] as const, '旅途版本'),
    ...(campaign ? { campaign } : {}),
    runId: text(source.runId, '旅途编号', 200, 1), seed: integer(source.seed, '随机种子', 0, 0xFFFFFFFF), rng: integer(source.rng, '随机进度', 0, 0xFFFFFFFF),
    name, origin: member(source.origin, ORIGINS.map(origin => origin.id), '出身'), day,
    actions: integer(source.actions, '剩余行动', 0, 3), location: member(source.location, getCampaignLocations(context).map(location => location.id), '地点'),
    hp: integer(source.hp, '生命', 0, maxHp), maxHp, qi: integer(source.qi, '真元', 0, maxQi), maxQi, rank,
    cultivation: integer(source.cultivation, '修为', 0, 10_000), resources: resources(source.resources, '资源'),
    clues: integer(source.clues, '情报', 0, 10_000), trust: integer(source.trust, '宗族信任', 0, 100), suspicion: integer(source.suspicion, '疑心', 0, 100),
    inventory: numberMap(source.inventory, '蛊囊', guIds, 1, 10_000), equipped: references(source.equipped, guIds, '装备', 4),
    hungry: references(source.hungry, guIds, '休眠蛊'), usedToday: references(source.usedToday, guIds, '当日携带记录'),
    flags: campaignFlags(source.flags, '剧情标记', context), relations: numberMap(source.relations, '人物关系', getCampaignNpcs(context).map(npc => npc.id), -100, 100),
    seenEvents: references(source.seenEvents, events.map(event => event.id), '事件历史'),
    activeEvent: source.activeEvent === null ? null : member(source.activeEvent, events.map(event => event.id), '当前事件'),
    purchases: numberMap(source.purchases, '购买记录', shop.map(item => item.id), 0, 10_000),
    combat: combat(source.combat, context), ending: ending(source.ending, context), journal: journal(source.journal, day, nextLogId), nextLogId,
  };
  if ([result.activeEvent, result.combat, result.ending].filter(Boolean).length > 1) invalid('当前阶段', '不能同时存在事件、战斗或结局');
  if (result.hp === 0 && result.ending?.outcome !== 'defeat') invalid('生命', '归零后必须已经按败退结算');
  for (const id of result.equipped) {
    if (!result.inventory[id]) invalid('装备', '引用了未持有的蛊');
    if (getCampaignGu(context).find(gu => gu.id === id)!.rank > rank) invalid('装备', '包含超出当前境界的蛊');
    if (!result.usedToday.includes(id)) invalid('当日携带记录', '遗漏了正在装备的蛊');
  }
  for (const id of result.hungry) if (!result.inventory[id]) invalid('休眠蛊', '引用了未持有的蛊');
  // usedToday may include ingredients already consumed by successful refinement.
  for (const [id, amount] of Object.entries(result.purchases)) {
    if (amount > shop.find(item => item.id === id)!.stock) invalid('购买记录', '超出了商店总库存');
  }
  if (result.activeEvent) {
    const active = events.find(event => event.id === result.activeEvent)!;
    if (active.location !== result.location || day < (active.dayMin ?? 1) || day > (active.dayMax ?? maxDay)) invalid('当前事件', '与地点或日期不一致');
    if (!active.repeatable && result.seenEvents.includes(active.id)) invalid('当前事件', '已经结束且不能重复触发');
  }
  if (fang) {
    if (result.name !== '古月方源' || result.origin !== 'disciple') invalid('主角', '必须是固定身份的古月方源');
    if ((rank === 1) !== result.flags.includes('fy-awakened')) invalid('境界', '与开窍记录不一致');
    for (let index = 0; index < FANG_STEPS.length; index += 1) {
      const step = FANG_STEPS[index]!;
      if (!result.flags.includes(step.flag)) continue;
      if (!result.seenEvents.includes(step.eventId) || (index > 0 && !result.flags.includes(FANG_STEPS[index - 1]!.flag))) invalid('章节进度', '缺少前置经历或已完成事件的记录');
    }
    const refined = result.flags.includes('fy-cicada-revealed');
    if (refined !== result.flags.includes('fy-liquor-refined') || refined !== result.flags.includes('fy-moonlight-refined')) invalid('炼化记录', '与春秋蝉显形的经历不一致');
    for (const id of guIds) {
      if ((result.inventory[id] ?? 0) !== (refined ? 1 : 0)) invalid('蛊囊', '与本章的唯一蛊虫及炼化记录不一致');
    }
    if (result.ending?.id === 'fy-first-gu' && !result.flags.includes('fy-first-gu-complete')) invalid('结局', '缺少报验完成记录');
    if (result.flags.includes('fy-first-gu-complete') && result.ending?.id !== 'fy-first-gu') invalid('章节进度', '报验后必须进入本章结算');
    if (getLocationError(result, result.location)) invalid('地点', '尚未随剧情开放');
    if (result.activeEvent) {
      const active = events.find(event => event.id === result.activeEvent)!;
      for (const requirement of active.requirements ?? []) {
        if (requirement.kind === 'flag' && result.flags.includes(requirement.key) !== (requirement.value ?? true)) invalid('当前事件', '与主线前置记录不一致');
      }
    }
  }
  return result;
}

function meta(value: unknown): MetaProgress {
  const source = object(value, '解锁记录', ['completedRuns', 'endings', 'discoveredGu', 'lastRecordedRun', 'recordedRunIds']);
  const completedRuns = integer(source.completedRuns, '完成次数');
  const lastRecordedRun = source.lastRecordedRun === null ? null : text(source.lastRecordedRun, '最近结算旅途', 200, 1);
  const recordedRunIds = source.recordedRunIds === undefined
    ? lastRecordedRun ? [lastRecordedRun] : []
    : strings(source.recordedRunIds, '已结算旅途', MAX_RUN_HISTORY, 200);
  if (lastRecordedRun && !recordedRunIds.includes(lastRecordedRun)) invalid('已结算旅途', '遗漏了最近一次结算');
  if (recordedRunIds.length > completedRuns) invalid('完成次数', '小于已结算旅途的数量');
  return {
    completedRuns, lastRecordedRun, recordedRunIds,
    endings: references(source.endings, ALL_ENDINGS.map(ending => ending.id), '已解锁结局'),
    discoveredGu: references(source.discoveredGu, ALL_GU.map(gu => gu.id), '已发现的蛊'),
  };
}

/** Parses untrusted files into fresh, checked values; no external object is asserted as SaveData. */
export function parseSave(serialized: string): SaveData {
  if (typeof serialized !== 'string') throw new Error('存档必须是 JSON 文本。');
  if (serialized.length > MAX_BYTES || new TextEncoder().encode(serialized).byteLength > MAX_BYTES) throw new Error('存档不能超过 1 MB。');
  let value: unknown;
  try {
    value = JSON.parse(serialized.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('存档不是有效的 JSON 文件。');
  }
  const source = object(value, '存档', ['version', 'savedAt', 'game', 'meta']);
  const version = member(source.version, [1] as const, '存档版本');
  const savedAt = text(source.savedAt, '保存时间', 32, 1);
  const timestamp = Date.parse(savedAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== savedAt) invalid('保存时间', '必须是有效的 ISO 时间');
  return { version, savedAt, game: game(source.game), meta: meta(source.meta) };
}

export function serializeSave(save: SaveData): string {
  const serialized = JSON.stringify(save, null, 2);
  parseSave(serialized);
  return serialized;
}

let latestTimestamp = 0;

export function createSave(currentGame: GameState, progress: MetaProgress): SaveData {
  // Distinct revisions must remain ordered even when two UI updates happen in one millisecond.
  latestTimestamp = Math.max(Date.now(), latestTimestamp + 1);
  return { version: 1, savedAt: new Date(latestTimestamp).toISOString(), game: structuredClone(currentGame), meta: structuredClone(progress) };
}

export function updateMeta(progress: MetaProgress, currentGame: GameState): MetaProgress {
  const recordedRunIds = [...new Set([...(progress.recordedRunIds ?? []), ...(progress.lastRecordedRun ? [progress.lastRecordedRun] : [])])];
  const endings = [...new Set(progress.endings)];
  const knownGu = new Set(ALL_GU.map(gu => gu.id));
  const discoveredGu = [...new Set([
    ...progress.discoveredGu,
    ...Object.entries(currentGame.inventory).filter(([, amount]) => amount > 0).map(([id]) => id),
    ...currentGame.usedToday,
  ])].filter(id => knownGu.has(id));
  let completedRuns = progress.completedRuns;
  let lastRecordedRun = progress.lastRecordedRun;
  if (currentGame.ending && !recordedRunIds.includes(currentGame.runId)) {
    recordedRunIds.push(currentGame.runId);
    completedRuns += 1;
    lastRecordedRun = currentGame.runId;
  }
  // Replaying a backup may achieve another route without creating a new journey.
  if (currentGame.ending?.outcome === 'success' && !endings.includes(currentGame.ending.id)) {
    endings.push(currentGame.ending.id);
  }
  return { completedRuns, endings, discoveredGu, lastRecordedRun, recordedRunIds };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('此环境不支持浏览器数据库。'));
      return;
    }
    let request: IDBOpenDBRequest;
    let settled = false;
    try {
      request = indexedDB.open(DATABASE_NAME, 1);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      settled = true;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => {
      if (!settled) {
        settled = true;
        reject(request.error ?? new Error('无法打开浏览器存档库。'));
      }
    };
    request.onblocked = () => {
      if (!settled) {
        settled = true;
        reject(new Error('存档库暂被其他页面占用。'));
      }
    };
  });
}

async function readDatabase(): Promise<unknown> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let stored: unknown;
    try {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(SAVE_KEY);
      request.onsuccess = () => { stored = request.result; };
      transaction.oncomplete = () => { database.close(); resolve(stored); };
      transaction.onabort = transaction.onerror = () => {
        database.close();
        reject(transaction.error ?? new Error('读取存档事务失败。'));
      };
    } catch (error) {
      database.close();
      reject(error);
    }
  });
}

async function writeDatabase(serialized: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onabort = transaction.onerror = () => {
        database.close();
        reject(transaction.error ?? new Error('写入存档事务失败。'));
      };
      transaction.objectStore(STORE_NAME).put(serialized, SAVE_KEY);
      // A successful put request is not a committed transaction. Resolve only above.
    } catch (error) {
      database.close();
      reject(error);
    }
  });
}

async function persist(serialized: string): Promise<void> {
  let committed = false;
  try {
    await writeDatabase(serialized);
    committed = true;
  } catch {
    // The backup is also used when database access is unavailable or blocked.
  }
  try {
    localStorage.setItem(BACKUP_KEY, serialized);
  } catch {
    if (!committed) throw new Error('无法保存：浏览器数据库和后备存储均写入失败。请导出备份保留当前进度。');
  }
}

let writeQueue: Promise<void> = Promise.resolve();

/** Snapshot immediately, then commit requests in invocation order. A failed write never poisons the queue. */
export function writeSave(save: SaveData): Promise<void> {
  let serialized: string;
  try {
    serialized = serializeSave(save);
    latestTimestamp = Math.max(latestTimestamp, Date.parse(save.savedAt));
  } catch (error) {
    return Promise.reject(error);
  }
  const request = writeQueue.then(() => persist(serialized));
  writeQueue = request.catch(() => undefined);
  return request;
}

function storedSave(value: unknown, source: string): SaveData | null {
  if (value === undefined || value === null) return null;
  try {
    return parseSave(typeof value === 'string' ? value : JSON.stringify(value));
  } catch (error) {
    throw new Error(`${source}中的存档已损坏，原数据未改动。${error instanceof Error ? error.message : '无法识别存档内容。'}`);
  }
}

/** Reads both stores without repairing or overwriting either; corrupted data is an explicit error. */
export async function loadSave(): Promise<SaveData | null> {
  await writeQueue;
  const [primary, backup] = await Promise.allSettled([
    readDatabase(), Promise.resolve().then(() => localStorage.getItem(BACKUP_KEY)),
  ]);
  if (primary.status === 'rejected' && backup.status === 'rejected') throw new Error('无法读取浏览器存档，数据库与后备存储均不可用。');
  const primarySave = primary.status === 'fulfilled' ? storedSave(primary.value, '浏览器数据库') : null;
  const backupSave = backup.status === 'fulfilled' ? storedSave(backup.value, '后备存储') : null;
  const newest = !primarySave ? backupSave : !backupSave ? primarySave
    : Date.parse(backupSave.savedAt) > Date.parse(primarySave.savedAt) ? backupSave : primarySave;
  if (newest) latestTimestamp = Math.max(latestTimestamp, Date.parse(newest.savedAt));
  return newest;
}
