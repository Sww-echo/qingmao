class_name SessionContracts
extends RefCounted
## Shared result/error constructors for the application boundary.

const COMMAND_KEYS: PackedStringArray = ["commandId", "runId", "baseRevision", "type", "action"]
const SAVE_STATES: PackedStringArray = ["ok", "saving", "failed"]

static func rejection(code: String, message: String, field_path: String = "") -> Dictionary:
	var error: Dictionary = {"code": code, "message": message}
	if not field_path.is_empty():
		error["fieldPath"] = field_path
	return {"ok": false, "error": error}

static func result(revision: int, view: Dictionary, events: Array, dedup: bool = false) -> Dictionary:
	return {
		"ok": true, "revision": revision, "view": view,
		"events": events.duplicate(true), "dedup": dedup,
	}

static func save_status(state: String, saved_revision: int, error_code: String = "") -> Dictionary:
	var status: Dictionary = {"state": state, "savedRevision": saved_revision}
	if not error_code.is_empty():
		status["errorCode"] = error_code
	return status

static func command_fingerprint(base_revision: int, action: Dictionary) -> String:
	var encoded: Dictionary = CanonicalJson.encode({
		"baseRevision": base_revision, "type": "action", "action": action,
	})
	return encoded.text if encoded.ok else ""
