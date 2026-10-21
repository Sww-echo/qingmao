extends SceneTree
## W7 focus/long-text regression: every state-derived modal must contain Tab,
## and the event body must stay scrollable without pushing choices off-screen.

const PLAY_SCENE := preload("res://scenes/play.tscn")
const ContentLoaderScript := preload("res://infrastructure/content_loader.gd")
const FIXTURE := "res://tests/fixtures/prototype/war-ready-42.json"

var _checks: int = 0
var _failures: PackedStringArray = []
var _catalog: ContentCatalog

func _initialize() -> void:
	_run()

func _run() -> void:
	var loaded: Dictionary = ContentLoaderScript.load_pack()
	if not loaded.ok:
		_fail("content load failed: %s" % loaded.error)
		_finish()
		return
	_catalog = loaded.catalog
	await _event_and_pause_focus()
	await _gu_focus()
	await _combat_focus()
	await _review_focus()
	await _ending_focus()
	await _layout(1280, 720)
	await _layout(1920, 1080)
	print("W7 UX: %d checks, %d failures" % [_checks, _failures.size()])
	_finish()

func _event_and_pause_focus() -> void:
	var session := _session(42)
	var play: Node = PLAY_SCENE.instantiate()
	play.configure(session)
	root.add_child(play)
	await _settle()
	var event_button: Button = _find_button(play.get_node("%EventList"), "十四日守望")
	_expect(event_button != null, "day-one event is listed")
	if event_button != null:
		event_button.pressed.emit()
		await _settle()
	_expect(play.get_node("%EventCenter").visible, "event modal opens")
	_expect(play.get_node("UI/Root/ModalLayer/EventCenter/EventModal/Body/EventScroll") is ScrollContainer,
		"event body uses a scroll container")
	_expect(await _tab_contained(play, 32), "Tab stays inside the event modal")
	var event_revision: int = session.current_revision()
	play._submit({"type": "WORK"})
	await _settle()
	_expect(session.current_revision() == event_revision, "event modal blocks HUD actions")
	play.get_node("%EventDismissButton").pressed.emit()
	await _settle()
	play.get_node("%PauseButton").pressed.emit()
	await _settle()
	_expect(play.get_node("%PauseCenter").visible, "pause opens")
	_expect(await _tab_contained(play, 32), "Tab stays inside the pause modal")
	_expect(play.get_node("%PauseRetrySave").visible, "pause exposes retry-save control")
	play.get_node("%PauseResume").pressed.emit()
	await _settle()
	play.queue_free()
	session.queue_free()

func _gu_focus() -> void:
	var session := _session(42)
	var play: Node = PLAY_SCENE.instantiate()
	play.configure(session)
	root.add_child(play)
	await _settle()
	play.get_node("%GuButton").pressed.emit()
	await _settle()
	_expect(play.get_node("%GuCenter").visible, "gu panel opens")
	_expect(await _tab_contained(play, 32), "Tab stays inside the gu modal")
	_expect(_inside(play.get_node("%GuCloseButton")), "gu close button is inside the viewport")
	play.get_node("%GuCloseButton").pressed.emit()
	await _settle()
	play.queue_free()
	session.queue_free()

func _combat_focus() -> void:
	var point: int = _point("combat")
	_expect(point >= 0, "golden trace has a combat point")
	if point < 0:
		return
	var session := _load_point(point, "w7-combat")
	var play: Node = PLAY_SCENE.instantiate()
	play.configure(session)
	root.add_child(play)
	await _settle()
	_expect(play.get_node("%CombatCenter").visible, "combat modal opens")
	_expect(await _tab_contained(play, 32), "Tab stays inside the combat modal")
	_expect(_inside(play.get_node("UI/Root/ModalLayer/CombatCenter/CombatModal")), "combat modal fits the viewport")
	play.queue_free()
	session.queue_free()

func _review_focus() -> void:
	var session := _session(42)
	var play: Node = PLAY_SCENE.instantiate()
	play.configure(session)
	root.add_child(play)
	await _settle()
	play.get_node("%EndDayButton").pressed.emit()
	await _settle()
	_expect(play.get_node("%DayReviewCenter").visible, "day review opens")
	_expect(await _tab_contained(play, 32), "Tab stays inside the day review")
	_expect(_inside(play.get_node("%DayReviewCenter").get_child(0)), "day review fits the viewport")
	play.get_node("%DayReviewContinue").pressed.emit()
	await _settle()
	play.queue_free()
	session.queue_free()

func _ending_focus() -> void:
	var point: int = _point("ending")
	_expect(point >= 0, "golden trace has an ending point")
	if point < 0:
		return
	var session := _load_point(point, "w7-ending")
	var play: Node = PLAY_SCENE.instantiate()
	play.configure(session)
	root.add_child(play)
	await _settle()
	_expect(play.get_node("%EndingCenter").visible, "ending modal opens")
	_expect(await _tab_contained(play, 32), "Tab stays inside the ending modal")
	_expect(_inside(play.get_node("%EndingCenter").get_child(0)), "ending modal fits the viewport")
	play.queue_free()
	session.queue_free()

func _layout(width: int, height: int) -> void:
	root.size = Vector2i(width, height)
	await process_frame
	await process_frame
	var session := _session(42)
	var play: Node = PLAY_SCENE.instantiate()
	play.configure(session)
	root.add_child(play)
	await _settle()
	var event_button: Button = _find_button(play.get_node("%EventList"), "十四日守望")
	if event_button != null:
		event_button.pressed.emit()
		await _settle()
	var viewport: Rect2 = play.get_viewport().get_visible_rect()
	for path: String in [
		"UI/Root/ModalLayer/EventCenter/EventModal",
		"UI/Root/ModalLayer/EventCenter/EventModal/Body/EventScroll",
		"UI/Root/ModalLayer/EventCenter/EventModal/Body/EventChoices",
		"UI/Root/ModalLayer/EventCenter/EventModal/Body/EventDismissButton",
	]:
		var control: Control = play.get_node(path)
		_expect(viewport.encloses(control.get_global_rect()),
			"%dx%d contains %s (%s)" % [width, height, path, control.get_global_rect()])
	_expect(play.get_node("UI/Root/ModalLayer/EventCenter/EventModal/Body/EventScroll").get_v_scroll_bar().visible
		or String(play.get_node("%EventDesc").text).length() < 200,
		"long event text is scrollable rather than clipped")
	play.queue_free()
	session.queue_free()

func _tab_contained(play: Node, presses: int) -> bool:
	var modal: Node = play.get_node("%ModalLayer")
	for index: int in range(presses):
		_key(KEY_TAB)
		await process_frame
		var owner: Control = play.get_viewport().gui_get_focus_owner()
		if owner == null or not modal.is_ancestor_of(owner):
			return false
	return true

func _inside(control: Control) -> bool:
	return control != null and control.get_viewport().get_visible_rect().encloses(control.get_global_rect())

func _session(seed: int) -> GameSession:
	var session := GameSession.new()
	root.add_child(session)
	session.configure(_catalog, null)
	session.new_run(seed)
	return session

func _load_point(index: int, run_id: String) -> GameSession:
	var trace: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(FIXTURE)).trace
	var session := GameSession.new()
	root.add_child(session)
	session.configure(_catalog, null)
	session.load_run({"runId": run_id, "revision": index + 1, "state": trace.steps[index].state})
	return session

func _point(kind: String) -> int:
	var trace: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(FIXTURE)).trace
	for index: int in range(trace.steps.size()):
		var state: Dictionary = trace.steps[index].state
		if kind == "combat" and state.combat != null:
			return index
		if kind == "ending" and state.ending != null:
			return index
	return -1

func _find_button(container: Node, prefix: String) -> Button:
	for child: Node in container.get_children():
		if child is Button and String(child.text).begins_with(prefix):
			return child
	return null

func _key(code: Key) -> void:
	for pressed: bool in [true, false]:
		var event := InputEventKey.new()
		event.keycode = code
		event.physical_keycode = code
		event.pressed = pressed
		Input.parse_input_event(event)

func _settle(frames: int = 3) -> void:
	for index: int in range(frames):
		await process_frame

func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		printerr("W7 UX fail: " + message)

func _fail(message: String) -> void:
	_checks += 1
	_failures.append(message)
	printerr("W7 UX fail: " + message)

func _finish() -> void:
	quit(0 if _failures.is_empty() else 1)
