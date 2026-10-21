extends SceneTree
## W7 evidence screenshots: long crisis event at 720p/1080p plus the pause
## modal. Test-only; excluded from exports. Requires a real display.

const MAIN := preload("res://bootstrap/main.tscn")
const PLAY_SCENE := preload("res://scenes/play.tscn")
const ContentLoader := preload("res://infrastructure/content_loader.gd")
const FIXTURE := "res://tests/fixtures/prototype/war-ready-42.json"

var _out: String = OS.get_environment("QINGMAO_CAPTURE_OUT")

func _initialize() -> void:
	_run()

func _run() -> void:
	if _out.is_empty():
		_out = "/tmp/qingmao-w7"
	DirAccess.make_dir_recursive_absolute(_out)
	var loaded: Dictionary = ContentLoader.load_pack()
	if not loaded.ok:
		printerr(loaded.error)
		quit(2)
		return
	var trace: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(FIXTURE)).trace
	var crisis_index: int = -1
	var combat_index: int = -1
	for index: int in range(trace.steps.size()):
		var state: Dictionary = trace.steps[index].state
		if crisis_index < 0 and state.activeEvent == "crisis-arrival":
			crisis_index = index
		if combat_index < 0 and state.combat != null:
			combat_index = index
	if crisis_index < 0 or combat_index < 0:
		printerr("golden trace is missing its crisis/combat points")
		quit(2)
		return
	# Window size is supplied by `--resolution`; let the first frames settle so
	# DisplayServer and the viewport report the actual window, not the 100x100
	# scene-tree default.
	await _settle(6)
	var size: Vector2i = DisplayServer.window_get_size()
	var session: GameSession = GameSession.new()
	root.add_child(session)
	session.configure(loaded.catalog, null)
	session.load_run({"runId": "w7-crisis-%d" % size.x, "revision": crisis_index + 1,
		"state": trace.steps[crisis_index].state})
	var play: Node = PLAY_SCENE.instantiate()
	play.configure(session)
	root.add_child(play)
	await _settle(12)
	print("W7 WINDOW viewport=%s event_modal=%s scroll=%s" % [
		root.get_visible_rect(),
		play.get_node("UI/Root/ModalLayer/EventCenter/EventModal").get_global_rect(),
		play.get_node("UI/Root/ModalLayer/EventCenter/EventModal/Body/EventScroll").get_global_rect(),
	])
	_shot("crisis-%dx%d" % [size.x, size.y])
	play.queue_free()
	session.queue_free()
	await _settle(4)
	await _settle(4)
	var main: Node = MAIN.instantiate()
	main.save_root = _out.path_join("save")
	root.add_child(main)
	await _settle(10)
	var title: Node = main.get_node("ScreenHost").get_child(0)
	title.get_node("%SeedInput").text = "42"
	title.get_node("%StartButton").pressed.emit()
	await _settle(10)
	var play2: Node = main.get_node("ScreenHost").get_child(0)
	play2._open_pause()
	await _settle(6)
	_shot("pause-720")
	print("W7 WINDOW pause status=%s" % play2.get_node("%PauseStatus").text)
	print("W7 CAPTURE done: %s" % _out)
	quit(0)

func _settle(frames: int) -> void:
	for index: int in range(frames):
		await process_frame

func _shot(name: String) -> void:
	var image: Image = root.get_texture().get_image()
	var path: String = _out.path_join(name + ".png")
	print("SHOT %s error=%s" % [path, image.save_png(path)])
