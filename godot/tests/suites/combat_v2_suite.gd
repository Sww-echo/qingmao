class_name CombatV2Suite
extends RefCounted
## W6 D1-D5 regression suite. State is built directly from the V2 catalog; no
## scene is involved, and rejected/disabled paths must not consume RNG.

var _checks: int = 0
var _failures: PackedStringArray = []
var _catalog: ContentCatalog

func run(_tree: SceneTree) -> Dictionary:
	var loaded: Dictionary = ContentLoader.load_pack("qingmao14-v2")
	if not _expect(loaded.ok, "V2 content must load: %s" % loaded.get("error", "")):
		return _result()
	_catalog = loaded.catalog
	_d1_inquiry()
	_d2_shelter()
	_d3_phase_chain()
	_d4_opening_strike()
	_d5_fortify()
	return _result()

func _d1_inquiry() -> void:
	var state: GameState = Rules.create(42, _catalog)
	state.suspicion = 4
	state.day = 7
	state.actions = 0
	V1DayCycle.apply(state, _catalog)
	_expect(state.flags.has("inquiry-due"), "D1 suspends inquiry at the pre-decay threshold")
	_expect(state.suspicion == 3, "D1 still decays suspicion after triggering")
	var again: GameState = Rules.create(42, _catalog)
	again.suspicion = 4
	again.flags.append("inquiry-due")
	again.day = 7
	V1DayCycle.apply(again, _catalog)
	_expect(again.flags.count("inquiry-due") == 1, "D1 triggers only once")
	var below: GameState = Rules.create(42, _catalog)
	below.suspicion = 3
	below.day = 7
	V1DayCycle.apply(below, _catalog)
	_expect(not below.flags.has("inquiry-due"), "D1 ignores suspicion below the threshold")
	var final: GameState = Rules.create(42, _catalog)
	final.day = 14
	final.flags.append("inquiry-due")
	V1DayCycle.apply(final, _catalog)
	_expect(Queries.has_exposure(final, "inquiry-unresolved"), "D1 unresolved inquiry creates the exposure")
	_expect(final.exposures.size() == 1, "D1 adds exactly one unresolved exposure")
	var resolved: GameState = Rules.create(42, _catalog)
	resolved.day = 14
	resolved.flags.append("inquiry-due")
	resolved.completed_events.append("inquiry")
	V1DayCycle.apply(resolved, _catalog)
	_expect(not Queries.has_exposure(resolved, "inquiry-unresolved"), "D1 completed inquiry leaves no exposure")

func _d2_shelter() -> void:
	var state: GameState = _shelter_state()
	state.clues = 5
	state.relations["guard-captain"] = 3
	state.relations["innkeeper"] = 4
	state.flags.append("route-chart")
	state.flags.append("watch-served")
	state.flags.append("shelter-stocked")
	state.flags.append("safe-route")
	_catalog.parameters["crisisThreatMin"] = 9
	_catalog.parameters["crisisThreatMax"] = 9
	V1Effects.apply(state, {"kind": "crisis", "response": "shelter"}, "crisis-arrival", _catalog)
	_expect(state.ending != null and state.ending.id == "shelter-secured",
		"D2 safe-route lowers demand and secures shelter")
	var gap: GameState = _shelter_state()
	# demand 9, readiness 7 -> gap 2 -> 8 stones.
	gap.clues = 6
	gap.relations["guard-captain"] = 1
	gap.relations["innkeeper"] = 4
	gap.resources["stones"] = 8
	gap.flags.append("route-chart")
	gap.flags.append("watch-served")
	gap.flags.append("shelter-stocked")
	V1Effects.apply(gap, {"kind": "crisis", "response": "shelter"}, "crisis-arrival", _catalog)
	_expect(gap.ending != null and gap.ending.id == "shelter-secured", "D2 pays a two-point gap")
	_expect(gap.resources["stones"] == 0, "D2 charges four stones per missing point")
	_expect(_ledger_has(gap, "shelter-buyout", -8), "D2 records the buyout in the ledger")
	var too_far: GameState = _shelter_state()
	# demand 9, readiness 5 -> gap 4 (> cap).
	too_far.clues = 5
	too_far.relations["guard-captain"] = 0
	too_far.relations["innkeeper"] = 4
	too_far.resources["stones"] = 100
	too_far.flags.append("route-chart")
	too_far.flags.append("watch-served")
	too_far.flags.append("shelter-stocked")
	V1Effects.apply(too_far, {"kind": "crisis", "response": "shelter"}, "crisis-arrival", _catalog)
	_expect(too_far.ending == null and too_far.combat != null,
		"D2 refuses a gap above the buyout cap and falls back to battle")
	_expect(too_far.resources["stones"] == 100, "D2 does not charge an unaffordable/too-large gap")

func _d3_phase_chain() -> void:
	var state: GameState = Rules.create(42, _catalog)
	state.day = 14
	state.crisis = "fighting"
	state.combat = GameState.CombatState.new()
	state.combat.enemy_id = "crisis-pack"
	state.combat.purpose = "crisis"
	state.combat.enemy_hp = 1
	state.combat.turn = 3
	state.combat.herbs_used = 2
	state.combat.wine_used = 1
	state.qi = 0
	var max_qi: int = Queries.max_qi(state, _catalog)
	# Attack grants +1 qi before the phase breather: 0 + 1 + phaseBreatherQi.
	var expected_qi: int = mini(max_qi, 1 + int(_catalog.parameters["phaseBreatherQi"]))
	V1Combat.apply(state, "attack", _catalog)
	_expect(state.combat != null and state.combat.enemy_id == "crisis-alpha",
		"D3 phase one defeat loads the alpha")
	_expect(state.combat.turn == 3, "D3 keeps the battle turn count continuous")
	_expect(state.combat.guard == 0, "D3 clears guard between phases")
	_expect(state.combat.herbs_used == 2 and state.combat.wine_used == 1,
		"D3 keeps shared herb/wine usage")
	_expect(state.qi == expected_qi, "D3 restores phase breather qi")
	var kill: GameState = Rules.create(42, _catalog)
	kill.day = 14
	kill.crisis = "fighting"
	kill.combat = GameState.CombatState.new()
	kill.combat.enemy_id = "crisis-alpha"
	kill.combat.purpose = "crisis"
	kill.combat.enemy_hp = 1
	kill.combat.turn = 5
	V1Combat.apply(kill, "attack", _catalog)
	_expect(kill.combat == null and kill.ending != null and kill.ending.id == "held-the-line",
		"D3 final phase defeat ends the crisis")

func _d4_opening_strike() -> void:
	var state: GameState = Rules.create(42, _catalog)
	state.flags.append("drilled")
	state.cultivation = 18
	state.qi = Queries.max_qi(state, _catalog)
	state.inventory["moonlight"] = _gu("active", true)
	var before_qi: int = state.qi
	V1Combat.start_battle(state, "crisis-pack", "crisis", _catalog)
	_expect(state.combat != null, "D4 battle starts")
	_expect(state.combat.turn == 0, "D4 opening strike does not consume a turn")
	_expect(state.qi == before_qi - int(_catalog.by_id["gu"]["moonlight"]["qiCost"]),
		"D4 uses moonlight when available")
	var fallback: GameState = Rules.create(42, _catalog)
	fallback.flags.append("drilled")
	fallback.cultivation = 18
	fallback.qi = 0
	V1Combat.start_battle(fallback, "crisis-pack", "crisis", _catalog)
	_expect(fallback.combat != null and fallback.combat.turn == 0, "D4 falls back to attack")
	var ordinary: GameState = Rules.create(42, _catalog)
	ordinary.flags.append("drilled")
	ordinary.cultivation = 18
	ordinary.qi = Queries.max_qi(ordinary, _catalog)
	ordinary.inventory["moonlight"] = _gu("active", true)
	V1Combat.start_battle(ordinary, "scout-wolf", "patrol", _catalog)
	_expect(ordinary.qi == Queries.max_qi(ordinary, _catalog), "D4 does not trigger outside crisis battles")

func _d5_fortify() -> void:
	for turn: int in [0, 1, 2]:
		var state: GameState = _crisis_state("crisis-pack", turn)
		state.flags.append("fortified")
		var forecast: Dictionary = Queries.combat_forecast(state, _catalog)
		var hp_before: int = state.hp
		V1Combat.apply(state, "attack", _catalog)
		var actual: int = hp_before - state.hp
		_expect(actual == int(forecast.incomingDamage), "D5 preview matches actual damage at turn %d" % turn)
		if turn < 2:
			_expect(actual == _base_damage(turn) - int(_catalog.parameters["fortifyDamageReduction"]),
				"D5 reduces damage during the first two turns (turn %d)" % turn)
		else:
			_expect(actual == _base_damage(turn), "D5 stops reducing at turn 2")
	# Phase two never receives the fortification reduction even on a low turn.
	var alpha: GameState = _crisis_state("crisis-alpha", 0)
	alpha.flags.append("fortified")
	var alpha_forecast: Dictionary = Queries.combat_forecast(alpha, _catalog)
	_expect(int(alpha_forecast.incomingDamage) == _alpha_damage(0),
		"D5 does not apply to the second phase")
	# A normal patrol battle never receives it.
	var patrol: GameState = Rules.create(42, _catalog)
	patrol.combat = GameState.CombatState.new()
	patrol.combat.enemy_id = "scout-wolf"
	patrol.combat.purpose = "patrol"
	patrol.combat.enemy_hp = 20
	patrol.flags.append("fortified")
	_expect(int(Queries.combat_forecast(patrol, _catalog).incomingDamage) == 5,
		"D5 does not apply outside crisis")

func _shelter_state() -> GameState:
	var state: GameState = Rules.create(42, _catalog)
	state.day = 14
	state.crisis = "decision"
	state.hp = 28
	return state

func _crisis_state(enemy: String, turn: int) -> GameState:
	var state: GameState = Rules.create(42, _catalog)
	state.day = 14
	state.crisis = "fighting"
	state.hp = 28
	state.combat = GameState.CombatState.new()
	state.combat.enemy_id = enemy
	state.combat.purpose = "crisis"
	state.combat.enemy_hp = 60
	state.combat.turn = turn
	return state

func _base_damage(turn: int) -> int:
	var enemy: Dictionary = _catalog.by_id["enemies"]["crisis-pack"]
	return int(enemy["intents"][turn % enemy["intents"].size()]["damage"])


func _alpha_damage(turn: int) -> int:
	var enemy: Dictionary = _catalog.by_id["enemies"]["crisis-alpha"]
	return int(enemy["intents"][turn % enemy["intents"].size()]["damage"])

func _gu(mode: String, equipped: bool) -> GameState.GuState:
	var gu := GameState.GuState.new()
	gu.mode = mode
	gu.equipped = equipped
	return gu

func _ledger_has(state: GameState, source: String, amount: int) -> bool:
	for entry: GameState.LedgerEntry in state.ledger:
		if entry.source == source and entry.amount == amount and entry.resource == "stones":
			return true
	return false

func _expect(condition: bool, message: String) -> bool:
	_checks += 1
	if not condition:
		_failures.append(message)
	return condition

func _result() -> Dictionary:
	return {"checks": _checks, "failures": _failures}
