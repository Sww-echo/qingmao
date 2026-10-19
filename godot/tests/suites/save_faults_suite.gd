class_name SaveFaultsSuite
extends RefCounted

const CONTENT_PATH := "res://content/generated/prototype/content.json"
const ROOT := "user://qingmao_save_fault_tests"

class FaultStore extends RefCounted:
	var files: Dictionary = {}
	var fail_write: String = ""
	var fail_rename: String = ""
	var fail_remove: String = ""
	var fail_current_read_after_promotion: bool = false
	var corrupt_current_on_promotion: bool = false
	var promotion_observed: bool = false
	var write_count: int = 0
	var rename_count: int = 0
	var on_operation: Callable

	func read(path: String) -> Dictionary:
		if fail_current_read_after_promotion and promotion_observed and path.ends_with("current.json"):
			return {"ok": false, "errorCode": "injected-read", "error": "injected current read failure"}
		if not files.has(path):
			return {"ok": false, "errorCode": "missing", "error": "missing"}
		_notify("read", path)
		return {"ok": true, "bytes": files[path]}

	func write(path: String, bytes: PackedByteArray) -> Dictionary:
		write_count += 1
		if not fail_write.is_empty() and path.ends_with(fail_write):
			return {"ok": false, "errorCode": "injected-write", "error": "injected write failure"}
		files[path] = bytes.duplicate()
		_notify("write", path)
		return {"ok": true}

	func rename(from: String, to: String) -> Dictionary:
		rename_count += 1
		if not fail_rename.is_empty() and to.ends_with(fail_rename):
			return {"ok": false, "errorCode": "injected-rename", "error": "injected rename failure"}
		if not files.has(from):
			return {"ok": false, "errorCode": "missing", "error": "source missing"}
		files[to] = files[from]
		files.erase(from)
		if from.ends_with("current.tmp") and to.ends_with("current.json"):
			promotion_observed = true
			if corrupt_current_on_promotion:
				files[to] = "broken-after-promotion".to_utf8_buffer()
		_notify("rename", to)
		return {"ok": true}

	func remove(path: String) -> Dictionary:
		if not fail_remove.is_empty() and path.ends_with(fail_remove):
			return {"ok": false, "errorCode": "injected-remove", "error": "injected remove failure"}
		files.erase(path)
		_notify("remove", path)
		return {"ok": true}

	func _notify(operation: String, path: String) -> void:
		if on_operation.is_valid():
			on_operation.call(operation, path)

	func exists(path: String) -> bool:
		return files.has(path)

	func probe_capability() -> Dictionary:
		return {"ok": true, "backend": "memory"}

var _checks: int = 0
var _failures: PackedStringArray = []
var _tree: SceneTree
var _catalog: ContentCatalog
var _content_sha256: String = ""

func run(tree: SceneTree) -> Dictionary:
	_tree = tree
	_checks = 0
	_failures = []
	var bytes: PackedByteArray = FileAccess.get_file_as_bytes(CONTENT_PATH)
	var content: Variant = JSON.parse_string(bytes.get_string_from_utf8())
	if not _expect(content is Dictionary, "save suite requires frozen content"):
		return _result()
	_catalog = ContentCatalog.new(content)
	_content_sha256 = CanonicalJson.sha256(bytes)
	_envelope_contract()
	_round_trip_contract()
	_recovery_matrix()
	_real_disk_contract()
	_generation_contract()
	_four_restore_points()
	return _result()

func _envelope_contract() -> void:
	var body: Dictionary = _body(0)
	var encoded: Dictionary = SaveEnvelope.encode(body, _catalog, _content_sha256)
	if not _expect(encoded.ok, "valid save body encodes: %s" % encoded.get("error", "")):
		return
	var decoded: Dictionary = SaveEnvelope.decode(encoded.bytes, _catalog, _content_sha256)
	_expect(decoded.ok and _same(decoded.body, body), "save envelope round-trips the exact body")
	var parser := JSON.new()
	_expect(parser.parse(encoded.bytes.get_string_from_utf8()) == OK, "save envelope is JSON")
	var envelope: Dictionary = parser.data
	_expect(envelope.size() == 7 and envelope.bodySha256.length() == 64, "envelope has all version and hash fields")
	var bad_body: Dictionary = body.duplicate(true)
	bad_body.state.hp = 999
	_expect(not SaveEnvelope.encode(bad_body, _catalog, _content_sha256).ok, "encode validates the state model")
	var tampered: Dictionary = body.duplicate(true)
	tampered.runId = "changed"
	var tampered_result: Dictionary = SaveEnvelope.encode(tampered, _catalog, _content_sha256)
	var tampered_parser := JSON.new()
	tampered_parser.parse(tampered_result.bytes.get_string_from_utf8())
	tampered_parser.data.body.runId = "changed-again"
	var recanonical: Dictionary = CanonicalJson.encode(tampered_parser.data)
	_expect(not SaveEnvelope.decode(recanonical.bytes, _catalog, _content_sha256).ok, "body SHA mismatch is rejected")
	_expect(not SaveEnvelope.decode(encoded.bytes.slice(0, encoded.bytes.size() - 2), _catalog, _content_sha256).ok, "truncated save is rejected")
	_expect(not SaveEnvelope.decode(encoded.bytes, _catalog, "0".repeat(64)).ok, "content hash mismatch is rejected")
	var oversized := PackedByteArray()
	oversized.resize(SaveEnvelope.MAX_BYTES + 1)
	_expect(not SaveEnvelope.decode(oversized, _catalog, _content_sha256).ok, "oversized save is rejected before parsing")
	var noncanonical: PackedByteArray = encoded.bytes.get_string_from_utf8().replace("  ", " ").to_utf8_buffer()
	_expect(not SaveEnvelope.decode(noncanonical, _catalog, _content_sha256).ok, "noncanonical save is rejected")
	var bad_revision: Dictionary = body.duplicate(true)
	bad_revision.revision = 1.5
	_expect(not SaveEnvelope.encode(bad_revision, _catalog, _content_sha256).ok, "fractional revision is rejected")
	_expect(not SaveEnvelope.encode(body, null, _content_sha256).ok, "missing catalog is rejected")

func _round_trip_contract() -> void:
	var store := FaultStore.new()
	var service := _service(store)
	var first: Dictionary = service.save_now(_body(0))
	_expect(first.ok and first.revision == 0, "first save commits revision zero: %s" % first.get("error", ""))
	var loaded: Dictionary = service.load()
	_expect(loaded.ok and loaded.source == "current", "fresh current loads: %s" % loaded.get("error", ""))
	if loaded.ok:
		_expect(_same(loaded.body, _body(0)), "load returns the exact body and full state")
	var second: Dictionary = service.save_now(_body(1))
	_expect(second.ok and second.revision == 1, "second save advances saved revision")
	var paths: Dictionary = _paths()
	_expect(store.exists(paths.current) and store.exists(paths.backup), "second save rotates current into backup")
	_expect(not store.exists(paths.tmp), "successful save removes tmp")
	var latest: Dictionary = service.load()
	_expect(latest.ok and _same(latest.body, _body(1)), "latest current wins: %s" % latest.get("error", ""))
	service.queue_free()

func _recovery_matrix() -> void:
	var paths: Dictionary = _paths()
	var valid_zero: PackedByteArray = SaveEnvelope.encode(_body(0), _catalog, _content_sha256).bytes
	var valid_one: PackedByteArray = SaveEnvelope.encode(_body(1), _catalog, _content_sha256).bytes
	var cases: Array[Dictionary] = [
		{"name": "current missing, backup valid", "current": null, "backup": valid_zero, "tmp": null},
		{"name": "current corrupt, backup valid", "current": "broken".to_utf8_buffer(), "backup": valid_zero, "tmp": null},
		{"name": "current missing, backup corrupt", "current": null, "backup": "broken".to_utf8_buffer(), "tmp": null},
		{"name": "only tmp remains", "current": null, "backup": null, "tmp": valid_zero},
		{"name": "all files corrupt", "current": "broken".to_utf8_buffer(), "backup": "broken".to_utf8_buffer(), "tmp": "broken".to_utf8_buffer()},
	]
	for case: Dictionary in cases:
		var store := FaultStore.new()
		_put(store, paths.current, case.current)
		_put(store, paths.backup, case.backup)
		_put(store, paths.tmp, case.tmp)
		var service := _service(store)
		var result: Dictionary = service.load()
		if case.name == "current missing, backup valid" or case.name == "current corrupt, backup valid":
			_expect(result.ok and result.source == "recovered-backup", "%s recovers from backup: %s" % [case.name, result.get("error", "")])
			_expect(store.exists(paths.current), "%s restores current" % case.name)
			_expect(store.exists(paths.backup), "%s preserves backup" % case.name)
		else:
			_expect(not result.ok and result.errorCode == "no-valid-save", "%s reports no valid committed save" % case.name)
			if case.name == "all files corrupt":
				_expect(store.exists(paths.current), "all-corrupt diagnostics preserve current")
				if store.exists(paths.current):
					_expect(
						not SaveEnvelope.decode(store.files[paths.current], _catalog, _content_sha256).ok,
						"all-corrupt current is never accepted as valid"
					)
			else:
				_expect(not store.exists(paths.current), "%s does not fabricate current" % case.name)
			if case.name == "only tmp remains":
				_expect(store.exists(paths.tmp), "only-tmp diagnostic file is preserved")
		service.queue_free()

	var write_failure := FaultStore.new()
	_put(write_failure, paths.current, valid_zero)
	var failing_service := _service(write_failure)
	write_failure.fail_write = "current.tmp"
	var failed: Dictionary = failing_service.save_now(_body(1))
	_expect(not failed.ok and write_failure.exists(paths.current), "tmp write failure preserves current")
	_expect(not write_failure.exists(paths.tmp), "tmp write failure leaves no promoted tmp")
	var preserved: Dictionary = failing_service.load()
	_expect(preserved.ok and _same(preserved.body, _body(0)), "tmp write failure remains recoverable: %s" % preserved.get("error", ""))
	failing_service.queue_free()

	var promote_failure := FaultStore.new()
	_put(promote_failure, paths.current, valid_zero)
	var promote_service := _service(promote_failure)
	promote_failure.fail_rename = "current.json"
	var promote_failed: Dictionary = promote_service.save_now(_body(1))
	_expect(not promote_failed.ok, "tmp promotion failure is reported")
	_expect(promote_failure.exists(paths.backup), "promotion failure keeps rotated backup")
	_expect(promote_failure.exists(paths.current), "promotion failure restores current from backup")
	var previous: Dictionary = promote_service.load()
	_expect(previous.ok and _same(previous.body, _body(0)), "promotion failure loads the previous committed body: %s" % previous.get("error", ""))
	promote_service.queue_free()

	var corrupt_current := FaultStore.new()
	_put(corrupt_current, paths.current, "broken".to_utf8_buffer())
	_put(corrupt_current, paths.backup, valid_zero)
	var repair_service := _service(corrupt_current)
	var repaired: Dictionary = repair_service.save_now(_body(1))
	_expect(repaired.ok, "save repairs a corrupt current before rotation")
	var repaired_load: Dictionary = repair_service.load()
	_expect(repaired_load.ok and _same(repaired_load.body, _body(1)), "repair save commits the new current: %s" % repaired_load.get("error", ""))
	_expect(corrupt_current.exists(paths.backup), "repair save retains a valid backup")
	repair_service.queue_free()

	var remove_failure := FaultStore.new()
	_put(remove_failure, paths.current, valid_one)
	_put(remove_failure, paths.backup, valid_zero)
	var remove_service := _service(remove_failure)
	remove_failure.fail_remove = "backup.json"
	var remove_result: Dictionary = remove_service.save_now(_body(2))
	_expect(not remove_result.ok, "backup removal failure is reported")
	_expect(remove_failure.exists(paths.current) and remove_failure.exists(paths.backup), "backup removal failure leaves both valid files")
	_expect(_same(remove_service.load().body, _body(1)), "backup removal failure keeps current unchanged")
	remove_service.queue_free()

	var rotate_failure := FaultStore.new()
	_put(rotate_failure, paths.current, valid_zero)
	var rotate_service := _service(rotate_failure)
	rotate_failure.fail_rename = "backup.json"
	var rotate_result: Dictionary = rotate_service.save_now(_body(1))
	_expect(not rotate_result.ok, "current-to-backup rename failure is reported")
	_expect(rotate_failure.exists(paths.current), "rotation failure leaves current readable")
	_expect(_same(rotate_service.load().body, _body(0)), "rotation failure keeps the previous current")
	rotate_service.queue_free()

	var final_read_failure := FaultStore.new()
	_put(final_read_failure, paths.current, valid_zero)
	var final_service := _service(final_read_failure)
	final_read_failure.fail_current_read_after_promotion = true
	var final_result: Dictionary = final_service.save_now(_body(1))
	_expect(not final_result.ok, "final current validation failure is reported")
	_expect(final_read_failure.exists(paths.backup), "final validation failure preserves backup")
	_expect(_same(final_service.load().body, _body(0)), "final validation failure recovers the previous body")
	final_service.queue_free()

	var recovery_failure := FaultStore.new()
	_put(recovery_failure, paths.current, valid_zero)
	var recovery_service := _service(recovery_failure)
	recovery_failure.fail_current_read_after_promotion = true
	recovery_failure.corrupt_current_on_promotion = true
	recovery_failure.fail_write = "current.json"
	var recovery_result: Dictionary = recovery_service.save_now(_body(1))
	_expect(not recovery_result.ok, "failed recovery write is reported")
	_expect(recovery_failure.exists(paths.backup), "failed recovery preserves the unique good backup")
	recovery_failure.fail_current_read_after_promotion = false
	recovery_failure.fail_write = ""
	var restarted_recovery := _service(recovery_failure)
	var restarted_result: Dictionary = restarted_recovery.load()
	_expect(restarted_result.ok and _same(restarted_result.body, _body(0)), "restart recovers the validated backup after failed promotion: %s" % restarted_result.get("error", ""))
	recovery_service.queue_free()
	restarted_recovery.queue_free()

	var latest_store := FaultStore.new()
	var latest_service := _service(latest_store)
	latest_service.enqueue(_body(0))
	latest_service.enqueue(_body(1))
	var latest_result: Dictionary = latest_service.flush_pending()
	_expect(latest_result.ok, "latest-wins queue flush succeeds")
	_expect(_same(latest_service.load().body, _body(1)), "latest-wins writes only the newest queued body")
	latest_service.queue_free()

	var generation_cancel_store := FaultStore.new()
	var generation_cancel := _service(generation_cancel_store)
	generation_cancel_store.write_count = 0
	generation_cancel.enqueue(_body(0))
	generation_cancel.begin_generation()
	_expect(generation_cancel.flush_pending().ok, "generation change cancels pending work")
	_expect(generation_cancel_store.write_count == 0, "canceled pending work performs no disk writes")
	generation_cancel.queue_free()

func _real_disk_contract() -> void:
	var root: String = ROOT
	_remove_tree(ProjectSettings.globalize_path(root))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(root))
	var store := DesktopSaveStore.new()
	var service := _service(store, root)
	var first: Dictionary = service.save_now(_body(0))
	_expect(first.ok, "desktop store writes the first save: %s" % first.get("error", ""))
	var second: Dictionary = service.save_now(_body(1))
	_expect(second.ok, "desktop store writes a second save: %s" % second.get("error", ""))
	var paths: Dictionary = _paths(root)
	_expect(FileAccess.file_exists(paths.current), "desktop current file exists")
	_expect(FileAccess.file_exists(paths.backup), "desktop backup file exists")
	_expect(store.probe_capability().ok, "desktop user storage supports a write/read probe")
	var reread := _service(DesktopSaveStore.new(), root)
	var loaded: Dictionary = reread.load()
	_expect(loaded.ok and loaded.source == "current", "a fresh save service reads the committed desktop file: %s" % loaded.get("error", ""))
	if loaded.ok:
		_expect(_same(loaded.body, _body(1)), "desktop reload preserves complete state")
	FileAccess.open(paths.current, FileAccess.WRITE).store_string("tampered")
	var recovered_service := _service(DesktopSaveStore.new(), root)
	var recovered: Dictionary = recovered_service.load()
	_expect(recovered.ok and recovered.source == "recovered-backup", "real disk tampering recovers from backup: %s" % recovered.get("error", ""))
	if recovered.ok:
		_expect(_same(recovered.body, _body(0)), "real disk recovery returns the last committed backup")
	_expect(FileAccess.file_exists(paths.current) and FileAccess.file_exists(paths.backup), "real disk recovery restores current and keeps backup")
	service.queue_free()
	reread.queue_free()
	recovered_service.queue_free()
	_remove_tree(ProjectSettings.globalize_path(root))

func _service(store: Variant, root: String = ROOT) -> SaveService:
	var service := SaveService.new()
	_tree.root.add_child(service)
	service.configure(_catalog, _content_sha256, store, root)
	return service

func _body(revision: int) -> Dictionary:
	var state: GameState = Rules.create(42, _catalog)
	state.location = "bamboo" if revision > 0 else "academy"
	return {"runId": "test-run", "revision": revision, "state": state.to_data()}

func _paths(root: String = ROOT) -> Dictionary:
	root = ProjectSettings.globalize_path(root).simplify_path()
	return {
		"current": "%s/%s/%s/current.json" % [root, _catalog.data.scenarioId, _catalog.data.rulesVersion],
		"backup": "%s/%s/%s/backup.json" % [root, _catalog.data.scenarioId, _catalog.data.rulesVersion],
		"tmp": "%s/%s/%s/current.tmp" % [root, _catalog.data.scenarioId, _catalog.data.rulesVersion],
	}

func _generation_contract() -> void:
	var stages: Array[Dictionary] = [
		{"op": "write", "suffix": "current.tmp"},
		{"op": "remove", "suffix": "backup.json"},
		{"op": "rename", "suffix": "backup.json"},
		{"op": "rename", "suffix": "current.json"},
		{"op": "read", "suffix": "current.json"},
	]
	for index: int in range(stages.size()):
		var store := FaultStore.new()
		var service := _service(store, ROOT + "/generation-%d" % index)
		service.begin_generation()
		_expect(service.save_now(_body(0)).ok, "generation case has previous good save")
		var other := _service(store, ROOT + "/generation-%d" % index)
		var callbacks: Array[String] = []
		service.save_status_changed.connect(func(status: String, _rev: int, _error: String) -> void:
			callbacks.append(status)
		)
		var nested: Array[Dictionary] = []
		var stage: Dictionary = stages[index]
		var fired: Array[bool] = [false]
		store.on_operation = func(op: String, path: String) -> void:
			if fired[0] or op != stage.op or not path.ends_with(stage.suffix):
				return
			fired[0] = true
			other.begin_generation()
			var next_body: Dictionary = _body(0)
			next_body["runId"] = "new-run"
			nested.append(other.save_now(next_body))
		var old_result: Dictionary = service.save_now(_body(1))
		_expect(fired[0] and not old_result.ok and old_result.errorCode == "superseded", "switch at %s/%s supersedes old writer" % [stage.op, stage.suffix])
		_expect(nested.size() == 1 and nested[0].errorCode == "busy", "different service shares physical slot lock")
		_expect(callbacks.is_empty(), "old generation cannot report success/failure to the new run")
		store.on_operation = Callable()
		_expect(other.flush_pending().ok, "new generation runs after previous writer releases lock")
		var loaded: Dictionary = other.load()
		_expect(loaded.ok and loaded.body.runId == "new-run" and loaded.body.revision == 0, "new run wins the physical slot")
		_expect(service.save_now(_body(2)).errorCode == "superseded", "late old-generation write is rejected")
		service.queue_free()
		other.queue_free()

func _four_restore_points() -> void:
	var trace: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://tests/fixtures/prototype/war-ready-42.json")).trace
	var points: Dictionary = {}
	for index: int in range(trace.steps.size()):
		var state: Dictionary = trace.steps[index].state
		if not points.has("event") and state.activeEvent != null:
			points["event"] = index
		if not points.has("combat") and state.combat != null:
			points["combat"] = index
		if not points.has("day-end") and trace.actions[index].type == "END_DAY":
			points["day-end"] = index
		if state.ending != null:
			points["ending"] = index
	for name: String in ["event", "combat", "day-end", "ending"]:
		if not _expect(points.has(name), "golden trace supplies %s recovery point" % name):
			continue
		var index: int = points[name]
		var root: String = ROOT + "/restore-" + name
		_remove_tree(ProjectSettings.globalize_path(root))
		var body: Dictionary = {"runId": "restore-" + name, "revision": index + 1, "state": trace.steps[index].state}
		var service := _service(DesktopSaveStore.new(), root)
		service.begin_generation()
		_expect(service.save_now(body).ok, "%s point saves to real disk" % name)
		service.free()
		var restarted := _service(DesktopSaveStore.new(), root)
		var loaded: Dictionary = restarted.load()
		_expect(loaded.ok and _same(loaded.body, body), "%s reload preserves every field including RNG/log/ledger" % name)
		if loaded.ok:
			var session := GameSession.new()
			_tree.root.add_child(session)
			session.configure(_catalog, restarted)
			_expect(session.load_run(loaded.body).ok, "%s point loads through the frozen session interface" % name)
			if index + 1 < trace.actions.size():
				var result: Dictionary = session.dispatch({
					"commandId": "after-restore", "runId": body.runId, "baseRevision": index + 1,
					"type": "action", "action": trace.actions[index + 1],
				})
				_expect(result.ok, "%s point accepts the next golden action once" % name)
				_expect(restarted.flush_pending().ok, "%s next action saves" % name)
				var after: Dictionary = restarted.load()
				_expect(after.ok and _same(after.body.state, trace.steps[index + 1].state), "%s next action matches full golden state without duplicate effects" % name)
			session.free()
		restarted.free()
		_remove_tree(ProjectSettings.globalize_path(root))

func _put(store: FaultStore, path: String, bytes: Variant) -> void:
	if bytes != null:
		store.files[path] = bytes.duplicate()

func _remove_tree(path: String) -> void:
	var directory := DirAccess.open(path)
	if directory == null:
		return
	for file: String in directory.get_files():
		DirAccess.remove_absolute(path.path_join(file))
	for child: String in directory.get_directories():
		_remove_tree(path.path_join(child))
	DirAccess.remove_absolute(path)

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
