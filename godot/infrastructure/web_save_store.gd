class_name WebSaveStore
extends DesktopSaveStore
## Godot Web maps user:// to IndexedDB; the transaction remains the same.

func probe_capability() -> Dictionary:
	if OS.has_feature("web") and not OS.is_userfs_persistent():
		return {"ok": false, "errorCode": "persistence-unavailable", "error": "browser user storage is not persistent"}
	var result: Dictionary = super.probe_capability()
	if result.ok:
		result["backend"] = "indexeddb-user"
	return result

func write(path: String, bytes: PackedByteArray) -> Dictionary:
	if OS.has_feature("web") and not OS.is_userfs_persistent():
		return {"ok": false, "errorCode": "persistence-unavailable", "error": "browser user storage is not persistent"}
	return super.write(path, bytes)
