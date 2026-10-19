class_name SessionSemanticsSuite
extends RefCounted

const CONTENT_PATH := "res://content/generated/prototype/content.json"

class RecordingSink extends RefCounted:
	var bodies: Array[Dictionary] = []
	var generation: int = 0
	var fail_next: bool = false

	func begin_generation(_saved_revision: int = -1) -> void:
		generation += 1
		bodies.clear()

	func enqueue(body: Variant) -> Dictionary:
		if fail_next:
			fail_next = false
			return {"ok": false, "errorCode": "test-enqueue-failure"}
		bodies.append(body.duplicate(true))
		return {"ok": true}

var _checks: int = 0
var _failures: PackedStringArray = []
var _tree: SceneTree
var _catalog: ContentCatalog

func run(tree: SceneTree) -> Dictionary:
	_tree = tree
	_checks = 0
	_failures = []
	var content: Variant = JSON.parse_string(FileAccess.get_file_as_string(CONTENT_PATH))
	if not _expect(content is Dictionary, "session suite requires frozen content"):
		return _result()
	_catalog = ContentCatalog.new(content)
	_dispatch_contract()
	_dedup_contract()
	_rule_rejection_contract()
	_view_contract()
	_load_contract()
	_reentry_contract()
	_event_retry_contract()
	_revision_replay_contract()
	return _result()

func _dispatch_contract() -> void:
	var sink := RecordingSink.new()
	var session := _session(sink)
	var started: Dictionary = session.new_run(42)
	if not _expect(started.ok, "new run starts"):
		return
	var run_id: String = started.view.runId
	_expect(sink.bodies.size() == 1 and sink.bodies[0].revision == 0, "new run enqueues its initial state")
	_expect(started.view.saveStatus.state == "saving" and started.view.saveStatus.savedRevision == -1, "new run is not saved before confirmation")
	sink.bodies.clear()
	var original: Dictionary = _command("cmd-1", run_id, 0, {"type": "TRAVEL", "location": "bamboo"})
	var accepted: Dictionary = session.dispatch(original)
	if not _expect(accepted.ok and accepted.revision == 1, "valid command commits revision one"):
		return
	_expect(accepted.view.revision == 1 and accepted.view.state.location == "bamboo", "accepted view reflects the committed state")
	_expect(sink.bodies.size() == 1 and sink.bodies[0].revision == 1, "accepted command enqueues one save snapshot")
	_expect(not accepted.view.state.has("seed") and not accepted.view.state.has("rng"), "public view hides seed and RNG")

	var same: Dictionary = session.dispatch(original)
	_expect(same.ok and same.dedup and same.revision == 1, "same payload replays the original result as dedup")
	_expect(sink.bodies.size() == 1, "dedup does not enqueue another save")
	_expect(session.current_revision() == 1, "dedup does not advance revision")

	var reused: Dictionary = session.dispatch(_command(
		"cmd-1", run_id, 0, {"type": "TRAVEL", "location": "inn"}
	))
	_expect(_error_code(reused) == "id-reused", "same commandId with another payload is id-reused")
	var stale: Dictionary = session.dispatch(_command(
		"cmd-stale", run_id, 0, {"type": "TRAVEL", "location": "inn"}
	))
	_expect(_error_code(stale) == "stale-revision", "unseen old baseRevision is rejected")
	var ahead: Dictionary = session.dispatch(_command(
		"cmd-ahead", run_id, 3, {"type": "TRAVEL", "location": "inn"}
	))
	_expect(_error_code(ahead) == "stale-revision", "future baseRevision is rejected")
	var mismatch: Dictionary = session.dispatch(_command(
		"cmd-run", "other-run", 1, {"type": "TRAVEL", "location": "inn"}
	))
	_expect(_error_code(mismatch) == "run-mismatch", "cross-run command is rejected before dedup/revision")
	_expect(session.current_revision() == 1 and sink.bodies.size() == 1, "rejections do not commit or save")
	_expect(_error_code(session.dispatch([])) == "shape-invalid", "nonobject command is shape-invalid")
	var bad_action: Dictionary = _command("cmd-bad", run_id, 1, {"type": "WORK", "extra": true})
	_expect(_error_code(session.dispatch(bad_action)) == "shape-invalid", "malformed action is rejected at the command boundary")
	session.queue_free()

func _dedup_contract() -> void:
	var sink := RecordingSink.new()
	var session := _session(sink)
	var run_id: String = session.new_run(7).view.runId
	sink.bodies.clear()
	var seen: Array[Dictionary] = []
	var locations: PackedStringArray = ["academy", "inn", "bamboo"]
	for index: int in range(GameSession.DEDUP_LIMIT + 1):
		var previous: String = session.snapshot_view().state.location
		var destination: String = locations[(index + 1) % locations.size()]
		if destination == previous:
			destination = locations[(index + 2) % locations.size()]
		var command: Dictionary = _command(
			"evict-%d" % index, run_id, index,
			{"type": "TRAVEL", "location": destination}
		)
		var result: Dictionary = session.dispatch(command)
		_expect(result.ok and result.revision == index + 1, "cache fill command %d commits" % index)
		seen.append(command)
	var oldest: Dictionary = session.dispatch(seen[0])
	_expect(_error_code(oldest) == "stale-revision", "evicted command is not executed again")
	var newest: Dictionary = session.dispatch(seen.back())
	_expect(newest.ok and newest.dedup, "newest cached command still replays")
	_expect(session.current_revision() == GameSession.DEDUP_LIMIT + 1, "eviction does not alter revision")
	_expect(sink.bodies.size() == GameSession.DEDUP_LIMIT + 1, "one save per accepted command only")
	session.queue_free()

func _rule_rejection_contract() -> void:
	var sink := RecordingSink.new()
	var session := _session(sink)
	var run_id: String = session.new_run(42).view.runId
	sink.bodies.clear()
	var rejected_command: Dictionary = _command(
		"rule-reject", run_id, 0, {"type": "TRAVEL", "location": "bamboo"}
	)
	session.dispatch(_command("open", run_id, 0, {"type": "OPEN_EVENT", "eventId": "briefing"}))
	var rejected: Dictionary = session.dispatch(_command(
		"choose-without-open", run_id, 1, {"type": "CHOOSE", "choiceId": "acknowledge"}
	))
	_expect(rejected.ok, "choose remains legal while the briefing is open")
	var before: Dictionary = session.snapshot_view().state.duplicate(true)
	var replay: Dictionary = session.dispatch(_command(
		"invalid-rest", run_id, 2, {"type": "COMBAT", "move": "attack"}
	))
	_expect(_error_code(replay) == "rule-rejected", "Rules rejection surfaces through the session")
	_expect(replay.revision == 2 and _same(before, session.snapshot_view().state), "rule rejection leaves the committed view unchanged")
	var rejected_again: Dictionary = session.dispatch(_command(
		"invalid-rest", run_id, 2, {"type": "COMBAT", "move": "attack"}
	))
	_expect(rejected_again.dedup and _error_code(rejected_again) == "rule-rejected", "rule rejection is cached and replayed")
	_expect(sink.bodies.size() == 2, "rejected commands never enqueue saves")
	_expect(session.current_revision() == 2, "rejected commands never advance revision")
	var unopened: Dictionary = session.dispatch(rejected_command)
	_expect(_error_code(unopened) == "stale-revision", "old command after commits remains stale")
	session.queue_free()

func _view_contract() -> void:
	var sink := RecordingSink.new()
	var session := _session(sink)
	session.new_run(42)
	var view: Dictionary = session.snapshot_view()
	_expect(view.revision == 0 and view.saveStatus.state == "saving", "initial view carries revision and unconfirmed save status")
	_expect(view.availableEvents is Array and view.legalActions is Array, "view carries events and legal actions")
	view.state.hp = 0
	view.legalActions.clear()
	_expect(session.snapshot_view().state.hp == 28, "view mutation does not mutate session state")
	_expect(not session.snapshot_view().legalActions.is_empty(), "legal actions are detached")
	var run_id: String = session.current_run_id()
	var opened: Dictionary = session.dispatch(_command(
		"open-before-end", run_id, 0, {"type": "OPEN_EVENT", "eventId": "briefing"}
	))
	_expect(opened.ok, "briefing opens before day end")
	var dismissed: Dictionary = session.dispatch(_command(
		"dismiss-before-end", run_id, 1, {"type": "DISMISS_EVENT"}
	))
	_expect(dismissed.ok, "briefing dismisses before day end")
	var end_day: Dictionary = session.dispatch(_command(
		"end-day", run_id, 2, {"type": "END_DAY"}
	))
	_expect(end_day.ok and end_day.view.has("dayReview"), "END_DAY publishes a day review")
	if end_day.view.has("dayReview"):
		_expect(end_day.view.dayReview.events is Array and end_day.view.dayReview.ledger is Array, "day review contains detached events and ledger")
	session.queue_free()

func _load_contract() -> void:
	var sink := RecordingSink.new()
	var session := _session(sink)
	var started: Dictionary = session.new_run(9)
	var run_id: String = started.view.runId
	sink.bodies.clear()
	session.dispatch(_command("save-me", run_id, 0, {"type": "TRAVEL", "location": "bamboo"}))
	var body: Dictionary = sink.bodies[0].duplicate(true)
	var loaded := _session(RecordingSink.new())
	var result: Dictionary = loaded.load_run(body)
	_expect(result.ok and result.revision == 1, "load restores revision from the save body")
	_expect(result.view.state.location == "bamboo" and result.view.runId == run_id, "load restores state and run id")
	var after_load: Dictionary = loaded.dispatch(_command(
		"after-load", run_id, 1, {"type": "TRAVEL", "location": "inn"}
	))
	_expect(after_load.ok and after_load.revision == 2, "loaded session accepts the next revision")
	_expect(_error_code(loaded.dispatch(_command("old-before-load", run_id, 0, {"type": "WORK"}))) == "stale-revision", "load clears prior dedup cache")
	var bad_revision: Dictionary = body.duplicate(true)
	bad_revision["revision"] = 1.5
	_expect(_error_code(_session(RecordingSink.new()).load_run(bad_revision)) == "shape-invalid", "load rejects fractional revision")
	session.queue_free()
	loaded.queue_free()

func _reentry_contract() -> void:
	var sink := RecordingSink.new()
	var session := _session(sink)
	session.new_run(42)
	sink.bodies.clear()
	var observations: Array[Dictionary] = []
	session.state_committed.connect(func(_revision: int, _view: Dictionary, _events: Array) -> void:
		observations.append(session.dispatch(_command("reenter", session.current_run_id(), session.current_revision(), {"type": "WORK"})))
		observations.append(session.new_run(42))
		observations.append(session.load_run(sink.bodies[0] if not sink.bodies.is_empty() else {}))
	)
	var committed: Dictionary = session.dispatch(_command("outer", session.current_run_id(), 0, {"type": "WORK"}))
	_expect(committed.ok and observations.size() == 3, "commit signal exercised real dispatch/new/load reentry")
	for result: Dictionary in observations:
		_expect(_error_code(result) == "busy", "signal reentry is busy")
	_expect(session.current_revision() == 1 and sink.bodies.size() == 1, "reentry cannot commit or save twice")
	var retry: Dictionary = session.dispatch(_command("reenter", session.current_run_id(), 1, {"type": "WORK"}))
	_expect(retry.ok and not retry.dedup, "busy rejection is not cached")
	session.queue_free()

func _event_retry_contract() -> void:
	var sink := RecordingSink.new()
	var session := _session(sink)
	var run_id: String = session.new_run(42).view.runId
	session.dispatch(_command("open-briefing", run_id, 0, {"type": "OPEN_EVENT", "eventId": "briefing"}))
	var choice: Dictionary = _command("ack", run_id, 1, {"type": "CHOOSE", "choiceId": "acknowledge"})
	var accepted: Dictionary = session.dispatch(choice)
	_expect(session.dispatch(_command("open-next", run_id, 2, {"type": "OPEN_EVENT", "eventId": "moonlight-issue"})).ok, "a different event opens before retry")
	var before: Dictionary = session.snapshot_view()
	var saves: int = sink.bodies.size()
	var replay: Dictionary = session.dispatch(choice)
	_expect(accepted.ok and replay.ok and replay.dedup and replay.revision == 2, "old choice dedups with a different active event")
	_expect(_same(before, session.snapshot_view()) and saves == sink.bodies.size(), "old result cannot roll back current view or save")
	replay.view.state.hp = 0
	_expect(session.dispatch(choice).view.state.hp != 0, "cached results are immutable copies")
	var prior_id: String = run_id
	session.new_run(42)
	_expect(session.current_run_id() != prior_id, "same seed produces distinct run IDs")
	var independent := _session(RecordingSink.new())
	_expect(independent.new_run(42).view.runId != session.current_run_id(), "independent sessions do not collide on run ID")
	independent.queue_free()
	session.queue_free()

func _revision_replay_contract() -> void:
	var sink := RecordingSink.new()
	var session := _session(sink)
	var run_id: String = session.new_run(42).view.runId
	var future: Dictionary = _command("future", run_id, 1, {"type": "WORK"})
	var rejected: Dictionary = session.dispatch(future)
	session.dispatch(_command("advance", run_id, 0, {"type": "WORK"}))
	var replay: Dictionary = session.dispatch(future)
	_expect(_error_code(replay) == "stale-revision" and replay.dedup, "future rejection stays rejected when its revision later becomes current")
	_expect(replay.revision == 0 and replay.has_all(["view", "events"]), "replayed rejection contains its original complete result")
	_expect(_same(rejected.view, replay.view) and session.current_revision() == 1, "revision rejection replays without side effects")
	session.set_save_status("ok", 0)
	_expect(session.snapshot_view().saveStatus.state == "saving", "confirming an older revision does not mark newer state saved")
	session.set_save_status("ok", 1)
	session.set_save_status("failed", 0, "late")
	_expect(session.snapshot_view().saveStatus.state == "ok" and session.snapshot_view().saveStatus.savedRevision == 1, "save confirmations do not regress")
	var body: Dictionary = sink.bodies.back().duplicate(true)
	body["extra"] = true
	_expect(_error_code(session.load_run(body)) == "shape-invalid", "load rejects unknown body fields")
	body.erase("extra")
	body["revision"] = CanonicalJson.MAX_SAFE_INTEGER + 1
	_expect(_error_code(session.load_run(body)) == "shape-invalid", "load rejects unsafe integer revision")
	session.queue_free()

func _session(sink: RecordingSink) -> GameSession:
	var session := GameSession.new()
	_tree.root.add_child(session)
	session.configure(_catalog, sink)
	return session

func _command(id: String, run_id: String, revision: int, action: Dictionary) -> Dictionary:
	return {
		"commandId": id, "runId": run_id, "baseRevision": revision,
		"type": "action", "action": action,
	}

func _error_code(result: Dictionary) -> String:
	return String(result.get("error", {}).get("code", ""))

func _same(left: Variant, right: Variant) -> bool:
	var a: Dictionary = CanonicalJson.encode(left)
	var b: Dictionary = CanonicalJson.encode(right)
	return a.ok and b.ok and a.text == b.text

func _expect(condition: bool, message: String) -> bool:
	_checks += 1
	if not condition:
		_failures.append(message)
	return condition

func _result() -> Dictionary:
	return {"checks": _checks, "failures": _failures}
