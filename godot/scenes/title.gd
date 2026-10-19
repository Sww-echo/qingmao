extends Control
## New-run and validated-continue entry points.

signal start_requested()
signal continue_requested()
signal quit_requested()


func _ready() -> void:
	%StartButton.pressed.connect(_on_start_pressed)
	%ContinueButton.pressed.connect(_on_continue_pressed)
	%QuitButton.pressed.connect(_on_quit_pressed)
	%StartButton.grab_focus()


func _on_start_pressed() -> void:
	start_requested.emit()


func _on_continue_pressed() -> void:
	continue_requested.emit()


func _on_quit_pressed() -> void:
	quit_requested.emit()


func configure(can_continue: bool, status_text: String) -> void:
	%ContinueButton.disabled = not can_continue
	%ContinueButton.text = "继续" if can_continue else "继续（暂无有效存档）"
	%SaveStatus.text = status_text
