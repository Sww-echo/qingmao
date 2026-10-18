extends Node
## Composition root for the architecture demo (W0).
##
## Owns exactly one screen at a time and swaps between the title and the
## location shell. It deliberately owns no game state: per the architecture plan
## the single authoritative state will live in `GameSession` (W3), and this node
## must never grow into a second copy of it.

const TITLE_SCENE := preload("res://scenes/title.tscn")
const PLAY_SCENE := preload("res://scenes/play.tscn")

@onready var _screen_host: Node = %ScreenHost


func _ready() -> void:
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
