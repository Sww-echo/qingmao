class_name GameSession
extends Node
## Sole owner of the live GameState. UI receives detached views and commands.

signal state_committed(revision: int, view: Dictionary, events: Array)
signal command_rejected(command_id: String, error: Dictionary)
signal save_status_changed(status: String, saved_revision: int, error_code: String)

const DEDUP_LIMIT: int = 64

var _catalog: ContentCatalog
var _state: GameState
var _run_id: String = ""
var _revision: int = 0
var _dedup: Array[Dictionary] = []
var _dispatching: bool = false
var _save_sink: Variant = null
var _save_status: Dictionary = SessionContracts.save_status("failed", -1, "no-active-run")
var _day_review: Variant = null
var _notifying_rejection: bool = false

func configure(catalog: ContentCatalog, save_sink: Variant = null) -> void:
	_catalog = catalog
	_save_sink = save_sink

func new_run(seed: int) -> Dictionary:
	if _dispatching:
		return _reject("busy", "another command is being committed")
	if _catalog == null or not Rng32.is_valid_state(seed):
		return _reject("shape-invalid", "new_run requires a valid catalog and uint32 seed")
	var state: GameState = Rules.create(seed, _catalog)
	if state == null:
		return _reject("shape-invalid", "new run could not be created")
	_dispatching = true
	_run_id = Crypto.new().generate_random_bytes(16).hex_encode()
	_state = state
	_revision = 0
	_dedup.clear()
	_day_review = null
	_save_status = SessionContracts.save_status("saving", -1)
	if _save_sink != null and _save_sink.has_method("begin_generation"):
		_save_sink.begin_generation()
	var view: Dictionary = snapshot_view()
	state_committed.emit(_revision, view.duplicate(true), [])
	_enqueue_save()
	_dispatching = false
	return SessionContracts.result(_revision, snapshot_view(), [])

func load_run(body: Variant) -> Dictionary:
	if _dispatching:
		return _reject("busy", "another command is being committed")
	if _catalog == null:
		return _reject("shape-invalid", "load_run requires a content catalog")
	if not body is Dictionary or body.size() != 3 \
			or not body.has_all(["runId", "revision", "state"]):
		return _reject("shape-invalid", "save body must contain exactly runId, revision and state", "body")
	if not body.get("runId") is String or String(body["runId"]).is_empty():
		return _reject("shape-invalid", "save body is missing runId", "body.runId")
	if not _is_nonnegative_integer(body.get("revision")):
		return _reject("shape-invalid", "save body revision must be a nonnegative integer", "body.revision")
	var decoded: Dictionary = StateCodec.decode(body.get("state"), _catalog)
	if not decoded.ok:
		return _reject("shape-invalid", decoded.error, "body.state")
	_dispatching = true
	_state = decoded.state
	_run_id = body["runId"]
	_revision = int(body["revision"])
	_dedup.clear()
	_day_review = null
	_save_status = SessionContracts.save_status("ok", _revision)
	if _save_sink != null and _save_sink.has_method("begin_generation"):
		_save_sink.begin_generation(_revision)
	var view: Dictionary = snapshot_view()
	state_committed.emit(_revision, view.duplicate(true), [])
	_dispatching = false
	return SessionContracts.result(_revision, view, [])

func dispatch(command: Variant) -> Dictionary:
	var shaped: Dictionary = _shape_command(command)
	if not shaped.ok:
		var id: String = String(command.get("commandId", "")) if command is Dictionary else ""
		_notify_rejection(id, shaped.error)
		return shaped
	var command_id: String = shaped.command.commandId
	if shaped.command.runId != _run_id:
		return _reject("run-mismatch", "command belongs to another run", "runId", command_id)
	if _dispatching or _state == null:
		return _reject("busy", "session is not ready for another command", "", command_id)
	var key: String = "%s|%s" % [shaped.command.runId, shaped.command.commandId]
	var fingerprint: String = SessionContracts.command_fingerprint(
		shaped.command.baseRevision, shaped.command.action
	)
	for entry: Dictionary in _dedup:
		if entry.key != key:
			continue
		if entry.fingerprint != fingerprint:
			return _reject("id-reused", "commandId was reused with a different payload", "commandId", command_id)
		var replay: Dictionary = entry.result.duplicate(true)
		replay["dedup"] = true
		return replay
	_dispatching = true
	if shaped.command.baseRevision != _revision:
		var stale: Dictionary = _reject("stale-revision", "baseRevision does not match the current revision", "baseRevision")
		_remember(key, fingerprint, stale)
		_notify_rejection(command_id, stale.error)
		_dispatching = false
		return stale.duplicate(true)

	var previous_state: GameState = _state
	var applied: Dictionary = Rules.apply(_state, shaped.command.action, _catalog)
	if not applied.ok:
		var rejected_view: Dictionary = snapshot_view()
		var rejection: Dictionary = {
			"ok": false, "revision": _revision, "view": rejected_view,
			"events": [], "error": applied.error.duplicate(true), "dedup": false,
		}
		_remember(key, fingerprint, rejection)
		_notify_rejection(command_id, applied.error)
		_dispatching = false
		return rejection.duplicate(true)

	_state = applied.state
	_revision += 1
	var events: Array = applied.events.duplicate(true)
	_day_review = null
	if shaped.command.action["type"] == "END_DAY":
		_day_review = ViewProjector.day_review(previous_state, _state, events, _catalog)
	_save_status["state"] = "saving"
	var view: Dictionary = snapshot_view()
	var accepted: Dictionary = SessionContracts.result(_revision, view, events)
	_remember(key, fingerprint, accepted)
	state_committed.emit(_revision, view.duplicate(true), events.duplicate(true))
	_enqueue_save()
	_dispatching = false
	return accepted.duplicate(true)

func snapshot_view() -> Dictionary:
	if _state == null:
		return {}
	return ViewProjector.project(
		_state, _catalog, _run_id, _revision, _save_status, _day_review
	)

func set_save_status(state: String, saved_revision: int, error_code: String = "") -> void:
	if _state == null or not SessionContracts.SAVE_STATES.has(state) \
			or saved_revision < int(_save_status.savedRevision) or saved_revision > _revision:
		return
	if state == "ok" and saved_revision < _revision:
		state = "saving"
	_set_save_status(state, saved_revision, error_code)

func current_run_id() -> String:
	return _run_id

func current_revision() -> int:
	return _revision

func _set_save_status(state: String, saved_revision: int, error_code: String) -> void:
	_save_status = SessionContracts.save_status(state, saved_revision, error_code)
	save_status_changed.emit(state, saved_revision, error_code)

func _shape_command(value: Variant) -> Dictionary:
	if not value is Dictionary or value.size() != SessionContracts.COMMAND_KEYS.size():
		return _reject("shape-invalid", "command must contain exactly commandId, runId, baseRevision, type and action")
	var data: Dictionary = value
	for key: String in SessionContracts.COMMAND_KEYS:
		if not data.has(key):
			return _reject("shape-invalid", "command is missing %s" % key, key)
	if not data.commandId is String or String(data.commandId).is_empty():
		return _reject("shape-invalid", "commandId must be a nonempty string", "commandId")
	if not data.runId is String or String(data.runId).is_empty():
		return _reject("shape-invalid", "runId must be a nonempty string", "runId")
	if not _is_nonnegative_integer(data.baseRevision):
		return _reject("shape-invalid", "baseRevision must be a nonnegative integer", "baseRevision")
	if not data.type is String or data.type != "action":
		return _reject("shape-invalid", "type must be action", "type")
	# Shape checks cannot depend on mutable state: old CHOOSE retries must dedup.
	# Rules.validate checks whether the choice belongs to the current event.
	var decoded: Dictionary = GameAction.decode(data.action, _catalog)
	if not decoded.ok:
		return _reject("shape-invalid", decoded.error, "action")
	return {
		"ok": true,
		"command": {
			"commandId": data.commandId, "runId": data.runId,
			"baseRevision": int(data.baseRevision), "type": data.type,
			"action": decoded.action.to_data(),
		},
	}

func _remember(key: String, fingerprint: String, result: Dictionary) -> void:
	_dedup.append({
		"key": key, "fingerprint": fingerprint, "result": result.duplicate(true),
	})
	if _dedup.size() > DEDUP_LIMIT:
		_dedup.pop_front()

func _is_nonnegative_integer(value: Variant) -> bool:
	if value is int:
		return value >= 0 and value <= CanonicalJson.MAX_SAFE_INTEGER
	if value is float:
		return is_finite(value) and value >= 0 and value == floor(value) \
			and value <= float(CanonicalJson.MAX_SAFE_INTEGER)
	return false

func _enqueue_save() -> void:
	if _save_sink == null or not _save_sink.has_method("enqueue"):
		_set_save_status("failed", int(_save_status.savedRevision), "storage-unavailable")
		return
	var queued: Dictionary = _save_sink.enqueue({
		"runId": _run_id, "revision": _revision, "state": _state.to_data(),
	})
	if not queued.get("ok", false):
		_set_save_status("failed", int(_save_status.savedRevision), String(queued.get("errorCode", "enqueue-failed")))

func _reject(code: String, message: String, field_path: String = "", command_id: String = "") -> Dictionary:
	var result: Dictionary = SessionContracts.rejection(code, message, field_path)
	result["revision"] = _revision
	result["view"] = snapshot_view()
	result["events"] = []
	result["dedup"] = false
	_notify_rejection(command_id, result.error)
	return result

func _notify_rejection(command_id: String, error: Dictionary) -> void:
	if command_id.is_empty() or _notifying_rejection:
		return
	var was_dispatching: bool = _dispatching
	_dispatching = true
	_notifying_rejection = true
	command_rejected.emit(command_id, error.duplicate(true))
	_notifying_rejection = false
	_dispatching = was_dispatching
