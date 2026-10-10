import { ENEMIES, ENDINGS, EVENTS, GU, LOCATIONS, ORIGINS, RECIPES, SHOP } from './content';
import type {
  EffectiveStats, Effects, EndingId, EnemyMove, EventChoice, EventDef, GameAction, GameState,
  GuDef, OriginId, RecipeDef, Requirement, ResourceKey, Resources,
} from './types';

const RESOURCE_KEYS: ResourceKey[] = ['stones', 'herbs', 'ore', 'wine'];
const RESOURCE_NAMES: Record<ResourceKey, string> = { stones: '元石', herbs: '药草', ore: '矿料', wine: '酒' };
const STAT_NAMES = { hp: '生命', qi: '真元', cultivation: '修为', clues: '情报', trust: '宗族信任', suspicion: '疑心', rank: '境界', day: '日期' };
const DAILY_ACTIONS = 3;
const LAST_DAY = 10;
const EQUIPMENT_LIMIT = 4;
const BASE_ATTACK = 3;
const BASE_GUARD = 4;

export interface CombatForecast {
  intent: EnemyMove;
  passiveGuard: number;
  incomingDamage: number;
  defendingDamage: number;
  qiLoss: number;
  retreatChance: number;
  danger: boolean;
}

const unique = <T,>(values: T[]): T[] => [...new Set(values)];
const finite = (value: number | undefined, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const count = (value: number | undefined): number => Math.max(0, Math.floor(finite(value)));
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, finite(value)));
const guById = (id: string): GuDef | undefined => GU.find(gu => gu.id === id);
const owned = (state: GameState, id: string): number => count(state.inventory[id]);
const usable = (state: GameState, id: string): boolean => owned(state, id) > 0 && state.equipped.includes(id) && !state.hungry.includes(id) && !!guById(id) && guById(id)!.rank <= state.rank;

function cloneEffects(effects: Effects): Effects {
  return { ...effects, resources: effects.resources && { ...effects.resources }, gu: effects.gu && { ...effects.gu }, relations: effects.relations && { ...effects.relations }, addFlags: effects.addFlags && [...effects.addFlags], removeFlags: effects.removeFlags && [...effects.removeFlags] };
}

function cloneGame(state: GameState): GameState {
  return {
    ...state, resources: { ...state.resources }, inventory: { ...state.inventory },
    equipped: [...state.equipped], hungry: [...state.hungry], usedToday: [...state.usedToday],
    flags: [...state.flags], relations: { ...state.relations }, seenEvents: [...state.seenEvents],
    purchases: { ...state.purchases }, journal: [...state.journal], ending: state.ending && { ...state.ending },
    combat: state.combat && { ...state.combat, victoryEffects: cloneEffects(state.combat.victoryEffects), defeatEffects: cloneEffects(state.combat.defeatEffects), log: [...state.combat.log] },
  };
}

function log(state: GameState, text: string, kind: 'story' | 'good' | 'bad' | 'info' = 'info'): void {
  state.journal.push({ id: state.nextLogId++, day: state.day, text, kind });
  if (state.journal.length > 160) state.journal = state.journal.slice(-160);
}

function normalize(state: GameState): void {
  for (const key of RESOURCE_KEYS) state.resources[key] = count(state.resources[key]);
  state.hp = clamp(state.hp, 0, state.maxHp);
  state.qi = clamp(state.qi, 0, state.maxQi);
  state.actions = clamp(state.actions, 0, DAILY_ACTIONS);
  state.cultivation = count(state.cultivation);
  state.clues = count(state.clues);
  state.trust = clamp(state.trust, 0, 100);
  state.suspicion = clamp(state.suspicion, 0, 100);
  for (const id of Object.keys(state.inventory)) {
    const amount = owned(state, id);
    if (!guById(id) || !amount) delete state.inventory[id];
    else state.inventory[id] = amount;
  }
  state.equipped = unique(state.equipped).filter(id => owned(state, id) > 0 && guById(id)!.rank <= state.rank).slice(0, EQUIPMENT_LIMIT);
  state.hungry = unique(state.hungry).filter(id => owned(state, id) > 0);
  // Keep already consumed ingredients here: using or carrying them earlier still incurred today's upkeep.
  state.usedToday = unique(state.usedToday).filter(id => !!guById(id));
  state.flags = unique(state.flags);
  state.seenEvents = unique(state.seenEvents);
  for (const id of Object.keys(state.relations)) state.relations[id] = clamp(state.relations[id], -100, 100);
}

function applyEffects(state: GameState, effects: Effects): void {
  for (const key of RESOURCE_KEYS) state.resources[key] += finite(effects.resources?.[key]);
  for (const key of ['hp', 'qi', 'cultivation', 'clues', 'trust', 'suspicion'] as const) state[key] += finite(effects[key]);
  for (const [id, amount] of Object.entries(effects.gu ?? {})) {
    if (guById(id)) state.inventory[id] = owned(state, id) + finite(amount);
  }
  for (const [id, amount] of Object.entries(effects.relations ?? {})) state.relations[id] = finite(state.relations[id]) + finite(amount);
  state.flags = unique([...state.flags, ...(effects.addFlags ?? [])]).filter(flag => !effects.removeFlags?.includes(flag));
  normalize(state);
}

function finish(state: GameState, id: EndingId, reason: string, outcome: 'success' | 'survived' | 'defeat'): void {
  state.ending = { id, reason, outcome };
  state.combat = null;
  state.activeEvent = null;
  log(state, `${ENDINGS.find(ending => ending.id === id)?.title ?? '旅途结束'}：${reason}`, outcome === 'success' ? 'good' : outcome === 'defeat' ? 'bad' : 'story');
}

function checkLife(state: GameState): void {
  if (state.hp <= 0 && !state.ending) finish(state, 'departure', '伤势过重，你的青茅山之行止步于此。此次按败退结算。', 'defeat');
}

function random(state: GameState): number {
  state.rng = (state.rng + 0x6D2B79F5) >>> 0;
  let value = state.rng;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
}

function requirementError(state: GameState, requirement: Requirement): string | null {
  if (requirement.kind === 'resource') {
    return finite(state.resources[requirement.key]) >= requirement.min ? null : `${RESOURCE_NAMES[requirement.key]}不足，需要 ${requirement.min}。`;
  }
  if (requirement.kind === 'stat') {
    const value = state[requirement.key];
    if (requirement.min !== undefined && value < requirement.min) return `${STAT_NAMES[requirement.key]}需达到 ${requirement.min}。`;
    if (requirement.max !== undefined && value > requirement.max) return `${STAT_NAMES[requirement.key]}需不高于 ${requirement.max}。`;
    return null;
  }
  if (requirement.kind === 'flag') {
    const required = requirement.value ?? true;
    return state.flags.includes(requirement.key) === required ? null : required ? '尚未完成这条路线的前置事件。' : '此前的选择已改变了这条路线。';
  }
  const gu = guById(requirement.id);
  if (!gu) return '所需蛊虫资料不存在。';
  const needed = Math.max(1, count(requirement.count ?? 1));
  if (owned(state, gu.id) < needed) return `需要 ${needed} 只${gu.name}，目前持有 ${owned(state, gu.id)} 只。`;
  if (requirement.equipped && !usable(state, gu.id)) return `需要装备醒着的${gu.name}。`;
  return null;
}

function requirementsError(state: GameState, requirements: Requirement[] = []): string | null {
  for (const requirement of requirements) {
    const error = requirementError(state, requirement);
    if (error) return error;
  }
  return null;
}

function effectsError(state: GameState, effects: Effects, reserve: Partial<Resources> = {}): string | null {
  for (const key of RESOURCE_KEYS) {
    const needed = count(reserve[key]) + Math.max(0, -finite(effects.resources?.[key]));
    if (finite(state.resources[key]) < needed) return `${RESOURCE_NAMES[key]}不足，需要 ${needed}，现有 ${count(state.resources[key])}。`;
  }
  if (effects.qi !== undefined && effects.qi < 0 && state.qi < -effects.qi) return `真元不足，需要 ${-effects.qi}。`;
  for (const [id, amount] of Object.entries(effects.gu ?? {})) {
    const gu = guById(id);
    if (!gu || !Number.isInteger(amount)) return '蛊虫资料无效。';
    if (amount < 0 && owned(state, id) < -amount) return `${gu.name}不足，需要 ${-amount} 只，现有 ${owned(state, id)} 只。`;
  }
  return null;
}

function recipeCost(recipe: RecipeDef, safe: boolean): Partial<Resources> {
  const resources: Partial<Resources> = {};
  for (const key of RESOURCE_KEYS) resources[key] = count(recipe.resources[key]) + (safe ? count(recipe.safeExtra[key]) : 0);
  return resources;
}

function upkeepIds(state: GameState): string[] {
  return unique([...state.usedToday, ...state.equipped.filter(id => owned(state, id) > 0)]).filter(id => !!guById(id));
}

/** Cost of the current day's carried Gu, including Gu unequipped later that day. */
export function getUpkeep(state: GameState): number {
  return upkeepIds(state).reduce((sum, id) => sum + count(guById(id)?.upkeep), 0);
}

/** Attack/guard include the ordinary move's base value; all other values are bonuses. */
export function getEffectiveStats(state: GameState): EffectiveStats {
  const stats: EffectiveStats = { attack: BASE_ATTACK, guard: BASE_GUARD, scouting: 0, storage: 0, escape: 0 };
  for (const id of unique(state.equipped)) {
    if (!usable(state, id)) continue;
    const gu = guById(id)!;
    if (!gu.passive) continue;
    if (gu.ability === 'power') stats.attack += gu.power;
    else if (gu.ability === 'guard') stats.guard += gu.power;
    else if (gu.ability === 'scout') stats.scouting += gu.power;
    else if (gu.ability === 'storage') stats.storage += gu.power;
    else if (gu.ability === 'escape') stats.escape += gu.power;
  }
  return stats;
}

const attackDamage = (power: number, passiveGuard: number, playerGuard: number): number => Math.max(1, power - passiveGuard - playerGuard);
const retreatPercent = (escape: number): number => Math.min(100, 60 + Math.max(0, escape) * 10);

/** Describes the displayed enemy intent without taking an action or drawing random numbers. */
export function getCombatForecast(state: GameState): CombatForecast | null {
  if (!state.combat || state.ending) return null;
  const combat = state.combat;
  const enemy = ENEMIES.find(item => item.id === combat.enemyId);
  const intent = enemy?.moves[combat.turn % enemy.moves.length];
  if (!intent) return null;
  const stats = getEffectiveStats(state);
  const passiveGuard = Math.max(0, stats.guard - BASE_GUARD);
  const incomingDamage = intent.type === 'attack' ? attackDamage(intent.power, passiveGuard, combat.playerGuard) : 0;
  return {
    intent: { ...intent }, passiveGuard, incomingDamage,
    defendingDamage: intent.type === 'attack' ? attackDamage(intent.power, passiveGuard, BASE_GUARD) : 0,
    qiLoss: intent.type === 'drain' ? Math.min(state.qi, intent.power) : 0,
    retreatChance: retreatPercent(stats.escape),
    danger: intent.type === 'attack' && incomingDamage >= state.hp,
  };
}

export function getAvailableEvents(state: GameState): EventDef[] {
  if (state.ending || state.combat || state.activeEvent) return [];
  return EVENTS.filter(event => event.location === state.location
    && (event.dayMin === undefined || state.day >= event.dayMin)
    && (event.dayMax === undefined || state.day <= event.dayMax)
    && (event.repeatable || !state.seenEvents.includes(event.id))
    && !requirementsError(state, event.requirements))
    .sort((a, b) => b.priority - a.priority);
}

/** Checks a choice's own conditions; CHOOSE separately checks membership in the active event. */
export function getChoiceError(state: GameState, choice: EventChoice): string | null {
  if (state.ending) return '本次旅途已经结束。';
  if (state.combat) return '请先完成当前战斗。';
  if (choice.encounterId && !ENEMIES.some(enemy => enemy.id === choice.encounterId)) return '这一场遭遇的资料缺失。';
  return requirementsError(state, choice.requirements) ?? effectsError(state, choice.effects);
}

export function getActionError(state: GameState, action: GameAction): string | null {
  if (state.ending) return '本次旅途已经结束，可在结算后开启新局。';
  if (state.combat && action.type !== 'COMBAT') return '请先完成当前战斗。';
  if (state.activeEvent && action.type !== 'CHOOSE') return '请先为当前事件作出选择。';
  const timed = ['EXPLORE', 'ACTIVITY', 'TRAIN', 'REST', 'BREAKTHROUGH', 'CRAFT'];
  if (timed.includes(action.type) && state.actions < 1) return '今日行动已用完，请结束当日。';
  switch (action.type) {
    case 'TRAVEL':
      if (!LOCATIONS.some(location => location.id === action.location)) return '目的地不存在。';
      return action.location === state.location ? '你已经在这里了。' : null;
    case 'EXPLORE': {
      const available = getAvailableEvents(state);
      if (action.eventId !== undefined && !available.some(event => event.id === action.eventId)) return '此事件目前不可选择，请选择当前地点可见的事件。';
      return available.length ? null : '此地暂时没有新事件，可进行当地活动或前往其他地点。';
    }
    case 'ACTIVITY': {
      const location = LOCATIONS.find(item => item.id === state.location);
      return location ? effectsError(state, location.activity.effects) : '地点资料缺失。';
    }
    case 'TRAIN':
      return state.qi < 3 ? '修炼需要 3 点真元，先休息或结束当日。' : null;
    case 'REST':
    case 'END_DAY':
      return null;
    case 'BREAKTHROUGH':
      if (state.rank >= 2) return '已达首章的二转境界。';
      if (state.cultivation < 12) return '突破二转需要 12 点修为。';
      return state.resources.stones < 12 ? '突破二转需要 12 块元石。' : null;
    case 'CHOOSE': {
      const event = EVENTS.find(item => item.id === state.activeEvent);
      if (!event) return '当前没有待决事件。';
      const choice = event.choices.find(item => item.id === action.choiceId);
      return choice ? getChoiceError(state, choice) : '这个事件中没有该选项。';
    }
    case 'EQUIP': {
      const gu = guById(action.guId);
      if (!gu) return '蛊虫不存在。';
      if (owned(state, gu.id) < 1) return `尚未拥有${gu.name}。`;
      if (gu.rank > state.rank) return `${gu.name}需要二转境界才能装备。`;
      if (state.equipped.includes(gu.id)) return '同种蛊不能重复装备。';
      return unique(state.equipped).length >= EQUIPMENT_LIMIT ? '最多装备 4 只蛊，请先卸下一只。' : null;
    }
    case 'UNEQUIP':
      return guById(action.guId) && state.equipped.includes(action.guId) ? null : '这只蛊没有被装备。';
    case 'FEED': {
      const ids = unique(state.hungry).filter(id => owned(state, id) > 0 && !!guById(id));
      if (!ids.length) return '当前没有需要补喂的休眠蛊。';
      const cost = ids.reduce((sum, id) => sum + count(guById(id)?.upkeep), 0);
      return state.resources.stones < cost ? `补喂需要 ${cost} 块元石，现有 ${count(state.resources.stones)}。` : null;
    }
    case 'BUY': {
      const item = SHOP.find(entry => entry.id === action.itemId);
      if (!item) return '商店中没有这件物品。';
      if (state.location !== 'market') return '前往山寨市集后才能购买。';
      if (!Number.isFinite(item.stock) || item.stock < 1 || count(state.purchases[item.id]) >= item.stock) return '这件物品已售罄。';
      if (!Number.isFinite(item.price) || item.price < 0) return '这件物品的价格无效。';
      return effectsError(state, item.effects, { stones: item.price });
    }
    case 'CRAFT': {
      const recipe = RECIPES.find(item => item.id === action.recipeId);
      if (!recipe || !guById(recipe.result)) return '合炼配方不存在。';
      for (const [id, amount] of Object.entries(recipe.gu)) {
        const gu = guById(id);
        if (!gu || !Number.isInteger(amount) || amount < 1) return '这张配方的蛊虫材料无效。';
        if (owned(state, id) < amount) return `合炼缺少${gu.name}：需要 ${amount} 只，现有 ${owned(state, id)} 只。`;
      }
      const cost = recipeCost(recipe, action.safe);
      for (const key of RESOURCE_KEYS) {
        if (state.resources[key] < (cost[key] ?? 0)) return `合炼${RESOURCE_NAMES[key]}不足：需要 ${cost[key]}，现有 ${count(state.resources[key])}。`;
      }
      return null;
    }
    case 'COMBAT': {
      const combat = state.combat;
      if (!combat) return '当前没有战斗。';
      const enemy = ENEMIES.find(item => item.id === combat.enemyId);
      if (!enemy || !enemy.moves.length) return '对手资料缺失。';
      if (action.move === 'attack' || action.move === 'defend' || action.move === 'retreat') return null;
      if (action.move === 'herbs') {
        if (state.hp >= state.maxHp) return '生命已满，无需消耗药草。';
        return state.resources.herbs < 2 ? '处理伤口需要 2 份药草。' : null;
      }
      if (action.move === 'wine') {
        if (state.qi >= state.maxQi) return '真元已满，无需消耗清酒。';
        return state.resources.wine < 1 ? '补充真元需要 1 份清酒。' : null;
      }
      if (action.move !== 'gu') return '未知的战斗动作。';
      const gu = action.guId && guById(action.guId);
      if (!gu) return '请指定一只可用的蛊。';
      if (!usable(state, gu.id)) return '这只蛊尚未装备、处于休眠，或境界不足。';
      if (gu.passive) return '此蛊会在装备时自动生效，无需主动催动。';
      if (!['strike', 'guard', 'heal', 'restore', 'escape'].includes(gu.ability)) return '此蛊没有可主动施展的战斗能力。';
      return state.qi < gu.qiCost ? `催动${gu.name}需要 ${gu.qiCost} 点真元。` : null;
    }
    default:
      return '未知的行动。';
  }
}

export function createGame({ name, origin, seed = 20261010 }: { name: string; origin: OriginId; seed?: number }): GameState {
  const background = ORIGINS.find(item => item.id === origin) ?? ORIGINS[0];
  if (!background) throw new Error('没有可用的出身资料。');
  const initialSeed = Math.trunc(finite(seed, 20261010)) >>> 0;
  const displayName = name.trim().slice(0, 18) || '无名行者';
  const inventory: Record<string, number> = {};
  for (const id of background.gu) if (guById(id)) inventory[id] = (inventory[id] ?? 0) + 1;
  const equipped = unique(background.gu).filter(id => guById(id)?.rank === 1).slice(0, EQUIPMENT_LIMIT);
  const state: GameState = {
    version: 1, runId: `${initialSeed.toString(36)}-${origin}-${displayName}`, seed: initialSeed, rng: initialSeed,
    name: displayName, origin: background.id, day: 1, actions: DAILY_ACTIONS, location: 'academy',
    hp: 28, maxHp: 28, qi: 12, maxQi: 12, rank: 1, cultivation: background.cultivation,
    resources: { ...background.resources }, clues: 0, trust: background.trust, suspicion: 0,
    inventory, equipped, hungry: [], usedToday: [...equipped], flags: [], relations: {}, seenEvents: [],
    activeEvent: null, purchases: {}, combat: null, ending: null, journal: [], nextLogId: 1,
  };
  normalize(state);
  log(state, `${displayName}以「${background.name}」的身份来到青茅山。山中遗藏的风声已起，你有十日决定自己的去路。`, 'story');
  return state;
}

function endDay(state: GameState): void {
  const ids = upkeepIds(state);
  const upkeep = getUpkeep(state);
  if (state.resources.stones >= upkeep) {
    state.resources.stones -= upkeep;
    state.hungry = state.hungry.filter(id => !ids.includes(id));
    log(state, `结清当日供养 ${upkeep} 块元石，今日携带的蛊已安顿。`, 'info');
  } else {
    state.hungry = unique([...state.hungry, ...ids.filter(id => owned(state, id) > 0)]);
    log(state, `供养需要 ${upkeep} 块元石，钱不足，因此没有扣款；今日携带的蛊进入休眠。可备足元石后补喂。`, 'bad');
  }
  if (state.day >= LAST_DAY) {
    finish(state, 'departure', '十日期限已到，你没有取得此前约定的成果，随最后一批离山人结束旅途。此次按存活离山结算。', 'survived');
    return;
  }
  state.day += 1;
  state.actions = DAILY_ACTIONS;
  state.hp = Math.min(state.maxHp, state.hp + 4);
  state.qi = state.maxQi;
  state.suspicion = Math.max(0, state.suspicion - 3);
  state.usedToday = [...state.equipped];
  log(state, `第 ${state.day} 日。生命恢复 4 点，真元已回满，获得 3 次行动。`, 'info');
}

function combatLog(state: GameState, text: string): void {
  if (state.combat) state.combat.log = [...state.combat.log.slice(-11), text];
}

function winCombat(state: GameState): void {
  const combat = state.combat!;
  const enemy = ENEMIES.find(item => item.id === combat.enemyId)!;
  const ending = combat.victoryEnding;
  const outcome = combat.victoryText || `你战胜了${enemy.name}。`;
  // Pending event rewards and enemy rewards are both gated on actual victory.
  applyEffects(state, enemy.reward);
  applyEffects(state, combat.victoryEffects);
  state.combat = null;
  log(state, `战胜${enemy.name}。${outcome}`, 'good');
  checkLife(state);
  if (ending && !state.ending) finish(state, ending, outcome, 'success');
}

function retreat(state: GameState): void {
  const combat = state.combat!;
  const enemy = ENEMIES.find(item => item.id === combat.enemyId)!;
  applyEffects(state, combat.defeatEffects);
  state.combat = null;
  state.location = 'academy';
  log(state, `你从${enemy.name}面前撤回学堂，没有获得胜利奖励；这次事件按未完成结算。`, 'bad');
  checkLife(state);
}

function enemyTurn(state: GameState): void {
  const combat = state.combat!;
  const enemy = ENEMIES.find(item => item.id === combat.enemyId)!;
  const move = enemy.moves[combat.turn % enemy.moves.length]!;
  if (move.type === 'attack') {
    const passiveGuard = Math.max(0, getEffectiveStats(state).guard - BASE_GUARD);
    const damage = attackDamage(move.power, passiveGuard, combat.playerGuard);
    state.hp = Math.max(0, state.hp - damage);
    combat.playerGuard = 0;
    combatLog(state, `${enemy.name}施展「${move.label}」，你损失 ${damage} 点生命。`);
  } else if (move.type === 'guard') {
    combat.enemyGuard = move.power;
    combatLog(state, `${enemy.name}施展「${move.label}」，下一次受击减伤 ${move.power}。`);
  } else {
    const lost = Math.min(state.qi, move.power);
    state.qi = Math.max(0, state.qi - move.power);
    combatLog(state, `${enemy.name}施展「${move.label}」，你损失 ${lost} 点真元。`);
  }
  combat.turn += 1;
  if (state.hp <= 0) {
    applyEffects(state, combat.defeatEffects);
    finish(state, 'departure', `你败在${enemy.name}手下，没能守住此行成果。此次按败退结算，没有获得胜利奖励。`, 'defeat');
  }
}

function fight(state: GameState, action: Extract<GameAction, { type: 'COMBAT' }>): void {
  const combat = state.combat!;
  const stats = getEffectiveStats(state);
  if (action.move === 'retreat') {
    const chance = retreatPercent(stats.escape) / 100;
    if (random(state) < chance) {
      retreat(state);
      return;
    }
    combatLog(state, '撤退的道路被封住了，你失去了这次出手机会。');
  } else if (action.move === 'defend') {
    combat.playerGuard = BASE_GUARD;
    state.qi = Math.min(state.maxQi, state.qi + 2);
    combatLog(state, `你稳住防线，下一击减伤 ${stats.guard}，并恢复 2 点真元。`);
  } else if (action.move === 'herbs') {
    const restored = Math.min(8, state.maxHp - state.hp);
    state.resources.herbs -= 2;
    state.hp += restored;
    combatLog(state, `你用 2 份药草处理伤口，恢复 ${restored} 点生命。`);
  } else if (action.move === 'wine') {
    const restored = Math.min(5, state.maxQi - state.qi);
    state.resources.wine -= 1;
    state.qi += restored;
    combatLog(state, `你饮下 1 份清酒，恢复 ${restored} 点真元。`);
  } else {
    let damage = 0;
    let label = '普通攻击';
    if (action.move === 'attack') {
      damage = stats.attack;
      state.qi = Math.min(state.maxQi, state.qi + 1);
    } else {
      const gu = guById(action.guId!)!;
      state.qi -= gu.qiCost;
      state.usedToday = unique([...state.usedToday, gu.id]);
      label = gu.name;
      if (gu.ability === 'strike') damage = gu.power + stats.attack - BASE_ATTACK;
      else if (gu.ability === 'guard') {
        combat.playerGuard = gu.power;
        combatLog(state, `你催动${gu.name}，为下一击增加 ${gu.power} 点防护。`);
      } else if (gu.ability === 'heal') {
        const restored = Math.min(gu.power, state.maxHp - state.hp);
        state.hp += restored;
        combatLog(state, `${gu.name}恢复了 ${restored} 点生命。`);
      } else if (gu.ability === 'restore') {
        const restored = Math.min(gu.power, state.maxQi - state.qi);
        state.qi += restored;
        combatLog(state, `${gu.name}恢复了 ${restored} 点真元。`);
      } else if (gu.ability === 'escape') {
        retreat(state);
        return;
      }
    }
    if (damage > 0) {
      const dealt = Math.max(1, damage - combat.enemyGuard);
      combat.enemyHp = Math.max(0, combat.enemyHp - dealt);
      combat.enemyGuard = 0;
      combatLog(state, `你使出${label}，造成 ${dealt} 点伤害。`);
    }
    if (combat.enemyHp <= 0) {
      winCombat(state);
      return;
    }
  }
  enemyTurn(state);
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (getActionError(state, action)) return state;
  const next = cloneGame(state);
  switch (action.type) {
    case 'TRAVEL':
      next.location = action.location;
      break;
    case 'EXPLORE': {
      const available = getAvailableEvents(next);
      const event = action.eventId === undefined ? available[0]! : available.find(item => item.id === action.eventId)!;
      next.actions -= 1;
      next.activeEvent = event.id;
      log(next, `探查${LOCATIONS.find(item => item.id === next.location)?.name ?? '此地'}：${event.title}。`, 'story');
      break;
    }
    case 'ACTIVITY': {
      const activity = LOCATIONS.find(item => item.id === next.location)!.activity;
      next.actions -= 1;
      applyEffects(next, activity.effects);
      const storage = getEffectiveStats(next).storage;
      const resource = RESOURCE_KEYS.find(key => (activity.effects.resources?.[key] ?? 0) > 0);
      if (storage > 0 && resource) {
        next.resources[resource] += storage;
        log(next, `${activity.label}。储物蛊额外保存了 ${storage} 份${RESOURCE_NAMES[resource]}。`, 'good');
      } else log(next, activity.label, 'info');
      checkLife(next);
      break;
    }
    case 'TRAIN':
      next.actions -= 1;
      applyEffects(next, { qi: -3, cultivation: 3 });
      log(next, '温养空窍：消耗 3 点真元，修为增加 3。', 'good');
      break;
    case 'REST':
      next.actions -= 1;
      applyEffects(next, { hp: 8, qi: 6 });
      log(next, '静坐调息：恢复最多 8 点生命、6 点真元。', 'good');
      break;
    case 'END_DAY':
      endDay(next);
      break;
    case 'BREAKTHROUGH':
      next.actions -= 1;
      next.rank = 2;
      next.cultivation -= 12;
      next.resources.stones -= 12;
      next.maxHp += 8;
      next.maxQi += 4;
      next.hp += 8;
      next.qi += 4;
      log(next, '冲关成功，晋升二转。消耗修为 12、元石 12；生命与上限增加 8，真元与上限增加 4，可以装备二转蛊。', 'good');
      break;
    case 'CHOOSE': {
      const event = EVENTS.find(item => item.id === next.activeEvent)!;
      const choice = event.choices.find(item => item.id === action.choiceId)!;
      next.seenEvents = unique([...next.seenEvents, event.id]);
      next.activeEvent = null;
      applyEffects(next, choice.effects);
      log(next, `${event.title} · ${choice.label}：${choice.outcome}`, 'story');
      checkLife(next);
      if (next.ending) break;
      if (choice.encounterId) {
        const enemy = ENEMIES.find(item => item.id === choice.encounterId)!;
        next.combat = {
          enemyId: enemy.id, enemyHp: enemy.hp, enemyGuard: 0, playerGuard: 0, turn: 0,
          victoryEffects: cloneEffects(choice.victoryEffects ?? {}),
          victoryText: choice.victoryText ?? `战胜${enemy.name}，你取得了这场遭遇的成果。`,
          victoryEnding: choice.victoryEnding ?? choice.ending,
          defeatEffects: cloneEffects(choice.defeatEffects ?? {}), log: [`${enemy.name}拦住去路。仔细观察对手的下一招。`],
        };
      } else if (choice.ending) finish(next, choice.ending, choice.outcome, 'success');
      break;
    }
    case 'EQUIP':
      next.equipped = unique([...next.equipped, action.guId]);
      next.usedToday = unique([...next.usedToday, action.guId]);
      break;
    case 'UNEQUIP':
      next.equipped = next.equipped.filter(id => id !== action.guId);
      break;
    case 'FEED': {
      const ids = unique(next.hungry).filter(id => owned(next, id) > 0);
      const cost = ids.reduce((sum, id) => sum + count(guById(id)?.upkeep), 0);
      next.resources.stones -= cost;
      next.hungry = [];
      log(next, `补喂花费 ${cost} 块元石，${ids.map(id => guById(id)!.name).join('、')}恢复活力。`, 'good');
      break;
    }
    case 'BUY': {
      const item = SHOP.find(entry => entry.id === action.itemId)!;
      next.resources.stones -= item.price;
      next.purchases[item.id] = count(next.purchases[item.id]) + 1;
      applyEffects(next, item.effects);
      log(next, `购入${item.name}，花费 ${item.price} 块元石。`, 'info');
      break;
    }
    case 'CRAFT': {
      const recipe = RECIPES.find(item => item.id === action.recipeId)!;
      const cost = recipeCost(recipe, action.safe);
      next.actions -= 1;
      for (const key of RESOURCE_KEYS) next.resources[key] -= cost[key] ?? 0;
      const succeeds = action.safe || random(next) < clamp(recipe.successRate, 0, 1);
      if (succeeds) {
        for (const [id, amount] of Object.entries(recipe.gu)) next.inventory[id] = owned(next, id) - amount;
        next.inventory[recipe.result] = owned(next, recipe.result) + 1;
        normalize(next);
        log(next, `${action.safe ? '稳炼' : '合炼'}成功：${recipe.name}。输入蛊已合为${guById(recipe.result)!.name}，可在蛊囊中装备。`, 'good');
      } else log(next, `合炼${recipe.name}失败。辅材与这次行动已经消耗，输入蛊虫全部保留。`, 'bad');
      break;
    }
    case 'COMBAT':
      fight(next, action);
      break;
  }
  normalize(next);
  checkLife(next);
  return next;
}
