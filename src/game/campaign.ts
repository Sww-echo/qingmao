import { ENEMIES, ENDINGS, EVENTS, GU, LOCATIONS, NPCS, RECIPES, SHOP } from './content';
import {
  FANG_ENEMIES, FANG_ENDINGS, FANG_EVENTS, FANG_GU, FANG_LOCATIONS, FANG_NPCS, FANG_RECIPES, FANG_SHOP,
} from './fang-content';
import { WOLF_TIDE_DAY } from './world-clock';
import type { GameState, LocationId } from './types';

export type CampaignContext = Pick<GameState, 'campaign'>;
/** 方源篇的日期上限：狼潮在这一天结束当日时结算，之后不再推进。 */
export const MAX_FANG_DAY = WOLF_TIDE_DAY;

export const isFangYuan = (game: CampaignContext): boolean => game.campaign === 'fang-yuan';
export const getCampaignEvents = (game: CampaignContext) => isFangYuan(game) ? FANG_EVENTS : EVENTS;
export const getCampaignLocations = (game: CampaignContext) => isFangYuan(game) ? FANG_LOCATIONS : LOCATIONS;
export const getCampaignNpcs = (game: CampaignContext) => isFangYuan(game) ? FANG_NPCS : NPCS;
export const getCampaignGu = (game: CampaignContext) => isFangYuan(game) ? FANG_GU : GU;
export const getCampaignShop = (game: CampaignContext) => isFangYuan(game) ? FANG_SHOP : SHOP;
export const getCampaignRecipes = (game: CampaignContext) => isFangYuan(game) ? FANG_RECIPES : RECIPES;
export const getCampaignEnemies = (game: CampaignContext) => isFangYuan(game) ? FANG_ENEMIES : ENEMIES;
/** 可记入成就的终局；败退与死亡另有展示，不作为解锁路线。 */
export const getCampaignEndings = (game: CampaignContext) => isFangYuan(game) ? FANG_ENDINGS : ENDINGS;

// Cross-run discoveries may include both campaigns. Runtime and save contents use the selectors above.
export const ALL_GU = [...new Map([...GU, ...FANG_GU].map(gu => [gu.id, gu])).values()];
export const ALL_ENDINGS = [...ENDINGS, ...FANG_ENDINGS];
export const ALL_NPCS = [...NPCS, ...FANG_NPCS];

/**
 * 方源篇地点随时间与真实因果开放，不再按主线顺序逐个解锁。
 * 市集、竹林按日期开放；溪边与石洞仍要求实际找到酒虫踪迹——这是真因果，不是流程顺序。
 */
export function getLocationError(game: GameState, location: LocationId): string | null {
  if (!isFangYuan(game)) return null;
  const gates: Partial<Record<LocationId, { day?: number; flag?: string; reason: string }>> = {
    academy: { flag: 'fy-reborn', reason: '先在家宅理清重生后的处境。' },
    market: { day: 3, reason: '第 3 日起，客栈酒肆才开门待客。' },
    bamboo: { day: 6, reason: '第 6 日起，才能自行出寨到竹林走动。' },
    stream: { flag: 'fy-liquor-lured', reason: '先在竹林引出酒虫，再跟随它前往溪边。' },
    cave: { flag: 'fy-trail-found', reason: '先沿溪追踪酒虫，查明石缝的位置。' },
  };
  const gate = gates[location];
  if (!gate) return null;
  if (gate.day !== undefined && game.day < gate.day) return gate.reason;
  if (gate.flag && !game.flags.includes(gate.flag)) return gate.reason;
  return null;
}

export function getCampaignLabel(game: CampaignContext): string {
  return isFangYuan(game) ? '方源篇 · 青茅生存' : '原创支线 · 石灯遗藏';
}
