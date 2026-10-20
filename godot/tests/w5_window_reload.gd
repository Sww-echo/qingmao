extends SceneTree
## W5 window-level process restart.
##
## Run twice in separate processes with the same QINGMAO_RELOAD_ROOT and
## QINGMAO_RELOAD_SCENARIO (event|combat|day-end):
##   QINGMAO_RELOAD_MODE=write ... --script res://tests/w5_window_reload.gd
##   QINGMAO_RELOAD_MODE=read  ... --script res://tests/w5_window_reload.gd
## The event scenario is played through the real composition root; combat and
## day-end seed their golden state into the save service (they are too far into
## a run to replay in a short probe). The read process starts from scratch,
## presses continue, and must restore the same revision/run/modal without
## re-settling anything.

const MAIN := preload("res://bootstrap/main.tscn")

var _checks: int = 0
var _failures: PackedStringArray = []
var _mode: String = OS.get_environment("QINGMAO_RELOAD_MODE")
var _root_path: String = OS.get_environment("QINGMAO_RELOAD_ROOT")
var _scenario: String = OS.get_environment("QINGMAO_RELOAD_SCENARIO")
const FIXTURE := "res://tests/fixtures/prototype/war-ready-42.json"

func _initialize() -> void:
	_run()

func _run() -> void:
	if _mode not in ["write", "read"] or _root_path.is_empty() \
			or _scenario not in ["event", "combat", "day-end"]:
		quit(2)
		return
	var main: Node = MAIN.instantiate()
	main.save_root = _root_path
	root.add_child(main)
	await _settle(20)
	if _mode == "write":
		await _write(main)
	else:
		await _read(main)
	print("W5 window reload %s/%s: %d checks, %d failures" % [
		_scenario, _mode, _checks, _failures.size()])
	quit(0 if _failures.is_empty() else 1)

func _write(main: Node) -> void:
	var title: Node = main.get_node("ScreenHost").get_child(0)
	_expect(title.name == "Title", "write process starts at the title")
	var save: SaveService = main.get("_save_service")
	var session: GameSession = main.get("_session")
	var body: Dictionary = {}
	if _scenario == "event":
		title.get_node("%SeedInput").text = "42"
		title.get_node("%StartButton").pressed.emit()
		await _settle(15)
		var play: Node = main.get_node("ScreenHost").get_child(0)
		_expect(play.name == "Play", "write process opens play")
		_expect(session.current_revision() == 0, "write process starts at revision 0")
		# Open the briefing: an active event is the recovery point we want.
		var button: Button = _event_button(play, "十四日守望")
		_expect(button != null, "briefing is visible on day one")
		if button != null:
			button.pressed.emit()
		await _settle(15)
		_expect(session.snapshot_view().state.activeEvent == "briefing", "write process has briefing open")
		_expect(play.get_node("%EventCenter").visible, "write process renders the event modal")
		var flushed: Dictionary = save.flush_pending()
		_expect(flushed.ok, "write process flushes the save")
	else:
		var point: Dictionary = _scenario_point(_scenario)
		_expect(not point.is_empty(), "%s golden point exists" % _scenario)
		if point.is_empty():
			main.queue_free()
			return
		body = {
			"runId": "window-%s" % _scenario,
			"revision": int(point.index) + 1,
			"state": point.state,
		}
		var written: Dictionary = save.save_now(body)
		_expect(written.ok, "write process saves the %s state: %s" % [_scenario, written.get("error", "")])
	var loaded: Dictionary = save.load(false)
	_expect(loaded.ok, "write process can read back its save")
	if loaded.ok:
		if _scenario == "event":
			_expect(int(loaded.body.revision) == int(session.current_revision()),
				"saved revision matches the live session")
			_expect(String(loaded.body.state.activeEvent) == "briefing",
				"saved event state keeps the active event")
		else:
			_expect(String(loaded.body.runId) == "window-%s" % _scenario,
				"saved run id matches the scenario")
			_expect(int(loaded.body.revision) == int(body.revision),
				"saved revision matches the seeded point")
		print("WINDOW WRITE %s runId=%s revision=%d activeEvent=%s combat=%s ending=%s" % [
			_scenario, loaded.body.runId, int(loaded.body.revision),
			str(loaded.body.state.activeEvent), str(loaded.body.state.combat != null),
			str(loaded.body.state.ending != null),
		])
	main.queue_free()
	await _settle(3)

func _read(main: Node) -> void:
	var title: Node = main.get_node("ScreenHost").get_child(0)
	_expect(title.name == "Title", "read process starts at the title")
	_expect(not title.get_node("%ContinueButton").disabled, "continue is enabled for the saved run")
	title.get_node("%ContinueButton").pressed.emit()
	await _settle(20)
	var play: Node = main.get_node("ScreenHost").get_child(0)
	var session: GameSession = main.get("_session")
	_expect(play.name == "Play", "read process reaches play")
	var view: Dictionary = session.snapshot_view()
	var save: SaveService = main.get("_save_service")
	var persisted: Dictionary = save.load(false)
	_expect(persisted.ok, "read process can read the persisted body")
	if not persisted.ok:
		return
	_expect(int(persisted.body.revision) == int(view.revision), "restored revision equals the save")
	_expect(String(persisted.body.runId) == session.current_run_id(), "restored run id equals the save")
	var expected: Dictionary = persisted.body.state.duplicate(true)
	expected.erase("seed")
	expected.erase("rng")
	expected.erase("rngDraws")
	_expect(_same(view.state, expected), "restored public state equals the save")

	match _scenario:
		"event":
			_expect(String(view.state.activeEvent) == "briefing", "restored active event is briefing")
			_expect(play.get_node("%EventCenter").visible, "event modal is restored")
			_expect(String(play.get_node("%EventTitle").text).contains("十四日守望"), "event modal shows its title")
			var choose_ok: bool = false
			for option: Dictionary in view.actionOptions:
				if option.ok and option.action.get("type") == "CHOOSE" and option.action.get("choiceId") == "acknowledge":
					choose_ok = true
			_expect(choose_ok, "restored event still accepts its choice")
		"combat":
			_expect(view.state.combat != null, "restored state is in combat")
			_expect(play.get_node("%CombatCenter").visible, "combat modal is restored")
			_expect(play.get_node("%CombatActions").get_child_count() == 7, "combat modal rebuilds seven actions")
			_expect(String(play.get_node("%CombatForecast").text).contains("下一招"), "combat intent is restored")
		"day-end":
			# A day review is a one-shot projection, not persisted state.
			_expect(not play.get_node("%DayReviewCenter").visible, "day review is not replayed after reload")
			_expect(int(view.state.day) == int(persisted.body.state.day), "day is not advanced again")
			_expect(view.state.activeEvent == null or String(view.state.activeEvent) != "crisis-arrival",
				"day-end reload does not reopen the crisis decision")
	print("WINDOW READ %s runId=%s revision=%d activeEvent=%s combat=%s ending=%s" % [
		_scenario, session.current_run_id(), int(view.revision), str(view.state.activeEvent),
		str(view.state.combat != null), str(view.state.ending != null),
	])

func _scenario_point(name: String) -> Dictionary:
	var parsed: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(FIXTURE))
	if parsed.is_empty() or not parsed.has("trace"):
		return {}
	var trace: Dictionary = parsed.trace
	var points: Dictionary = {}
	for index: int in range(trace.steps.size()):
		var state: Dictionary = trace.steps[index].state
		if not points.has("combat") and state.combat != null:
			points["combat"] = index
		if not points.has("day-end") and trace.actions[index].type == "END_DAY":
			points["day-end"] = index
		if state.ending != null:
			points["ending"] = index
	if not points.has(name):
		return {}
	var chosen: int = int(points[name])
	return {"index": chosen, "state": trace.steps[chosen].state}

func _same(left: Dictionary, right: Dictionary) -> bool:
	var a: Dictionary = CanonicalJson.encode(left)
	var b: Dictionary = CanonicalJson.encode(right)
	return a.ok and b.ok and String(a.text) == String(b.text)

func _event_button(play: Node, title: String) -> Button:
	for child: Node in play.get_node("%EventList").get_children():
		if child is Button and String(child.text).begins_with(title):
			return child
	return null

func _settle(frames: int) -> void:
	for index: int in range(frames):
		await process_frame

func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		printerr("W5 window reload fail: " + message)
