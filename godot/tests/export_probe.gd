extends SceneTree
## Run this external script against an exported --main-pack, not the source tree.


func _initialize() -> void:
	if not OS.has_feature("editor"):
		printerr("Use the editor binary with --main-pack and this external probe script")
		quit(2)
		return
	var required := [
		"res://content/generated/prototype/content.json",
		"res://content/generated/prototype/manifest.json",
	]
	var excluded := [
		"res://tests/run_all.gd",
		"res://tests/run_all.gdc",
		"res://tests/export_probe.gd",
		"res://tests/fixtures/prototype/war-ready-42.json",
		"res://tests/fixtures/prototype/network-42.json",
		"res://tests/fixtures/prototype/labor-42.json",
	]
	for path in required:
		if not FileAccess.file_exists(path):
			printerr("Export is missing content resource: " + path)
			quit(1)
			return
	for path in excluded:
		if FileAccess.file_exists(path):
			printerr("Export contains a development-only resource: " + path)
			quit(1)
			return
	print("Export resources verified: content/manifest present; test runner and fixtures excluded")
	quit(0)
