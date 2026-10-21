extends SceneTree
## W7 save-failure path: a failed pause save keeps the player in-game with the
## snapshot pending; retry persists it; only a successful save leaves the game.

const MAIN := preload("res://bootstrap/main.tscn")

class FaultStore extends RefCounted:
	var files: Dictionary = {}
	var fail_write: String = ""

	func read(path: String) -> Dictionary:
		if not files.has(path):
			return {"ok": false, "errorCode": "missing", "error": "missing"}
		return {"ok": true, "bytes": files[path]}

	func write(path: String, bytes: PackedByteArray) -> Dictionary:
		if not fail_write.is_empty() and path.ends_with(fail_write):
			return {"ok": false, "errorCode": "injected-write", "error": "injected write failure"}
		files[path] = bytes.duplicate()
		return {"ok": true}

	func rename(from: String, to: String) -> Dictionary:
		if not files.has(from):
			return {"ok": false, "errorCode": "missing", "error": "missing"}
		files[to] = files[from]
		files.erase(from)
		return {"ok": true}

	func remove(path: String) -> Dictionary:
		files.erase(path)
		return {"ok": true}

	func exists(path: String) -> bool:
		return files.has(path)

	func probe_capability() -> Dictionary:
		return {"ok": true, "backend": "memory"}

var _checks: int = 0
var _failures: PackedStringArray = []

func _initialize() -> void:
	_run()

func _run() -> void:
	var store := FaultStore.new()
	var main: Node = MAIN.instantiate()
	main.save_store = store
	main.save_root = "/tmp/w7-save-%d" % Time.get_ticks_usec()
	root.add_child(main)
	await _settle(15)
	var title: Node = main.get_node("ScreenHost").get_child(0)
	title.get_node("%SeedInput").text = "42"
	title.get_node("%StartButton").pressed.emit()
	await _settle(15)
	var play: Node = main.get_node("ScreenHost").get_child(0)
	var session: GameSession = main.get("_session")
	_expect(play.name == "Play", "new run opens play")
	_expect(session.current_revision() == 0, "new run at revision 0")
	# Persist revision 0 cleanly before introducing the fault.
	var initial: Dictionary = main.get("_save_service").flush_pending()
	_expect(initial.ok, "initial revision saves")
	# Commit a real action, then fail the save transaction.
	store.fail_write = "current.tmp"
	play.get_node("%WorkButton").pressed.emit()
	await _settle(3)
	_expect(session.current_revision() == 1, "action commits revision 1 in memory")
	_expect(String(session.snapshot_view().saveStatus.state) == "failed", "status shows the failed save")
	# Save-and-return must refuse to leave while the save failed.
	play._open_pause()
	await _settle(3)
	play.get_node("%PauseTitleReturn").pressed.emit()
	await _settle(5)
	_expect(main.get_node("ScreenHost").get_child(0).name == "Play", "failed save keeps the player in play")
	_expect(play.get_node("%PauseCenter").visible, "pause stays open after failed save")
	_expect(String(play.get_node("%LastEvent").text).contains("保存失败"), "failure explains itself")
	_expect(play.get_node("%PauseRetrySave").disabled == false, "retry becomes enabled")
	# Retry after the injected failure clears must persist revision 1.
	store.fail_write = ""
	play.get_node("%PauseRetrySave").pressed.emit()
	await _settle(5)
	_expect(int(session.snapshot_view().saveStatus.get("savedRevision", -1)) == 1,
		"retry persisted revision 1")
	_expect(String(session.snapshot_view().saveStatus.state) == "ok", "retry reports ok")
	_expect(String(play.get_node("%LastEvent").text).contains("已保存"), "retry reports saved")
	# Only now may save-and-return leave.
	play.get_node("%PauseTitleReturn").pressed.emit()
	await _settle(10)
	_expect(main.get_node("ScreenHost").get_child(0).name == "Title", "successful save returns to title")
	var back: Node = main.get_node("ScreenHost").get_child(0)
	_expect(not back.get_node("%ContinueButton").disabled, "continue is enabled after retry")
	back.get_node("%ContinueButton").pressed.emit()
	await _settle(10)
	_expect(main.get_node("ScreenHost").get_child(0).name == "Play", "continue restores play")
	_expect(session.current_revision() == 1, "revision 1 survives the restart")
	print("W7 save failure: %d checks, %d failures" % [_checks, _failures.size()])
	quit(0 if _failures.is_empty() else 1)

func _settle(frames: int) -> void:
	for index: int in range(frames):
		await process_frame

func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		printerr("W7 save fail: " + message)
