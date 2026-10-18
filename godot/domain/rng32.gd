class_name Rng32
extends RefCounted
## Portable Mulberry32. State and products are always reduced to uint32.

const MASK: int = 0xffffffff
const INCREMENT: int = 0x6d2b79f5

var state: int = 0


static func is_valid_state(value: int) -> bool:
	return value >= 0 and value <= MASK


static func from_seed(seed: int) -> Rng32:
	assert(is_valid_state(seed), "seed must be a uint32 integer")
	var generator := Rng32.new()
	generator.state = seed
	return generator


static func multiply_low32(left: int, right: int) -> int:
	# The full uint32 product may overflow int64; only these low limbs matter.
	var low: int = (left & 0xffff) * (right & 0xffff)
	var cross: int = ((left >> 16) * (right & 0xffff) + (left & 0xffff) * (right >> 16)) & 0xffff
	return (low + (cross << 16)) & MASK


static func step(rng: int) -> Dictionary:
	assert(is_valid_state(rng), "rng must be a uint32 integer")
	var next_rng: int = (rng + INCREMENT) & MASK
	var value: int = multiply_low32(next_rng ^ (next_rng >> 15), next_rng | 1)
	value = (value ^ ((value + multiply_low32(value ^ (value >> 7), value | 61)) & MASK)) & MASK
	var numerator: int = (value ^ (value >> 14)) & MASK
	return {"rng": next_rng, "numerator": numerator, "value": numerator / 4294967296.0}


func next_state() -> int:
	state = (state + INCREMENT) & MASK
	return state


func next_uint32() -> int:
	var result: Dictionary = step(state)
	state = result.rng
	return result.numerator


func next_random() -> float:
	return next_uint32() / 4294967296.0


func state_after(steps: int) -> int:
	assert(steps >= 0, "steps must not be negative")
	var result: int = state
	for index in range(steps):
		result = (result + INCREMENT) & MASK
	return result
