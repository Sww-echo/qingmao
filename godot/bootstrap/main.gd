extends Node
## Composition root for the architecture demo and W1 content verification.
##
## Owns exactly one screen at a time and swaps between the title and the
## location shell. It deliberately owns no game state: per the architecture plan
## the single authoritative state will live in `GameSession` (W3), and this node
## must never grow into a second copy of it.

const TITLE_SCENE := preload("res://scenes/title.tscn")
const PLAY_SCENE := preload("res://scenes/play.tscn")
const ContentLoaderScript := preload("res://infrastructure/content_loader.gd")

@onready var _screen_host: Node = %ScreenHost
var _catalog: RefCounted


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
	_show_title()


func _show_title() -> void:
	var title := TITLE_SCENE.instantiate()
	title.start_requested.connect(_show_play)
	title.quit_requested.connect(_quit)
	_swap(title)


func _show_play() -> void:
	var play := PLAY_SCENE.instantiate()
	play.exit_requested.connect(_show_title)
	_swap(play)


func _swap(screen: Node) -> void:
	for child in _screen_host.get_children():
		_screen_host.remove_child(child)
		child.queue_free()
	_screen_host.add_child(screen)


func _quit() -> void:
	get_tree().quit()
