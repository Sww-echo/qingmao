class_name V1Trace
extends RefCounted
## Development-only simulation and complete-state comparison helpers.


static func state_data(state: GameState, catalog: ContentCatalog) -> Dictionary:
	return StateCodec.encode(state, catalog)


static func simulate(strategy_id: String, seed: int, catalog: ContentCatalog) -> Dictionary:
	if not V1Policies.STRATEGIES.has(strategy_id):
		return {"ok": false, "error": "Unknown V1 strategy: " + strategy_id}
	var state: GameState = Rules.create(seed, catalog)
	if state == null:
		return {"ok": false, "error": "V1 initialization failed"}
	var initial: Dictionary = state_data(state, catalog)
	if not initial["ok"]:
		return initial
	var actions: Array[Dictionary] = []
	var steps: Array[Dictionary] = []
	while state.ending == null and steps.size() < 600:
		var view: Dictionary = Queries.public_view(state, catalog)
		var action: Dictionary = V1Policies.choose(strategy_id, view, catalog)
		if action.is_empty():
			return {"ok": false, "error": "Policy %s produced no action on day %d" % [strategy_id, state.day]}
		var applied: Dictionary = Rules.apply(state, action, catalog)
		if not applied["ok"]:
			return {"ok": false, "error": "Policy %s proposed an illegal action at step %d: %s" % [strategy_id, steps.size(), str(applied["error"])]}
		state = applied["state"]
		var snapshot: Dictionary = state_data(state, catalog)
		if not snapshot["ok"]:
			return snapshot
		actions.append(action.duplicate(true))
		steps.append({"action": action.duplicate(true), "state": snapshot["data"]})
	if state.ending == null:
		return {"ok": false, "error": "Policy %s exceeded 600 steps for seed %d" % [strategy_id, seed]}
	var final: Dictionary = state_data(state, catalog)
	if not final["ok"]:
		return final
	return {"ok": true, "trace": {
		"strategyId": strategy_id, "seed": seed, "initialState": initial["data"],
		"actions": actions, "steps": steps, "finalState": final["data"],
		"summary": V1Policies.summarize(state, catalog),
	}}


static func first_difference(expected: Variant, actual: Variant, path: String = "$") -> Dictionary:
	var expected_number: bool = expected is int or expected is float
	var actual_number: bool = actual is int or actual is float
	if expected_number and actual_number:
		return {} if expected == actual else {"path": path, "expected": expected, "actual": actual}
	if typeof(expected) != typeof(actual):
		return {"path": path, "expected": expected, "actual": actual}
	if expected is Dictionary:
		var keys: Array = expected.keys()
		for key: Variant in actual:
			if not expected.has(key):
				keys.append(key)
		keys.sort()
		for key: Variant in keys:
			var child_path: String = "%s.%s" % [path, str(key)]
			if not expected.has(key):
				return {"path": child_path, "expected": "<missing>", "actual": actual[key]}
			if not actual.has(key):
				return {"path": child_path, "expected": expected[key], "actual": "<missing>"}
			var difference: Dictionary = first_difference(expected[key], actual[key], child_path)
			if not difference.is_empty():
				return difference
		return {}
	if expected is Array:
		for index: int in mini(expected.size(), actual.size()):
			var difference: Dictionary = first_difference(expected[index], actual[index], "%s[%d]" % [path, index])
			if not difference.is_empty():
				return difference
		if expected.size() != actual.size():
			return {"path": path + ".length", "expected": expected.size(), "actual": actual.size()}
		return {}
	return {} if expected == actual else {"path": path, "expected": expected, "actual": actual}
