import { ENEMIES, ENDINGS, EVENTS, GU, LOCATIONS, NPCS, RECIPES, SHOP } from './content';
import {
  FANG_ENEMIES, FANG_ENDINGS, FANG_EVENTS, FANG_GU, FANG_LOCATIONS, FANG_NPCS, FANG_RECIPES, FANG_SHOP,
} from './fang-content';
import type { GameState, LocationId } from './types';

export type CampaignContext = Pick<GameState, 'campaign'>;
export const MAX_FANG_DAY = 10_000;

export const isFangYuan = (game: CampaignContext): boolean => game.campaign === 'fang-yuan';
export const getCampaignEvents = (game: CampaignContext) => isFangYuan(game) ? FANG_EVENTS : EVENTS;
export const getCampaignLocations = (game: CampaignContext) => isFangYuan(game) ? FANG_LOCATIONS : LOCATIONS;
export const getCampaignNpcs = (game: CampaignContext) => isFangYuan(game) ? FANG_NPCS : NPCS;
export const getCampaignGu = (game: CampaignContext) => isFangYuan(game) ? FANG_GU : GU;
export const getCampaignShop = (game: CampaignContext) => isFangYuan(game) ? FANG_SHOP : SHOP;
export const getCampaignRecipes = (game: CampaignContext) => isFangYuan(game) ? FANG_RECIPES : RECIPES;
export const getCampaignEnemies = (game: CampaignContext) => isFangYuan(game) ? FANG_ENEMIES : ENEMIES;
/** Successful chapter conclusions; failure is presented separately, never as an unlocked route. */
export const getCampaignEndings = (game: CampaignContext) => isFangYuan(game) ? FANG_ENDINGS : ENDINGS;

// Cross-run discoveries may include both campaigns. Runtime and save contents use the selectors above.
export const ALL_GU = [...new Map([...GU, ...FANG_GU].map(gu => [gu.id, gu])).values()];
export const ALL_ENDINGS = [...ENDINGS, ...FANG_ENDINGS];
export const ALL_NPCS = [...NPCS, ...FANG_NPCS];

/** The same locks apply to map affordances, travel and imported saves. */
export function getLocationError(game: GameState, location: LocationId): string | null {
  if (!isFangYuan(game)) return null;
  const gates: Partial<Record<LocationId, { flag: string; reason: string }>> = {
    academy: { flag: 'fy-reborn', reason: '先在家宅理清重生后的处境。' },
    market: { flag: 'fy-rain-prepared', reason: '先处理家宅交涉与雨中试炼，再去客栈筹备。' },
    bamboo: { flag: 'fy-wine-bought', reason: '先在酒肆取得青竹酒，再沿山径引虫。' },
    stream: { flag: 'fy-liquor-lured', reason: '先在山径引出酒虫，再跟随它前往溪边。' },
    cave: { flag: 'fy-trail-found', reason: '先沿溪追踪酒虫，查明石缝的位置。' },
  };
  const gate = gates[location];
  return gate && !game.flags.includes(gate.flag) ? gate.reason : null;
}

export function getCampaignLabel(game: CampaignContext): string {
  return isFangYuan(game) ? '方源篇 · 重生初炼' : '原创支线 · 石灯遗藏';
}
