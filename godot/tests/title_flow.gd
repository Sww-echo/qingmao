extends SceneTree
## W4 title integration: seed validation, new run, auto-save, return, continue.
## Unlike play_flow.gd this drives the real composition root (main -> title/play).

const MAIN := preload("res://bootstrap/main.tscn")

var _checks: int = 0
var _failures: PackedStringArray = []

func _initialize() -> void:
	_run()

func _run() -> void:
	var main: Node = MAIN.instantiate()
	main.save_root = "user://w4-title-flow-%d" % Time.get_ticks_usec()
	root.add_child(main)
	await process_frame
	await process_frame

	var title: Node = main.get_node("ScreenHost").get_child(0)
	_expect(title != null and title.name == "Title", "the title screen is shown first")
	_expect(title.get_node("%ContinueButton").disabled, "continue is disabled without a save")
	_expect(title.get_node("%ImportButton").disabled, "import stays a disabled placeholder")

	for bad: String in ["", "abc", "-1", "4294967296", "99999999999999999999"]:
		title.get_node("%SeedInput").text = bad
		title.get_node("%StartButton").pressed.emit()
		await process_frame
		_expect(main.get_node("ScreenHost").get_child(0).name == "Title",
			"seed %s does not start a run" % ("<empty>" if bad.is_empty() else bad))
		_expect(title.get_node("%SeedError").visible, "seed %s shows an error" % ("<empty>" if bad.is_empty() else bad))

	title.get_node("%SeedInput").text = "4294967295"
	title.get_node("%StartButton").pressed.emit()
	await process_frame
	await process_frame
	var play: Node = main.get_node("ScreenHost").get_child(0)
	var session: GameSession = main.get("_session")
	_expect(play != null and play.name == "Play", "a valid seed opens the play screen")
	_expect(session.current_revision() == 0, "a new run starts at revision 0")
	_expect(int(session.get("_state").seed) == 4294967295, "the run uses the typed seed")
	_expect(play.get_node("%SessionHud").text.contains("第1日"), "the HUD starts on day one")

	play.get_node("%WorkButton").pressed.emit()
	await process_frame
	await process_frame
	_expect(session.current_revision() == 1, "a UI action commits revision one")
	var stones: int = int(session.snapshot_view().state.resources.stones)
	var run_id: String = session.current_run_id()

	play._open_pause()
	await process_frame
	_expect(play.get_node("%PauseCenter").visible, "pause opens")
	play.get_node("%PauseTitleReturn").pressed.emit()
	await process_frame
	await process_frame
	var returned: Node = main.get_node("ScreenHost").get_child(0)
	_expect(returned != null and returned.name == "Title", "save and return reaches the title")
	_expect(not returned.get_node("%ContinueButton").disabled, "continue is enabled after the autosave")
	_expect(String(returned.get_node("%SaveStatus").text).contains("revision 1"), "the title reports the saved revision")

	returned.get_node("%ContinueButton").pressed.emit()
	await process_frame
	await process_frame
	var resumed: Node = main.get_node("ScreenHost").get_child(0)
	_expect(resumed != null and resumed.name == "Play", "continue opens the play screen")
	_expect(session.current_run_id() == run_id, "continue keeps the run id")
	_expect(session.current_revision() == 1, "continue keeps the revision")
	_expect(int(session.snapshot_view().state.resources.stones) == stones, "continue keeps the saved state")

	# Starting a new run replaces the slot; one click must only ask for
	# confirmation, not silently overwrite the save.
	resumed._open_pause()
	await process_frame
	resumed.get_node("%PauseTitleReturn").pressed.emit()
	await process_frame
	await process_frame
	var third: Node = main.get_node("ScreenHost").get_child(0)
	_expect(third.name == "Title", "second return reaches the title")
	third.get_node("%SeedInput").text = "7"
	third.get_node("%StartButton").pressed.emit()
	await process_frame
	_expect(main.get_node("ScreenHost").get_child(0).name == "Title", "one click does not overwrite an existing save")
	_expect(third.get_node("%SeedError").visible, "overwrite warning is shown")
	_expect(String(third.get_node("%StartButton").text).contains("确认覆盖"), "start button asks for overwrite confirmation")
	_expect(session.current_revision() == 1 and session.current_run_id() == run_id, "unconfirmed start leaves the run untouched")

	print("W4 title flow: %d checks, %d failures" % [_checks, _failures.size()])
	quit(0 if _failures.is_empty() else 1)

func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		printerr("W4 title fail: " + message)
