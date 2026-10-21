# Godot foundation contracts

## 1. Scope / Trigger

Applies to the W1 data boundary, W2 V1 rules and W3 session/save boundary in
`godot/domain/`, `godot/application/`, `godot/infrastructure/`, the suite runner,
content/comparison tooling, and export presets.
Keep the W0 shell and existing React game isolated.

The authoritative V1 content/types remain `src/game/prototype/`. Never edit
generated `shared/` or Godot copies to make a compatibility test pass.

## 2. Signatures

```gdscript
Rng32.from_seed(seed: int) -> Rng32
Rng32.step(rng: int) -> Dictionary # {rng, numerator, value}
CanonicalJson.encode(value: Variant) -> Dictionary
CanonicalJson.sha256(bytes: PackedByteArray) -> String
ContentValidation.validate(value: Variant) -> PackedStringArray
ContentCatalog.new(validated_content: Dictionary)
GameAction.decode(value: Variant, catalog: ContentCatalog, active_event: String = "") -> Dictionary
StateCodec.decode(value: Variant, catalog: ContentCatalog) -> Dictionary
StateCodec.encode(state: GameState, catalog: ContentCatalog) -> Dictionary
ContentLoader.load_pack(pack_id: String = "prototype") -> Dictionary
ContentLoader.verify_all() -> Dictionary
```

```sh
npm run godot:sync-content [-- --pack prototype --check]
npm run godot:validate-content [-- --file path]
npm run godot:test-tools
Godot --headless --path godot --editor --quit
Godot --headless --path godot --script res://tests/run_all.gd [-- --suite=name]
Godot --headless --path godot -- --verify-content
```

Node 24 is required for native TS imports. The verified local engine is
`4.7.2.stable.official.ed1daf0bf`, installed at
`~/Applications/Godot.app/Contents/MacOS/Godot`. Import resources before tests on a
fresh checkout. No environment variables are required by content tooling.
Set `GODOT_BIN` when running `godot:test-tools` to include isolated process tests
for runner exit codes and manifest rejection; those tests otherwise skip.

## 3. Contracts

- Pure data classes extend `RefCounted`; no scene, input, or clock dependencies.
  Explicit snake_case model to camelCase JSON mapping preserves every state
  field, including log, ledger, seed, RNG state/draws, and array order.
- Codec results are `{ok:true,state}` / `{ok:true,data}` or `{ok:false,error}`.
  Action decoding returns `{ok:true,action}` or an error; `action.to_data()`
  emits only fields belonging to its tag. It checks payload shape/references,
  not gameplay legality. Supply the selected active event to constrain choices.
- JSON numeric floats representing integers are accepted only after finite,
  integral, safe-range checks. Never cast first. `seed`/`rng` are uint32;
  other ranges follow selected content capacities. Unknown fields and references
  are rejected. Catalog construction requires successfully validated content.
- W1 accepts only `qingmao-fourteen-day-prototype` / `prototype-rules-1` /
  `prototype-content-1`. Node selects this tuple before delegating to the frozen
  validator. Godot mirrors V1 schema, dependencies and monotone feasibility audit.
  Printable ASCII keys and no string control characters are additional
  interchange boundary constraints. Malformed JSON-shaped payloads return
  validation errors even when the frozen validator cannot stringify a bad ID.
  V2 is not an accepted alias.
- Canonical encoding returns `{ok:true,text,bytes}` or `{ok:false,error}`.
  Safe integers use decimal notation; arrays preserve order; objects sort ASCII
  keys; two-space indentation and exactly one trailing LF are required. Match
  Node's integer-index property enumeration for numeric-looking object keys
  (indices first in numeric order). Empty objects/arrays remain `{}`/`[]`.
  SHA256 covers UTF-8 bytes, not a host engine's JSON representation.
- Mulberry32 uses low-32-bit multiplication with 16-bit limbs, unsigned shifts,
  and explicit masking. `step` returns new state, uint32 numerator, and numerator
  divided by `2^32`; Godot's native seeded RNG is not equivalent.
- Sync validates all inputs before writing. The manifest records versions,
  `packId`, and `files[{source,path,sha256,kind}]`; paths are inside `res://`.
  Content and three trace fixtures are byte copies, never reserialized copies.
  Only `kind:content` is read at runtime. `--check` compares expected bytes
  without creating directories or repairing anything. Every manifest hash,
  including development-only fixture records, must be 64 lowercase hex digits.
- Both export presets explicitly include `content/generated/*/*.json` and
  exclude `tests/*`. Run the exported executable's `-- --verify-content`;
  it verifies every built-in pack and reports version/hash before exiting.

## 4. Validation & Error Matrix

| Boundary | Condition | Behavior |
| --- | --- | --- |
| Canonical JSON | Fraction, nonfinite/unsafe number, non-ASCII key, unsupported type, cycle/depth overflow | `ok:false`, no implicit conversion |
| Codec | Missing/unknown field, bad enum/reference/version or numeric range | `ok:false`; no partial model accepted |
| Content | Extra V2 field/enemy, bad reference/cycle/required crisis fallback | Validation errors; V1 is never relaxed |
| Sync CLI | Unknown, duplicate, missing or unsupported option/pack | Nonzero exit; V2/all fail until W6 |
| Sync input | Noncanonical bytes, bad trace or source hash/version | Failure before output writes |
| Sync check | Missing/changed output, altered manifest, extra generated file | Nonzero; files remain unchanged |
| Runtime | Missing/noncanonical content, corrupt manifest, hash/version mismatch | Loud failure; self-check exits 1 |
| Runner | Assertion failure | Exit 1 |
| Runner | Invalid suite/arguments or missing environment input | Exit 2 |
| Startup | Unknown user arguments | Exit 2 |

## 5. Good / Base / Bad Cases

- Good: sync frozen resources, import, run five suites, export, then verify the
  exported binary independently of the repository resource tree.
- Base: parse JSON numeric `4294967295.0`, validate its range/integrality, then
  normalize to the same uint32 integer bytes. This is not accepting fractions.
- Bad: load V2 data with the V1 schema, weaken the V1 whitelist, or substitute
  Godot `JSON.stringify` and assume matching hashes.
- Bad: ship a manifest and call export successful without testing the content
  JSON inside the exported resource pack.

## 6. Tests Required

Run the five suites `smoke`, `rng_vectors`, `canonical_json`, `state_codec`,
`content_validation`; retain all 36 W0 checks. Assert:

- RNG seed vectors 0/1/12185/4294967295, first three draws and states.
- Frozen content parse/encode is byte-identical, including its SHA256.
- Every state and action in all three frozen traces round-trips without loss.
  Codec conversion is not evidence of rule replay.
- Fractional/out-of-range numbers, bad references, unknown fields, unsupported
  versions, and malformed nested values fail without mutating inputs.
- V1 schema/dependency/cycle/monotone negative cases reject malformed content.
- Tool tests exercise read-only drift failure, missing outputs, bad source
  manifests, extra files and strict CLI options in isolated temporary roots.
- Exported macOS content verification passes; test fixtures are not shipped.

For full-scope verification, also run `npm run check`, `content:validate`,
`prototype:replay`, `prototype:freeze -- --check`, and the development simulation.
No new holdout evaluation or V2 tuning belongs to W1.

## 8. V1 Rules and Equivalence (W2)

```gdscript
Rules.create(seed: int, catalog: ContentCatalog) -> GameState
Rules.validate(state: GameState, action: Dictionary, catalog: ContentCatalog) -> Dictionary
Rules.apply(state: GameState, action: Dictionary, catalog: ContentCatalog) -> Dictionary
Queries.public_view(state: GameState, catalog: ContentCatalog) -> Dictionary
GameState.clone() -> GameState
GameState.to_data() -> Dictionary
```

- `validate` returns `{ok:true}` or
  `{ok:false,error:{code:"rule-rejected",message,fieldPath:"action"}}`. Preserve
  the frozen TS validation order and Chinese rejection messages. The action
  argument is a Dictionary; nonobject input is rejected by the action codec.
- `Rules.create` validates the uint32 seed and catalog with runtime checks and
  returns `null` on failure; never rely on assertions for release behavior.
- `apply` validates before cloning or drawing randomness. Success returns
  `{ok:true,state,events}`; `events` is the detached list of new log dictionaries.
  Both rejected and accepted actions leave the entire input model and action
  unchanged. The rule-group modules mutate only the accepted clone.
- `GameState.to_data()` is the domain's detached camelCase projection. Keep its
  complete field mapping consistent with the strict codec; queries must never
  import infrastructure. `public_view` drops seed/RNG/draw count and returns
  detached state/content/actions. Test policies accept only that public view
  and the public catalog, never a raw state or seed.
- TRAVEL spends no action. SCOUT does not require a Gu: a usable, equipped
  ear-grass prevents risk draws; otherwise draw risk, then enemy HP only if an
  encounter starts. Daily upkeep is all-or-nothing, equipment removal does not
  waive it, and sealing preserves an already accrued obligation. The final
  END_DAY pays upkeep and opens crisis without healing, qi refill, suspicion
  decay, action reset, or next-day upkeep reconstruction.
- Combat computes intent before the move and damage after defensive changes.
  Killing prevents retaliation. Survey victories grant no patrol reward;
  crisis retreat is fatal. Preserve log, ledger and ending-reason order.

```sh
Godot --headless --path godot --script res://tests/run_all.gd -- --suite=rules_unit
Godot --headless --path godot --script res://tests/run_all.gd -- --suite=v1_replay
npm run godot:compare -- --set development
npm run godot:compare -- --set holdout
npm run godot:compare -- --set all
node scripts/prototype-replay.mjs --seed 42 --policy network --dump artifacts/godot/debug.json
```

The dump is a complete, verified developer trace, not a save format. It requires
seed/policy/output together and cannot be combined with `--file`. Frozen TS,
shared content and golden traces must not change to hide a mismatch.

Comparison expectations contain actions, initial plus every post-action full
state SHA256, summary, and a cumulative action/state hash chain. Chain zero is
the initial state hash; each later link is SHA256 of UTF-8
`previousChain + LF + actionHash + LF + stateHash + LF`. Hash actions and states
using canonical JSON, not Godot's JSON serializer. Cohorts are complete ordered
sets (1-100 or 10001-10100), each with all three policies. Initial/post-action
states include every log, ledger and counter field.

The comparison runner receives absolute `--expected`/`--report` paths. It rejects
invalid/partial cohorts with exit 2, fails a mismatch with exit 1, and exits 0
only after every action, state, chain and terminal summary match. Failure reports
retain run ID, one-based action step (initial state is 0), action, hashes and
actual full state/action. The Node driver regenerates that one TS trace and
reports the first differing JSON path; corrupted expectation hashes can instead
produce a diagnostic saying the actual values still match the reference.

Use literal string keys for JSON dictionaries. New dot-assigned GDScript keys
can be `StringName`, which the canonical writer correctly rejects. Keep paths
for input and output distinct and never let error reporting overwrite input.
Clear old reports before a process run so stale success cannot pass verification.
The Node comparison driver also requires the exact locked engine string and
records report time, source commit/dirty state, command, exit code and untested
scope. A compatible-looking but different engine is not equivalence evidence.

W2 adds `rules_unit` and `v1_replay` to the five W1 suites. Run real Godot tooling
tests with `GODOT_BIN`, including isolated action/state/chain corruption and
malformed cohort/CLI cases. These tests cannot substitute for a successful
600-run comparison, native gameplay UI, or the W3 save/recovery checks.

## 7. Wrong vs Correct

Wrong:

```gdscript
state.seed = int(raw.seed) # 1.5 silently becomes 1
var text := JSON.stringify(raw)
```

Correct:

```gdscript
var decoded := StateCodec.decode(raw, selected_catalog)
if not decoded.ok:
	return decoded
var encoded := StateCodec.encode(decoded.state, selected_catalog)
return CanonicalJson.encode(encoded.data)
```

Never parse state fields independently in UI code or let the loader reference
`res://../shared`. Keep V1 fixtures and unknown future versions separate.

## 9. Session and Save Boundary (W3)

- `GameSession` owns the live model. UI uses detached views, dictionary commands
  and its three signals. All dispatch outcomes include revision/view/events,
  including boundary rejections. No state reference crosses into scenes.
- Check command shape independently of current mutable event, then run ID,
  busy/readiness, dedup, revision and rules. A successful CHOOSE retry must still
  dedup after another event opens. Cache both rule and revision rejections.
  Busy is transient and uncached. Replayed results do not emit or save again.
- Keep the lifecycle lock through commit signal and save enqueue. Guard
  dispatch, new_run and load_run, including signal callback reentry.
  New-run IDs use independent entropy, never the deterministic game RNG.
- Enqueue the initial revision zero. Until confirmation, savedRevision is -1,
  not zero. Saving an older revision cannot mark newer in-memory state saved.
  Failed enqueue/write retains the last confirmed revision and live state.
- Envelope v1 has exact fields, selected versions/content SHA256, canonical body
  hash and strict StateCodec validation. Validate integer floats before casting.
  Enforce 2 MiB using file length before allocating a read buffer.
- Share lock/generation by normalized physical slot path within the process,
  not by SaveService instance or run ID. Guard rotation, promotion and callbacks.
  Pending snapshots are copied/latest-wins; reject stale confirmed revisions.
  Multiprocess and multi-tab writers are not supported by this contract.
- Validate old current before replacing backup. If only backup is valid,
  restore/re-read current first and never modify the good backup on failure.
  Re-read promoted/restored bytes and compare with the intended bytes, not just
  structural validity. Advance savedRevision only after final confirmation.
- Missing/invalid current always tries backup and reports source plus cause.
  `load(false)` is read-only for the title screen. Failed restoration preserves
  backup and tmp; tmp alone is an error, never a committed save or empty slot.
- Web capability uses OS.is_userfs_persistent plus a write/read probe. A memory
  filesystem round trip alone is not persistence evidence. Verify IndexedDB,
  refresh and continue in a real browser; disclose untested browser/quota modes.

Run all nine suites and `GODOT_BIN=... npm run godot:test-tools`. The latter
includes eight isolated child processes killed at transaction boundaries, each
followed by a fresh verifier process. SaveFaults also checks four golden recovery
points on real disk with complete state equality and the next action, real
tampering, and switches during I/O. Native automated input is not human playtest
acceptance. The versioned UI handoff is documented in `godot/README.md` section 7.

## 10. W4 UI handoff (playable day 1)

- Scenes submit dictionary actions through `GameSession.dispatch` only. They
  never read `GameState`, call `Rules`, or recompute legality; disabled reasons
  come from `view.actionOptions`.
- A modal derived from state owns both pointer and keyboard input. While pause,
  day review or ending is visible, no HUD action may commit; event, gu and
  combat modals accept only their own action types. Mirror this in
  `_modal_action_allowed` and disable `focus_behavior_recursive` on the HUD
  panels so Tab/Enter cannot reach hidden controls.
- The day review is keyed by revision and dismissed only by its own button;
  it must render before a final-day crisis event.
- Location changes happen in the session, not by scene teleport. On location
  change close the academy explain panel, clear/rebuild the hotspot prompt and
  hide academy-only hotspot geometry; release `player.input_locked`.
- The session panel scrolls in a `ScrollContainer` with `follow_focus`; the
  action column must fit 1280x720 without requiring the window to grow.
- Seed parsing is ASCII digits only, rejects more than 10 significant digits
  before `int()`, and accepts exactly 0..4294967295.
- Tests: `tests/play_flow.gd` drives real controls through a full war-ready run
  and asserts modal isolation; `tests/title_flow.gd` covers main -> title ->
  new run -> autosave -> title -> continue. Headless tests do not replace
  native window/human playtest evidence.

## 11. W5 location handoff

- `GameState.location` stays the only location truth. Scenes react to the
  projected view; `TRAVEL` success (not a scene teleport) drives geometry,
  hotspots and spawn point selection.
- Each location owns its own visible geometry and hotspot set. Hotspots carry
  stable `target_id`s (`academy.*`, `inn.*`, `bamboo.*`); hidden hotspots must
  not be focusable, clickable or reachable via `E`. Filter by
  `is_visible_in_tree()` in `InteractionController`, do not rely on the
  avatar's enter/exit signals alone.
- Location changes re-place the avatar at `LOCATION_SPAWNS`; no camera or
  position is saved. The explain panel records the location it was opened in
  and closes on any location change.
- Relationship/risk readouts are display-only projections of `view.state`
  (`relations`, `suspicion`, `exposures`). Never recompute them in the scene.
- `tests/play_flow.gd` accepts `QINGMAO_FLOW_STRATEGY=war-ready|network|labor`
  and asserts each location's geometry, spawn, hotspot count and readout.

## 12. W7 save-failure and long-text handoff

- `SaveService.flush_pending()` must keep the pending snapshot after a write
  failure so the user can retry. Do not retain `stale-save`, `not-configured`
  or `superseded`; those cannot be retried safely. Expose `has_pending()` for
  tests and callers.
- The composition root owns destructive navigation. "Save and return",
  "save and quit", ending return and Esc-from-ending must flush first; on
  failure stay in the current screen, open/keep the pause modal and show the
  error. Title-screen quit on a failed save needs an explicit second click.
- The play scene must not read disk or compute save status. It emits
  `save_and_return_requested`, `save_and_quit_requested` and
  `retry_save_requested`; `report_save_result(ok, code)` is display feedback.
- Pause exposes a retry button only while `saveStatus.state == "failed"`.
- Long event text lives in a `ScrollContainer`; choices and dismiss stay
  outside it so 720p/1080p cannot push them off-screen.
- W7 tests: `tests/w7_save_failure.gd` (failed save stays in game, retry,
  continue), `tests/suites/save_faults_suite.gd` flush-retry contract,
  `tests/w7_ux.gd` (Tab containment, event scroll, 720/1080 layout),
  `tests/capture_w7.gd` (real-window screenshots).
