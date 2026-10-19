extends Node
## Deterministic W0 evidence capture.
##
## The agent shell has neither Screen Recording nor Accessibility permission, so
## `screencapture` / `osascript` cannot be used. This scene opens a real window
## with the real shell and saves the rendered viewport instead: same pixels, no
## OS permission needed.
##
## Usage:
##   godot --path godot res://tests/capture_w0.tscn -- --out=/tmp/w0-evidence
##
## Test-only. It is excluded from exported builds (see export_presets.cfg).

const MAIN_SCENE := preload("res://bootstrap/main.tscn")

## Frames to let the previous step settle before the next one. Long enough for
## the camera, the area detection and the layout to reach a steady state.
const SETTLE := 20

var _out_dir := OS.get_environment("QINGMAO_CAPTURE_OUT") if not OS.get_environment("QINGMAO_CAPTURE_OUT").is_empty() else "/tmp/w0-evidence"
var _main: Node
var _step := 0
var _timer := 0
var _move_from := Vector2.ZERO


func _ready() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):
			_out_dir = arg.trim_prefix("--out=")
	DirAccess.make_dir_recursive_absolute(_out_dir)
	print("[capture] out=%s" % _out_dir)
	print("[capture] window=%s renderer=%s" % [
		DisplayServer.window_get_size(),
		ProjectSettings.get_setting("rendering/renderer/rendering_method"),
	])
	_main = MAIN_SCENE.instantiate()
	_main.save_root = "user://qingmao_capture_w0"
	add_child(_main)


func _process(_delta: float) -> void:
	_timer += 1
	if _timer < SETTLE:
		return
	_timer = 0
	_step += 1
	match _step:
		1:
			_shot("01-title")
		2:
			_press_key(KEY_ENTER)
		3:
			print("[capture] screen after accept=%s" % _screen().name)
			_shot("02-academy")
		4:
			_move_from = _player().position
			Input.action_press("move_right")
			Input.action_press("move_down")
		5:
			Input.action_release("move_right")
			Input.action_release("move_down")
			print("[capture] movement delta=%s" % (_player().position - _move_from))
		6:
			_shot("03-after-move")
		7:
			_teleport_player_to("academy.training")
		8:
			print("[capture] prompt visible=%s text=%s" % [
				_prompt().visible, _prompt().text,
			])
			_shot("04-hotspot-prompt")
		9:
			_press_key(KEY_E)
		10:
			print("[capture] panel visible=%s" % _panel().visible)
			_shot("05-explanation-panel")
		11:
			_press_key(KEY_ESCAPE)
		12:
			print("[capture] panel after esc visible=%s" % _panel().visible)
			_shot("06-panel-closed")
		13:
			_click_at(_viewport_position_of("academy.training"))
		14:
			print("[capture] mouse click panel visible=%s" % _panel().visible)
			_shot("07-mouse-open")
		_:
			print("[capture] done")
			get_tree().quit(0)


func _screen() -> Node:
	var host := _main.get_node("ScreenHost")
	return host.get_child(0) if host.get_child_count() > 0 else null


func _player() -> Node2D:
	return _screen().get_node("World/Player")


func _prompt() -> Label:
	return _screen().get_node("UI/Root/Prompt")


func _panel() -> Control:
	return _screen().get_node("UI/Root/ExplainPanel")


func _teleport_player_to(target_id: String) -> void:
	for hotspot in get_tree().get_nodes_in_group("interactable"):
		if hotspot.target_id == target_id:
			_player().position = hotspot.position
			return
	push_error("[capture] no hotspot with target_id %s" % target_id)


## Send a real key event. `InputEventAction` is not routed to the GUI, so a
## focused Button would never see it; a genuine `InputEventKey` exercises the
## same path as a human keypress (GUI focus for buttons, `_unhandled_input`
## for the world actions).
func _press_key(keycode: Key) -> void:
	for pressed in [true, false]:
		var event := InputEventKey.new()
		event.keycode = keycode
		event.physical_keycode = keycode
		event.pressed = pressed
		Input.parse_input_event(event)


## Viewport-space position of a hotspot, so a synthetic click lands where the
## camera actually draws it.
func _viewport_position_of(target_id: String) -> Vector2:
	for hotspot in get_tree().get_nodes_in_group("interactable"):
		if hotspot.target_id == target_id:
			return get_viewport().get_canvas_transform() * hotspot.global_position
	push_error("[capture] no hotspot with target_id %s" % target_id)
	return Vector2.ZERO


func _click_at(position: Vector2) -> void:
	for pressed in [true, false]:
		var event := InputEventMouseButton.new()
		event.button_index = MOUSE_BUTTON_LEFT
		event.position = position
		event.global_position = position
		event.pressed = pressed
		Input.parse_input_event(event)


func _shot(shot_name: String) -> void:
	var image := get_viewport().get_texture().get_image()
	var path := "%s/%s.png" % [_out_dir, shot_name]
	var err := image.save_png(path)
	print("[capture] %s -> %s err=%d size=%dx%d distinct=%d" % [
		shot_name, path, err, image.get_width(), image.get_height(), _distinct_colors(image),
	])


## Cheap non-blankness probe. A uniformly coloured frame means the capture ran
## before anything was drawn, which would make the evidence worthless.
func _distinct_colors(image: Image) -> int:
	var seen := {}
	var step := maxi(1, image.get_width() / 64)
	for x in range(0, image.get_width(), step):
		for y in range(0, image.get_height(), step):
			seen[image.get_pixel(x, y).to_rgba32()] = true
	return seen.size()
