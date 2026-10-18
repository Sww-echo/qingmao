extends Node2D
## Academy placeholder location (W0).
##
## Wires the placeholder avatar to the interaction controller and renders a
## read-only explanation panel. No rule state is created, mutated or persisted
## here: this screen only knows how to ask about a stable target id, which is
## exactly the boundary the architecture plan draws around `presentation/`.

signal exit_requested()

const SCOPE_NOTE := "架构演示：未接入完整规则"

@onready var _player: CharacterBody2D = %Player
@onready var _interaction: Node = %InteractionController
@onready var _prompt: Label = %Prompt
@onready var _panel: PanelContainer = %ExplainPanel
@onready var _panel_title: Label = %ExplainTitle
@onready var _panel_body: Label = %ExplainBody
@onready var _status: Label = %StatusLine


func _ready() -> void:
	_prompt.visible = false
	_panel.visible = false
	_status.text = "%s · WASD/方向键移动 · E 交互 · Esc 返回标题" % SCOPE_NOTE
	for hotspot in get_tree().get_nodes_in_group("interactable"):
		_interaction.register(hotspot)
	_interaction.focus_changed.connect(_on_focus_changed)
	_interaction.focus_cleared.connect(_on_focus_cleared)
	_interaction.interaction_requested.connect(_on_interaction_requested)


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
	target_id: String, display_name: String, description: String
) -> void:
	if _panel.visible:
		return
	_panel_title.text = display_name
	_panel_body.text = "%s\n\n目标 ID：%s\n\nW0 占位：该目标尚未接入规则动作。W1–W3 之后，这里显示的成本、条件与结果全部来自 GameSession 的只读投影。" % [description, target_id]
	_panel.visible = true
	_prompt.visible = false
	_player.input_locked = true
	_interaction.enabled = false


func _close_panel() -> void:
	_panel.visible = false
	_player.input_locked = false
	_interaction.enabled = true
	# Standing still produces no new enter/exit event, so the prompt has to be
	# rebuilt explicitly instead of waiting for a signal that will never fire.
	_interaction.refocus()
