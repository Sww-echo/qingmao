extends Area2D
## A world hotspot that carries a stable target id (W0).
##
## The id is the entire contract with the future rule layer: `academy.training`
## and friends will be mapped to rule actions or event previews by the
## interaction table, exactly as the architecture plan requires. This node holds
## no reward, no cost and no gate — reaching it must never settle anything.

## Stable logic id. Display text is never the key.
@export var target_id: String = ""
@export var display_name: String = ""
@export_multiline var description: String = ""


func _ready() -> void:
	add_to_group("interactable")
	if target_id.is_empty():
		push_warning("Interactable %s has no target_id; it cannot be dispatched." % name)
