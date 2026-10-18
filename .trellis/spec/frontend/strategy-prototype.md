# Strategy prototype contracts

## 1. Scope / Trigger

Applies to `src/game/prototype/`, the `scripts/prototype-*.mjs` commands,
`scripts/validate-prototype-content.mjs`, and generated `shared/` fixtures. These
are executable P1 contracts for the isolated fourteen-day scenario and the P2
Godot port. Existing campaign initialization, UI, browser saves, and the 165-day
timeline do not import this module.

`src/game/prototype/content.ts` owns typed content. Generated JSON is reviewed
output, never a second editable authority. See
`shared/contracts/prototype-trace-v1.md` for the interchange format.

## 2. Signatures

```ts
createPrototype(seed: number): PrototypeState
getPrototypeActionError(state: PrototypeState, action: PrototypeAction): string | null
prototypeReducer(state: PrototypeState, action: PrototypeAction): PrototypeState
getAvailablePrototypeEvents(state: PrototypeState): PrototypeEvent[]
getPrototypePublicView(state: PrototypeState): PublicPrototypeView
validatePrototypeContent(content?: unknown): string[]
summarizePrototypeRun(state: PrototypeState): RunSummary
simulateStrategy(strategyId: StrategyId, seed: number): RunTrace
simulateBatch(strategyIds: readonly StrategyId[], seeds: readonly number[]): BatchReport
```

```sh
npm run prototype:freeze [-- --check]
npm run content:validate
npm run prototype:replay [-- --file path]
npm run prototype:audit-combat
npm run prototype:simulate -- --set development --verify --out artifacts/prototype/development
npm run prototype:simulate -- --set holdout --verify --out artifacts/prototype/holdout
npm run prototype:simulate -- --seed 42 --strategy network
```

Use Node.js 24 for CLI execution. Prototype imports use explicit `.ts` extensions,
type-only imports, and erasable TypeScript syntax. No environment variables are
required. Policies are `war-ready`, `network`, and `labor`.

## 3. Contracts

- Seed is an integer in `[0, 4294967295]`. State contains the seed, uint32 RNG
  state, and draw count. Randomness uses the engine's documented Mulberry32
  operations, never `Math.random`, wall time, or the host engine's seeded RNG.
- Rejected actions return the original state reference, consume no randomness,
  append no log or ledger entry, and leave nested fields unchanged. Accepted
  actions produce a new state without mutating the input.
- `PublicPrototypeView` omits seed/RNG/draw count and exposes current legal
  actions, known opportunities, and enemy intent. Policies receive this view;
  they cannot peek at future draws or inject resources.
- Event windows are inclusive. Opening/dismissing is free; committing a choice
  pays the event's action cost and resource costs once. Completed and missed
  events cannot grant duplicate rewards. A mandatory crisis cannot be dismissed.
  Content validation preserves the engine-triggered `crisis-arrival` node and its
  free, unconditional `stand` response so missed preparation cannot soft-lock the
  decision. Optional choice gates are not mandatory event dependencies; the
  monotone reachability audit checks events, not every branch or economic path.
- Owned, unsealed Gu incur upkeep even when unequipped or dormant. `upkeepDue`
  preserves obligations already incurred that day; sealing cannot erase them.
  Abilities require both active mode and equipment. Low resources preserve safe
  labor and rest; no negative resources or permanent Gu death is introduced.
- Day fourteen's `END_DAY` settles upkeep before the crisis decision. No new
  training, shopping, management, or expired commission can happen afterwards.
  Combat consumes combat turns rather than daily actions; victory prevents an
  extra enemy strike. Retreat provides no victory reward and is counted as a
  combat action. Ending reasons report actual per-fight herb/wine use, including
  zero, and name a lethal shelter interception as its cause.
- Numbers and counters are integer rule data. Stable IDs drive logic; translated
  display text is not a key. Requirements and effects are finite tagged unions,
  never executable strings.
- A version-1 trace includes versions, strategy, seed, initial state, actions,
  post-action snapshots, final state, and recomputable summary. Replay checks
  every step, a terminal ending, and the summary. Canonical JSON sorts object keys
  recursively, preserves array order, and uses two spaces plus a trailing newline.
- Manifest hashes cover exact UTF-8 file bytes. `prototype:freeze --check` detects
  source, content, trace, and manifest drift. Regeneration requires an explicit
  rule/content version decision; inspect the diff before accepting it.
- Development seeds are 1–100; holdout seeds are 10001–10100. Freeze before
  holdout evaluation. Preserve failures, disclose any tuning against holdout, and
  report action allocations and resource costs alongside survival rates.
- `prototype:audit-combat` searches final combat after legal labor preparation
  using the reducer, merging identical boards and pruning lower-HP boards with
  identical remaining resources. This V1-only audit validates every winning
  witness against the original state. It rejects changed RNG draw counts and
  requires review when the rule version changes. It does not search preparation.

## 4. Validation & Error Matrix

| Boundary | Condition | Behavior |
| --- | --- | --- |
| Initialization | Noninteger, negative, or overflowing seed | Throws `RangeError` |
| Action | Unknown payload, unavailable event, unaffordable choice, invalid phase | Nonempty rejection reason; reducer preserves identity |
| Event | Dismiss/reopen, duplicate completion, elapsed window | No duplicate reward; invalid commit rejected |
| Upkeep | Equipment toggle or same-day seal after obligation | Obligation remains due |
| Content | Invalid IDs, references, discriminants, numbers, or event structure | Validation errors; CLI exits nonzero |
| CLI | Unknown, duplicate, missing, conflicting options | Exits nonzero |
| Verification | Single seed or single strategy with `--verify` | Exits nonzero |
| Replay | Version/seed/action/snapshot/final/summary mismatch | Exits nonzero at the failed boundary |
| Freeze | Generated bytes differ from current source/trace | `--check` exits nonzero |
| Balance | War/network survival <70% or labor >40% | `--verify` exits nonzero; retain report |

## 5. Good / Base / Bad Cases

- Good: prepare an actual combat build or fulfill the information/shelter chain;
  finish via legal operations and reproduce the complete trace.
- Base: no money for upkeep makes unsealed Gu dormant; safe labor earns money,
  and a later paid upkeep or wake action restores use. No debug grant is needed.
- Bad: earn money, unequip or seal a Gu immediately before settlement, and expect
  that day's obligation to disappear. The charge still applies.
- Bad: edit a trace's success flag while retaining its original snapshots. Replay
  recomputes the summary and fails.

## 6. Tests Required

Run `npm run check`, content validation, reference replay, and the development
simulation after rule changes. Evaluate holdout after freezing; do not repeatedly
tune on it. Required behavioral assertions include:

- Identical seed/action sequences reproduce every state and RNG draw count;
  illegal actions preserve identity and the complete state.
- Same-seed counterfactuals show cultivation, effective Gu, and actual relations
  affect damage, options, or outcomes independently.
- Event dismissal/window expiry/repeated choice cannot duplicate income or
  rewards; prerequisites refer to real reachable effects.
- Unequip/seal/wake cannot evade incurred upkeep; insufficient upkeep and
  subsequent recovery leave valid legal actions.
- Enemy intent, lethal action, healing, qi recovery, and retreat obey ordering,
  resource limits, and final-crisis restrictions.
- Malformed content and tampered or incompatible replay input fail explicitly.
- All policies terminate legally; retain all seeds and failure reasons. Passing
  three policies does not establish global balance or human comprehension.
- Run `npm run prototype:audit-combat` when changing combat or the labor policy;
  distinguish weak-policy failures from an inability to survive with the same
  preparation and better tactical play.

The old browser E2E has a documented baseline selector/version mismatch in
`10-18-godot-strategy-prototype/baseline.md`; record it separately from new unit
regressions. Godot execution/export and human playtesting need later evidence.

## 7. Wrong vs Correct

Wrong: the UI deducts money directly or uses Godot's built-in seeded RNG while
claiming compatibility with the TS fixture.

Correct: dispatch a legal action through the rules and compare the resulting
state with the reference step. Port uint32 multiply/shift/truncation and RNG draw
order explicitly before attempting a complete trace.

```ts
const error = getPrototypeActionError(state, action);
if (error) return { state, error };
return { state: prototypeReducer(state, action), error: null };
```

P2 must copy generated content and fixtures inside the Godot resource root;
exported builds cannot depend on `res://../shared`. Any reduced state projection
must be documented before excluding fields from cross-engine comparisons.
