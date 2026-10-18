class_name RngVectorsSuite
extends RefCounted

const RNG = preload("res://domain/rng32.gd")
const CHECKS = preload("res://tests/suite_checks.gd")
const VECTORS: Array[Dictionary] = [
	{"seed": 0, "states": [1831565813, 3663131626, 1199730143], "numerators": [1144304738, 1416247, 958946056]},
	{"seed": 1, "states": [1831565814, 3663131627, 1199730144], "numerators": [2693262067, 11749833, 2265367787]},
	{"seed": 12185, "states": [1831577998, 3663143811, 1199742328], "numerators": [2499861155, 1810223824, 1374101062]},
	{"seed": 4294967295, "states": [1831565812, 3663131625, 1199730142], "numerators": [3850105811, 813802916, 3073704848]},
]


func run(_tree: SceneTree) -> Dictionary:
	var check := CHECKS.new()
	for vector: Dictionary in VECTORS:
		var generator := RNG.from_seed(vector.seed)
		check.expect(generator.state_after(3) == vector.states[2], "seed %d: batch state" % vector.seed)
		check.expect(generator.state == vector.seed, "batch prediction must not advance state")
		for index in range(3):
			var result: Dictionary = RNG.step(generator.state)
			check.expect(result.rng == vector.states[index], "seed %d draw %d: state" % [vector.seed, index + 1])
			check.expect(result.numerator == vector.numerators[index], "seed %d draw %d: numerator" % [vector.seed, index + 1])
			check.expect(result.value == vector.numerators[index] / 4294967296.0, "seed %d draw %d: value" % [vector.seed, index + 1])
			check.expect(generator.next_uint32() == vector.numerators[index], "instance draw must match portable step")
			check.expect(generator.state == vector.states[index], "instance must persist the advanced state")
	check.expect(not RNG.is_valid_state(-1), "negative uint32 rejected")
	check.expect(not RNG.is_valid_state(4294967296), "overflow uint32 rejected")
	check.expect(RNG.is_valid_state(0) and RNG.is_valid_state(4294967295), "uint32 endpoints accepted")
	check.expect(RNG.multiply_low32(4294967295, 4294967295) == 1, "full-width multiply wraps without int64 overflow")
	check.expect(RNG.multiply_low32(2147483648, 2) == 0, "sign-bit multiply wraps")
	var generator := RNG.from_seed(0)
	check.expect(generator.next_state() == 1831565813, "next_state advances only the persisted state")
	var value_generator := RNG.from_seed(0)
	check.expect(value_generator.next_random() == 1144304738 / 4294967296.0, "next_random returns the unit-interval value")
	return check.result()
