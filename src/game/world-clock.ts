/**
 * 方源篇的世界时钟：季节、固定世界事件与狼潮期限。
 * 全部由 `day` 派生，不写入存档；日期是压缩后的游戏时间，不是原著逐日账目。
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export const SEASON_LENGTH = 30;
export const SEASONS_PER_YEAR = 4;
export const YEAR_LENGTH = SEASON_LENGTH * SEASONS_PER_YEAR;
/** 狼潮在第 165 日结束当日时结算；此前是玩家筹备的全部时间。 */
export const WOLF_TIDE_DAY = 165;
export const WOLF_TIDE_WARNING_DAY = 125;

export const SEASON_NAMES: Record<Season, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
export const SEASON_NOTES: Record<Season, string> = {
  spring: '山花初开，商队将至。',
  summer: '天光炽烈，狼群渐近。',
  autumn: '草木转黄，正是筹备的时节。',
  winter: '风雪封山，留力者方能过冬。',
};

export function getSeason(day: number): Season {
  const index = Math.floor((Math.max(1, day) - 1) / SEASON_LENGTH) % SEASONS_PER_YEAR;
  return (['spring', 'summer', 'autumn', 'winter'] as const)[index]!;
}

export function getYear(day: number): number {
  return Math.floor((Math.max(1, day) - 1) / YEAR_LENGTH) + 1;
}

/** 距狼潮结算还剩几日；已到或已过返回 0。 */
export function daysUntilWolfTide(day: number): number {
  return Math.max(0, WOLF_TIDE_DAY - day);
}

export interface WorldEventDef {
  id: string;
  name: string;
  /** 最早可触发的日期。 */
  opens: number;
  /** 关闭日期；缺省表示到狼潮为止持续有效。 */
  closes?: number;
  /** 错失后的说明，写入结算与手记。 */
  missedNote: string;
  /** 触发时写入手记的说明。 */
  firedNote: string;
  /** 未开窍即错失、会直接结束本局的死局节点。 */
  fatal?: boolean;
}

/** 固定世界事件。时间不会因玩家行为而改变，玩家只能改变自己的准备。 */
export const WORLD_EVENTS: WorldEventDef[] = [
  {
    id: 'fy-awakening-fair', name: '开窍大典', opens: 2, closes: 5, fatal: true,
    firedNote: '开窍大典在花海举行。空窍是否开启，从这一刻起决定你还有没有修行的资格。',
    missedNote: '你错过了开窍大典。没有空窍，此生与蛊师之路无缘。',
  },
  {
    id: 'fy-merchant-window', name: '商队到来', opens: 25, closes: 32,
    firedNote: '商队的驼铃在山道上响起。一年之中，这是唯一能外购蛊虫、销赃与赌石的窗口。',
    missedNote: '商队已经离山。本年度的外购与销赃窗口就此关闭。',
  },
  {
    id: 'fy-year-end-trial', name: '年末考核', opens: 100, closes: 110,
    firedNote: '年末考核与分家资格评审同时开始。',
    missedNote: '你错过了年末考核，学堂毕业与分家资格都要推迟。',
  },
  {
    id: 'fy-wolf-tide-omen', name: '狼潮前兆', opens: WOLF_TIDE_WARNING_DAY,
    firedNote: '山寨外的残狼群越来越多，狼潮的前奏已经打响。',
    missedNote: '',
  },
];

/** 当前正在窗口内的世界事件（已开启、未关闭）。 */
export function activeWorldEvents(day: number): WorldEventDef[] {
  return WORLD_EVENTS.filter(event => day >= event.opens && (event.closes === undefined || day <= event.closes));
}

/** 下一个尚未开启的世界事件；没有则返回 null。 */
export function nextWorldEvent(day: number): WorldEventDef | null {
  return WORLD_EVENTS.find(event => day < event.opens) ?? null;
}

export interface WolfTideOutcome {
  id: 'fy-wolf-tide-death' | 'fy-wolf-tide-survived' | 'fy-wolf-tide-stood';
  outcome: 'defeat' | 'survived' | 'success';
  reason: string;
}

export interface WolfTideStanding {
  rank: number;
  guKinds: number;
  stones: number;
  suspicion: number;
  hasLiquorWorm: boolean;
  sawInheritance: boolean;
}

/** 狼潮结算：按玩家本钱打分，不看是否走完原著主线。 */
export function scoreWolfTide(standing: WolfTideStanding): number {
  // 未开窍 0 · 一转 1 · 二转及以上 6（本阶段最高一转；二转以上留给后续阶段）
  const rankScore = standing.rank <= 0 ? 0 : standing.rank === 1 ? 1 : 6;
  const guScore = Math.min(4, Math.max(0, standing.guKinds));
  const stoneScore = standing.stones >= 120 ? 3 : standing.stones >= 60 ? 2 : standing.stones >= 20 ? 1 : 0;
  const suspicionPenalty = standing.suspicion >= 60 ? 2 : 0;
  const flagScore = (standing.hasLiquorWorm ? 1 : 0) + (standing.sawInheritance ? 1 : 0);
  return rankScore + guScore + stoneScore - suspicionPenalty + flagScore;
}

export function judgeWolfTide(standing: WolfTideStanding): WolfTideOutcome {
  const score = scoreWolfTide(standing);
  if (score <= 3) {
    return {
      id: 'fy-wolf-tide-death', outcome: 'defeat',
      reason: `狼潮冲破寨门。以你此刻的境界、蛊虫与元石，没能在这一夜活下来（本钱 ${score}）。`,
    };
  }
  if (score <= 7) {
    return {
      id: 'fy-wolf-tide-survived', outcome: 'survived',
      reason: `你在狼潮的第一夜活了下来，但本钱已尽（本钱 ${score}）。青茅山元气大伤，前路更险。`,
    };
  }
  return {
    id: 'fy-wolf-tide-stood', outcome: 'success',
    reason: `你在狼潮中站住了（本钱 ${score}）。青茅山的格局自此有你一席，接下来的路仍要自己走。`,
  };
}
