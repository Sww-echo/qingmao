import { PROTOTYPE_CONTENT } from './content.ts';
import { nextPrototypeRandom } from './random.ts';
import type { Effect, GuId, PrototypeAction, PrototypeCombat, PrototypeEvent, PrototypeState, PublicPrototypeView, Requirement, ResourceId } from './types.ts';

const P = PROTOTYPE_CONTENT.parameters;
const guIds = PROTOTYPE_CONTENT.gu.map(gu => gu.id);

export function createPrototype(seed: number): PrototypeState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('seed must be a uint32 integer');
  return {
    scenarioId: PROTOTYPE_CONTENT.scenarioId, rulesVersion: PROTOTYPE_CONTENT.rulesVersion,
    contentVersion: PROTOTYPE_CONTENT.contentVersion, seed, rng: seed, rngDraws: 0,
    day: 1, actions: P.actionsPerDay, location: 'academy', hp: P.startingHp, qi: P.startingQi,
    cultivation: 0, clues: 0, suspicion: 0,
    resources: { stones: P.startingStones, herbs: P.startingHerbs, wine: 0 },
    relations: { 'guard-captain': 0, innkeeper: 0 }, inventory: {}, upkeepDue: [],
    flags: [], exposures: [], completedEvents: [], missedEvents: [], activeEvent: null,
    combat: null, crisis: 'approaching', ending: null, actionCounts: {}, ledger: [],
    log: [{ day: 1, kind: 'event', message: '独立十四日情境：已开窍的一转方源。第14日日暮结算供养后应对狼群；先查看学堂守望说明。' }],
  };
}

export function getPrototypeMaxQi(state: Pick<PrototypeState, 'cultivation'>): number {
  return P.startingQi + Math.floor(state.cultivation / P.cultivationStep) * P.maxQiBonusPerStep;
}

export function isPrototypeGuUsable(state: Pick<PrototypeState, 'inventory'>, guId: GuId): boolean {
  const gu = state.inventory[guId];
  return gu?.mode === 'active' && gu.equipped;
}

export function getPrototypeUpkeep(state: Pick<PrototypeState, 'inventory' | 'upkeepDue'>): number {
  return guIds.reduce((sum, id) => sum + (state.inventory[id] && (state.inventory[id]!.mode !== 'sealed' || state.upkeepDue.includes(id))
    ? PROTOTYPE_CONTENT.gu.find(gu => gu.id === id)!.upkeep : 0), 0);
}

export function getPrototypeRequirementError(state: PrototypeState, requirement: Requirement): string | null {
  switch (requirement.kind) {
    case 'flag': return state.flags.includes(requirement.id) === requirement.present ? null : `尚未落实：${requirement.id}`;
    case 'resource': return state.resources[requirement.id] >= requirement.min ? null : `${requirement.id}至少需要${requirement.min}`;
    case 'relation': return state.relations[requirement.id] >= requirement.min ? null : `${requirement.id}关系至少需要${requirement.min}`;
    case 'cultivation': return state.cultivation >= requirement.min ? null : `修为至少需要${requirement.min}`;
    case 'clues': return state.clues >= requirement.min ? null : `情报至少需要${requirement.min}`;
    case 'gu': return requirement.usable ? (isPrototypeGuUsable(state, requirement.id) ? null : `需要清醒并装备的${requirement.id}`)
      : (state.inventory[requirement.id] ? null : `尚未获得${requirement.id}`);
    case 'exposure': return state.exposures.some(exposure => exposure.id === requirement.id) ? null : '没有这条暴露痕迹';
  }
}

function requirementsError(state: PrototypeState, requirements: Requirement[]): string | null {
  for (const requirement of requirements) {
    const error = getPrototypeRequirementError(state, requirement);
    if (error) return error;
  }
  return null;
}

/** All currently knowable opportunities, across locations; travel is checked separately. */
export function getAvailablePrototypeEvents(state: PrototypeState): PrototypeEvent[] {
  if (state.ending || state.combat || state.activeEvent) return [];
  return structuredClone(PROTOTYPE_CONTENT.events.filter(event => event.fromDay <= state.day && event.throughDay >= state.day
    && !state.completedEvents.includes(event.id) && !state.missedEvents.includes(event.id)
    && !requirementsError(state, event.requirements)
    && (state.crisis === 'approaching' ? event.id !== 'crisis-arrival' : event.id === 'crisis-arrival')));
}

function hasOnlyKeys(action: object, allowed: string[]): boolean {
  return Object.keys(action).every(key => allowed.includes(key));
}

export function getPrototypeActionError(state: PrototypeState, action: PrototypeAction): string | null {
  if (!action || typeof action !== 'object' || typeof action.type !== 'string') return '操作格式不正确';
  if (state.ending) return '本局已经结算';
  if (state.combat && action.type !== 'COMBAT') return '请先完成战斗';
  if (!state.combat && action.type === 'COMBAT') return '当前没有战斗';
  if (state.activeEvent && !['CHOOSE', 'DISMISS_EVENT'].includes(action.type)) return '请先处理当前事件';
  if (!state.activeEvent && ['CHOOSE', 'DISMISS_EVENT'].includes(action.type)) return '当前没有待决事件';
  if (state.crisis !== 'approaching' && !['CHOOSE', 'COMBAT'].includes(action.type)) return '狼群已经抵达，不能再筹备';
  const actionNeeded = ['WORK', 'TRAIN', 'SCOUT', 'REST', 'GU_MODE', 'CLEAR_EXPOSURE'].includes(action.type);
  if (actionNeeded && state.actions < 1) return '今日行动已用完';
  switch (action.type) {
    case 'TRAVEL':
      if (!hasOnlyKeys(action, ['type', 'location']) || !PROTOTYPE_CONTENT.locations.some(location => location.id === action.location)) return '未知地点';
      return action.location === state.location ? '已经在此处' : null;
    case 'OPEN_EVENT': {
      if (!hasOnlyKeys(action, ['type', 'eventId'])) return '操作格式不正确';
      const event = getAvailablePrototypeEvents(state).find(event => event.id === action.eventId);
      if (!event) return '事件未开放、条件不足或已处理';
      if (event.location !== state.location) return '需要先到事件地点';
      return state.actions >= event.actionCost ? null : '今日行动不足以完成此事件';
    }
    case 'CHOOSE': {
      if (!hasOnlyKeys(action, ['type', 'choiceId'])) return '操作格式不正确';
      const event = PROTOTYPE_CONTENT.events.find(event => event.id === state.activeEvent);
      const choice = event?.choices.find(choice => choice.id === action.choiceId);
      if (!event || !choice) return '未知事件选项';
      if (event.fromDay > state.day || event.throughDay < state.day || state.completedEvents.includes(event.id)) return '事件已过期或已结算';
      const error = requirementsError(state, [...event.requirements, ...choice.requirements]);
      if (error) return error;
      if (state.actions < event.actionCost) return '今日行动不足';
      for (const [resource, cost] of Object.entries(choice.costs)) {
        const amount = resource === 'qi' ? state.qi : state.resources[resource as ResourceId];
        if (amount < cost) return `${resource}不足，需要${cost}`;
      }
      return null;
    }
    case 'DISMISS_EVENT':
      if (!hasOnlyKeys(action, ['type'])) return '操作格式不正确';
      return state.activeEvent === 'crisis-arrival' ? '狼群已抵达，必须选择应对方式' : null;
    case 'WORK':
      if (!hasOnlyKeys(action, ['type'])) return '操作格式不正确';
      return state.location === 'bamboo' ? '安全劳作只在学堂或客栈提供' : null;
    case 'TRAIN':
      if (!hasOnlyKeys(action, ['type'])) return '操作格式不正确';
      if (state.location !== 'academy') return '需要在学堂修炼';
      if (state.cultivation >= P.cultivationCap) return '本情境修为已经达到上限';
      return state.qi >= P.trainingQi ? null : '修炼需要3真元';
    case 'SCOUT':
      if (!hasOnlyKeys(action, ['type'])) return '操作格式不正确';
      if (state.location !== 'bamboo') return '需要在竹林侦察';
      return state.qi >= P.scoutQi ? null : '侦察需要3真元';
    case 'REST':
      if (!hasOnlyKeys(action, ['type'])) return '操作格式不正确';
      if (state.location === 'bamboo') return '需要先返回安全地点';
      return state.hp < P.startingHp || state.qi < getPrototypeMaxQi(state) ? null : '无需休整';
    case 'END_DAY': return hasOnlyKeys(action, ['type']) ? null : '操作格式不正确';
    case 'BUY': {
      if (!hasOnlyKeys(action, ['type', 'item']) || !['herbs', 'wine'].includes(action.item)) return '未知补给';
      if (state.location !== 'inn') return '需要到客栈买补给';
      const limit = action.item === 'herbs' ? P.herbCarryLimit : P.wineCarryLimit;
      const price = action.item === 'herbs' ? P.herbPrice : P.winePrice;
      if (state.resources[action.item] >= limit) return '补给已达携带上限';
      return state.resources.stones >= price ? null : '元石不足';
    }
    case 'EQUIP':
      if (!hasOnlyKeys(action, ['type', 'guId', 'equipped']) || !guIds.includes(action.guId) || typeof action.equipped !== 'boolean') return '未知蛊或装备设置';
      if (!state.inventory[action.guId]) return '尚未获得此蛊';
      return state.inventory[action.guId]!.equipped === action.equipped ? '装备状态没有变化' : null;
    case 'GU_MODE': {
      if (!hasOnlyKeys(action, ['type', 'guId', 'mode']) || !guIds.includes(action.guId) || !['seal', 'wake'].includes(action.mode)) return '未知蛊或养护操作';
      const gu = state.inventory[action.guId];
      if (!gu) return '尚未获得此蛊';
      if (action.mode === 'seal' && gu.mode === 'sealed') return '已经封存';
      if (action.mode === 'wake' && gu.mode === 'active') return '已经清醒';
      const price = action.mode === 'seal' ? P.sealCost : gu.mode === 'sealed' ? P.wakeSealedCost : P.wakeDormantCost;
      return state.resources.stones >= price ? null : `养护需要${price}元石`;
    }
    case 'CLEAR_EXPOSURE':
      if (!hasOnlyKeys(action, ['type', 'exposureId']) || !state.exposures.some(exposure => exposure.id === action.exposureId)) return '没有这条暴露痕迹';
      if (state.location !== 'inn') return '需要在客栈处理物证';
      return state.resources.stones >= P.clearExposureCost ? null : '处理物证需要4元石';
    case 'COMBAT': {
      if (!hasOnlyKeys(action, ['type', 'move'])) return '操作格式不正确';
      const combat = state.combat!;
      switch (action.move) {
        case 'attack': case 'defend': case 'retreat': return null;
        case 'moonlight': case 'jade-skin': {
          if (!isPrototypeGuUsable(state, action.move)) return '需要清醒且装备的蛊';
          return state.qi >= PROTOTYPE_CONTENT.gu.find(gu => gu.id === action.move)!.qiCost ? null : '真元不足';
        }
        case 'herbs':
          if (state.hp >= P.startingHp) return '生命已满';
          return state.resources.herbs > 0 && combat.herbsUsed < 3 ? null : '无药草或已用完本场3次疗伤机会';
        case 'wine':
          if (state.qi >= getPrototypeMaxQi(state)) return '真元已满';
          return state.resources.wine > 0 && combat.wineUsed < 3 ? null : '无酒或已用完本场3次补充机会';
        default: return '未知战斗操作';
      }
    }
    default: return '未知操作';
  }
}

function log(state: PrototypeState, kind: PrototypeState['log'][number]['kind'], message: string): void {
  state.log.push({ day: state.day, kind, message });
}

function resourceDelta(state: PrototypeState, resource: ResourceId, amount: number, source: string): void {
  const limit = resource === 'herbs' ? P.herbCarryLimit : resource === 'wine' ? P.wineCarryLimit : 100000;
  const before = state.resources[resource];
  state.resources[resource] = Math.max(0, Math.min(limit, before + amount));
  if (before !== state.resources[resource]) state.ledger.push({ day: state.day, source, resource, amount: state.resources[resource] - before });
}

function flag(state: PrototypeState, id: string): void {
  if (!state.flags.includes(id)) state.flags.push(id);
}

/** Mulberry32: same uint32 contract as the existing engine, with explicit draw count. */
function draw(state: PrototypeState): number {
  const sample = nextPrototypeRandom(state.rng);
  state.rng = sample.rng;
  state.rngDraws += 1;
  return sample.value;
}

function startBattle(state: PrototypeState, enemyId: PrototypeCombat['enemyId'], purpose: PrototypeCombat['purpose']): void {
  const enemy = PROTOTYPE_CONTENT.enemies.find(enemy => enemy.id === enemyId)!;
  state.combat = { enemyId, purpose, enemyHp: enemy.hpMin + Math.floor(draw(state) * (enemy.hpMax - enemy.hpMin + 1)), turn: 0, guard: 0, herbsUsed: 0, wineUsed: 0 };
  if (purpose === 'crisis') state.crisis = 'fighting';
  log(state, 'combat', `${enemy.name}接战，生命${state.combat.enemyHp}。意图和每次伤害在行动前可查。`);
}

function die(state: PrototypeState, reason: string): void {
  state.hp = 0;
  const wasCrisis = state.crisis !== 'approaching';
  state.ending = { id: wasCrisis ? 'overrun' : 'lost-in-bamboo', outcome: 'death', reasons: [reason] };
  if (wasCrisis) {
    if (state.cultivation < 12) state.ending.reasons.push('修为不足12，月刃威力与真元容量没有形成战备优势。');
    if (!isPrototypeGuUsable(state, 'jade-skin')) state.ending.reasons.push('没有有效玉皮蛊，连续攻击缺少减伤。');
    if (!isPrototypeGuUsable(state, 'moonlight')) state.ending.reasons.push('月光蛊未装备、休眠或封存，无法打出月刃。');
    if (!state.flags.includes('shelter-stocked')) state.ending.reasons.push('未落实庇护备粮，囤积的元石不能临时替代完整安排。');
    if (state.exposures.length) state.ending.reasons.push('未处理的越界痕迹增加了追击压力。');
  }
  state.combat = null;
  state.activeEvent = null;
  state.crisis = 'resolved';
  log(state, 'crisis', state.ending.reasons.join(' '));
}

function applyEffect(state: PrototypeState, effect: Effect, source: string): void {
  switch (effect.kind) {
    case 'resource': resourceDelta(state, effect.id, effect.amount, source); break;
    case 'relation': state.relations[effect.id] = Math.max(-100, Math.min(100, state.relations[effect.id] + effect.amount)); break;
    case 'clues': state.clues = Math.max(0, Math.min(P.clueCap, state.clues + effect.amount)); break;
    case 'hp': state.hp = Math.max(0, Math.min(P.startingHp, state.hp + effect.amount)); break;
    case 'qi': state.qi = Math.max(0, Math.min(getPrototypeMaxQi(state), state.qi + effect.amount)); break;
    case 'suspicion': state.suspicion = Math.max(0, Math.min(100, state.suspicion + effect.amount)); break;
    case 'flag': flag(state, effect.id); break;
    case 'gu':
      if (!state.inventory[effect.id]) state.inventory[effect.id] = { mode: 'active', equipped: true };
      if (!state.upkeepDue.includes(effect.id)) state.upkeepDue.push(effect.id);
      break;
    case 'exposure':
      if (!state.exposures.some(exposure => exposure.id === effect.id)) state.exposures.push({ id: effect.id, source: effect.source, day: state.day });
      break;
    case 'battle': startBattle(state, effect.enemyId, effect.purpose); break;
    case 'crisis':
      if (effect.response === 'fight') startBattle(state, 'crisis-pack', 'crisis');
      else {
        const demand = P.crisisThreatMin + Math.floor(draw(state) * (P.crisisThreatMax - P.crisisThreatMin + 1));
        const readiness = state.clues + state.relations['guard-captain'] - state.exposures.length;
        if (readiness >= demand) {
          state.ending = { id: 'shelter-secured', outcome: 'survived', reasons: [
            `地听草与路线标记发挥作用：情报${state.clues}＋队长关系${state.relations['guard-captain']}−暴露${state.exposures.length}＝准备${readiness}，覆盖本次需求${demand}。`,
            '掌柜庇护、已交付药资与已完成守望班次兑现，支付6元石护送费后安全撤入。',
          ] };
          state.crisis = 'resolved';
          log(state, 'crisis', state.ending.reasons.join(' '));
        } else {
          state.hp = Math.max(0, state.hp - 10);
          log(state, 'risk', `庇护准备${readiness}不足以覆盖需求${demand}，遭截击损失10生命，${state.hp > 0 ? '转入战斗' : '未能抵达庇护所'}。`);
          if (state.hp > 0) startBattle(state, 'crisis-pack', 'crisis');
          else die(state, `庇护准备${readiness}不足以覆盖需求${demand}，遭截击损失10生命，未能抵达庇护所。`);
        }
      }
      break;
  }
}

function spendAction(state: PrototypeState, source: string): void {
  state.actions -= 1;
  state.actionCounts[source] = (state.actionCounts[source] ?? 0) + 1;
}

function endDay(state: PrototypeState): void {
  const upkeep = getPrototypeUpkeep(state);
  const canFeed = state.resources.stones >= upkeep;
  if (canFeed) resourceDelta(state, 'stones', -upkeep, 'daily-upkeep');
  for (const id of guIds) {
    const gu = state.inventory[id];
    if (gu && gu.mode !== 'sealed') gu.mode = canFeed ? 'active' : 'dormant';
  }
  log(state, 'upkeep', canFeed ? `供养${upkeep}元石；全体未封存蛊清醒，卸装不减免。` : `应付${upkeep}，余额${state.resources.stones}不足；本轮不扣款，未封存蛊全部休眠。安全劳作和休整仍可用。`);
  if (state.day === P.days) {
    flag(state, 'crisis-arrived');
    state.crisis = 'decision';
    state.activeEvent = 'crisis-arrival';
    log(state, 'crisis', '最后一轮供养已结清。狼群抵达，请按已有准备应对。');
    return;
  }
  state.day += 1;
  for (const event of PROTOTYPE_CONTENT.events) {
    if (event.throughDay < state.day && !state.completedEvents.includes(event.id) && !state.missedEvents.includes(event.id)) {
      state.missedEvents.push(event.id);
      log(state, 'event', `${event.title}的窗口已关闭；本局不补发该次奖励。`);
    }
  }
  state.actions = P.actionsPerDay;
  state.hp = Math.min(P.startingHp, state.hp + P.nightlyHealing);
  state.qi = getPrototypeMaxQi(state);
  state.suspicion = Math.max(0, state.suspicion - P.suspicionDecay);
  state.upkeepDue = guIds.filter(id => state.inventory[id] && state.inventory[id]!.mode !== 'sealed');
}

export function getPrototypeCombatForecast(state: PrototypeState): PublicPrototypeView['combatForecast'] {
  if (!state.combat) return null;
  const enemy = PROTOTYPE_CONTENT.enemies.find(enemy => enemy.id === state.combat!.enemyId)!;
  const intent = enemy.intents[state.combat.turn % enemy.intents.length]!;
  const damage = intent.damage + state.exposures.length * 2;
  const passive = isPrototypeGuUsable(state, 'jade-skin') ? PROTOTYPE_CONTENT.gu.find(gu => gu.id === 'jade-skin')!.power : 0;
  return { enemyHp: state.combat.enemyHp, intent: intent.label, incomingDamage: Math.max(0, damage - passive - state.combat.guard), defendingDamage: Math.max(0, damage - passive - state.combat.guard - 6) };
}

function combatMove(state: PrototypeState, move: Extract<PrototypeAction, { type: 'COMBAT' }>['move']): void {
  const combat = state.combat!;
  const forecast = getPrototypeCombatForecast(state)!;
  if (move === 'retreat') {
    state.actionCounts['combat:retreat'] = (state.actionCounts['combat:retreat'] ?? 0) + 1;
    const damage = Math.max(0, P.retreatDamage - (isPrototypeGuUsable(state, 'ear-grass') ? P.scoutProtection : 0));
    state.hp = Math.max(0, state.hp - damage);
    resourceDelta(state, 'stones', -Math.min(P.retreatStoneLoss, state.resources.stones), 'retreat');
    state.combat = null;
    state.location = 'academy';
    log(state, 'combat', `撤退，受${damage}伤害并损失至多${P.retreatStoneLoss}元石；无胜利奖励。`);
    if (combat.purpose === 'crisis') die(state, '最终守望时放弃通道，未安排替代撤离，随后被狼群围困。');
    return;
  }
  let damage = 0;
  if (move === 'attack') {
    damage = 3 + Math.floor(state.cultivation / 6);
    state.qi = Math.min(getPrototypeMaxQi(state), state.qi + 1);
  } else if (move === 'moonlight') {
    state.qi -= PROTOTYPE_CONTENT.gu.find(gu => gu.id === 'moonlight')!.qiCost;
    damage = PROTOTYPE_CONTENT.gu.find(gu => gu.id === 'moonlight')!.power + Math.floor(state.cultivation / 6) * 2;
  } else if (move === 'jade-skin') {
    state.qi -= PROTOTYPE_CONTENT.gu.find(gu => gu.id === 'jade-skin')!.qiCost;
    combat.guard += 8;
  } else if (move === 'defend') {
    combat.guard += 6;
    state.qi = Math.min(getPrototypeMaxQi(state), state.qi + 3);
  } else if (move === 'herbs') {
    resourceDelta(state, 'herbs', -1, 'combat-healing');
    combat.herbsUsed += 1;
    state.hp = Math.min(P.startingHp, state.hp + P.herbHealing);
  } else if (move === 'wine') {
    resourceDelta(state, 'wine', -1, 'combat-qi');
    combat.wineUsed += 1;
    state.qi = Math.min(getPrototypeMaxQi(state), state.qi + P.wineQi);
  }
  combat.enemyHp = Math.max(0, combat.enemyHp - damage);
  state.actionCounts[`combat:${move}`] = (state.actionCounts[`combat:${move}`] ?? 0) + 1;
  if (combat.enemyHp === 0) {
    state.combat = null;
    const enemy = PROTOTYPE_CONTENT.enemies.find(enemy => enemy.id === combat.enemyId)!;
    if (combat.purpose !== 'survey') resourceDelta(state, 'stones', enemy.rewardStones, 'combat-victory');
    if (combat.purpose === 'patrol') {
      state.relations['guard-captain'] = Math.min(100, state.relations['guard-captain'] + 3);
      flag(state, 'patrol-cleared');
      log(state, 'combat', '救援胜利：获得10元石和队长关系+3，敌人不再出手。');
    } else if (combat.purpose === 'survey') {
      log(state, 'combat', '驱走侦察途中遇到的山狼；保留已采情报和药草，无巡山委托报酬或队长关系奖励。');
    } else {
      state.crisis = 'resolved';
      state.ending = { id: 'held-the-line', outcome: 'survived', reasons: [
        `修为${state.cultivation}决定月刃伤害和真元容量；${isPrototypeGuUsable(state, 'moonlight') ? '清醒月光蛊' : '普通攻击'}完成击退。`,
        `${isPrototypeGuUsable(state, 'jade-skin') ? '清醒玉皮蛊降低连续受伤' : '没有玉皮减伤'}，剩余${state.hp}生命；本场使用药草${combat.herbsUsed}份、酒${combat.wineUsed}份。`,
      ] };
      log(state, 'crisis', state.ending.reasons.join(' '));
    }
    return;
  }
  // Recompute after defensive moves; the enemy's published intent never changes mid-turn.
  const incoming = getPrototypeCombatForecast(state)!.incomingDamage;
  state.hp = Math.max(0, state.hp - incoming);
  combat.guard = 0;
  combat.turn += 1;
  log(state, 'combat', `${move}造成${damage}伤害；${forecast.intent}造成${incoming}伤害，剩余生命${state.hp}。`);
}

/** Illegal actions are identity-preserving and never consume RNG or append logs. */
export function prototypeReducer(state: PrototypeState, action: PrototypeAction): PrototypeState {
  if (getPrototypeActionError(state, action)) return state;
  const next = structuredClone(state);
  switch (action.type) {
    case 'TRAVEL': next.location = action.location; break;
    case 'OPEN_EVENT': next.activeEvent = action.eventId; break;
    case 'DISMISS_EVENT': next.activeEvent = null; break;
    case 'CHOOSE': {
      const event = PROTOTYPE_CONTENT.events.find(event => event.id === next.activeEvent)!;
      const choice = event.choices.find(choice => choice.id === action.choiceId)!;
      for (let i = 0; i < event.actionCost; i += 1) spendAction(next, `event:${event.id}`);
      for (const [resource, cost] of Object.entries(choice.costs)) {
        if (resource === 'qi') next.qi -= cost;
        else resourceDelta(next, resource as ResourceId, -cost, event.id);
      }
      next.completedEvents.push(event.id);
      next.activeEvent = null;
      log(next, 'event', `${event.title}：${choice.label}。${choice.risk}`);
      for (const effect of choice.effects) applyEffect(next, effect, event.id);
      break;
    }
    case 'WORK':
      spendAction(next, 'work');
      resourceDelta(next, 'stones', P.laborIncome, 'safe-labor');
      log(next, 'economy', `安全劳作1行动，收入${P.laborIncome}元石。`);
      break;
    case 'TRAIN': {
      spendAction(next, 'train');
      next.qi -= P.trainingQi;
      const gain = P.trainingGain + (isPrototypeGuUsable(next, 'liquor-worm') ? P.liquorTrainingBonus : 0);
      next.cultivation = Math.min(P.cultivationCap, next.cultivation + gain);
      log(next, 'growth', `修炼获得${gain}修为，当前${next.cultivation}；真元上限${getPrototypeMaxQi(next)}，月刃伤害${8 + Math.floor(next.cultivation / 6) * 2}。`);
      break;
    }
    case 'SCOUT': {
      spendAction(next, 'scout');
      next.qi -= P.scoutQi;
      const protectedByGu = isPrototypeGuUsable(next, 'ear-grass');
      next.clues = Math.min(P.clueCap, next.clues + (protectedByGu ? 2 : 1));
      resourceDelta(next, 'herbs', 1, 'bamboo-survey');
      if (protectedByGu) log(next, 'event', '地听草排除危险，获得2情报及1药草。');
      else {
        const risk = draw(next);
        applyEffect(next, { kind: 'exposure', id: 'unlicensed-survey', source: '无地听草的竹林侦察' }, 'bamboo-survey');
        next.suspicion = Math.min(100, next.suspicion + 3);
        if (risk < 0.3) startBattle(next, 'scout-wolf', 'survey');
        else {
          const injury = 2 + Math.floor((risk - 0.3) / 0.7 * 5);
          next.hp = Math.max(0, next.hp - injury);
          log(next, 'risk', `无侦察蛊的调查留下痕迹并受${injury}伤害；获得1情报及1药草。`);
        }
      }
      break;
    }
    case 'REST':
      spendAction(next, 'rest');
      next.hp = Math.min(P.startingHp, next.hp + 8);
      next.qi = Math.min(getPrototypeMaxQi(next), next.qi + 5);
      log(next, 'management', '安全休整1行动，恢复至多8生命和5真元，无元石费用。');
      break;
    case 'END_DAY': endDay(next); break;
    case 'BUY':
      resourceDelta(next, 'stones', -(action.item === 'herbs' ? P.herbPrice : P.winePrice), `buy-${action.item}`);
      resourceDelta(next, action.item, 1, `buy-${action.item}`);
      break;
    case 'EQUIP': next.inventory[action.guId]!.equipped = action.equipped; break;
    case 'GU_MODE': {
      spendAction(next, action.mode === 'seal' ? 'seal-gu' : 'wake-gu');
      const gu = next.inventory[action.guId]!;
      const price = action.mode === 'seal' ? P.sealCost : gu.mode === 'sealed' ? P.wakeSealedCost : P.wakeDormantCost;
      resourceDelta(next, 'stones', -price, `gu-${action.mode}`);
      gu.mode = action.mode === 'seal' ? 'sealed' : 'active';
      if (action.mode === 'wake' && !next.upkeepDue.includes(action.guId)) next.upkeepDue.push(action.guId);
      log(next, 'management', `${action.guId}${action.mode === 'seal' ? '封存' : '唤醒'}，花${price}元石和1行动。当日已产生供养义务不消除。`);
      break;
    }
    case 'CLEAR_EXPOSURE':
      spendAction(next, 'clear-exposure');
      resourceDelta(next, 'stones', -P.clearExposureCost, 'clear-exposure');
      next.exposures = next.exposures.filter(exposure => exposure.id !== action.exposureId);
      log(next, 'risk', `付出1行动和${P.clearExposureCost}元石处理${action.exposureId}物证。`);
      break;
    case 'COMBAT': combatMove(next, action.move); break;
  }
  if (next.hp === 0 && !next.ending) die(next, next.combat ? '未能承受已展示的敌人意图，生命耗尽。' : '探索或撤退造成的伤势耗尽生命。');
  return next;
}

export function getPrototypePublicView(state: PrototypeState): PublicPrototypeView {
  const candidates: PrototypeAction[] = [
    ...PROTOTYPE_CONTENT.locations.map(location => ({ type: 'TRAVEL', location: location.id } as const)),
    ...getAvailablePrototypeEvents(state).map(event => ({ type: 'OPEN_EVENT', eventId: event.id } as const)),
    ...(['WORK', 'TRAIN', 'SCOUT', 'REST', 'END_DAY', 'DISMISS_EVENT'] as const).map(type => ({ type })),
    ...(['herbs', 'wine'] as const).map(item => ({ type: 'BUY', item } as const)),
    ...guIds.flatMap(guId => [
      { type: 'EQUIP', guId, equipped: true } as const, { type: 'EQUIP', guId, equipped: false } as const,
      { type: 'GU_MODE', guId, mode: 'wake' } as const, { type: 'GU_MODE', guId, mode: 'seal' } as const,
    ]),
    ...state.exposures.map(exposure => ({ type: 'CLEAR_EXPOSURE', exposureId: exposure.id } as const)),
    ...(['attack', 'defend', 'moonlight', 'jade-skin', 'herbs', 'wine', 'retreat'] as const).map(move => ({ type: 'COMBAT', move } as const)),
  ];
  const event = PROTOTYPE_CONTENT.events.find(event => event.id === state.activeEvent);
  for (const choice of event?.choices ?? []) candidates.push({ type: 'CHOOSE', choiceId: choice.id });
  const { rng: _rng, rngDraws: _draws, seed: _seed, ...publicState } = structuredClone(state);
  return {
    state: publicState, availableEvents: getAvailablePrototypeEvents(state),
    legalActions: candidates.filter(action => !getPrototypeActionError(state, action)),
    combatForecast: getPrototypeCombatForecast(state), maxHp: P.startingHp,
    maxQi: getPrototypeMaxQi(state), upkeep: getPrototypeUpkeep(state),
  };
}
