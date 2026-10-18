extends CharacterBody2D
## Placeholder explorer avatar (W0).
##
## Movement is pure presentation. It consumes no daily action, draws no
## randomness and never mutates rule state — the architecture plan keeps every
## authoritative field in `GameSession` (W3) and forbids scenes from holding a
## second copy of the truth.

const SPEED := 240.0

## Set by the location screen while a modal panel owns the input. A locked
## avatar stops moving but is never removed from the scene, so unlocking cannot
## teleport or re-trigger an interaction.
var input_locked := false


func _ready() -> void:
	add_to_group("player")


func _physics_process(_delta: float) -> void:
	if input_locked:
		velocity = Vector2.ZERO
		move_and_slide()
		return
	velocity = Input.get_vector("move_left", "move_right", "move_up", "move_down") * SPEED
	move_and_slide()
