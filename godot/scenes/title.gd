extends Control
## Title screen (W0).
##
## The three entries are the shape the finished screen will have — new run,
## continue, import. Only "new run" does anything today; the other two are
## visibly disabled rather than silently absent, because the architecture plan
## requires every demo to state its own scope instead of implying progress.

signal start_requested()
signal quit_requested()


func _ready() -> void:
	%StartButton.pressed.connect(_on_start_pressed)
	%QuitButton.pressed.connect(_on_quit_pressed)
	%StartButton.grab_focus()


func _on_start_pressed() -> void:
	start_requested.emit()


func _on_quit_pressed() -> void:
	quit_requested.emit()
