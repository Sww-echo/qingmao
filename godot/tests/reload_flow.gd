extends SceneTree
## W5 recovery points: load a golden state into a fresh session and render it
## through the real play scene. This is the UI-level companion to W3's
## process-interruption matrix; it is not a substitute for native playtesting.

const PLAY_SCENE := preload("res://scenes/play.tscn")
const ContentLoaderScript := preload("res://infrastructure/content_loader.gd")
const FIXTURE := "res://tests/fixtures/prototype/war-ready-42.json"

var _checks: int = 0
var _failures: PackedStringArray = []
var _catalog: ContentCatalog
var _trace: Dictionary

func _initialize() -> void:
	_run()

func _run() -> void:
	var loaded: Dictionary = ContentLoaderScript.load_pack()
	if not loaded.ok:
		_fail("content load failed: %s" % loaded.error)
		_finish()
		return
	_catalog = loaded.catalog
	_trace = JSON.parse_string(FileAccess.get_file_as_string(FIXTURE)).trace
	if _trace.is_empty():
		_fail("golden fixture did not parse")
		_finish()
		return
	var points: Dictionary = _recovery_points()
	for name: String in ["event", "combat", "day-end", "ending"]:
		if not points.has(name):
			_fail("golden trace lacks %s recovery point" % name)
			continue
		await _check_point(name, int(points[name]))
	await _check_layout()
	print("W5 reload flow: %d checks, %d failures" % [_checks, _failures.size()])
	_finish()

func _recovery_points() -> Dictionary:
	var points: Dictionary = {}
	for index: int in range(_trace.steps.size()):
		var state: Dictionary = _trace.steps[index].state
		if not points.has("event") and state.activeEvent != null:
			points["event"] = index
		if not points.has("combat") and state.combat != null:
			points["combat"] = index
		if not points.has("day-end") and _trace.actions[index].type == "END_DAY":
			points["day-end"] = index
		if state.ending != null:
			points["ending"] = index
	return points

func _check_point(name: String, index: int) -> void:
	var state: Dictionary = _trace.steps[index].state
	var body: Dictionary = {"runId": "reload-%s" % name, "revision": index + 1, "state": state}
	var session: GameSession = GameSession.new()
	root.add_child(session)
	session.configure(_catalog, null)
	var loaded: Dictionary = session.load_run(body)
	_expect(loaded.ok, "%s state loads into a fresh session" % name)
	if not loaded.ok:
		session.queue_free()
		return
	var play: Node = PLAY_SCENE.instantiate()
	play.configure(session)
	root.add_child(play)
	await process_frame
	await process_frame

	_expect(session.current_revision() == index + 1, "%s keeps its revision" % name)
	var centered: String = {
		"event": "%EventCenter", "combat": "%CombatCenter",
		"day-end": "%DayReviewCenter", "ending": "%EndingCenter",
	}[name]
	var visible: bool = play.get_node(centered).visible
	if name == "day-end":
		# A day review is a one-shot projection, not persisted state. Reloading
		# must not re-run upkeep or re-show the old ledger.
		_expect(not visible, "day-end does not replay the review after reload")
		_expect(int(session.snapshot_view().state.day) == int(state.day),
			"day-end does not advance the day again")
	else:
		_expect(visible, "%s modal is restored from state" % name)
	if name == "event":
		_expect(String(play.get_node("%EventTitle").text) == String(_event(state.activeEvent).title),
			"event modal shows the active event")
	if name == "combat":
		_expect(play.get_node("%CombatActions").get_child_count() == 7,
			"combat modal rebuilds its seven actions")
		_expect(String(play.get_node("%CombatForecast").text).contains("下一招"),
			"combat modal restores the announced intent")
	if name == "ending":
		_expect(String(play.get_node("%EndingBody").text).contains("原因"),
			"ending modal restores its reasons")
		_expect(String(play.get_node("%EndingTitle").text).contains("守住通道"),
			"ending modal restores the ending id")
	# Load must not settle or reward anything by itself.
	var expected: Dictionary = state.duplicate(true)
	expected.erase("seed")
	expected.erase("rng")
	expected.erase("rngDraws")
	_expect(_same_state(session.snapshot_view().state, expected),
		"%s reload preserves the complete public state" % name)
	play.queue_free()
	session.queue_free()

func _check_layout() -> void:
	var previous: Vector2i = root.size
	root.size = Vector2i(1280, 720)
	await process_frame
	await process_frame
	var session: GameSession = GameSession.new()
	root.add_child(session)
	session.configure(_catalog, null)
	_expect(session.new_run(42).ok, "layout run starts")
	var play: Node = PLAY_SCENE.instantiate()
	play.configure(session)
	root.add_child(play)
	await process_frame
	await process_frame
	var viewport: Rect2 = play.get_viewport().get_visible_rect()
	for path: String in [
		"UI/Root/SessionPanel", "UI/Root/SessionPanel/Margin/Scroll",
		"UI/Root/SessionPanel/Margin/Scroll/Body/Actions/EndDayButton",
		"UI/Root/LogPanel",
	]:
		var control: Control = play.get_node(path)
		_expect(viewport.encloses(control.get_global_rect()),
			"720p contains %s (%s)" % [path, control.get_global_rect()])
	play.queue_free()
	session.queue_free()
	root.size = previous
	await process_frame

func _event(id: String) -> Dictionary:
	for event: Dictionary in _catalog.data.events:
		if event.id == id:
			return event
	return {}

func _same_state(left: Dictionary, right: Dictionary) -> bool:
	var a: Dictionary = CanonicalJson.encode(left)
	var b: Dictionary = CanonicalJson.encode(right)
	return a.ok and b.ok and String(a.text) == String(b.text)

func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		printerr("W5 reload fail: " + message)

func _fail(message: String) -> void:
	_checks += 1
	_failures.append(message)
	printerr("W5 reload fail: " + message)

func _finish() -> void:
	quit(0 if _failures.is_empty() else 1)
