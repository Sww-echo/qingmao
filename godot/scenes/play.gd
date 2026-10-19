extends Node2D
## Minimal session HUD over the W0 academy shell.

signal exit_requested()

const SCOPE_NOTE := "架构演示"

@onready var _player: CharacterBody2D = %Player
@onready var _interaction: Node = %InteractionController
@onready var _prompt: Label = %Prompt
@onready var _panel: PanelContainer = %ExplainPanel
@onready var _panel_title: Label = %ExplainTitle
@onready var _panel_body: Label = %ExplainBody
@onready var _status: Label = %StatusLine
@onready var _session_hud: Label = %SessionHud
@onready var _save_status: Label = %SaveStatus
@onready var _last_event: Label = %LastEvent

var _session: GameSession
var _load_notice: String = ""
var _command_serial: int = 0

func configure(session: GameSession, load_notice: String = "") -> void:
	_session = session
	_load_notice = load_notice


func _ready() -> void:
	_prompt.visible = false
	_panel.visible = false
	_status.text = SCOPE_NOTE
	for hotspot in get_tree().get_nodes_in_group("interactable"):
		_interaction.register(hotspot)
	_interaction.focus_changed.connect(_on_focus_changed)
	_interaction.focus_cleared.connect(_on_focus_cleared)
	_interaction.interaction_requested.connect(_on_interaction_requested)
	%WorkButton.pressed.connect(_on_work_pressed)
	%RestButton.pressed.connect(_on_rest_pressed)
	%EndDayButton.pressed.connect(_on_end_day_pressed)
	if _session != null:
		_session.state_committed.connect(_on_state_committed)
		_session.command_rejected.connect(_on_command_rejected)
		_session.save_status_changed.connect(_on_save_status_changed)
		_render(_session.snapshot_view())
		if not _load_notice.is_empty():
			_last_event.text = _load_notice
	else:
		_session_hud.text = "没有活动会话"


func _unhandled_input(event: InputEvent) -> void:
	if _panel.visible and event.is_action_pressed("interact"):
		get_viewport().set_input_as_handled()
		_close_panel()
		return
	if event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		if _panel.visible:
			_close_panel()
		else:
			exit_requested.emit()


func _on_focus_changed(_target_id: String, display_name: String, _description: String) -> void:
	if _panel.visible:
		return
	_prompt.text = "按 E 查看「%s」" % display_name
	_prompt.visible = true


func _on_focus_cleared() -> void:
	_prompt.visible = false


func _on_interaction_requested(
	_target_id: String, display_name: String, description: String
) -> void:
	if _panel.visible:
		return
	_panel_title.text = display_name
	_panel_body.text = description
	_panel.visible = true
	_prompt.visible = false
	_player.input_locked = true
	_interaction.enabled = false
	if _session != null:
		_render(_session.snapshot_view())


func _close_panel() -> void:
	_panel.visible = false
	_player.input_locked = false
	_interaction.enabled = true
	# Standing still produces no new enter/exit event, so the prompt has to be
	# rebuilt explicitly instead of waiting for a signal that will never fire.
	_interaction.refocus()
	if _session != null:
		_render(_session.snapshot_view())


func _on_work_pressed() -> void:
	_submit({"type": "WORK"})


func _on_rest_pressed() -> void:
	_submit({"type": "REST"})


func _on_end_day_pressed() -> void:
	_submit({"type": "END_DAY"})


func _submit(action: Dictionary) -> void:
	if _session == null:
		return
	var view: Dictionary = _session.snapshot_view()
	if view.is_empty():
		return
	_command_serial += 1
	var result: Dictionary = _session.dispatch({
		"commandId": "ui-%d-%d" % [int(view.revision), _command_serial],
		"runId": view.runId,
		"baseRevision": int(view.revision),
		"type": "action",
		"action": action,
	})
	if not result.ok:
		_last_event.text = "动作被拒绝：%s" % result.error.message
	_render(_session.snapshot_view())


func _on_state_committed(_revision: int, view: Dictionary, _events: Array) -> void:
	_render(view)


func _on_command_rejected(_command_id: String, error: Dictionary) -> void:
	_last_event.text = "动作被拒绝：%s" % error.message


func _on_save_status_changed(_status: String, _saved_revision: int, _error_code: String) -> void:
	if _session != null:
		_render(_session.snapshot_view())


func _render(view: Dictionary) -> void:
	if view.is_empty():
		return
	var state: Dictionary = view.state
	var status: Dictionary = view.saveStatus
	_session_hud.text = "第%d日 · 行动%d · 生命%d/%d · 真元%d/%d · 元石%d · 维持%d · revision %d" % [
		int(state.day), int(state.actions), int(state.hp), int(view.maxHp),
		int(state.qi), int(view.maxQi), int(state.resources.stones), int(view.upkeep),
		int(view.revision),
	]
	_save_status.text = _save_label(status)
	if not state.log.is_empty():
		_last_event.text = String(state.log[-1].message)
	%WorkButton.disabled = _panel.visible or not _has_action(view, {"type": "WORK"})
	%RestButton.disabled = _panel.visible or not _has_action(view, {"type": "REST"})
	%EndDayButton.disabled = _panel.visible or not _has_action(view, {"type": "END_DAY"})


func _save_label(status: Dictionary) -> String:
	match String(status.state):
		"saving":
			return "保存中"
		"failed":
			return "未保存：%s" % status.get("errorCode", "unknown")
		_:
			return "已保存 revision %d" % int(status.savedRevision)


func _has_action(view: Dictionary, wanted: Dictionary) -> bool:
	for action: Dictionary in view.legalActions:
		if action == wanted:
			return true
	return false
