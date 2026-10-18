# Strategy prototype interchange contract v1

## Scope and ownership

This contract covers the isolated fourteen-day strategy scenario. It is not a
save-format migration for the existing Fang Yuan or legacy web campaigns.

For P1, `src/game/prototype/content.ts` is the authoritative typed content source.
`npm run prototype:freeze` generates reviewable JSON and reference traces. Do not
hand-edit generated JSON. P2 must explicitly copy generated resources inside the
Godot project root; exported games cannot depend on `res://../shared`.

## Content

`shared/prototype/content.json` is a plain JSON object with these required keys:

- `scenarioId`, `rulesVersion`, `contentVersion`: exact nonempty version strings.
- `parameters`: named finite integer rule parameters.
- `locations`, `gu`, `relations`, `exposures`, `enemies`, `events`: definitions with
  unique stable string IDs and validated references.

Events declare a location, inclusive day window, action cost, requirements and
choices. Choices declare costs, requirements, effects and player-facing risk
text. Requirements and effects are finite discriminated unions, never executable
expressions. See `src/game/prototype/types.ts` for the exact field names.

## Trace envelope

```text
{
  formatVersion: 1,
  scenarioId: string,
  rulesVersion: string,
  contentVersion: string,
  trace: {
    strategyId: "war-ready" | "network" | "labor",
    seed: uint32,
    initialState: PrototypeState,
    actions: PrototypeAction[],
    steps: { action: PrototypeAction, state: PrototypeState }[],
    finalState: PrototypeState,
    summary: RunSummary
  }
}
```

Each step contains the state **after** its matching action. `initialState` must
equal `createPrototype(seed)`. Replaying only legal actions must reproduce every
step and the final state; a final-state-only comparison is insufficient.

The scenarios are deterministic, including the action and RNG draw order.
Resources, dates, counters, cultivation, relationships and RNG state are integers.
The initial seed and RNG are unsigned 32-bit values. GDScript must validate JSON
numbers before converting them to integers and implement the same low-32-bit
multiply/shift behavior. Godot's built-in seeded RNG is not a substitute.

`upkeepDue` records obligations that survive equipment changes. Inventory modes
are `active`, `dormant` and `sealed`; equipment alone does not determine upkeep or
ability. State includes pending events, combat, crisis phase, completed/missed
events, exposure sources, economy ledger and reasons for the ending.

## Canonicalization and integrity

The generated representation sorts object keys recursively and preserves array
order, uses two-space indentation and one trailing newline. SHA256 hashes in
`shared/prototype/manifest.json` cover those exact UTF-8 bytes. Keep array order
until a later contract explicitly classifies a field as an unordered set.

The P1 Node replay checks complete states, including the deterministic ledger and
log. For a Godot port, define a documented rule-state projection before dropping
presentation-only fields; do not silently omit resources, flags, relationships,
inventory, upkeep, missed windows, RNG state/draw count, combat or endings.

## Commands and failures

Node.js 24 is required for native TypeScript imports. New prototype modules use
explicit `.ts` import paths and type-only imports; no TS enums or parameter
properties that need a transpiler.

```sh
npm run prototype:freeze
npm run content:validate
npm run prototype:replay
npm run prototype:audit-combat
npm run prototype:simulate -- --set development --verify
npm run prototype:simulate -- --set holdout --verify --out artifacts/prototype/holdout
npm run prototype:simulate -- --seed 42 --strategy network
```

Unknown, duplicate, missing or conflicting command options fail with a nonzero
exit status. So do invalid content, stale generated output, a changed manifest,
an illegal action, a mismatched state/version or unmet strategy thresholds.
`--verify` requires a complete seed cohort and all three strategies. A custom
single seed is exploratory evidence, not a population balance result.

Replay also requires a terminal ending and recomputes the result summary from
the final state. `prototype:audit-combat` separately searches deterministic V1
combat after legal labor preparation; it does not search all preparation routes.

Development seeds are 1–100; holdout seeds are 10001–10100. Do not tune against the
holdout and then describe it as unseen. Reports state rule/content versions and
retain each seed, ending, action allocation and failure reason. Passing these
three explicit policies is not proof of optimal play or human usability.

## Compatibility

Reference traces are developer fixtures, not player saves or a shipping debug
entry point. Existing browser storage remains untouched. Changes to effects,
resource costs, RNG behavior or action semantics require an explicit rule/content
version decision and fixture regeneration followed by review.
