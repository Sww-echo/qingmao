extends SceneTree
## W5 input robustness: double clicks settle once, modals block HUD input, and
## rapid END_DAY presses cannot skip a day review.

const PLAY_SCENE := preload("res://scenes/play.tscn")
const ContentLoaderScript := preload("res://infrastructure/content_loader.gd")

var _checks: int = 0
var _failures: PackedStringArray = []
var _catalog: ContentCatalog
var _session: GameSession
var _play: Node

func _initialize() -> void:
	_run()

func _run() -> void:
	var loaded: Dictionary = ContentLoaderScript.load_pack()
	if not loaded.ok:
		_fail("content load failed")
		_finish()
		return
	_catalog = loaded.catalog
	_session = GameSession.new()
	root.add_child(_session)
	_session.configure(_catalog, null)
	_session.new_run(42)
	_play = PLAY_SCENE.instantiate()
	_play.configure(_session)
	root.add_child(_play)
	await process_frame
	await process_frame

	await _double_click_contract()
	await _modal_block_contract()
	await _end_day_contract()
	print("W5 input robustness: %d checks, %d failures" % [_checks, _failures.size()])
	_finish()

func _double_click_contract() -> void:
	var before: int = _session.current_revision()
	var stones_before: int = int(_session.snapshot_view().state.resources.stones)
	var work: Button = _play.get_node("%WorkButton")
	work.pressed.emit()
	work.pressed.emit()
	await process_frame
	_expect(_session.current_revision() == before + 1,
		"double click commits one revision (%d -> %d)" % [before, _session.current_revision()])
	var stones_after: int = int(_session.snapshot_view().state.resources.stones)
	_expect(stones_after == stones_before + 2, "double click pays once (%d -> %d)" % [stones_before, stones_after])
	# A distinct action is never suppressed by the guard.
	var travel_before: int = _session.current_revision()
	_play.get_node("%TravelInn").pressed.emit()
	await process_frame
	_expect(_session.current_revision() == travel_before + 1, "distinct action after a double click still commits")

func _modal_block_contract() -> void:
	_play.get_node("%PauseButton").pressed.emit()
	await process_frame
	var before: int = _session.current_revision()
	_play.get_node("%WorkButton").pressed.emit()
	_play.get_node("%EndDayButton").pressed.emit()
	_play._submit({"type": "WORK"})
	await process_frame
	await process_frame
	_expect(_session.current_revision() == before, "pause blocks HUD actions")
	_expect(_play.get_node("%PauseCenter").visible, "pause remains until resumed")
	_play.get_node("%PauseResume").pressed.emit()
	await process_frame

func _end_day_contract() -> void:
	# Move to academy so END_DAY is unambiguously legal, then double-click it.
	_play.get_node("%TravelAcademy").pressed.emit()
	await process_frame
	await process_frame
	var day_before: int = int(_session.snapshot_view().state.day)
	var revision_before: int = _session.current_revision()
	_play.get_node("%EndDayButton").pressed.emit()
	_play.get_node("%EndDayButton").pressed.emit()
	await process_frame
	await process_frame
	_expect(_session.current_revision() == revision_before + 1, "double END_DAY commits one revision")
	_expect(int(_session.snapshot_view().state.day) == day_before + 1, "double END_DAY advances one day")
	_expect(_play.get_node("%DayReviewCenter").visible, "day review remains visible")
	var review_revision: int = _session.current_revision()
	# While the review is up, neither the review button nor HUD may double-settle.
	_play.get_node("%WorkButton").pressed.emit()
	_play._submit({"type": "END_DAY"})
	await process_frame
	await process_frame
	_expect(_session.current_revision() == review_revision, "review blocks further actions")
	_play.get_node("%DayReviewContinue").pressed.emit()
	await process_frame
	_expect(not _play.get_node("%DayReviewCenter").visible, "review dismisses once")

func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		printerr("W5 input fail: " + message)

func _fail(message: String) -> void:
	_checks += 1
	_failures.append(message)
	printerr("W5 input fail: " + message)

func _finish() -> void:
	quit(0 if _failures.is_empty() else 1)
