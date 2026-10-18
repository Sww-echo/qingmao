extends SceneTree
## Suite failures exit 1; invalid options or an unusable suite exit 2.

const SUITES: Dictionary = {
	"smoke": "res://tests/suites/smoke_suite.gd",
	"rng_vectors": "res://tests/suites/rng_vectors_suite.gd",
	"canonical_json": "res://tests/suites/canonical_json_suite.gd",
	"state_codec": "res://tests/suites/state_codec_suite.gd",
	"content_validation": "res://tests/suites/content_validation_suite.gd",
	"rules_unit": "res://tests/suites/rules_unit_suite.gd",
	"v1_replay": "res://tests/suites/v1_replay_suite.gd",
}

var _ran: bool = false


func _process(_delta: float) -> bool:
	if _ran:
		return true
	_ran = true
	var selected: Dictionary = _select_suites(OS.get_cmdline_user_args())
	if not selected.ok:
		printerr("Suite configuration error: " + selected.error)
		quit(2)
		return true
	var checks: int = 0
	var failures: int = 0
	for suite_name: String in selected.names:
		var input_error: String = _required_input_error(suite_name)
		if not input_error.is_empty():
			printerr("[%s] environment error: %s" % [suite_name, input_error])
			quit(2)
			return true
		var script: Script = load(SUITES[suite_name])
		if script == null or not script.can_instantiate():
			printerr("[%s] environment error: suite cannot load" % suite_name)
			quit(2)
			return true
		var suite: RefCounted = script.new()
		if not suite.has_method("run"):
			printerr("[%s] environment error: suite has no run method" % suite_name)
			quit(2)
			return true
		var result: Variant = suite.run(self)
		if not result is Dictionary or typeof(result.get("checks")) != TYPE_INT or not result.get("failures") is PackedStringArray:
			printerr("[%s] environment error: invalid suite result" % suite_name)
			quit(2)
			return true
		checks += result.checks
		failures += result.failures.size()
		if result.failures.is_empty():
			print("[%s] ok: %d checks" % [suite_name, result.checks])
		else:
			for message: String in result.failures:
				printerr("[%s] fail: %s" % [suite_name, message])
	print("Godot suites: %d checks, %d failures" % [checks, failures])
	quit(0 if failures == 0 else 1)
	return true


func _required_input_error(suite_name: String) -> String:
	var paths: PackedStringArray = []
	if suite_name in ["canonical_json", "state_codec", "content_validation", "rules_unit", "v1_replay"]:
		paths.append("res://content/generated/prototype/content.json")
	if suite_name == "content_validation":
		paths.append("res://content/generated/prototype/manifest.json")
	if suite_name in ["state_codec", "v1_replay"]:
		for strategy: String in ["war-ready", "network", "labor"]:
			paths.append("res://tests/fixtures/prototype/%s-42.json" % strategy)
	for path: String in paths:
		if not FileAccess.file_exists(path):
			return "missing input %s; run godot:sync-content" % path
	return ""


func _select_suites(args: PackedStringArray) -> Dictionary:
	var selected: String = ""
	var seen: bool = false
	var index: int = 0
	while index < args.size():
		var arg: String = args[index]
		if arg != "--suite" and not arg.begins_with("--suite="):
			return {"ok": false, "error": "unknown option " + arg}
		if seen:
			return {"ok": false, "error": "duplicate --suite option"}
		seen = true
		if arg == "--suite":
			index += 1
			if index >= args.size() or args[index].begins_with("--"):
				return {"ok": false, "error": "--suite requires a value"}
			selected = args[index]
		else:
			selected = arg.trim_prefix("--suite=")
		if not SUITES.has(selected):
			return {"ok": false, "error": "unknown suite " + selected}
		index += 1
	return {"ok": true, "names": [selected] if seen else SUITES.keys()}
