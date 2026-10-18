import { PROTOTYPE_CONTENT } from './content.ts';
import { createPrototype, getPrototypeActionError, getPrototypePublicView, isPrototypeGuUsable, prototypeReducer } from './engine.ts';
import type { BatchReport, GuId, PrototypeAction, PrototypeState, PublicPrototypeView, RunSummary, RunTrace, StrategyId } from './types.ts';

const STRATEGIES: StrategyId[] = ['war-ready', 'network', 'labor'];

function legal(view: PublicPrototypeView, action: PrototypeAction): PrototypeAction | null {
  return view.legalActions.find(candidate => JSON.stringify(candidate) === JSON.stringify(action)) ?? null;
}

function travelOr(view: PublicPrototypeView, location: 'academy' | 'inn' | 'bamboo', action: PrototypeAction): PrototypeAction | null {
  return view.state.location === location ? legal(view, action) : legal(view, { type: 'TRAVEL', location });
}

function opportunity(view: PublicPrototypeView, eventId: string): PrototypeAction | null {
  const event = view.availableEvents.find(event => event.id === eventId);
  if (!event || view.state.actions < event.actionCost) return null;
  // Do not travel to an unaffordable event and oscillate between locations.
  const affordable = event.choices.some(choice => Object.entries(choice.costs).every(([id, cost]) =>
    (id === 'qi' ? view.state.qi : view.state.resources[id as 'stones' | 'herbs' | 'wine']) >= cost)
    && choice.requirements.every(requirement => {
      switch (requirement.kind) {
        case 'gu': return requirement.usable ? isPrototypeGuUsable(view.state, requirement.id) : !!view.state.inventory[requirement.id];
        case 'flag': return view.state.flags.includes(requirement.id) === requirement.present;
        case 'relation': return view.state.relations[requirement.id] >= requirement.min;
        case 'resource': return view.state.resources[requirement.id] >= requirement.min;
        case 'clues': return view.state.clues >= requirement.min;
        case 'cultivation': return view.state.cultivation >= requirement.min;
        case 'exposure': return view.state.exposures.some(exposure => exposure.id === requirement.id);
      }
    }));
  if (!affordable) return null;
  return travelOr(view, event.location, { type: 'OPEN_EVENT', eventId });
}

function battlePolicy(view: PublicPrototypeView): PrototypeAction {
  const forecast = view.combatForecast!;
  const hp = view.state.hp;
  const strike = 8 + Math.floor(view.state.cultivation / 6) * 2;
  const canStrike = legal(view, { type: 'COMBAT', move: 'moonlight' });
  if (canStrike && forecast.enemyHp <= strike) return canStrike;
  const attack = legal(view, { type: 'COMBAT', move: 'attack' })!;
  if (forecast.enemyHp <= 3 + Math.floor(view.state.cultivation / 6)) return attack;
  const herbs = legal(view, { type: 'COMBAT', move: 'herbs' });
  if (herbs && (hp <= forecast.incomingDamage + 4 || hp <= 10)) return herbs;
  if (canStrike) return canStrike;
  const wine = legal(view, { type: 'COMBAT', move: 'wine' });
  if (wine && isPrototypeGuUsable(view.state, 'moonlight') && hp > forecast.incomingDamage) return wine;
  if (isPrototypeGuUsable(view.state, 'moonlight') && forecast.incomingDamage >= 8
    && view.state.qi < 3 && hp > forecast.defendingDamage) return legal(view, { type: 'COMBAT', move: 'defend' })!;
  return attack;
}

/** Policy input excludes seed, RNG, draw count and future sampled results. */
export function choosePrototypeStrategyAction(strategyId: StrategyId, view: PublicPrototypeView): PrototypeAction {
  if (!STRATEGIES.includes(strategyId)) throw new RangeError(`unknown strategy: ${strategyId}`);
  if (view.state.ending) throw new Error('cannot choose an action for a finished run');
  if (view.state.combat) return battlePolicy(view);
  if (view.state.activeEvent) {
    if (view.state.activeEvent === 'crisis-arrival') {
      return legal(view, { type: 'CHOOSE', choiceId: 'take-shelter' }) ?? legal(view, { type: 'CHOOSE', choiceId: 'stand' })!;
    }
    return legal(view, { type: 'CHOOSE', choiceId: 'listen' })
      ?? view.legalActions.find(action => action.type === 'CHOOSE')
      ?? legal(view, { type: 'DISMISS_EVENT' })!;
  }
  // All policies accept the same visible opening and warning, including labor.
  for (const eventId of ['briefing', 'moonlight-issue', 'alarm']) {
    const action = opportunity(view, eventId);
    if (action) return action;
  }
  if (view.state.actions === 0) return legal(view, { type: 'END_DAY' })!;

  if (strategyId !== 'labor') {
    const essential: GuId[] = strategyId === 'war-ready' ? ['moonlight', 'jade-skin'] : ['ear-grass'];
    for (const guId of essential) {
      const gu = view.state.inventory[guId];
      if (gu && gu.mode !== 'active' && view.state.resources.stones >= view.upkeep + 2) {
        const action = legal(view, { type: 'GU_MODE', guId, mode: 'wake' });
        if (action) return action;
      }
    }
    for (const eventId of ['inn-introduction', 'academy-commission', 'supply-ledger']) {
      const action = opportunity(view, eventId);
      if (action) return action;
    }
    if (strategyId === 'war-ready') {
      for (const eventId of ['jade-offer', 'liquor-offer']) {
        const action = opportunity(view, eventId);
        if (action) return action;
      }
      if (view.state.cultivation >= 12 && isPrototypeGuUsable(view.state, 'jade-skin')) {
        const rescue = opportunity(view, 'patrol-rescue');
        if (rescue) return rescue;
      }
      if (view.state.cultivation >= 30 && view.state.inventory['liquor-worm']?.mode !== 'sealed') {
        const seal = legal(view, { type: 'GU_MODE', guId: 'liquor-worm', mode: 'seal' });
        if (seal) return seal;
      }
      if (view.state.cultivation < 30 && view.state.resources.stones >= view.upkeep) {
        // TRAIN validation is local; this qi check prevents free travel oscillation.
        if (view.state.qi >= PROTOTYPE_CONTENT.parameters.trainingQi) {
          const train = travelOr(view, 'academy', { type: 'TRAIN' });
          if (train) return train;
        }
      }
    } else {
      for (const eventId of ['eargrass-offer', 'bamboo-signs', 'academy-service', 'guide-report', 'signal-markers', 'shelter-pledge', 'watch-duty', 'shelter-stock']) {
        const action = opportunity(view, eventId);
        if (action) return action;
      }
      if (isPrototypeGuUsable(view.state, 'ear-grass') && view.state.inventory.moonlight?.mode !== 'sealed') {
        const seal = legal(view, { type: 'GU_MODE', guId: 'moonlight', mode: 'seal' });
        if (seal) return seal;
      }
      if (view.state.day >= 8 && view.state.clues < 7 && view.state.qi >= PROTOTYPE_CONTENT.parameters.scoutQi
        && isPrototypeGuUsable(view.state, 'ear-grass')) {
        const scout = travelOr(view, 'bamboo', { type: 'SCOUT' });
        if (scout) return scout;
      }
    }
    if (view.state.resources.herbs < 4) {
      const herbs = opportunity(view, 'healer-herbs');
      if (herbs) return herbs;
    }
    if (view.state.hp <= 18) {
      const rest = travelOr(view, 'academy', { type: 'REST' });
      if (rest) return rest;
    }
    if (view.state.exposures.length && view.state.resources.stones >= PROTOTYPE_CONTENT.parameters.clearExposureCost) {
      const clear = travelOr(view, 'inn', { type: 'CLEAR_EXPOSURE', exposureId: view.state.exposures[0]!.id });
      if (clear) return clear;
    }
  }

  // Everyone can buy the same legal emergency supplies. Labor does not ignore them.
  if (view.state.day === 14) {
    for (const item of ['herbs', 'wine'] as const) {
      const limit = item === 'herbs' ? PROTOTYPE_CONTENT.parameters.herbCarryLimit : PROTOTYPE_CONTENT.parameters.wineCarryLimit;
      const price = item === 'herbs' ? PROTOTYPE_CONTENT.parameters.herbPrice : PROTOTYPE_CONTENT.parameters.winePrice;
      if (view.state.resources[item] < limit && view.state.resources.stones >= price + view.upkeep) {
        const buy = travelOr(view, 'inn', { type: 'BUY', item });
        if (buy) return buy;
      }
    }
    if (view.state.hp < view.maxHp || view.state.qi < view.maxQi) {
      const rest = travelOr(view, 'academy', { type: 'REST' });
      if (rest) return rest;
    }
  }
  return travelOr(view, 'inn', { type: 'WORK' }) ?? legal(view, { type: 'END_DAY' })!;
}

export function summarizePrototypeRun(state: PrototypeState): RunSummary {
  if (!state.ending) throw new Error('run has not reached an ending');
  return {
    survived: state.ending.outcome === 'survived', endingId: state.ending.id,
    reasons: [...state.ending.reasons], stones: state.resources.stones,
    cultivation: state.cultivation,
    activeGu: PROTOTYPE_CONTENT.gu.filter(gu => isPrototypeGuUsable(state, gu.id)).map(gu => gu.id),
    wounds: PROTOTYPE_CONTENT.parameters.startingHp - state.hp,
    exposures: state.exposures.map(exposure => exposure.id), actionCounts: { ...state.actionCounts },
  };
}

export function simulateStrategy(strategyId: StrategyId, seed: number): RunTrace {
  if (!STRATEGIES.includes(strategyId)) throw new RangeError(`unknown strategy: ${strategyId}`);
  const initialState = createPrototype(seed);
  let state = initialState;
  const actions: PrototypeAction[] = [];
  const steps: RunTrace['steps'] = [];
  // Bound accidental policy loops. This is a harness failure, never a fabricated ending.
  while (!state.ending && steps.length < 600) {
    const action = choosePrototypeStrategyAction(strategyId, getPrototypePublicView(state));
    if (!action) throw new Error(`policy ${strategyId} produced no action on day ${state.day}`);
    const error = getPrototypeActionError(state, action);
    if (error) throw new Error(`policy ${strategyId} proposed an illegal action: ${JSON.stringify(action)}: ${error}`);
    state = prototypeReducer(state, action);
    actions.push(structuredClone(action));
    steps.push({ action: structuredClone(action), state });
  }
  if (!state.ending) throw new Error(`policy ${strategyId} exceeded 600 steps for seed ${seed}`);
  return { strategyId, seed, initialState, actions, steps, finalState: state, summary: summarizePrototypeRun(state) };
}

export function simulateBatch(strategyIds: readonly StrategyId[], seeds: readonly number[]): BatchReport {
  if (strategyIds.length === 0 || seeds.length === 0) throw new RangeError('strategies and seeds must be nonempty');
  if (new Set(strategyIds).size !== strategyIds.length || new Set(seeds).size !== seeds.length) throw new RangeError('strategies and seeds must be unique');
  return {
    scenarioId: PROTOTYPE_CONTENT.scenarioId, rulesVersion: PROTOTYPE_CONTENT.rulesVersion,
    contentVersion: PROTOTYPE_CONTENT.contentVersion, seeds: [...seeds],
    results: strategyIds.map(strategyId => {
      const summaries = seeds.map(seed => ({ seed, summary: simulateStrategy(strategyId, seed).summary }));
      const sum = (select: (summary: RunSummary) => number) => summaries.reduce((total, item) => total + select(item.summary), 0);
      const endingCounts: Record<string, number> = {};
      const meanActionCounts: Record<string, number> = {};
      for (const { summary } of summaries) {
        endingCounts[summary.endingId] = (endingCounts[summary.endingId] ?? 0) + 1;
        for (const [id, count] of Object.entries(summary.actionCounts)) meanActionCounts[id] = (meanActionCounts[id] ?? 0) + count / summaries.length;
      }
      const survived = sum(summary => Number(summary.survived));
      return {
        strategyId, runs: summaries.length, survived, survivalRate: survived / summaries.length,
        meanStones: sum(summary => summary.stones) / summaries.length,
        meanCultivation: sum(summary => summary.cultivation) / summaries.length,
        meanWounds: sum(summary => summary.wounds) / summaries.length,
        meanExposures: sum(summary => summary.exposures.length) / summaries.length,
        meanActiveGu: sum(summary => summary.activeGu.length) / summaries.length,
        meanActionCounts, endingCounts,
        failures: summaries.filter(item => !item.summary.survived).map(({ seed, summary }) => ({ seed, endingId: summary.endingId, reasons: summary.reasons })),
        summaries,
      };
    }),
  };
}
