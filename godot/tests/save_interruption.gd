extends SceneTree
## Separate-process interruption probe. Only its isolated test child kills itself.

class InterruptStore extends DesktopSaveStore:
	var stage: String = ""

	func stop_at(point: String) -> void:
		if stage == point:
			print("INTERRUPT " + point)
			OS.kill(OS.get_process_id())

	func write(path: String, bytes: PackedByteArray) -> Dictionary:
		if path.ends_with("current.tmp") and stage in ["tmp-write", "tmp-flush"]:
			ensure_parent(path)
			var file := FileAccess.open(path, FileAccess.WRITE)
			file.store_buffer(bytes.slice(0, bytes.size() / 2) if stage == "tmp-write" else bytes)
			if stage == "tmp-flush":
				file.flush()
			stop_at(stage)
		return super.write(path, bytes)

	func read(path: String) -> Dictionary:
		var result: Dictionary = super.read(path)
		if path.ends_with("current.tmp"):
			stop_at("tmp-read")
		return result

	func remove(path: String) -> Dictionary:
		var result: Dictionary = super.remove(path)
		if path.ends_with("backup.json"):
			stop_at("backup-remove")
		return result

	func rename(from: String, to: String) -> Dictionary:
		if from.ends_with("current.tmp") and stage == "promotion-failed":
			stop_at("promotion-failed")
		var result: Dictionary = super.rename(from, to)
		if to.ends_with("backup.json"):
			stop_at("current-rotate")
		if from.ends_with("current.tmp"):
			if stage == "final-invalid":
				super.write(to, "corrupt promoted bytes".to_utf8_buffer())
				stop_at("final-invalid")
			stop_at("promoted")
		return result

var _ran: bool = false

func _process(_delta: float) -> bool:
	if _ran:
		return true
	_ran = true
	var args: PackedStringArray = OS.get_cmdline_user_args()
	if args.size() != 3 or not args[0].is_absolute_path():
		quit(2)
		return true
	var loaded: Dictionary = ContentLoader.load_pack()
	if not loaded.ok:
		printerr(loaded.error)
		quit(2)
		return true
	var store := InterruptStore.new()
	var service := SaveService.new()
	root.add_child(service)
	service.configure(loaded.catalog, loaded.content_sha256, store, args[0])
	service.begin_generation()
	if args[1] == "seed":
		for revision: int in range(2):
			if not service.save_now(_body(revision, loaded.catalog)).ok:
				quit(1)
				return true
	elif args[1] == "interrupt":
		store.stage = args[2]
		service.save_now(_body(2, loaded.catalog))
		printerr("interruption point was not reached")
		quit(1)
		return true
	elif args[1] == "verify":
		var result: Dictionary = service.load()
		var expected: int = int(args[2])
		var canonical: Dictionary = CanonicalJson.encode(_body(expected, loaded.catalog))
		var actual: Dictionary = CanonicalJson.encode(result.get("body"))
		if not result.ok or not actual.ok or actual.bytes != canonical.bytes:
			printerr("restart failed: " + str(result))
			quit(1)
			return true
		print("RESTORED revision=%d source=%s" % [expected, result.source])
	else:
		quit(2)
		return true
	quit(0)
	return true

func _body(revision: int, catalog: ContentCatalog) -> Dictionary:
	var state: GameState = Rules.create(42, catalog)
	for index: int in range(revision):
		state = Rules.apply(state, {"type": "WORK"}, catalog).state
	return {"runId": "process-interruption", "revision": revision, "state": state.to_data()}
