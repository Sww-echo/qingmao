class_name DesktopSaveStore
extends RefCounted
## FileAccess/DirAccess store. Web uses the same user:// contract.

func read(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {"ok": false, "errorCode": "missing", "error": "file does not exist"}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {"ok": false, "errorCode": "read-failed", "error": error_string(FileAccess.get_open_error())}
	var length: int = file.get_length()
	if length > SaveEnvelope.MAX_BYTES:
		file.close()
		return {"ok": false, "errorCode": "save-too-large", "error": "save exceeds 2 MiB"}
	var bytes: PackedByteArray = file.get_buffer(length)
	if file.get_error() != OK:
		file.close()
		return {"ok": false, "errorCode": "read-failed", "error": "incomplete read"}
	file.close()
	return {"ok": true, "bytes": bytes}

func write(path: String, bytes: PackedByteArray) -> Dictionary:
	var directory_error: String = ensure_parent(path)
	if not directory_error.is_empty():
		return {"ok": false, "errorCode": "mkdir-failed", "error": directory_error}
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return {"ok": false, "errorCode": "write-failed", "error": error_string(FileAccess.get_open_error())}
	var wrote: bool = file.store_buffer(bytes)
	file.flush()
	var write_error: Error = file.get_error()
	file.close()
	if not wrote or write_error != OK:
		return {"ok": false, "errorCode": "flush-failed", "error": error_string(write_error)}
	return {"ok": true}

func rename(from: String, to: String) -> Dictionary:
	var directory_error: String = ensure_parent(to)
	if not directory_error.is_empty():
		return {"ok": false, "errorCode": "mkdir-failed", "error": directory_error}
	var error: Error = DirAccess.rename_absolute(from, to)
	if error != OK:
		return {"ok": false, "errorCode": "rename-failed", "error": error_string(error)}
	return {"ok": true}

func remove(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {"ok": true}
	var error: Error = DirAccess.remove_absolute(path)
	if error != OK:
		return {"ok": false, "errorCode": "remove-failed", "error": error_string(error)}
	return {"ok": true}

func exists(path: String) -> bool:
	return FileAccess.file_exists(path)

func ensure_parent(path: String) -> String:
	var parent: String = path.get_base_dir()
	if DirAccess.dir_exists_absolute(parent):
		return ""
	var error: Error = DirAccess.make_dir_recursive_absolute(parent)
	return "" if error == OK else error_string(error)

func probe_capability() -> Dictionary:
	var probe_path: String = "user://qingmao_strategy_demo/.probe"
	var written: Dictionary = write(probe_path, "ok".to_utf8_buffer())
	if not written.ok:
		return {"ok": false, "errorCode": written.errorCode, "error": written.error}
	var read_back: Dictionary = read(probe_path)
	remove(probe_path)
	if not read_back.ok or read_back.bytes != "ok".to_utf8_buffer():
		return {"ok": false, "errorCode": "probe-failed", "error": "storage round trip failed"}
	return {"ok": true, "backend": "user"}
