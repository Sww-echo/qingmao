class_name V1CompareRunner
extends SceneTree
## Development-only streaming comparison; no full batch of state snapshots is retained.

var _ran: bool = false
var _expected_path: String = ""
var _report_path: String = ""
var _catalog: ContentCatalog
var _started: int = 0
var _report: Dictionary = {}


func _process(_delta: float) -> bool:
	if _ran:
		return true
	_ran = true
	_started = Time.get_ticks_msec()
	var error: String = _arguments(OS.get_cmdline_user_args())
	if not error.is_empty():
		_finish_error(error)
		return true
	var file: FileAccess = FileAccess.open(_expected_path, FileAccess.READ)
	if file == null:
		_finish_error("Cannot read expected file: " + _expected_path)
		return true
	if file.get_length() > 32 * 1024 * 1024:
		_finish_error("Expected file exceeds 32 MiB")
		return true
	var bytes: PackedByteArray = file.get_buffer(file.get_length())
	var parser := JSON.new()
	if parser.parse(bytes.get_string_from_utf8()) != OK:
		_finish_error("Invalid expected JSON: " + parser.get_error_message())
		return true
	var loaded: Dictionary = ContentLoader.load_pack()
	if not loaded.ok:
		_finish_error(loaded.error)
		return true
	_catalog = loaded.catalog
	error = _expected_error(parser.data, loaded.content_sha256)
	if not error.is_empty():
		_finish_error(error)
		return true
	_report = {
		"ok": true, "formatVersion": 1, "expectedFile": _expected_path,
		"expectedSha256": CanonicalJson.sha256(bytes),
		"contentSha256": loaded.content_sha256, "godotVersion": Engine.get_version_info().string,
		"scenarioId": _catalog.data.scenarioId, "rulesVersion": _catalog.data.rulesVersion,
		"contentVersion": _catalog.data.contentVersion,
		"seedSets": parser.data.seedSets, "runs": 0, "actions": 0, "states": 0,
	}
	for run: Dictionary in parser.data.runs:
		if not _compare_run(run):
			_finish(1)
			return true
		_report.runs += 1
		if int(_report.runs) % 50 == 0:
			print("V1 compare: %d/%d runs" % [_report.runs, parser.data.runs.size()])
	print("V1 compare PASS: %d runs, %d actions, %d complete states" % [_report.runs, _report.actions, _report.states])
	_finish(0)
	return true


func _compare_run(run: Dictionary) -> bool:
	var state: GameState = Rules.create(int(run.seed), _catalog)
	var encoded: Dictionary = V1Trace.state_data(state, _catalog)
	if not encoded.ok:
		return _fail(run, 0, "codec", {}, "", "", {"message": encoded.error})
	var state_hash: String = _hash(encoded.data)
	var chain_hash: String = state_hash
	if state_hash != run.stateHashes[0]:
		return _fail(run, 0, "state", {}, run.stateHashes[0], state_hash, {"actualState": encoded.data})
	if chain_hash != run.chainHashes[0]:
		return _fail(run, 0, "chain", {}, run.chainHashes[0], chain_hash, {"actualState": encoded.data})
	_report.states += 1
	for index: int in range(run.actions.size()):
		var expected_action: Dictionary = run.actions[index]
		if state.ending != null:
			return _fail(run, index + 1, "action", expected_action, _hash(expected_action), _hash(null), {"actualAction": null, "message": "Godot ended before the expected action"})
		var actual_action: Dictionary = V1Policies.choose(run.strategyId, Queries.public_view(state, _catalog), _catalog)
		var difference: Dictionary = V1Trace.first_difference(expected_action, actual_action)
		if not difference.is_empty():
			return _fail(run, index + 1, "action", expected_action, _hash(expected_action), _hash(actual_action), {"actualAction": actual_action, "difference": difference})
		var applied: Dictionary = Rules.apply(state, actual_action, _catalog)
		if not applied.ok:
			return _fail(run, index + 1, "rejected", actual_action, run.stateHashes[index + 1], "", {"message": str(applied.error), "actualState": encoded.data})
		state = applied.state
		encoded = V1Trace.state_data(state, _catalog)
		if not encoded.ok:
			return _fail(run, index + 1, "codec", actual_action, run.stateHashes[index + 1], "", {"message": encoded.error})
		state_hash = _hash(encoded.data)
		if state_hash != run.stateHashes[index + 1]:
			return _fail(run, index + 1, "state", actual_action, run.stateHashes[index + 1], state_hash, {"actualState": encoded.data})
		chain_hash = CanonicalJson.sha256(("%s\n%s\n%s\n" % [chain_hash, _hash(actual_action), state_hash]).to_utf8_buffer())
		if chain_hash != run.chainHashes[index + 1]:
			return _fail(run, index + 1, "chain", actual_action, run.chainHashes[index + 1], chain_hash, {"actualState": encoded.data})
		_report.actions += 1
		_report.states += 1
	if state.ending == null:
		return _fail(run, run.actions.size(), "ending", {}, "", "", {"actualState": encoded.data, "message": "Expected actions did not reach a Godot ending"})
	var summary: Dictionary = V1Policies.summarize(state, _catalog)
	var summary_difference: Dictionary = V1Trace.first_difference(run.summary, summary)
	if not summary_difference.is_empty():
		return _fail(run, run.actions.size(), "summary", {}, _hash(run.summary), _hash(summary), {"actualSummary": summary, "difference": summary_difference})
	return true


func _fail(run: Dictionary, step: int, kind: String, action: Dictionary, expected_hash: String, actual_hash: String, details: Dictionary) -> bool:
	var failure: Dictionary = {
		"runId": run.runId, "strategyId": run.strategyId, "seed": int(run.seed),
		"step": step, "kind": kind, "action": action,
		"expectedHash": expected_hash, "actualHash": actual_hash,
		"message": "First %s difference" % kind,
	}
	failure.merge(details, true)
	_report.ok = false
	_report["failure"] = failure
	printerr("V1 compare FAIL %s step %d [%s] action=%s expected=%s actual=%s expectedFile=%s" % [run.runId, step, kind, JSON.stringify(action), expected_hash, actual_hash, _expected_path])
	return false


func _hash(value: Variant) -> String:
	var encoded: Dictionary = CanonicalJson.encode(value)
	if not encoded.ok:
		return "canonical-error:" + str(encoded.error)
	return CanonicalJson.sha256(encoded.bytes)


func _expected_error(value: Variant, content_hash: String) -> String:
	if not value is Dictionary or not _keys(value, ["formatVersion", "scenarioId", "rulesVersion", "contentVersion", "contentSha256", "seedSets", "runs"]):
		return "Invalid expected envelope fields"
	if value.formatVersion != 1 or value.contentSha256 != content_hash:
		return "Expected format/content SHA256 mismatch"
	for key: String in ["scenarioId", "rulesVersion", "contentVersion"]:
		if value[key] != _catalog.data[key]:
			return "Expected version mismatch at " + key
	if not value.seedSets is Dictionary or value.seedSets.is_empty() or not value.runs is Array:
		return "Invalid seed sets/runs"
	var identifiers: Array[String] = []
	for cohort: Variant in value.seedSets:
		if cohort not in ["development", "holdout"]:
			return "Unknown expected cohort"
		var seeds: Variant = value.seedSets[cohort]
		if not seeds is Array or seeds.size() != 100:
			return "Expected a complete 100-seed cohort"
		var first: int = 1 if cohort == "development" else 10001
		for index: int in range(100):
			if not _integer(seeds[index], first + index, first + index):
				return "Invalid cohort seed/order"
		for strategy: String in ["war-ready", "network", "labor"]:
			for seed: Variant in seeds:
				identifiers.append("%s/%s/%d" % [cohort, strategy, int(seed)])
	if value.runs.size() != identifiers.size():
		return "Expected runs do not cover every seed and policy"
	for index: int in range(value.runs.size()):
		var run: Variant = value.runs[index]
		if not run is Dictionary or not _keys(run, ["runId", "set", "strategyId", "seed", "actions", "stateHashes", "chainHashes", "summary"]):
			return "Invalid run fields at %d" % index
		if not _integer(run.seed, 0, 4294967295) or not run.set is String or not run.strategyId is String \
			or run.runId != identifiers[index] or run.runId != "%s/%s/%d" % [run.set, run.strategyId, int(run.seed)]:
			return "Invalid/duplicate/missing run identity at %d" % index
		if not run.actions is Array or run.actions.is_empty() or run.actions.size() > 600 \
			or not run.stateHashes is Array or run.stateHashes.size() != run.actions.size() + 1 \
			or not run.chainHashes is Array or run.chainHashes.size() != run.stateHashes.size() or not run.summary is Dictionary:
			return "Invalid action/hash/summary counts at " + str(run.runId)
		for hashes: Array in [run.stateHashes, run.chainHashes]:
			for digest: Variant in hashes:
				if not _is_sha256(digest):
					return "Invalid expected SHA256 at " + str(run.runId)
		for action: Variant in run.actions:
			if not GameAction.decode(action, _catalog).ok:
				return "Invalid expected action at " + str(run.runId)
	return ""


func _keys(value: Dictionary, keys: Array) -> bool:
	if value.size() != keys.size():
		return false
	for key: String in keys:
		if not value.has(key):
			return false
	return true


func _integer(value: Variant, low: int, high: int) -> bool:
	return typeof(value) in [TYPE_INT, TYPE_FLOAT] and is_finite(float(value)) and value >= low and value <= high and value == floor(value)


func _is_sha256(value: Variant) -> bool:
	if not value is String or value.length() != 64:
		return false
	for character: String in value:
		if not "0123456789abcdef".contains(character):
			return false
	return true


func _arguments(args: PackedStringArray) -> String:
	var options: Dictionary = {}
	var index: int = 0
	while index < args.size():
		var arg: String = args[index]
		var key: String = arg.get_slice("=", 0)
		if key not in ["--expected", "--report"] or options.has(key):
			return "Unknown or duplicate option: " + key
		var value: String = ""
		if arg.contains("="):
			value = arg.substr(key.length() + 1)
		else:
			index += 1
			if index < args.size():
				value = args[index]
		if value.is_empty() or value.begins_with("--") or not value.is_absolute_path():
			return key + " requires an absolute path"
		options[key] = value
		index += 1
	if not options.has("--expected") or not options.has("--report"):
		return "--expected and --report are required"
	if options["--expected"].simplify_path() == options["--report"].simplify_path():
		return "Expected and report paths must be different"
	_expected_path = options["--expected"]
	_report_path = options["--report"]
	return ""


func _finish_error(message: String) -> void:
	printerr("V1 compare configuration error: " + message)
	_report = {"ok": false, "error": message, "expectedFile": _expected_path}
	_finish(2)


func _finish(code: int) -> void:
	_report["elapsedMs"] = Time.get_ticks_msec() - _started
	if not _report_path.is_empty():
		var encoded: Dictionary = CanonicalJson.encode(_report)
		if not encoded.ok:
			printerr("Cannot encode comparison report: " + str(encoded.error))
			quit(2)
			return
		var file: FileAccess = FileAccess.open(_report_path, FileAccess.WRITE)
		if file == null:
			printerr("Cannot write comparison report: " + _report_path)
			quit(2)
			return
		file.store_buffer(encoded.bytes)
		file.flush()
		if file.get_error() != OK:
			printerr("Comparison report write failed: " + _report_path)
			quit(2)
			return
	quit(code)
