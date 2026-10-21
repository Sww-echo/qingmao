extends SceneTree
## W6 pack switch: the composition root must load V2 via `pack_id`/`--pack=`
## without any new title control, keep a separate save slot, and restore it.

const MAIN := preload("res://bootstrap/main.tscn")

var _checks: int = 0
var _failures: PackedStringArray = []

func _initialize() -> void:
	_run()

func _run() -> void:
	var loaded: Dictionary = ContentLoader.load_pack("qingmao14-v2")
	if not _expect(loaded.ok, "V2 content loads"):
		_finish()
		return
	_expect(loaded.catalog.data.scenarioId == "qingmao-fourteen-day-v2", "V2 scenario id")
	_expect(loaded.catalog.data.events.size() == 28, "V2 exposes 28 events")
	_expect(loaded.catalog.has_id("enemies", "crisis-alpha"), "V2 exposes the alpha")

	var main: Node = MAIN.instantiate()
	main.pack_id = "qingmao14-v2"
	main.save_root = "user://w6-pack-%d" % Time.get_ticks_usec()
	root.add_child(main)
	await _settle(20)
	var title: Node = main.get_node("ScreenHost").get_child(0)
	_expect(title.name == "Title", "V2 starts at the same title screen")
	title.get_node("%SeedInput").text = "42"
	title.get_node("%StartButton").pressed.emit()
	await _settle(20)
	var play: Node = main.get_node("ScreenHost").get_child(0)
	var session: GameSession = main.get("_session")
	_expect(play.name == "Play", "V2 opens the play screen")
	_expect(session.snapshot_view().state.scenarioId == "qingmao-fourteen-day-v2",
		"the session runs the V2 scenario")
	_expect(play.get_node("%StatusLine").text.contains("十四日生存试玩"), "V2 uses the same HUD")
	_expect(play.get_node("%RelationLine").text.contains("巡山队长"), "V2 keeps the relation readout")
	# V2-only event must be reachable through the generic list once its window opens.
	var v2_event_button: Button = _event_button(play, "十四日守望")
	_expect(v2_event_button != null, "V2 day-one event is listed")
	if v2_event_button != null:
		v2_event_button.pressed.emit()
		await _settle(10)
		_expect(play.get_node("%EventCenter").visible, "V2 event modal opens")
		play.get_node("%EventDismissButton").pressed.emit()
		await _settle(10)
	# Auto-save and continue must use the V2 slot, not the V1 one.
	play._open_pause()
	await _settle(10)
	play.get_node("%PauseTitleReturn").pressed.emit()
	await _settle(15)
	var returned: Node = main.get_node("ScreenHost").get_child(0)
	_expect(returned.name == "Title", "V2 returns to the title")
	_expect(not returned.get_node("%ContinueButton").disabled, "V2 continue is enabled")
	returned.get_node("%ContinueButton").pressed.emit()
	await _settle(20)
	var resumed: Node = main.get_node("ScreenHost").get_child(0)
	_expect(resumed.name == "Play", "V2 continue restores play")
	_expect(session.snapshot_view().state.scenarioId == "qingmao-fourteen-day-v2",
		"V2 continue keeps the scenario")
	var slot: String = main.get("_save_service").get("_slot_path")
	_expect(slot.ends_with("qingmao-fourteen-day-v2/qingmao-rules-2"), "V2 uses its own save slot")
	print("W6 pack switch: %d checks, %d failures" % [_checks, _failures.size()])
	_finish()

func _event_button(play: Node, prefix: String) -> Button:
	for child: Node in play.get_node("%EventList").get_children():
		if child is Button and String(child.text).begins_with(prefix):
			return child
	return null

func _settle(frames: int) -> void:
	for index: int in range(frames):
		await process_frame

func _expect(condition: bool, message: String) -> bool:
	_checks += 1
	if not condition:
		_failures.append(message)
		printerr("W6 pack switch fail: " + message)
	return condition

func _finish() -> void:
	quit(0 if _failures.is_empty() else 1)
