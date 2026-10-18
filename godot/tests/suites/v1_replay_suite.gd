class_name V1ReplaySuite
extends RefCounted

const CHECKS = preload("res://tests/suite_checks.gd")
const FIXTURES: PackedStringArray = [
	"res://tests/fixtures/prototype/war-ready-42.json",
	"res://tests/fixtures/prototype/network-42.json",
	"res://tests/fixtures/prototype/labor-42.json",
]


func run(_tree: SceneTree) -> Dictionary:
	var check := CHECKS.new()
	var loaded: Dictionary = ContentLoader.load_pack("prototype")
	if not check.expect(loaded["ok"], "V1 content loads: %s" % str(loaded.get("error", ""))):
		return check.result()
	var catalog: ContentCatalog = loaded["catalog"]
	for path: String in FIXTURES:
		_replay(check, path, catalog)
	_diagnostics(check)
	return check.result()


func _replay(check: RefCounted, path: String, catalog: ContentCatalog) -> void:
	var parser := JSON.new()
	if not check.expect(parser.parse(FileAccess.get_file_as_string(path)) == OK and parser.data is Dictionary, "Golden trace parses: " + path):
		return
	var envelope: Dictionary = parser.data
	if not check.expect(envelope.get("formatVersion") == 1, "Golden trace format: " + path):
		return
	for field: String in ["scenarioId", "rulesVersion", "contentVersion"]:
		if not _equal(check, envelope.get(field), catalog.data[field], path + "." + field):
			return
	var trace: Dictionary = envelope["trace"]
	var strategy_id: String = trace["strategyId"]
	var state: GameState = Rules.create(int(trace["seed"]), catalog)
	if not check.expect(state != null, "Golden initial state exists: " + path):
		return
	if not _state_equal(check, trace["initialState"], state, catalog, path + ".initialState"):
		return
	if not check.expect(trace["actions"].size() == trace["steps"].size(), "Golden action/step lengths agree: " + path):
		return
	var index: int = 0
	for step: Dictionary in trace["steps"]:
		var label: String = "%s.steps[%d]" % [path, index]
		if not check.expect(state.ending == null, label + " starts unfinished"):
			return
		if not _equal(check, trace["actions"][index], step["action"], label + ".actionEnvelope"):
			return
		var view: Dictionary = Queries.public_view(state, catalog)
		if not check.expect(not view["state"].has("seed") and not view["state"].has("rng") and not view["state"].has("rngDraws"), label + " public view omits random state"):
			return
		var public_snapshot: Dictionary = view.duplicate(true)
		var chosen: Dictionary = V1Policies.choose(strategy_id, view, catalog)
		if not _equal(check, step["action"], chosen, label + ".policyAction"):
			return
		if not _equal(check, public_snapshot, view, label + ".unchangedPublicView"):
			return
		var applied: Dictionary = Rules.apply(state, step["action"], catalog)
		if not check.expect(applied["ok"], label + " action accepted: " + str(applied.get("error", ""))):
			return
		state = applied["state"]
		if not _state_equal(check, step["state"], state, catalog, label + ".state"):
			return
		index += 1
	if not check.expect(state.ending != null, "Golden run reaches an ending: " + path):
		return
	if not _state_equal(check, trace["finalState"], state, catalog, path + ".finalState"):
		return
	_equal(check, trace["summary"], V1Policies.summarize(state, catalog), path + ".summary")


func _state_equal(check: RefCounted, expected: Dictionary, state: GameState, catalog: ContentCatalog, label: String) -> bool:
	var encoded: Dictionary = V1Trace.state_data(state, catalog)
	if not check.expect(encoded["ok"], label + " encodes: " + str(encoded.get("error", ""))):
		return false
	return _equal(check, expected, encoded["data"], label)


func _equal(check: RefCounted, expected: Variant, actual: Variant, label: String) -> bool:
	var expected_json: Dictionary = CanonicalJson.encode(expected)
	var actual_json: Dictionary = CanonicalJson.encode(actual)
	if not check.expect(expected_json["ok"] and actual_json["ok"], label + " values are canonical JSON"):
		return false
	var equal: bool = expected_json["bytes"] == actual_json["bytes"]
	var difference: Dictionary = {} if equal else V1Trace.first_difference(expected, actual, label)
	return check.expect(equal, label + " complete value matches; first difference: " + str(difference))


func _diagnostics(check: RefCounted) -> void:
	var expected: Dictionary = {"nested": [{"rngDraws": 3, "log": [{"message": "golden"}]}]}
	var tampered: Dictionary = expected.duplicate(true)
	tampered["nested"][0]["log"][0]["message"] = "tampered"
	var difference: Dictionary = V1Trace.first_difference(expected, tampered)
	check.expect(difference.get("path") == "$.nested[0].log[0].message", "First difference locates nested log corruption")
	check.expect(difference.get("expected") == "golden" and difference.get("actual") == "tampered", "First difference retains both values")
	check.expect(V1Trace.first_difference({"n": 3.0}, {"n": 3}).is_empty(), "JSON integral floats compare equal to model integers")
	check.expect(V1Trace.first_difference([1], [1, 2]).get("path") == "$.length", "First difference locates array length")
	check.expect(V1Trace.first_difference({"n": 1}, {}).get("path") == "$.n", "First difference locates a missing key")
