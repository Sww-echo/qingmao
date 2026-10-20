extends SceneTree
## W5 evidence capture: real window screenshots of title, the three locations
## and the state-derived modals. Test-only; excluded from export presets.
##
## Usage:
##   QINGMAO_CAPTURE_OUT=/tmp/w5-evidence \
##     godot --path godot --script res://tests/capture_w5.gd

const MAIN := preload("res://bootstrap/main.tscn")
const PLAY_SCENE := preload("res://scenes/play.tscn")
const ContentLoader := preload("res://infrastructure/content_loader.gd")

var _out: String = OS.get_environment("QINGMAO_CAPTURE_OUT")
var _main: Node

func _initialize() -> void:
	_run()

func _run() -> void:
	if _out.is_empty():
		_out = "/tmp/qingmao-w5"
	DirAccess.make_dir_recursive_absolute(_out)
	_main = MAIN.instantiate()
	_main.save_root = _out.path_join("save")
	root.add_child(_main)
	await _settle(30)
	print("WINDOW %s renderer=%s" % [DisplayServer.window_get_size(), RenderingServer.get_current_rendering_driver_name()])
	_shot("00-title")
	var title: Node = _main.get_node("ScreenHost").get_child(0)
	title.get_node("%SeedInput").text = "42"
	title.get_node("%StartButton").pressed.emit()
	await _settle(30)
	var play: Node = _main.get_node("ScreenHost").get_child(0)
	_shot("01-academy")

	play.get_node("%TravelInn").pressed.emit()
	await _settle(20)
	_shot("02-inn")
	play.get_node("%TravelBamboo").pressed.emit()
	await _settle(20)
	_shot("03-bamboo")
	play.get_node("%TravelAcademy").pressed.emit()
	await _settle(20)

	play.get_node("%GuButton").pressed.emit()
	await _settle(15)
	_shot("04-gu")
	play.get_node("%GuCloseButton").pressed.emit()
	await _settle(10)

	var first: Node = play.get_node("%EventList").get_child(0)
	if first is Button:
		(first as Button).pressed.emit()
		await _settle(20)
		_shot("05-event")
		play.get_node("%EventDismissButton").pressed.emit()
		await _settle(10)

	play.get_node("%PauseButton").pressed.emit()
	await _settle(15)
	_shot("06-pause")
	play.get_node("%PauseResume").pressed.emit()
	await _settle(10)

	play.get_node("%EndDayButton").pressed.emit()
	await _settle(20)
	_shot("07-day-review")

	# The live screen is a child of Main; free it so the state-derived modals
	# below are the only UI layer in frame.
	_main.queue_free()
	await _settle(3)
	await _capture_state_modals()
	print("CAPTURE done: %s" % _out)
	quit(0)

## Combat/day-end/ending modals derive from state; load golden states directly.
func _capture_state_modals() -> void:
	var loaded: Dictionary = ContentLoader.load_pack()
	if not loaded.ok:
		return
	var trace: Dictionary = JSON.parse_string(
		FileAccess.get_file_as_string("res://tests/fixtures/prototype/war-ready-42.json")).trace
	var points: Dictionary = {}
	for index: int in range(trace.steps.size()):
		var state: Dictionary = trace.steps[index].state
		if not points.has("combat") and state.combat != null:
			points["combat"] = index
		if state.ending != null:
			points["ending"] = index
	for name: String in ["combat", "ending"]:
		if not points.has(name):
			continue
		var session: GameSession = GameSession.new()
		root.add_child(session)
		session.configure(loaded.catalog, null)
		session.load_run({
			"runId": "capture-%s" % name,
			"revision": int(points[name]) + 1,
			"state": trace.steps[int(points[name])].state,
		})
		var play: Node = PLAY_SCENE.instantiate()
		play.configure(session)
		root.add_child(play)
		await _settle(20)
		_shot("08-%s" % name)
		play.queue_free()
		session.queue_free()
		await _settle(5)

func _settle(frames: int) -> void:
	for index: int in range(frames):
		await process_frame

func _shot(name: String) -> void:
	var image: Image = root.get_texture().get_image()
	# OpenGL readback is bottom-up on some Linux/X11 drivers; store upright PNGs
	# so screenshots can be reviewed without external post-processing.
	image.flip_y()
	var path: String = _out.path_join(name + ".png")
	print("SHOT %s error=%s" % [path, image.save_png(path)])
