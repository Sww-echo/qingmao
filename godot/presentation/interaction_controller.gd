extends Node
## Resolves which world hotspot the avatar is standing on (W0).
##
## Presentation only. It decides *which* target is focused and forwards the
## request upward; it never decides whether an action is legal, what it costs or
## what it grants. Those answers belong to `Rules.validate` / `Rules.apply` once
## the domain layer lands in W2.
##
## Reaching a hotspot is free and settles nothing — the architecture plan calls
## this out explicitly, because "arrive in a scene and collect a reward" is the
## easiest way to smuggle rules into the view layer.

signal focus_changed(target_id: String, display_name: String, description: String)
signal focus_cleared()
signal interaction_requested(target_id: String, display_name: String, description: String)

## Cleared while a modal owns the input, so a queued key press cannot open a
## second panel behind the first.
var enabled := true

var _candidates: Array[Area2D] = []
var _focused: Area2D = null


## Subscribe to one hotspot. Safe to call before the avatar exists.
func register(area: Area2D) -> void:
	area.body_entered.connect(_on_body_entered.bind(area))
	area.body_exited.connect(_on_body_exited.bind(area))
	area.input_event.connect(_on_area_input_event.bind(area))


func _on_body_entered(body: Node2D, area: Area2D) -> void:
	if not body.is_in_group("player") or _candidates.has(area):
		return
	_candidates.append(area)
	_refresh()


func _on_body_exited(body: Node2D, area: Area2D) -> void:
	if not body.is_in_group("player"):
		return
	_candidates.erase(area)
	_refresh()


func _on_area_input_event(
	_viewport: Node, event: InputEvent, _shape_idx: int, area: Area2D
) -> void:
	if not enabled:
		return
	if event is InputEventMouseButton and event.pressed \
			and event.button_index == MOUSE_BUTTON_LEFT:
		get_viewport().set_input_as_handled()
		_emit_request(area)


func _unhandled_input(event: InputEvent) -> void:
	if not enabled or _focused == null:
		return
	if event.is_action_pressed("interact"):
		get_viewport().set_input_as_handled()
		_emit_request(_focused)


func _refresh() -> void:
	var next: Area2D = _candidates[0] if not _candidates.is_empty() else null
	if next == _focused:
		return
	_focused = next
	if _focused == null:
		focus_cleared.emit()
	else:
		focus_changed.emit(_focused.target_id, _focused.display_name, _focused.description)


## Re-emit the current focus. A modal that closes while the avatar stands still
## gets no new enter/exit event, so the prompt has to be rebuilt on demand
## rather than waiting for a signal that will never fire.
func refocus() -> void:
	if _focused == null:
		focus_cleared.emit()
	else:
		focus_changed.emit(_focused.target_id, _focused.display_name, _focused.description)


func _emit_request(area: Area2D) -> void:
	interaction_requested.emit(area.target_id, area.display_name, area.description)
