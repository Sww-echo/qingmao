class_name SaveService
extends Node
## Latest-wins snapshots; all services sharing a physical slot share its lock.

signal save_status_changed(status: String, saved_revision: int, error_code: String)

const ROOT := "user://qingmao_strategy_demo"
static var _slots: Dictionary = {}

var _catalog: ContentCatalog
var _content_sha256: String = ""
var _store: Variant
var _slot_path: String = ""
var _slot: Dictionary
var _generation: int = 0
var _pending: Variant = null
var _drain_scheduled: bool = false
var _saved_revision: int = -1

func configure(
	catalog: ContentCatalog,
	content_sha256: String,
	store: Variant,
	root: String = ROOT
) -> void:
	_catalog = catalog
	_content_sha256 = content_sha256
	_store = store
	_slot_path = ProjectSettings.globalize_path("%s/%s/%s" % [
		root, catalog.data["scenarioId"], catalog.data["rulesVersion"],
	]).simplify_path()
	if not _slots.has(_slot_path):
		_slots[_slot_path] = {"generation": 0, "writing": false}
	_slot = _slots[_slot_path]
	_generation = int(_slot.generation)

func begin_generation(saved_revision: int = -1) -> int:
	if _slot.is_empty():
		return -1
	_slot["generation"] += 1
	_generation = int(_slot.generation)
	_pending = null
	_saved_revision = saved_revision
	return _generation

func generation() -> int:
	return _generation

func enqueue(body: Variant) -> Dictionary:
	if _catalog == null or _store == null:
		return {"ok": false, "errorCode": "not-configured"}
	if not _is_current(_generation):
		return _superseded()
	_pending = body.duplicate(true) if body is Dictionary else body
	_schedule_drain()
	save_status_changed.emit("saving", _saved_revision, "")
	return {"ok": true}

func flush_pending() -> Dictionary:
	if _pending == null:
		return {"ok": true, "revision": _saved_revision}
	var body: Variant = _pending
	_pending = null
	return save_now(body)

func save_now(body: Variant) -> Dictionary:
	if _catalog == null or _store == null:
		return _failure("not-configured")
	var token: int = _generation
	if not _is_current(token):
		return _superseded()
	if _slot.writing:
		_pending = body.duplicate(true) if body is Dictionary else body
		_schedule_drain()
		return {"ok": false, "errorCode": "busy", "revision": _saved_revision}
	_slot["writing"] = true
	# Capture before I/O or callbacks: callers cannot mutate an in-flight save.
	var snapshot: Variant = body.duplicate(true) if body is Dictionary else body
	var result: Dictionary = _transaction(snapshot, token)
	_slot["writing"] = false
	if _pending != null:
		_schedule_drain()
	# Both successful and failed callbacks are generation-scoped.
	if not _is_current(token):
		return _superseded()
	if not result.ok:
		return _failure(result.errorCode, String(result.get("error", "")))
	_saved_revision = int(snapshot.revision)
	save_status_changed.emit("ok", _saved_revision, "")
	return {"ok": true, "revision": _saved_revision}

func _transaction(body: Variant, token: int) -> Dictionary:
	var encoded: Dictionary = SaveEnvelope.encode(body, _catalog, _content_sha256)
	if not encoded.ok:
		return encoded
	if int(body.revision) < _saved_revision:
		return {"ok": false, "errorCode": "stale-save", "error": "snapshot predates the confirmed save"}
	var paths: Dictionary = _paths()
	var prepared: Dictionary = _prepare_existing(paths)
	if not prepared.ok:
		return prepared
	if not _is_current(token):
		return _superseded()
	var wrote: Dictionary = _store.write(paths.tmp, encoded.bytes)
	if not wrote.ok:
		return wrote
	var tmp_read: Dictionary = _read_valid(paths.tmp)
	if not tmp_read.ok or tmp_read.bytes != encoded.bytes:
		return {"ok": false, "errorCode": "tmp-validation-failed", "error": "temporary save did not round-trip"}
	if not _is_current(token):
		_store.remove(paths.tmp)
		return _superseded()
	var rotated: Dictionary = _rotate(paths, token)
	if not rotated.ok:
		return rotated
	if not _is_current(token):
		return _stop_rotated(paths)
	var promoted: Dictionary = _store.rename(paths.tmp, paths.current)
	if not promoted.ok:
		return _with_recovery(paths, promoted)
	var final_read: Dictionary = _read_valid(paths.current)
	if not final_read.ok or final_read.bytes != encoded.bytes:
		return _with_recovery(paths, {
			"ok": false, "errorCode": "final-validation-failed",
			"error": "promoted save did not round-trip",
		})
	if not _is_current(token):
		return _stop_rotated(paths)
	return {"ok": true}

func load(repair: bool = true) -> Dictionary:
	if _catalog == null or _store == null:
		return {"ok": false, "errorCode": "not-configured", "error": "save service is not configured"}
	if _slot.writing:
		return {"ok": false, "errorCode": "busy", "error": "save transaction is in progress"}
	_slot["writing"] = true
	var result: Dictionary = _load(repair)
	_slot["writing"] = false
	return result

func _load(repair: bool) -> Dictionary:
	var paths: Dictionary = _paths()
	var current: Dictionary = _read_valid(paths.current)
	if current.ok:
		if repair:
			_store.remove(paths.tmp)
		return {
			"ok": true, "body": current.body, "source": "current",
			"recovered": false, "warning": "", "recoveryError": "",
		}
	var backup: Dictionary = _read_valid(paths.backup)
	if backup.ok:
		var restored: Dictionary = _recover_current(paths) if repair else {"ok": true}
		if repair and restored.ok:
			_store.remove(paths.tmp)
		return {
			"ok": true, "body": backup.body, "source": "recovered-backup",
			"recovered": true, "warning": current.error,
			"recoveryError": "" if restored.ok else String(restored.error),
		}
	if not _store.exists(paths.tmp) and not _store.exists(paths.current) and not _store.exists(paths.backup):
		return {"ok": false, "errorCode": "no-save", "error": "no save exists"}
	return {
		"ok": false, "errorCode": "no-valid-save",
		"error": "save interrupted or invalid; no valid committed current/backup (tmp is not promoted)",
		"currentError": current.error, "backupError": backup.error,
	}

func _drain() -> void:
	_drain_scheduled = false
	flush_pending()

func _schedule_drain() -> void:
	if not _drain_scheduled:
		_drain_scheduled = true
		call_deferred("_drain")

func _prepare_existing(paths: Dictionary) -> Dictionary:
	var current_exists: bool = _store.exists(paths.current)
	var backup_exists: bool = _store.exists(paths.backup)
	if not current_exists and not backup_exists:
		if _store.exists(paths.tmp):
			return {
				"ok": false, "errorCode": "no-valid-save",
				"error": "only an interrupted tmp exists; preserve it for explicit recovery",
			}
		return {"ok": true}
	if _read_valid(paths.current).ok:
		return {"ok": true}
	return _recover_current(paths)

func _rotate(paths: Dictionary, token: int) -> Dictionary:
	if not _store.exists(paths.current):
		return {"ok": true}
	var current: Dictionary = _read_valid(paths.current)
	if not current.ok:
		return {"ok": false, "errorCode": "no-valid-current", "error": current.error}
	if not _is_current(token):
		return _superseded()
	var removed: Dictionary = _store.remove(paths.backup)
	if not removed.ok:
		return removed
	if not _is_current(token):
		return _superseded()
	var moved: Dictionary = _store.rename(paths.current, paths.backup)
	if not moved.ok:
		return moved
	return {"ok": true}

func _stop_rotated(paths: Dictionary) -> Dictionary:
	# A switch during rotation must leave a valid formal save before unlocking.
	if _store.exists(paths.backup):
		_recover_current(paths)
	_store.remove(paths.tmp)
	return _superseded()

func _with_recovery(paths: Dictionary, failure: Dictionary) -> Dictionary:
	var recovered: Dictionary = _recover_current(paths)
	return {
		"ok": false, "errorCode": failure.errorCode,
		"error": "%s; recovery=%s" % [failure.error, recovered.get("error", "ok")],
	}

func _recover_current(paths: Dictionary) -> Dictionary:
	var backup: Dictionary = _read_valid(paths.backup)
	if not backup.ok:
		return {"ok": false, "errorCode": "no-valid-save", "error": backup.error}
	var restored: Dictionary = _store.write(paths.current, backup.bytes)
	if not restored.ok:
		return {"ok": false, "errorCode": "recovery-failed", "error": restored.error}
	var checked: Dictionary = _read_valid(paths.current)
	if not checked.ok or checked.bytes != backup.bytes:
		return {"ok": false, "errorCode": "recovery-failed", "error": "restored current did not round-trip"}
	return {"ok": true}

func _read_valid(path: String) -> Dictionary:
	var read: Dictionary = _store.read(path)
	if not read.ok:
		return {"ok": false, "errorCode": read.errorCode, "error": read.error}
	var decoded: Dictionary = SaveEnvelope.decode(read.bytes, _catalog, _content_sha256)
	if not decoded.ok:
		return {"ok": false, "errorCode": decoded.errorCode, "error": decoded.error}
	decoded["bytes"] = read.bytes
	return decoded

func _paths() -> Dictionary:
	return {
		"current": _slot_path + "/current.json",
		"backup": _slot_path + "/backup.json",
		"tmp": _slot_path + "/current.tmp",
	}

func _is_current(token: int) -> bool:
	return token == _generation and token == int(_slot.generation)

func _superseded() -> Dictionary:
	return {"ok": false, "errorCode": "superseded", "revision": _saved_revision}

func _failure(code: String, message: String = "") -> Dictionary:
	save_status_changed.emit("failed", _saved_revision, code)
	return {"ok": false, "errorCode": code, "revision": _saved_revision, "error": message}
