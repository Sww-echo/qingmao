class_name SmokeSuite
extends RefCounted
## The original W0 shell checks, preserved independently of domain contracts.

const TITLE_SCENE := preload("res://scenes/title.tscn")
const PLAY_SCENE := preload("res://scenes/play.tscn")
const THEME_PATH := "res://ui/app_theme.tres"
const CHECKS = preload("res://tests/suite_checks.gd")
const REQUIRED_ACTIONS := ["move_left", "move_right", "move_up", "move_down", "interact"]
const REQUIRED_GLYPHS := ["青", "茅", "山", "蛊", "真", "元"]

var _tree: SceneTree
var _check: RefCounted


func run(tree: SceneTree) -> Dictionary:
	_tree = tree
	_check = CHECKS.new()
	_check_project_settings()
	_check_input_map()
	_check_theme_font()
	_check_title_scene()
	_check_play_scene()
	return _check.result()


func _check_project_settings() -> void:
	_check.expect(
		String(ProjectSettings.get_setting("rendering/renderer/rendering_method")) == "gl_compatibility",
		"renderer must be gl_compatibility (Compatibility path for desktop + Web)"
	)
	_check.expect(
		int(ProjectSettings.get_setting("display/window/size/viewport_width")) == 1280
			and int(ProjectSettings.get_setting("display/window/size/viewport_height")) == 720,
		"viewport must be the 1280x720 baseline"
	)
	_check.expect(
		String(ProjectSettings.get_setting("display/window/stretch/mode")) == "canvas_items",
		"stretch mode must be canvas_items so window scaling works"
	)
	_check.expect(
		String(ProjectSettings.get_setting("gui/theme/custom")) == THEME_PATH,
		"project must use the bundled CJK theme"
	)


func _check_input_map() -> void:
	for action in REQUIRED_ACTIONS:
		if not _check.expect(InputMap.has_action(action), "missing input action: %s" % action):
			continue
		_check.expect(not InputMap.action_get_events(action).is_empty(), "input action %s has no bound key" % action)


func _check_theme_font() -> void:
	var theme: Theme = load(THEME_PATH)
	if not _check.expect(theme != null, "theme %s failed to load" % THEME_PATH):
		return
	var font: Font = theme.default_font
	if not _check.expect(font != null, "theme declares no default font"):
		return
	for glyph in REQUIRED_GLYPHS:
		_check.expect(font.has_char(glyph.unicode_at(0)), "bundled font is missing CJK glyph: %s" % glyph)


func _check_title_scene() -> void:
	var title := TITLE_SCENE.instantiate()
	if not _check.expect(title != null, "title scene failed to instantiate"):
		return
	_check.expect(title.has_signal("start_requested"), "title scene lacks start_requested")
	_check.expect(title.has_signal("continue_requested"), "title scene lacks continue_requested")
	_check.expect(title.has_signal("quit_requested"), "title scene lacks quit_requested")
	_tree.root.add_child(title)
	for path in [
		"Center/Column/StartButton", "Center/Column/ContinueButton",
		"Center/Column/SaveStatus", "Center/Column/QuitButton",
	]:
		_check.expect(title.get_node_or_null(path) != null, "title scene is missing %s" % path)
	# Seeds are uint32; a long paste must be rejected before int() can overflow.
	for bad: String in ["99999999999999999999", "4294967296", "-1", "12a"]:
		var parsed: Dictionary = title._parse_seed(bad)
		_check.expect(not parsed.get("ok", true), "seed %s must be rejected" % bad)
	_check.expect(title._parse_seed("0000042").get("value", -1) == 42, "leading zeroes parse as their numeric value")
	title.queue_free()


func _check_play_scene() -> void:
	var play := PLAY_SCENE.instantiate()
	if not _check.expect(play != null, "play scene failed to instantiate"):
		return
	_check.expect(play.has_signal("exit_requested"), "play scene lacks exit_requested")
	_check.expect(play.has_method("configure"), "play scene lacks the W3 session boundary")
	_tree.root.add_child(play)
	_check.expect(play.get_node_or_null("World/Player") != null, "play scene is missing World/Player")
	_check.expect(play.get_node_or_null("World/InteractionController") != null, "play scene is missing World/InteractionController")
	for path in [
		"UI/Root/SessionPanel/Margin/Scroll/Body/SessionHud",
		"UI/Root/SessionPanel/Margin/Scroll/Body/SaveStatus",
		"UI/Root/SessionPanel/Margin/Scroll/Body/Actions/WorkButton",
		"UI/Root/SessionPanel/Margin/Scroll/Body/Actions/RestButton",
		"UI/Root/SessionPanel/Margin/Scroll/Body/Actions/EndDayButton",
	]:
		_check.expect(play.get_node_or_null(path) != null, "play scene is missing %s" % path)
	var ids: PackedStringArray = []
	for hotspot in _tree.get_nodes_in_group("interactable"):
		ids.append(hotspot.target_id)
	# W5: 3 academy + 2 inn + 3 bamboo hotspots, all registered but
	# visibility-filtered by the interaction controller.
	_check.expect(ids.size() == 8, "expected 8 interactables, found %d" % ids.size())
	_check.expect(not ids.has(""), "an interactable declares an empty target_id")
	var seen: Dictionary = {}
	for id in ids:
		seen[id] = true
	_check.expect(seen.size() == ids.size(), "duplicate interactable target_id")
	var status := play.get_node_or_null("UI/Root/StatusBar/StatusLine")
	_check.expect(status != null, "play scene is missing the status line")
	if status != null:
		_check.expect(status.text.contains("可玩第 1 日"), "status line must state the playable W4 scope")
	play.queue_free()
