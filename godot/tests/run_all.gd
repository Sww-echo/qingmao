extends SceneTree
## W0 smoke checks for the Godot architecture-demo shell.
##
## Run:
##   godot --headless --path godot --script res://tests/run_all.gd
##
## Exits non-zero on the first reported failure so a gate can depend on it.
## This is deliberately a *shell* check: it proves the window, the Chinese font,
## the input map and the placeholder scenes load. It says nothing about game
## rules, because W0 has none — those arrive in W2 and get their own runner.

const TITLE_SCENE := preload("res://scenes/title.tscn")
const PLAY_SCENE := preload("res://scenes/play.tscn")
const THEME_PATH := "res://ui/app_theme.tres"

const REQUIRED_ACTIONS := ["move_left", "move_right", "move_up", "move_down", "interact"]
const REQUIRED_GLYPHS := ["青", "茅", "山", "蛊", "真", "元"]

var _failures: PackedStringArray = []
var _checks := 0


var _ran := false


## The checks run on the first frame, not in `_initialize()`: at `_initialize()`
## time the root window is not inside the tree yet, so `add_child` would skip
## every child's `_ready` and the node-group lookups would silently see nothing.
func _process(_delta: float) -> bool:
	if _ran:
		return true
	_ran = true
	_check_project_settings()
	_check_input_map()
	_check_theme_font()
	_check_title_scene()
	_check_play_scene()
	_report()
	return true


func _check_project_settings() -> void:
	_expect(
		String(ProjectSettings.get_setting("rendering/renderer/rendering_method")) == "gl_compatibility",
		"renderer must be gl_compatibility (Compatibility path for desktop + Web)"
	)
	_expect(
		int(ProjectSettings.get_setting("display/window/size/viewport_width")) == 1280
			and int(ProjectSettings.get_setting("display/window/size/viewport_height")) == 720,
		"viewport must be the 1280x720 baseline"
	)
	_expect(
		String(ProjectSettings.get_setting("display/window/stretch/mode")) == "canvas_items",
		"stretch mode must be canvas_items so window scaling works"
	)
	_expect(
		String(ProjectSettings.get_setting("gui/theme/custom")) == THEME_PATH,
		"project must use the bundled CJK theme"
	)


func _check_input_map() -> void:
	for action in REQUIRED_ACTIONS:
		if not _expect(InputMap.has_action(action), "missing input action: %s" % action):
			continue
		_expect(
			not InputMap.action_get_events(action).is_empty(),
			"input action %s has no bound key" % action
		)


func _check_theme_font() -> void:
	var theme: Theme = load(THEME_PATH)
	if not _expect(theme != null, "theme %s failed to load" % THEME_PATH):
		return
	var font: Font = theme.default_font
	if not _expect(font != null, "theme declares no default font"):
		return
	for glyph in REQUIRED_GLYPHS:
		_expect(
			font.has_char(glyph.unicode_at(0)),
			"bundled font is missing CJK glyph: %s" % glyph
		)


func _check_title_scene() -> void:
	var title := TITLE_SCENE.instantiate()
	if not _expect(title != null, "title scene failed to instantiate"):
		return
	_expect(title.has_signal("start_requested"), "title scene lacks start_requested")
	_expect(title.has_signal("quit_requested"), "title scene lacks quit_requested")
	root.add_child(title)
	for path in ["Center/Column/StartButton", "Center/Column/QuitButton"]:
		_expect(title.get_node_or_null(path) != null, "title scene is missing %s" % path)
	title.queue_free()


func _check_play_scene() -> void:
	var play := PLAY_SCENE.instantiate()
	if not _expect(play != null, "play scene failed to instantiate"):
		return
	_expect(play.has_signal("exit_requested"), "play scene lacks exit_requested")
	root.add_child(play)

	_expect(play.get_node_or_null("World/Player") != null, "play scene is missing World/Player")
	_expect(
		play.get_node_or_null("World/InteractionController") != null,
		"play scene is missing World/InteractionController"
	)

	var ids: PackedStringArray = []
	for hotspot in get_nodes_in_group("interactable"):
		ids.append(hotspot.target_id)
	_expect(ids.size() == 3, "expected 3 interactables, found %d" % ids.size())
	_expect(not ids.has(""), "an interactable declares an empty target_id")
	var seen := {}
	for id in ids:
		seen[id] = true
	_expect(seen.size() == ids.size(), "duplicate interactable target_id")

	# Every demo must state its own scope; a screen that looks finished but is
	# not would be exactly the misleading artefact the plan forbids.
	var status := play.get_node_or_null("UI/Root/StatusBar/StatusLine")
	_expect(status != null, "play scene is missing the status line")
	if status != null:
		_expect(
			status.text.contains("架构演示"),
			"status line must state that this is an architecture demo"
		)

	play.queue_free()


func _expect(condition: bool, message: String) -> bool:
	_checks += 1
	if not condition:
		_failures.append(message)
	return condition


func _report() -> void:
	if _failures.is_empty():
		print("W0 smoke: %d checks passed" % _checks)
		quit(0)
		return
	for failure in _failures:
		printerr("FAIL: %s" % failure)
	printerr("W0 smoke: %d of %d checks failed" % [_failures.size(), _checks])
	quit(1)
