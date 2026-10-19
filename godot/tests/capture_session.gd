extends SceneTree
## Native-window input/capture probe; separate write/continue process launches.

const MAIN := preload("res://bootstrap/main.tscn")
var _main: Node
var _frame: int = 0
var _mode: String = OS.get_environment("QINGMAO_CAPTURE_MODE")
var _out: String = OS.get_environment("QINGMAO_CAPTURE_OUT")
var _save_root: String = OS.get_environment("QINGMAO_CAPTURE_SAVE_ROOT")

func _process(_delta: float) -> bool:
	_frame += 1
	if _frame == 1:
		if _out.is_empty() or _save_root.is_empty() or _mode not in ["write", "continue"]:
			quit(2)
			return true
		DirAccess.make_dir_recursive_absolute(_out)
		_main = MAIN.instantiate()
		_main.save_root = _save_root
		root.add_child(_main)
	if _frame == 30:
		_shot(_mode + "-title")
		if _mode == "continue":
			_main.get_node("ScreenHost").get_child(0).get_node("%ContinueButton").grab_focus()
		_key(KEY_ENTER)
	if _frame == 60 and _mode == "write":
		var play: Node = _main.get_node("ScreenHost").get_child(0)
		var button: Button = play.get_node("%WorkButton")
		for pressed: bool in [true, false]:
			var event := InputEventMouseButton.new()
			event.position = button.get_global_rect().get_center()
			event.global_position = event.position
			event.button_index = MOUSE_BUTTON_LEFT
			event.pressed = pressed
			Input.parse_input_event(event)
	if _frame == 90:
		_shot(_mode + "-play")
		var service: SaveService = _main.get("_save_service")
		var loaded: Dictionary = service.load(false)
		if not loaded.ok or int(loaded.body.revision) != 1:
			printerr("native capture did not restore revision one: " + str(loaded))
			quit(1)
			return true
		var canonical: Dictionary = CanonicalJson.encode(loaded.body)
		var expected_path: String = _out.path_join("expected-body.json")
		var store := DesktopSaveStore.new()
		if _mode == "write":
			store.write(expected_path, canonical.bytes)
		elif store.read(expected_path).get("bytes") != canonical.bytes:
			printerr("native continuation changed the full saved state")
			quit(1)
			return true
		print("NATIVE %s revision=%d runId=%s bodySha256=%s" % [
			_mode, int(loaded.body.revision), loaded.body.runId, CanonicalJson.sha256(canonical.bytes),
		])
		_key(KEY_ESCAPE)
	if _frame == 120:
		_shot(_mode + "-returned-title")
		quit(0)
	return false

func _key(code: Key) -> void:
	for pressed: bool in [true, false]:
		var event := InputEventKey.new()
		event.keycode = code
		event.physical_keycode = code
		event.pressed = pressed
		Input.parse_input_event(event)

func _shot(name: String) -> void:
	var image: Image = root.get_texture().get_image()
	var path: String = _out.path_join(name + ".png")
	print("CAPTURE %s error=%s" % [path, image.save_png(path)])
