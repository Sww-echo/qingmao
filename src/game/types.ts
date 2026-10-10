export type ResourceKey = 'stones' | 'herbs' | 'ore' | 'wine';
export type Resources = Record<ResourceKey, number>;
export type LocationId = 'academy' | 'market' | 'bamboo' | 'stream' | 'cave' | 'clan';
export type OriginId = 'disciple' | 'scout' | 'trader';
export type LegacyEndingId = 'inheritance' | 'clan' | 'departure';
export type EndingId = LegacyEndingId | 'fy-first-gu';
export type GuRole = 'attack' | 'defense' | 'support' | 'scouting' | 'economy' | 'movement';
export type GuAbility = 'strike' | 'guard' | 'heal' | 'restore' | 'power' | 'scout' | 'storage' | 'escape' | 'purify';
export type StatKey = 'hp' | 'qi' | 'cultivation' | 'clues' | 'trust' | 'suspicion' | 'rank' | 'day';

export type Requirement =
  | { kind: 'resource'; key: ResourceKey; min: number }
  | { kind: 'stat'; key: StatKey; min?: number; max?: number }
  | { kind: 'flag'; key: string; value?: boolean }
  | { kind: 'gu'; id: string; count?: number; equipped?: boolean };

export interface Effects {
  resources?: Partial<Resources>;
  hp?: number;
  qi?: number;
  cultivation?: number;
  clues?: number;
  trust?: number;
  suspicion?: number;
  addFlags?: string[];
  removeFlags?: string[];
  gu?: Record<string, number>;
  relations?: Record<string, number>;
}

export interface GuDef {
  id: string;
  name: string;
  glyph: string;
  rank: 1 | 2;
  role: GuRole;
  description: string;
  lore: string;
  upkeep: number;
  price: number;
  ability: GuAbility;
  power: number;
  qiCost: number;
  passive: boolean;
}

export interface LocationDef {
  id: LocationId;
  name: string;
  subtitle: string;
  description: string;
  x: number;
  y: number;
  danger: 'safe' | 'wild' | 'danger';
  activity: { label: string; description: string; effects: Effects };
}

export interface OriginDef {
  id: OriginId;
  name: string;
  subtitle: string;
  description: string;
  gu: string[];
  resources: Resources;
  trust: number;
  cultivation: number;
}

export interface NpcDef {
  id: string;
  name: string;
  role: string;
  motive: string;
  location: LocationId;
}

export interface EventChoice {
  id: string;
  label: string;
  description: string;
  requirements?: Requirement[];
  effects: Effects;
  outcome: string;
  encounterId?: string;
  victoryEffects?: Effects;
  victoryText?: string;
  victoryEnding?: EndingId;
  defeatEffects?: Effects;
  ending?: EndingId;
}

export interface EventDef {
  id: string;
  title: string;
  location: LocationId;
  tag: string;
  description: string;
  dayMin?: number;
  dayMax?: number;
  requirements?: Requirement[];
  priority: number;
  actionCost?: 0 | 1;
  repeatable?: boolean;
  choices: EventChoice[];
}

export interface RecipeDef {
  id: string;
  name: string;
  description: string;
  result: string;
  gu: Record<string, number>;
  resources: Partial<Resources>;
  successRate: number;
  safeExtra: Partial<Resources>;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  effects: Effects;
  guId?: string;
}

export interface EnemyMove {
  label: string;
  type: 'attack' | 'guard' | 'drain';
  power: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  subtitle: string;
  hp: number;
  moves: EnemyMove[];
  reward: Effects;
}

export interface EndingDef {
  id: EndingId;
  title: string;
  subtitle: string;
  description: string;
  color: string;
}

export interface JournalEntry {
  id: number;
  day: number;
  text: string;
  kind: 'story' | 'good' | 'bad' | 'info';
}

export interface CombatState {
  enemyId: string;
  enemyHp: number;
  enemyGuard: number;
  playerGuard: number;
  turn: number;
  victoryEffects: Effects;
  victoryText: string;
  victoryEnding?: EndingId;
  defeatEffects: Effects;
  log: string[];
}

export interface RunEnding {
  id: EndingId;
  reason: string;
  outcome: 'success' | 'survived' | 'defeat';
}

export interface GameState {
  version: 1;
  campaign?: 'fang-yuan';
  runId: string;
  seed: number;
  rng: number;
  name: string;
  origin: OriginId;
  day: number;
  actions: number;
  location: LocationId;
  hp: number;
  maxHp: number;
  qi: number;
  maxQi: number;
  rank: 0 | 1 | 2;
  cultivation: number;
  resources: Resources;
  clues: number;
  trust: number;
  suspicion: number;
  inventory: Record<string, number>;
  equipped: string[];
  hungry: string[];
  usedToday: string[];
  flags: string[];
  relations: Record<string, number>;
  seenEvents: string[];
  activeEvent: string | null;
  purchases: Record<string, number>;
  combat: CombatState | null;
  ending: RunEnding | null;
  journal: JournalEntry[];
  nextLogId: number;
}

export type GameAction =
  | { type: 'TRAVEL'; location: LocationId }
  | { type: 'EXPLORE'; eventId?: string }
  | { type: 'ACTIVITY' }
  | { type: 'TRAIN' }
  | { type: 'REST' }
  | { type: 'USE_HERBS' }
  | { type: 'END_DAY' }
  | { type: 'BREAKTHROUGH' }
  | { type: 'CHOOSE'; choiceId: string }
  | { type: 'EQUIP'; guId: string }
  | { type: 'UNEQUIP'; guId: string }
  | { type: 'FEED' }
  | { type: 'BUY'; itemId: string }
  | { type: 'CRAFT'; recipeId: string; safe: boolean }
  | { type: 'COMBAT'; move: 'attack' | 'defend' | 'retreat' | 'gu' | 'herbs' | 'wine'; guId?: string };

export interface EffectiveStats {
  attack: number;
  guard: number;
  scouting: number;
  storage: number;
  escape: number;
}

export interface MetaProgress {
  completedRuns: number;
  endings: EndingId[];
  discoveredGu: string[];
  lastRecordedRun: string | null;
  recordedRunIds?: string[];
}

export interface SaveData {
  version: 1;
  savedAt: string;
  game: GameState;
  meta: MetaProgress;
}
