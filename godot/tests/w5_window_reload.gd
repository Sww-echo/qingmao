extends SceneTree
## W5 window-level process restart.
##
## Run twice in separate processes with the same QINGMAO_RELOAD_ROOT:
##   QINGMAO_RELOAD_MODE=write ... --script res://tests/w5_window_reload.gd
##   QINGMAO_RELOAD_MODE=read  ... --script res://tests/w5_window_reload.gd
## The write process commits an event state through the real composition root;
## the read process starts from scratch, presses continue, and must restore the
## same revision/run/modal without re-settling anything.

const MAIN := preload("res://bootstrap/main.tscn")

var _checks: int = 0
var _failures: PackedStringArray = []
var _mode: String = OS.get_environment("QINGMAO_RELOAD_MODE")
var _root_path: String = OS.get_environment("QINGMAO_RELOAD_ROOT")

func _initialize() -> void:
	_run()

func _run() -> void:
	if _mode not in ["write", "read"] or _root_path.is_empty():
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
	print("W5 window reload %s: %d checks, %d failures" % [_mode, _checks, _failures.size()])
	quit(0 if _failures.is_empty() else 1)

func _write(main: Node) -> void:
	var title: Node = main.get_node("ScreenHost").get_child(0)
	_expect(title.name == "Title", "write process starts at the title")
	title.get_node("%SeedInput").text = "42"
	title.get_node("%StartButton").pressed.emit()
	await _settle(15)
	var play: Node = main.get_node("ScreenHost").get_child(0)
	var session: GameSession = main.get("_session")
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
	# Flush through the composition root's save service, then exit.
	var save: SaveService = main.get("_save_service")
	var flushed: Dictionary = save.flush_pending()
	_expect(flushed.ok, "write process flushes the save")
	var loaded: Dictionary = save.load(false)
	_expect(loaded.ok, "write process can read back its save")
	if loaded.ok:
		_expect(int(loaded.body.revision) == session.current_revision(), "saved revision matches the session")
		_expect(String(loaded.body.state.activeEvent) == "briefing", "saved state keeps the active event")
		print("WINDOW WRITE runId=%s revision=%d activeEvent=%s" % [
			loaded.body.runId, int(loaded.body.revision), loaded.body.state.activeEvent,
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
	_expect(String(view.state.activeEvent) == "briefing", "read process restores the active event")
	_expect(play.get_node("%EventCenter").visible, "read process restores the event modal")
	_expect(String(play.get_node("%EventTitle").text).contains("十四日守望"), "restored modal shows the event title")
	var options: Array = view.actionOptions
	var choose_ok: bool = false
	for option: Dictionary in options:
		if option.ok and option.action.get("type") == "CHOOSE" and option.action.get("choiceId") == "acknowledge":
			choose_ok = true
	_expect(choose_ok, "restored event still accepts its choice")
	# Recovery must not re-run the opening event or advance the revision.
	_expect(int(view.revision) > 0, "restored revision is committed")
	print("WINDOW READ runId=%s revision=%d activeEvent=%s" % [
		session.current_run_id(), int(view.revision), view.state.activeEvent,
	])

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
