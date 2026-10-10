import { EVENTS, GU, LOCATIONS, RECIPES, SHOP } from './content';
import { getActionError, getAvailableEvents, getChoiceError, getUpkeep } from './engine';
import { getChapterProgress } from './chapter';
import { getCampaignEvents, getCampaignLocations, getCampaignShop, getLocationError, isFangYuan } from './campaign';
import { FANG_STEPS } from './fang-content';
import type { Effects, LegacyEndingId, EventDef, GameAction, GameState, LocationId } from './types';

export type JourneyFocus = 'open' | LegacyEndingId;
export type AdviceDestination =
  | { kind: 'action'; action: GameAction; label: string }
  | { kind: 'pane'; pane: 'gu' | 'forge' | 'market'; label: string };

export interface JourneyAdvice {
  kind: 'discovery' | 'care' | 'resources' | 'route' | 'rest';
  title: string;
  description: string;
  destination: AdviceDestination;
  location?: LocationId;
}

export function getMapEventCounts(game: GameState): Record<LocationId, number> {
  return Object.fromEntries(getCampaignLocations(game).map(place => [place.id, getAvailableEvents({ ...game, location: place.id }).length])) as Record<LocationId, number>;
}

const actionDestination = (action: GameAction, label: string): AdviceDestination => ({ kind: 'action', action, label });

function eventAdvice(game: GameState, event: EventDef, title: string, description: string, kind: JourneyAdvice['kind'] = 'discovery'): JourneyAdvice {
  const place = getCampaignLocations(game).find(item => item.id === event.location)!;
  return {
    kind, title, description, location: place.id,
    destination: game.location === place.id
      ? actionDestination({ type: 'EXPLORE', eventId: event.id }, '探查这条消息')
      : actionDestination({ type: 'TRAVEL', location: place.id }, `前往${place.name}`),
  };
}

function opportunity(game: GameState, useful: (effects: Effects) => boolean, order: LocationId[]): EventDef | undefined {
  for (const location of order) {
    const there = { ...game, location };
    const event = getAvailableEvents(there).find(item => item.choices.some(choice => useful(choice.effects) && !getChoiceError(there, choice)));
    if (event) return event;
  }
  return undefined;
}

function restAdvice(title = '留一点余力给下一段山路'): JourneyAdvice {
  return { kind: 'care', title, description: '调息用一次行动，恢复最多 8 生命和 6 真元；准备好再进山。', destination: actionDestination({ type: 'REST' }, '先调息恢复') };
}

function earnAdvice(game: GameState, title: string, description: string): JourneyAdvice {
  const candidates: LocationId[] = ['market', 'clan', 'academy'];
  const location = candidates.find(id => !getActionError({ ...game, location: id }, { type: 'ACTIVITY' }));
  if (!location) return restAdvice('真元不足，先休息再筹措物资');
  const place = LOCATIONS.find(item => item.id === location)!;
  return {
    kind: 'resources', title, description, location,
    destination: game.location === location
      ? actionDestination({ type: 'ACTIVITY' }, place.activity.label)
      : actionDestination({ type: 'TRAVEL', location }, `前往${place.name}`),
  };
}

function readyRoute(game: GameState, ending: LegacyEndingId): EventDef | undefined {
  const location: LocationId = ending === 'inheritance' ? 'cave' : ending === 'clan' ? 'clan' : 'market';
  const there = { ...game, location };
  return getAvailableEvents(there).find(event => event.choices.some(choice => (choice.ending === ending || choice.victoryEnding === ending) && !getChoiceError(there, choice)));
}

/** Recommendations are derived from the current rules; they never spend resources or advance the day. */
export function getJourneyAdvice(game: GameState, focus: JourneyFocus): JourneyAdvice | null {
  if (game.ending || game.combat || game.activeEvent) return null;
  if (isFangYuan(game)) return getFangAdvice(game);
  const chapter = getChapterProgress(game);
  const nextChapterEvent = EVENTS.find(event => event.id === chapter?.nextEventId);
  if (nextChapterEvent) {
    return eventAdvice(game, nextChapterEvent, chapter!.stageTitle, '这段主线交谈不消耗行动。听取条件、说清打算，最后的去路仍可自由选择。', 'route');
  }
  if (game.actions === 0) {
    const shortage = Math.max(0, getUpkeep(game) - game.resources.stones);
    return {
      kind: 'rest', title: game.day === 10 ? '最后一日的脚步已尽' : '今日行动已用完',
      description: shortage ? `今晚供养还差 ${shortage} 元石。结束当日会让未获供养的蛊休眠，先核对结算。` : `今晚供养 ${getUpkeep(game)} 元石。结束当日前会再显示费用和结算结果。`,
      destination: actionDestination({ type: 'END_DAY' }, '查看日暮结算'),
    };
  }

  if (focus === 'clan' || focus === 'departure') {
    const event = readyRoute(game, focus);
    if (event) return eventAdvice(game, event, '这条去路的条件已经齐备', '前往听取最后的条件。探查不会直接结束旅途，最终选择仍由你作出。', 'route');
  }

  if (game.hungry.length && !getActionError(game, { type: 'FEED' })) {
    return { kind: 'care', title: '先唤醒休眠的蛊', description: '休眠蛊不能提供能力。补喂会支付其供养费用，不消耗行动。', destination: actionDestination({ type: 'FEED' }, '补喂休眠蛊') };
  }
  if (game.hp <= Math.ceil(game.maxHp / 3)) return restAdvice('伤势已经影响后面的选择');
  if (game.resources.stones < getUpkeep(game)) {
    return earnAdvice(game, '先凑齐今晚的供养', `今日携带过的蛊需要 ${getUpkeep(game)} 元石，手中只有 ${game.resources.stones}。劳作的报酬可以补上缺口。`);
  }

  const roster = getAvailableEvents({ ...game, location: 'academy' }).find(event => event.id === 'academy-roster');
  if ((focus === 'open' || focus === 'clan') && game.clues === 0 && roster && roster.choices.some(choice => (choice.effects.cultivation ?? 0) > 0 && !getChoiceError(game, choice))) {
    return eventAdvice(game, roster, '先问清山里的消息', '学堂的巡山差事会交代竹林、山涧和市集的线索，也能为宗族路线积累信任。');
  }

  const wantedClues = focus === 'departure' ? 1 : focus === 'clan' ? 2 : 3;
  if (game.clues < wantedClues) {
    const event = opportunity(game, effects => (effects.clues ?? 0) > 0, ['bamboo', 'stream', 'market', 'cave', 'clan', 'academy']);
    if (event) return eventAdvice(game, event, `再核实一条线索 · ${game.clues} / ${wantedClues}`, `「${event.title}」中有当前能够承担的情报选择。具体代价会在事件里列出。`);
    const followUp = opportunity(game, effects => Boolean(effects.addFlags?.length), ['bamboo', 'market', 'academy', 'stream', 'clan', 'cave']);
    if (followUp) return eventAdvice(game, followUp, '从一份委托打开新的门路', '直接的线索暂时不足，先看看尚可承接的委托。人情和约定可能在另一处地点兑现。');
    return earnAdvice(game, '为下一条线索留些本钱', '仍未解决的情报可能需要元石或材料。可以先补充路费，也可自由走访地图上的其他事件。');
  }

  if (focus === 'clan') {
    const event = opportunity(game, effects => (effects.trust ?? 0) >= 4, ['clan', 'academy', 'bamboo', 'stream', 'market', 'cave']);
    if (event) return eventAdvice(game, event, `让承诺变成信用 · ${game.trust} / 35`, '完成报告、援助或委托可以积累信任；保留哪些独家消息，需要你自己权衡。', 'route');
    const there = { ...game, location: 'clan' as const };
    if (!getActionError(there, { type: 'ACTIVITY' })) {
      return { kind: 'route', title: `还差 ${Math.max(0, 35 - game.trust)} 点宗族信任`, description: '协助清点公仓，每次获得 5 元石与 3 信任，消耗一次行动和 1 真元。', location: 'clan', destination: game.location === 'clan' ? actionDestination({ type: 'ACTIVITY' }, '协助公仓劳作') : actionDestination({ type: 'TRAVEL', location: 'clan' }, '前往议事楼') };
    }
    return restAdvice();
  }

  if (focus === 'departure') {
    const reserve = 35 + getUpkeep(game) * Math.max(0, 6 - game.day);
    if (game.resources.stones < reserve) return earnAdvice(game, '把路费和沿途供养分开留好', `离山路费为 35 元石。按当前携带的蛊估算，等到第六日前还需要 ${reserve - 35} 元石供养；更换装备会改变费用。`);
    return {
      kind: 'route', title: '路费已备好，等第六日商队启程', description: '可以用余下日程修行、准备补给或继续探索；每晚仍需支付供养。',
      destination: !getActionError(game, { type: 'TRAIN' }) ? actionDestination({ type: 'TRAIN' }, '利用余暇修炼') : actionDestination({ type: 'REST' }, '调息准备明日'),
    };
  }

  if (!getActionError(game, { type: 'BREAKTHROUGH' })) {
    return { kind: 'care', title: '你已经具备突破二转的积累', description: `突破花费 12 修为、12 元石和一次行动，提升生命、真元上限。支付后剩 ${game.resources.stones - 12} 元石，今晚还需 ${getUpkeep(game)} 元石供养。`, destination: actionDestination({ type: 'BREAKTHROUGH' }, '突破二转境界') };
  }

  const hasProtection = game.equipped.some(id => !game.hungry.includes(id) && GU.some(gu => gu.id === id && (gu.ability === 'guard' || gu.ability === 'heal')));
  const guardian = readyRoute(game, 'inheritance');
  if (guardian && !hasProtection) {
    const protectiveGu = GU.filter(gu => gu.rank <= game.rank && (gu.ability === 'guard' || gu.ability === 'heal'));
    if (protectiveGu.some(gu => (game.inventory[gu.id] ?? 0) > 0)) {
      return { kind: 'care', title: '线索齐了，再准备一手防护', description: '蛊囊里已有能装备的护身或治疗蛊，试关前可以先换上。药草与清酒也能在战斗中应急。', destination: { kind: 'pane', pane: 'gu', label: '调整随身蛊虫' } };
    }
    const offer = SHOP.find(item => protectiveGu.some(gu => gu.id === item.guId) && (game.purchases[item.id] ?? 0) < item.stock);
    if (offer) {
      if (game.resources.stones < offer.price) return earnAdvice(game, '为试关备一只护身蛊', `${offer.name}需要 ${offer.price} 元石，目前还差 ${offer.price - game.resources.stones}。筹好本钱后可以回市集挑选。`);
      return { kind: 'care', title: '进灯室前，先看看防护与补给', description: `市集仍有${offer.name}，售价 ${offer.price} 元石。它能为守关战增加余地；购买和换装都不消耗行动。`, location: 'market', destination: game.location === 'market' ? { kind: 'pane', pane: 'market', label: '挑选作战用蛊' } : actionDestination({ type: 'TRAVEL', location: 'market' }, '前往市集备战') };
    }
  }
  if (guardian && chapter && game.day <= 8) {
    if (!game.flags.includes('milestone-battle') && game.hp >= Math.ceil(game.maxHp * 0.7) && game.qi >= 8) {
      const practice = (['academy', 'bamboo'] as const).flatMap(location => getAvailableEvents({ ...game, location }))
        .find(event => ['academy-assessment', 'bamboo-boar'].includes(event.id) && event.choices.some(choice => choice.encounterId && !getChoiceError(game, choice)));
      if (practice) return eventAdvice(game, practice, '可选准备 · 先熟悉一次攻防', '可以从切磋或山豕练习看招、护身与回气。探查后仍能选择退出，也可以直接前往遗藏试关。', 'care');
    }
    if (game.rank === 1 && game.cultivation < 12 && !getActionError(game, { type: 'TRAIN' })) {
      return { kind: 'care', title: '可选准备 · 为二转攒下修为', description: `目前 ${game.cultivation} / 12 修为。温养一次消耗 1 行动、3 真元，获得 3 修为；突破另需 12 元石。你也可以保持一转试关。`, destination: actionDestination({ type: 'TRAIN' }, '温养一次空窍') };
    }
    if (!game.flags.includes('milestone-crafted')) {
      const recipe = RECIPES.find(item => !getActionError(game, { type: 'CRAFT', recipeId: item.id, safe: true })
        && game.resources.stones - (item.resources.stones ?? 0) - (item.safeExtra.stones ?? 0) >= getUpkeep(game));
      if (recipe) return { kind: 'care', title: '可选准备 · 材料已经能稳炼一蛊', description: `「${recipe.name}」的蛊与辅材已齐，支付后仍够当前供养。先查看合炼明细，再决定是否投入；现有装备也可直接试关。`, destination: { kind: 'pane', pane: 'forge', label: '查看合炼准备' } };
    }
  }
  if (guardian) return eventAdvice(game, guardian, '可以把准备拿到灯室试一试', '探查后仍可决定是否试关。先看生命、真元与补给，进入战斗后不能临时换蛊。', 'route');
  const event = opportunity(game, effects => Object.keys(effects).length > 0, [game.location, ...LOCATIONS.filter(place => place.id !== game.location).map(place => place.id)]);
  if (event) return eventAdvice(game, event, '山里还有尚未处理的人和事', `可以从「${event.title}」继续，也可切换关注的路线，看看另一种安排。`);
  return restAdvice();
}

function getFangAdvice(game: GameState): JourneyAdvice | null {
  const step = FANG_STEPS.find(item => !game.flags.includes(item.flag));
  if (!step) return null;
  const event = getCampaignEvents(game).find(item => item.id === step.eventId);
  if (!event || getLocationError(game, event.location)) return null;
  const there = { ...game, location: event.location };
  if (!getAvailableEvents(there).some(item => item.id === event.id)) return null;
  const advancing = event.choices.filter(choice => choice.effects.addFlags?.includes(step.flag));
  const affordable = advancing.some(choice => !getChoiceError(there, choice));
  const cost = event.actionCost ?? 1;
  if (affordable && (cost === 0 || game.actions > 0)) {
    return eventAdvice(game, event, step.title, cost === 0
      ? '这段主线不消耗行动。按眼前处境作出选择，资源与人物态度会留在行记中。'
      : '这段探索消耗一次行动。先看清代价，再决定如何运用记忆与手中资源。', 'route');
  }
  if (game.actions === 0) {
    return {
      kind: 'rest', title: '安排下一日的筹备',
      description: `今晚供养折合 ${getUpkeep(game)} 元石。方源篇没有十日离山期限；确认结算后恢复行动与真元。`,
      destination: actionDestination({ type: 'END_DAY' }, '查看日暮结算'),
    };
  }
  const needsRest = advancing.some(choice => (choice.requirements ?? []).some(requirement => requirement.kind === 'stat'
    && (requirement.key === 'hp' || requirement.key === 'qi') && requirement.min !== undefined && game[requirement.key] < requirement.min)
    || (choice.effects.qi ?? 0) < -game.qi);
  if (needsRest) return restAdvice('先调息，再处理眼前的主线');
  const neededGoods = advancing.flatMap(choice => (choice.requirements ?? []).flatMap(requirement => requirement.kind === 'resource'
    && requirement.key !== 'stones' && game.resources[requirement.key] < requirement.min ? [requirement.key] : []));
  const offer = getCampaignShop(game).find(item => neededGoods.some(key => (item.effects.resources?.[key] ?? 0) > 0)
    && !getActionError({ ...game, location: 'market' }, { type: 'BUY', itemId: item.id }));
  if (offer) {
    const market = getCampaignLocations(game).find(place => place.id === 'market')!;
    return {
      kind: 'resources', title: `先补足${offer.name}`,
      description: `这一段需要${offer.name}。可在${market.name}购买，备妥后仍能继续当前主线。`,
      location: 'market', destination: game.location === 'market'
        ? { kind: 'pane', pane: 'market', label: '查看补给' }
        : actionDestination({ type: 'TRAVEL', location: 'market' }, `前往${market.name}`),
    };
  }
  const home = getCampaignLocations(game).find(place => place.id === 'clan')!;
  if (!getActionError({ ...game, location: home.id }, { type: 'ACTIVITY' })) {
    return {
      kind: 'resources', title: '先备齐这一步所需的元石', description: '主线可以暂缓后再回来。整理手边资源换取少量元石，再支付住店、买酒或炼化所需的费用。',
      location: home.id,
      destination: game.location === home.id
        ? actionDestination({ type: 'ACTIVITY' }, home.activity.label)
        : actionDestination({ type: 'TRAVEL', location: home.id }, `前往${home.name}`),
    };
  }
  return eventAdvice(game, event, step.title, '先处理这段主线，再安排后续筹备。', 'route');
}
