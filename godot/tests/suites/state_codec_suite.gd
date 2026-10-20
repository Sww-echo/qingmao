class_name StateCodecSuite
extends RefCounted

const FIXTURES: PackedStringArray = [
	"res://tests/fixtures/prototype/war-ready-42.json",
	"res://tests/fixtures/prototype/network-42.json",
	"res://tests/fixtures/prototype/labor-42.json",
]

var _checks: int = 0
var _failures: PackedStringArray = []


func run(_tree: SceneTree) -> Dictionary:
	_checks = 0
	_failures = []
	var content: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://content/generated/prototype/content.json"))
	if not _expect(content is Dictionary, "frozen content must be readable"):
		return _result()
	var catalog := ContentCatalog.new(content)
	var initial: Dictionary = {}
	for path: String in FIXTURES:
		var envelope: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
		if not _expect(envelope is Dictionary, "fixture must be readable: %s" % path):
			continue
		var trace: Dictionary = envelope["trace"]
		initial = trace["initialState"]
		_round_trip(initial, catalog, "%s initial" % path)
		var previous: Dictionary = initial
		var index: int = 0
		for step: Dictionary in trace["steps"]:
			_round_trip(step["state"], catalog, "%s step %d" % [path, index])
			var active_event: String = "" if previous["activeEvent"] == null else String(previous["activeEvent"])
			_action_round_trip(step["action"], catalog, "%s action %d" % [path, index], active_event)
			previous = step["state"]
			index += 1
		_round_trip(trace["finalState"], catalog, "%s final" % path)
	if not initial.is_empty():
		_negative_states(initial, catalog)
		_model_boundary(initial, catalog)
	_action_cases(catalog)
	_v2_codec_cases()
	return _result()

## V2 state must round-trip phase-two combat, inquiry flags/exposures, while the
## V1 catalog keeps rejecting them.
func _v2_codec_cases() -> void:
	var v2_content: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://content/generated/qingmao14-v2/content.json"))
	if not _expect(v2_content is Dictionary, "frozen V2 content must be readable"):
		return
	var v2_catalog := ContentCatalog.new(v2_content)
	var state: GameState = Rules.create(42, v2_catalog)
	_expect(state != null, "V2 state starts from the V2 catalog")
	state.flags.append("inquiry-due")
	var inquiry := GameState.ExposureState.new()
	inquiry.id = "inquiry-unresolved"
	inquiry.source = "学堂盘问未了结"
	inquiry.day = 1
	state.exposures.append(inquiry)
	state.combat = GameState.CombatState.new()
	state.combat.enemy_id = "crisis-alpha"
	state.combat.purpose = "crisis"
	state.combat.enemy_hp = 34
	state.combat.turn = 1
	state.combat.herbs_used = 2
	state.combat.wine_used = 1
	var encoded: Dictionary = StateCodec.encode(state, v2_catalog)
	_expect(encoded.ok, "V2 state encodes: %s" % encoded.get("error", ""))
	if encoded.ok:
		_expect(encoded.data.combat.enemyId == "crisis-alpha", "V2 encoding keeps the phase-two enemy")
		var decoded: Dictionary = StateCodec.decode(encoded.data, v2_catalog)
		_expect(decoded.ok, "V2 state decodes")
		if decoded.ok:
			_expect(decoded.state.flags.has("inquiry-due"), "V2 keeps the inquiry flag")
			_expect(decoded.state.combat.enemy_id == "crisis-alpha", "V2 restores the phase-two combat")
	var v1_content: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://content/generated/prototype/content.json"))
	var v1_catalog := ContentCatalog.new(v1_content)
	var v1_state: GameState = Rules.create(42, v1_catalog)
	v1_state.combat = GameState.CombatState.new()
	v1_state.combat.enemy_id = "crisis-alpha"
	v1_state.combat.purpose = "crisis"
	v1_state.combat.enemy_hp = 34
	_expect(not StateCodec.encode(v1_state, v1_catalog).ok, "V1 rejects the V2 enemy")
	v1_state.combat.enemy_id = "scout-wolf"
	v1_state.flags.append("inquiry-due")
	_expect(not StateCodec.encode(v1_state, v1_catalog).ok, "V1 rejects the V2 inquiry flag")


func _round_trip(data: Dictionary, catalog: ContentCatalog, label: String) -> void:
	var decoded: Dictionary = StateCodec.decode(data, catalog)
	if not _expect(decoded["ok"], "%s decode: %s" % [label, decoded.get("error", "")]):
		return
	var state: GameState = decoded["state"]
	_expect(state.rng_draws == int(data["rngDraws"]), "%s maps rngDraws to typed rng_draws" % label)
	var encoded: Dictionary = StateCodec.encode(state, catalog)
	if not _expect(encoded["ok"], "%s encode: %s" % [label, encoded.get("error", "")]):
		return
	_expect(_same_json(data, encoded["data"]), "%s preserves every field and array order" % label)


func _action_round_trip(data: Dictionary, catalog: ContentCatalog, label: String, active_event: String = "") -> void:
	var result: Dictionary = GameAction.decode(data, catalog, active_event)
	if not _expect(result["ok"], "%s decode: %s" % [label, result.get("error", "")]):
		return
	var action: GameAction = result["action"]
	_expect(_same_json(data, action.to_data()), "%s preserves the action tag and payload" % label)


func _negative_states(initial: Dictionary, catalog: ContentCatalog) -> void:
	var cases: Array[Dictionary] = [
		{"label": "fractional seed", "path": ["seed"], "value": 1.5},
		{"label": "negative seed", "path": ["seed"], "value": -1},
		{"label": "overflowing seed", "path": ["seed"], "value": 4294967296},
		{"label": "fractional RNG", "path": ["rng"], "value": 0.25},
		{"label": "overflowing RNG", "path": ["rng"], "value": 4294967296},
		{"label": "nonfinite RNG draws", "path": ["rngDraws"], "value": INF},
		{"label": "unsafe RNG draws", "path": ["rngDraws"], "value": 9007199254740992.0},
		{"label": "negative RNG draws", "path": ["rngDraws"], "value": -1},
		{"label": "boolean day", "path": ["day"], "value": true},
		{"label": "zero day", "path": ["day"], "value": 0},
		{"label": "day outside pack", "path": ["day"], "value": 15},
		{"label": "fractional actions", "path": ["actions"], "value": 1.5},
		{"label": "too many actions", "path": ["actions"], "value": 4},
		{"label": "negative HP", "path": ["hp"], "value": -1},
		{"label": "overfull HP", "path": ["hp"], "value": 29},
		{"label": "overfull qi", "path": ["qi"], "value": 13},
		{"label": "fractional cultivation", "path": ["cultivation"], "value": 0.5},
		{"label": "cultivation over cap", "path": ["cultivation"], "value": 61},
		{"label": "clues over cap", "path": ["clues"], "value": 9},
		{"label": "suspicion over cap", "path": ["suspicion"], "value": 101},
		{"label": "unknown location", "path": ["location"], "value": "elsewhere"},
		{"label": "negative stones", "path": ["resources", "stones"], "value": -1},
		{"label": "stones over engine limit", "path": ["resources", "stones"], "value": 100001},
		{"label": "herbs over carry limit", "path": ["resources", "herbs"], "value": 7},
		{"label": "unknown resource field", "path": ["resources"], "value": {"stones": 1, "herbs": 1, "wine": 0, "gold": 1}},
		{"label": "relation outside range", "path": ["relations", "innkeeper"], "value": -101},
		{"label": "fractional relation", "path": ["relations", "innkeeper"], "value": 0.1},
		{"label": "unknown relation", "path": ["relations"], "value": {"guard-captain": 0, "stranger": 0}},
		{"label": "unknown Gu", "path": ["inventory"], "value": {"new-gu": {"mode": "active", "equipped": true}}},
		{"label": "null Gu mode", "path": ["inventory"], "value": {"moonlight": {"mode": null, "equipped": true}}},
		{"label": "nonboolean equipment", "path": ["inventory"], "value": {"moonlight": {"mode": "active", "equipped": 1}}},
		{"label": "unknown Gu field", "path": ["inventory"], "value": {"moonlight": {"mode": "active", "equipped": true, "power": 9}}},
		{"label": "unknown upkeep reference", "path": ["upkeepDue"], "value": ["new-gu"]},
		{"label": "unowned upkeep reference", "path": ["upkeepDue"], "value": ["moonlight"]},
		{"label": "unknown engine flag", "path": ["flags"], "value": ["inquiry-due"]},
		{"label": "duplicate flag", "path": ["flags"], "value": ["briefed", "briefed"]},
		{"label": "new V2 exposure", "path": ["exposures"], "value": [{"id": "inquiry-unresolved", "source": "source", "day": 1}]},
		{"label": "future exposure day", "path": ["exposures"], "value": [{"id": "unlicensed-survey", "source": "source", "day": 2}]},
		{"label": "unknown completed event", "path": ["completedEvents"], "value": ["missing-event"]},
		{"label": "duplicate missed event", "path": ["missedEvents"], "value": ["briefing", "briefing"]},
		{"label": "unknown active event", "path": ["activeEvent"], "value": "missing-event"},
		{"label": "false active event", "path": ["activeEvent"], "value": false},
		{"label": "null crisis", "path": ["crisis"], "value": null},
		{"label": "unknown crisis", "path": ["crisis"], "value": "waiting"},
		{"label": "unknown ending", "path": ["ending"], "value": {"id": "new-ending", "outcome": "survived", "reasons": []}},
		{"label": "null ending outcome", "path": ["ending"], "value": {"id": "overrun", "outcome": null, "reasons": []}},
		{"label": "mismatched ending outcome", "path": ["ending"], "value": {"id": "overrun", "outcome": "survived", "reasons": []}},
		{"label": "nonarray ending reasons", "path": ["ending"], "value": {"id": "overrun", "outcome": "death", "reasons": "reason"}},
		{"label": "fractional action count", "path": ["actionCounts"], "value": {"work": 0.5}},
		{"label": "negative action count", "path": ["actionCounts"], "value": {"work": -1}},
		{"label": "non-ASCII counter key", "path": ["actionCounts"], "value": {"\u4e2d": 1}},
		{"label": "fractional ledger", "path": ["ledger"], "value": [{"day": 1, "source": "source", "resource": "stones", "amount": 0.5}]},
		{"label": "unknown ledger resource", "path": ["ledger"], "value": [{"day": 1, "source": "source", "resource": "gold", "amount": 1}]},
		{"label": "unknown log kind", "path": ["log"], "value": [{"day": 1, "kind": "debug", "message": "text"}]},
		{"label": "unknown log field", "path": ["log"], "value": [{"day": 1, "kind": "event", "message": "text", "timestamp": 1}]},
		{"label": "fake V2 scenario", "path": ["scenarioId"], "value": "qingmao-fourteen-day-v2"},
		{"label": "incompatible rules", "path": ["rulesVersion"], "value": "qingmao-rules-2"},
		{"label": "incompatible content", "path": ["contentVersion"], "value": "qingmao-content-2"},
	]
	for test: Dictionary in cases:
		var invalid: Dictionary = initial.duplicate(true)
		var path: Array = test["path"]
		var parent: Dictionary = invalid
		for index: int in range(path.size() - 1):
			parent = parent[path[index]]
		parent[path.back()] = test["value"]
		_expect_rejected(invalid, catalog, test["label"])
	var missing: Dictionary = initial.duplicate(true)
	missing.erase("rngDraws")
	_expect_rejected(missing, catalog, "missing required field")
	var extra: Dictionary = initial.duplicate(true)
	extra["unknown"] = true
	_expect_rejected(extra, catalog, "unknown top-level field")
	var overlap: Dictionary = initial.duplicate(true)
	overlap["completedEvents"] = ["briefing"]
	overlap["missedEvents"] = ["briefing"]
	_expect_rejected(overlap, catalog, "completed and missed overlap")
	var closed: Dictionary = initial.duplicate(true)
	closed["completedEvents"] = ["briefing"]
	closed["activeEvent"] = "briefing"
	_expect_rejected(closed, catalog, "active completed event")
	var combat: Dictionary = {
		"enemyId": "scout-wolf", "purpose": "survey", "enemyHp": 1, "turn": 0,
		"guard": 0, "herbsUsed": 0, "wineUsed": 0,
	}
	for test: Dictionary in [
		{"key": "enemyId", "value": "crisis-alpha"},
		{"key": "purpose", "value": null},
		{"key": "enemyHp", "value": 0},
		{"key": "turn", "value": 0.5},
		{"key": "guard", "value": -1},
		{"key": "herbsUsed", "value": 4},
		{"key": "wineUsed", "value": 1.5},
	]:
		var invalid: Dictionary = initial.duplicate(true)
		invalid["combat"] = combat.duplicate(true)
		invalid["combat"][test["key"]] = test["value"]
		_expect_rejected(invalid, catalog, "invalid combat %s" % test["key"])
	_expect(not StateCodec.decode([], catalog)["ok"], "nonobject state is rejected")
	_expect(not StateCodec.decode(initial, null)["ok"], "missing catalog is rejected")


func _model_boundary(initial: Dictionary, catalog: ContentCatalog) -> void:
	var input: Dictionary = initial.duplicate(true)
	var decoded: Dictionary = StateCodec.decode(input, catalog)
	if not _expect(decoded["ok"], "decode before checking model isolation"):
		return
	var state: GameState = decoded["state"]
	input["resources"]["stones"] = 999
	_expect(state.resources["stones"] == int(initial["resources"]["stones"]), "decoded resource records do not alias source data")
	state.flags.append("briefed")
	_expect(not initial["flags"].has("briefed"), "decoded arrays do not alias source data")
	var encoded: Dictionary = StateCodec.encode(state, catalog)
	if _expect(encoded["ok"], "encode before checking detached output"):
		encoded["data"]["resources"]["stones"] = 999
		encoded["data"]["flags"].append("warned")
		_expect(state.resources["stones"] != 999 and not state.flags.has("warned"), "encoded arrays and records do not alias the model")
	state.hp = 999
	_expect(not StateCodec.encode(state, catalog)["ok"], "encoding revalidates a modified typed model")
	_expect(not StateCodec.encode(null, catalog)["ok"], "encoding null model is rejected")
	var maximum: Dictionary = initial.duplicate(true)
	maximum["seed"] = 4294967295.0
	maximum["rng"] = 4294967295.0
	maximum["rngDraws"] = 9007199254740991.0
	maximum["resources"]["stones"] = 100000.0
	maximum["relations"]["innkeeper"] = -100.0
	maximum["cultivation"] = 60.0
	maximum["qi"] = 22.0
	maximum["actionCounts"] = {"custom-ascii-counter": 9007199254740991.0}
	_round_trip(maximum, catalog, "valid inclusive numeric boundaries and parsed integral floats")
	var unsupported: Dictionary = catalog.data.duplicate(true)
	unsupported["scenarioId"] = "qingmao-fourteen-day-v2"
	unsupported["rulesVersion"] = "qingmao-rules-2"
	unsupported["contentVersion"] = "qingmao-content-2"
	_expect(not StateCodec.decode(initial, ContentCatalog.new(unsupported))["ok"], "W1 refuses a fake V2 catalog")


func _action_cases(catalog: ContentCatalog) -> void:
	var actions: Array[Dictionary] = [
		{"type": "TRAVEL", "location": "academy"},
		{"type": "OPEN_EVENT", "eventId": "briefing"},
		{"type": "CHOOSE", "choiceId": "acknowledge"},
		{"type": "DISMISS_EVENT"}, {"type": "WORK"}, {"type": "TRAIN"}, {"type": "SCOUT"},
		{"type": "REST"}, {"type": "END_DAY"}, {"type": "BUY", "item": "herbs"},
		{"type": "EQUIP", "guId": "moonlight", "equipped": false},
		{"type": "GU_MODE", "guId": "moonlight", "mode": "wake"},
		{"type": "CLEAR_EXPOSURE", "exposureId": "unlicensed-survey"},
		{"type": "COMBAT", "move": "retreat"},
	]
	_expect(actions.size() == GameAction.TYPES.size(), "all fourteen action types have explicit valid cases")
	for action: Dictionary in actions:
		_action_round_trip(action, catalog, "explicit %s" % action["type"])
	var invalid_actions: Array = [
		null, [], {}, {"type": null}, {"type": "UNKNOWN"}, {"type": "WORK", "extra": 1},
		{"type": "TRAVEL"}, {"type": "TRAVEL", "location": "missing"},
		{"type": "TRAVEL", "location": null},
		{"type": "OPEN_EVENT", "eventId": "missing"},
		{"type": "CHOOSE", "choiceId": "missing"},
		{"type": "BUY", "item": "stones"},
		{"type": "EQUIP", "guId": "moonlight", "equipped": 1},
		{"type": "EQUIP", "guId": "missing", "equipped": true},
		{"type": "GU_MODE", "guId": "moonlight", "mode": "active"},
		{"type": "GU_MODE", "guId": "moonlight", "mode": null},
		{"type": "CLEAR_EXPOSURE", "exposureId": "inquiry-unresolved"},
		{"type": "COMBAT", "move": "new-move"},
		{"type": "COMBAT", "move": "attack", "enemyId": "scout-wolf"},
	]
	for index: int in range(invalid_actions.size()):
		var rejected: Dictionary = GameAction.decode(invalid_actions[index], catalog)
		_expect(not rejected["ok"] and rejected.has("error"), "malformed action %d is rejected explicitly" % index)
	_expect(
		not GameAction.decode({"type": "CHOOSE", "choiceId": "receive"}, catalog, "briefing")["ok"],
		"choice reference is checked against the selected event when supplied"
	)
	_expect(not GameAction.decode({"type": "WORK"}, null)["ok"], "action decoding requires a catalog")


func _expect_rejected(value: Dictionary, catalog: ContentCatalog, label: String) -> void:
	var result: Dictionary = StateCodec.decode(value, catalog)
	_expect(not result["ok"] and result.has("error"), "reject %s with an explicit error" % label)


func _same_json(left: Variant, right: Variant) -> bool:
	var left_result: Dictionary = CanonicalJson.encode(left)
	var right_result: Dictionary = CanonicalJson.encode(right)
	return left_result["ok"] and right_result["ok"] and left_result["text"] == right_result["text"]


func _expect(condition: bool, message: String) -> bool:
	_checks += 1
	if not condition:
		_failures.append(message)
	return condition


func _result() -> Dictionary:
	return {"checks": _checks, "failures": _failures}
