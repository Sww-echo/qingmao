extends Node
## Composition root. GameSession is the only live game-state owner.

const TITLE_SCENE := preload("res://scenes/title.tscn")
const PLAY_SCENE := preload("res://scenes/play.tscn")
const ContentLoaderScript := preload("res://infrastructure/content_loader.gd")
const SAFE_ERROR_LABELS := {
	"not-configured": "保存未配置",
	"storage-unavailable": "存储不可用",
	"enqueue-failed": "保存入队失败",
	"superseded": "本次保存已被新进度取代",
	"tmp-validation-failed": "临时存档校验失败",
	"final-validation-failed": "存档确认校验失败",
	"recovery-failed": "从备份恢复后写盘失败",
	"stale-save": "快照已过期",
}
const ScreenRouterScript := preload("res://bootstrap/screen_router.gd")

@onready var _screen_host: Node = %ScreenHost
var _catalog: RefCounted
var _content_sha256: String = ""
var _session: GameSession
var _save_service: SaveService
var _router: ScreenRouter
var save_root: String = SaveService.ROOT
var _storage_warning: String = ""


func _ready() -> void:
	var arguments := OS.get_cmdline_user_args()
	if not arguments.is_empty():
		if arguments.size() != 1 or arguments[0] != "--verify-content":
			printerr("Unsupported startup arguments: %s" % " ".join(arguments))
			get_tree().quit(2)
			return
		var verified := ContentLoaderScript.verify_all()
		if not verified.ok:
			printerr(verified.error)
			get_tree().quit(1)
			return
		for pack in verified.packs:
			print("Content verified: pack=%s contentVersion=%s contentSha256=%s" % [
				pack.pack_id, pack.content_version, pack.content_sha256,
			])
		get_tree().quit(0)
		return
	var loaded := ContentLoaderScript.load_pack()
	if not loaded.ok:
		push_error(loaded.error)
		get_tree().quit(1)
		return
	_catalog = loaded.catalog
	_content_sha256 = loaded.content_sha256
	_router = ScreenRouterScript.new()
	_router.configure(_screen_host)
	_session = GameSession.new()
	add_child(_session)
	_save_service = SaveService.new()
	add_child(_save_service)
	var store: Variant = WebSaveStore.new() if OS.has_feature("web") else DesktopSaveStore.new()
	_save_service.configure(_catalog, _content_sha256, store, save_root)
	var capability: Dictionary = store.probe_capability()
	if not capability.ok:
		_storage_warning = "存储不可用，本次进度可能无法保留：%s" % capability.get("errorCode", "unknown")
	_save_service.save_status_changed.connect(_on_save_status)
	_session.configure(_catalog, _save_service)
	_show_title()


func _show_title() -> void:
	var title := TITLE_SCENE.instantiate()
	title.start_requested.connect(_show_play)
	title.continue_requested.connect(_continue_run)
	title.quit_requested.connect(_quit)
	var flushed: Dictionary = _save_service.flush_pending()
	var save_warning: String = "" if flushed.ok else "上次保存失败：%s" % SAFE_ERROR_LABELS.get(
		String(flushed.get("errorCode", "unknown")), String(flushed.get("errorCode", "unknown")))
	var inspected: Dictionary = _save_service.load(false)
	if inspected.ok:
		title.configure(true, "可继续：%s · revision %d%s" % [
			"当前档" if inspected.source == "current" else "备份（当前档不可用：%s）" % inspected.warning,
			int(inspected.body.revision),
			_warnings([_storage_warning, save_warning]),
		])
	elif inspected.errorCode == "no-save":
		title.configure(false, _warnings([_storage_warning if not _storage_warning.is_empty() else "尚无存档", save_warning]))
	else:
		title.configure(false, _warnings(["存档不可用：%s" % inspected.get("error", inspected.errorCode), save_warning]))
	_swap(title)

func _warnings(parts: Array) -> String:
	var lines: PackedStringArray = []
	for part: Variant in parts:
		if String(part).is_empty():
			continue
		lines.append(String(part))
	return "" if lines.is_empty() else "\n" + "\n".join(lines)


func _show_play(seed: int = 42) -> void:
	if _session == null:
		return
	var started: Dictionary = _session.new_run(seed)
	if not started.ok:
		push_error(started.error.message)
		return
	var play := PLAY_SCENE.instantiate()
	play.configure(_session)
	play.exit_requested.connect(_show_title)
	play.quit_requested.connect(_quit)
	_swap(play)

func _continue_run() -> void:
	var loaded: Dictionary = _save_service.load()
	if not loaded.ok:
		_show_title()
		return
	var resumed: Dictionary = _session.load_run(loaded.body)
	if not resumed.ok:
		push_error(resumed.error.message)
		_show_title()
		return
	_session.set_save_status("ok", int(loaded.body.revision))
	if not loaded.recoveryError.is_empty():
		_session.set_save_status("failed", int(loaded.body.revision), "recovery-failed")
	var play := PLAY_SCENE.instantiate()
	var notice: String = ""
	if loaded.recovered:
		notice = "已从备份恢复；当前档不可用：%s" % loaded.warning
		if not loaded.recoveryError.is_empty():
			notice += "；恢复写盘失败：%s" % loaded.recoveryError
	play.configure(_session, notice)
	play.exit_requested.connect(_show_title)
	play.quit_requested.connect(_quit)
	_swap(play)


func _swap(screen: Node) -> void:
	_router.show(screen)


func _quit() -> void:
	_save_service.flush_pending()
	get_tree().quit()

func _on_save_status(status: String, saved_revision: int, error_code: String) -> void:
	if _session != null:
		_session.set_save_status(status, saved_revision, error_code)
