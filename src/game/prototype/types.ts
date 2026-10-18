export type LocationId = 'academy' | 'inn' | 'bamboo';
export type GuId = 'moonlight' | 'jade-skin' | 'ear-grass' | 'liquor-worm';
export type RelationId = 'guard-captain' | 'innkeeper';
export type ResourceId = 'stones' | 'herbs' | 'wine';
export type GuMode = 'active' | 'dormant' | 'sealed';
export type StrategyId = 'war-ready' | 'network' | 'labor';

export type Requirement =
  | { kind: 'flag'; id: string; present: boolean }
  | { kind: 'resource'; id: ResourceId; min: number }
  | { kind: 'relation'; id: RelationId; min: number }
  | { kind: 'cultivation' | 'clues'; min: number }
  | { kind: 'gu'; id: GuId; usable: boolean }
  | { kind: 'exposure'; id: string };

export type Effect =
  | { kind: 'resource'; id: ResourceId; amount: number }
  | { kind: 'relation'; id: RelationId; amount: number }
  | { kind: 'clues' | 'hp' | 'qi' | 'suspicion'; amount: number }
  | { kind: 'flag'; id: string }
  | { kind: 'gu'; id: GuId }
  | { kind: 'exposure'; id: string; source: string }
  | { kind: 'battle'; enemyId: 'scout-wolf'; purpose: 'patrol' }
  | { kind: 'crisis'; response: 'fight' | 'shelter' };

export interface EventChoice {
  id: string;
  label: string;
  costs: Partial<Record<ResourceId | 'qi', number>>;
  requirements: Requirement[];
  effects: Effect[];
  risk: string;
}

export interface PrototypeEvent {
  id: string;
  title: string;
  location: LocationId;
  fromDay: number;
  throughDay: number;
  actionCost: number;
  requirements: Requirement[];
  description: string;
  choices: EventChoice[];
}

export interface PrototypeContent {
  scenarioId: string;
  rulesVersion: string;
  contentVersion: string;
  parameters: {
    days: number; actionsPerDay: number; startingHp: number; startingQi: number;
    startingStones: number; startingHerbs: number; laborIncome: number;
    trainingQi: number; trainingGain: number; liquorTrainingBonus: number;
    cultivationCap: number; cultivationStep: number; maxQiBonusPerStep: number;
    herbCarryLimit: number; wineCarryLimit: number; herbPrice: number; winePrice: number;
    herbHealing: number; wineQi: number; nightlyHealing: number; suspicionDecay: number;
    scoutQi: number; clueCap: number; sealCost: number; wakeSealedCost: number;
    wakeDormantCost: number; clearExposureCost: number;
    crisisThreatMin: number; crisisThreatMax: number; shelterCost: number;
    retreatDamage: number; retreatStoneLoss: number; scoutProtection: number;
  };
  locations: { id: LocationId; name: string; description: string }[];
  gu: { id: GuId; name: string; role: 'attack' | 'guard' | 'scout' | 'growth'; upkeep: number; qiCost: number; power: number; description: string }[];
  relations: { id: RelationId; name: string; purpose: string }[];
  exposures: { id: string; source: string; consequence: string; remedy: string }[];
  enemies: { id: 'scout-wolf' | 'crisis-pack'; name: string; hpMin: number; hpMax: number; intents: { label: string; damage: number }[]; rewardStones: number }[];
  events: PrototypeEvent[];
}

export interface PrototypeGu { mode: GuMode; equipped: boolean }
export interface PrototypeCombat {
  enemyId: 'scout-wolf' | 'crisis-pack';
  purpose: 'patrol' | 'survey' | 'crisis';
  enemyHp: number;
  turn: number;
  guard: number;
  herbsUsed: number;
  wineUsed: number;
}
export interface PrototypeEnding {
  id: 'held-the-line' | 'shelter-secured' | 'overrun' | 'lost-in-bamboo';
  outcome: 'survived' | 'death';
  reasons: string[];
}
export interface PrototypeLog {
  day: number;
  kind: 'event' | 'economy' | 'growth' | 'upkeep' | 'risk' | 'combat' | 'crisis' | 'management';
  message: string;
}
export interface PrototypeState {
  scenarioId: string;
  rulesVersion: string;
  contentVersion: string;
  seed: number;
  rng: number;
  rngDraws: number;
  day: number;
  actions: number;
  location: LocationId;
  hp: number;
  qi: number;
  cultivation: number;
  clues: number;
  suspicion: number;
  resources: Record<ResourceId, number>;
  relations: Record<RelationId, number>;
  inventory: Partial<Record<GuId, PrototypeGu>>;
  upkeepDue: GuId[];
  flags: string[];
  exposures: { id: string; source: string; day: number }[];
  completedEvents: string[];
  missedEvents: string[];
  activeEvent: string | null;
  combat: PrototypeCombat | null;
  crisis: 'approaching' | 'decision' | 'fighting' | 'resolved';
  ending: PrototypeEnding | null;
  actionCounts: Record<string, number>;
  ledger: { day: number; source: string; resource: ResourceId; amount: number }[];
  log: PrototypeLog[];
}

export type PrototypeAction =
  | { type: 'TRAVEL'; location: LocationId }
  | { type: 'OPEN_EVENT'; eventId: string }
  | { type: 'CHOOSE'; choiceId: string }
  | { type: 'DISMISS_EVENT' }
  | { type: 'WORK' | 'TRAIN' | 'SCOUT' | 'REST' | 'END_DAY' }
  | { type: 'BUY'; item: 'herbs' | 'wine' }
  | { type: 'EQUIP'; guId: GuId; equipped: boolean }
  | { type: 'GU_MODE'; guId: GuId; mode: 'seal' | 'wake' }
  | { type: 'CLEAR_EXPOSURE'; exposureId: string }
  | { type: 'COMBAT'; move: 'attack' | 'defend' | 'moonlight' | 'jade-skin' | 'herbs' | 'wine' | 'retreat' };

/** Policies receive only this projection. RNG and unread future content are absent. */
export interface PublicPrototypeView {
  state: Omit<PrototypeState, 'rng' | 'rngDraws' | 'seed'>;
  availableEvents: PrototypeEvent[];
  legalActions: PrototypeAction[];
  combatForecast: { enemyHp: number; intent: string; incomingDamage: number; defendingDamage: number } | null;
  maxHp: number;
  maxQi: number;
  upkeep: number;
}

export interface RunSummary {
  survived: boolean;
  endingId: PrototypeEnding['id'];
  reasons: string[];
  stones: number;
  cultivation: number;
  activeGu: GuId[];
  wounds: number;
  exposures: string[];
  actionCounts: Record<string, number>;
}
export interface RunTrace {
  strategyId: StrategyId;
  seed: number;
  initialState: PrototypeState;
  actions: PrototypeAction[];
  steps: { action: PrototypeAction; state: PrototypeState }[];
  finalState: PrototypeState;
  summary: RunSummary;
}
export interface BatchReport {
  scenarioId: string;
  rulesVersion: string;
  contentVersion: string;
  seeds: number[];
  results: {
    strategyId: StrategyId;
    runs: number;
    survived: number;
    survivalRate: number;
    meanStones: number;
    meanCultivation: number;
    meanWounds: number;
    meanExposures: number;
    meanActiveGu: number;
    meanActionCounts: Record<string, number>;
    endingCounts: Record<string, number>;
    failures: { seed: number; endingId: PrototypeEnding['id']; reasons: string[] }[];
    summaries: { seed: number; summary: RunSummary }[];
  }[];
}
