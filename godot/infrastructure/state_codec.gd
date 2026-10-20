class_name StateCodec
extends RefCounted
## Strict V1 interchange boundary; validation precedes every numeric conversion.

const MAX_SAFE: int = 9007199254740991
const UINT32_MAX: int = 4294967295
const FIELDS: PackedStringArray = [
	"scenarioId", "rulesVersion", "contentVersion", "seed", "rng", "rngDraws", "day",
	"actions", "location", "hp", "qi", "cultivation", "clues", "suspicion", "resources",
	"relations", "inventory", "upkeepDue", "flags", "exposures", "completedEvents",
	"missedEvents", "activeEvent", "combat", "crisis", "ending", "actionCounts", "ledger", "log",
]
const RESOURCES: PackedStringArray = ["stones", "herbs", "wine"]
const LOG_KINDS: PackedStringArray = [
	"event", "economy", "growth", "upkeep", "risk", "combat", "crisis", "management",
]


static func decode(value: Variant, catalog: ContentCatalog) -> Dictionary:
	if catalog == null:
		return _fail("state: content catalog is required")
	if not _is_supported(catalog):
		return _fail("state: unsupported content version")
	var error: String = _shape(value, FIELDS, "state")
	if not error.is_empty():
		return _fail(error)
	var data: Dictionary = value
	for key: String in ["scenarioId", "rulesVersion", "contentVersion"]:
		if not data[key] is String or data[key] != catalog.data[key]:
			return _fail("state.%s: incompatible version" % key)
	var parameters: Dictionary = catalog.parameters
	var limits: Dictionary = {
		"seed": [0, UINT32_MAX], "rng": [0, UINT32_MAX], "rngDraws": [0, MAX_SAFE],
		"day": [1, parameters["days"]], "actions": [0, parameters["actionsPerDay"]],
		"hp": [0, parameters["startingHp"]], "cultivation": [0, parameters["cultivationCap"]],
		"clues": [0, parameters["clueCap"]], "suspicion": [0, 100],
	}
	for key: String in limits:
		if not _integer(data[key], int(limits[key][0]), int(limits[key][1])):
			return _fail("state.%s: expected an integer in range" % key)
	var max_qi: int = int(parameters["startingQi"]) + (
		int(data["cultivation"]) / int(parameters["cultivationStep"])
	) * int(parameters["maxQiBonusPerStep"])
	if not _integer(data["qi"], 0, max_qi):
		return _fail("state.qi: expected an integer within current capacity")
	if not data["location"] is String or not catalog.has_id("locations", data["location"]):
		return _fail("state.location: unknown location")
	error = _shape(data["resources"], RESOURCES, "state.resources")
	if not error.is_empty():
		return _fail(error)
	for id: String in RESOURCES:
		var upper: int = 100000
		if id == "herbs":
			upper = int(parameters["herbCarryLimit"])
		elif id == "wine":
			upper = int(parameters["wineCarryLimit"])
		if not _integer(data["resources"][id], 0, upper):
			return _fail("state.resources.%s: expected an integer in range" % id)
	var relation_ids: PackedStringArray = []
	for relation: Dictionary in catalog.data["relations"]:
		relation_ids.append(relation["id"])
	error = _shape(data["relations"], relation_ids, "state.relations")
	if not error.is_empty():
		return _fail(error)
	for id: String in relation_ids:
		if not _integer(data["relations"][id], -100, 100):
			return _fail("state.relations.%s: expected an integer in range" % id)
	error = _inventory_error(data["inventory"], catalog)
	if not error.is_empty():
		return _fail(error)
	for pair: Array in [
		["upkeepDue", "gu"], ["completedEvents", "events"], ["missedEvents", "events"],
	]:
		error = _reference_array_error(data[pair[0]], catalog, pair[1], "state.%s" % pair[0])
		if not error.is_empty():
			return _fail(error)
	for id: String in data["upkeepDue"]:
		if not data["inventory"].has(id):
			return _fail("state.upkeepDue: Gu is not owned")
	for id: String in data["completedEvents"]:
		if data["missedEvents"].has(id):
			return _fail("state.missedEvents: completed event cannot also be missed")
	error = _flags_error(data["flags"], catalog)
	if not error.is_empty():
		return _fail(error)
	error = _exposures_error(data["exposures"], catalog, int(data["day"]))
	if not error.is_empty():
		return _fail(error)
	if data["activeEvent"] != null:
		if not data["activeEvent"] is String or not catalog.has_id("events", data["activeEvent"]):
			return _fail("state.activeEvent: expected null or a known event")
		if data["completedEvents"].has(data["activeEvent"]) or data["missedEvents"].has(data["activeEvent"]):
			return _fail("state.activeEvent: event is already closed")
	error = _combat_error(data["combat"], catalog)
	if not error.is_empty():
		return _fail(error)
	if not data["crisis"] is String or not ["approaching", "decision", "fighting", "resolved"].has(data["crisis"]):
		return _fail("state.crisis: unknown crisis phase")
	error = _ending_error(data["ending"])
	if not error.is_empty():
		return _fail(error)
	error = _counts_error(data["actionCounts"])
	if not error.is_empty():
		return _fail(error)
	error = _ledger_error(data["ledger"], int(data["day"]))
	if not error.is_empty():
		return _fail(error)
	error = _log_error(data["log"], int(data["day"]))
	if not error.is_empty():
		return _fail(error)
	return {"ok": true, "state": _from_validated(data)}


static func encode(state: GameState, catalog: ContentCatalog) -> Dictionary:
	if state == null:
		return _fail("state: model is required")
	var result: Dictionary = _to_data(state)
	if not result["ok"]:
		return result
	var checked: Dictionary = decode(result["data"], catalog)
	if not checked["ok"]:
		return checked
	return result


static func _is_supported(catalog: ContentCatalog) -> bool:
	var tuple: String = "%s|%s|%s" % [
		catalog.data.get("scenarioId", ""), catalog.data.get("rulesVersion", ""),
		catalog.data.get("contentVersion", ""),
	]
	return tuple == "qingmao-fourteen-day-prototype|prototype-rules-1|prototype-content-1" \
		or tuple == "qingmao-fourteen-day-v2|qingmao-rules-2|qingmao-content-2"


static func _shape(value: Variant, keys: PackedStringArray, path: String) -> String:
	if not value is Dictionary:
		return "%s: expected an object" % path
	if value.size() != keys.size():
		return "%s: missing or unknown fields" % path
	for key: String in keys:
		if not value.has(key):
			return "%s.%s: missing field" % [path, key]
	return ""


static func _integer(value: Variant, minimum: int, maximum: int) -> bool:
	if value is int:
		return value >= minimum and value <= maximum and value >= -MAX_SAFE and value <= MAX_SAFE
	if value is float:
		return is_finite(value) and value == floor(value) \
			and value >= minimum and value <= maximum and absf(value) <= MAX_SAFE
	return false


static func _text(value: Variant) -> bool:
	return value is String and not String(value).is_empty()


static func _inventory_error(value: Variant, catalog: ContentCatalog) -> String:
	if not value is Dictionary:
		return "state.inventory: expected an object"
	for id: Variant in value:
		if not id is String or not catalog.has_id("gu", id):
			return "state.inventory: unknown Gu"
		var error: String = _shape(value[id], ["mode", "equipped"], "state.inventory.%s" % id)
		if not error.is_empty():
			return error
		if not value[id]["mode"] is String or not ["active", "dormant", "sealed"].has(value[id]["mode"]):
			return "state.inventory.%s.mode: unknown Gu mode" % id
		if not value[id]["equipped"] is bool:
			return "state.inventory.%s.equipped: expected a boolean" % id
	return ""


static func _reference_array_error(value: Variant, catalog: ContentCatalog, section: String, path: String) -> String:
	if not value is Array:
		return "%s: expected an array" % path
	var seen: Dictionary = {}
	for id: Variant in value:
		if not id is String or not catalog.has_id(section, id):
			return "%s: unknown reference" % path
		if seen.has(id):
			return "%s: duplicate reference" % path
		seen[id] = true
	return ""


static func _flags_error(value: Variant, catalog: ContentCatalog) -> String:
	if not value is Array:
		return "state.flags: expected an array"
	var known: Dictionary = {"crisis-arrived": true, "patrol-cleared": true}
	if catalog.data.get("scenarioId") == "qingmao-fourteen-day-v2":
		known["inquiry-due"] = true
	for event: Dictionary in catalog.data["events"]:
		for choice: Dictionary in event["choices"]:
			for effect: Dictionary in choice["effects"]:
				if effect["kind"] == "flag":
					known[effect["id"]] = true
	var seen: Dictionary = {}
	for id: Variant in value:
		if not id is String or not known.has(id):
			return "state.flags: unknown flag"
		if seen.has(id):
			return "state.flags: duplicate flag"
		seen[id] = true
	return ""


static func _exposures_error(value: Variant, catalog: ContentCatalog, day: int) -> String:
	if not value is Array:
		return "state.exposures: expected an array"
	var seen: Dictionary = {}
	for entry: Variant in value:
		var error: String = _shape(entry, ["id", "source", "day"], "state.exposures[]")
		if not error.is_empty():
			return error
		if not entry["id"] is String or not catalog.has_id("exposures", entry["id"]):
			return "state.exposures[].id: unknown exposure"
		if seen.has(entry["id"]):
			return "state.exposures: duplicate exposure"
		seen[entry["id"]] = true
		if not _text(entry["source"]):
			return "state.exposures[].source: expected a nonempty string"
		if not _integer(entry["day"], 1, day):
			return "state.exposures[].day: expected an elapsed day"
	return ""


static func _combat_error(value: Variant, catalog: ContentCatalog) -> String:
	if value == null:
		return ""
	var error: String = _shape(value, ["enemyId", "purpose", "enemyHp", "turn", "guard", "herbsUsed", "wineUsed"], "state.combat")
	if not error.is_empty():
		return error
	if not value["enemyId"] is String or not catalog.has_id("enemies", value["enemyId"]):
		return "state.combat.enemyId: unknown enemy"
	if not value["purpose"] is String or not ["patrol", "survey", "crisis"].has(value["purpose"]):
		return "state.combat.purpose: unknown battle purpose"
	var enemy: Dictionary = catalog.by_id["enemies"][value["enemyId"]]
	if not _integer(value["enemyHp"], 1, int(enemy["hpMax"])):
		return "state.combat.enemyHp: expected remaining enemy HP"
	for key: String in ["turn", "guard"]:
		if not _integer(value[key], 0, MAX_SAFE):
			return "state.combat.%s: expected a nonnegative integer" % key
	for key: String in ["herbsUsed", "wineUsed"]:
		if not _integer(value[key], 0, 3):
			return "state.combat.%s: expected an integer from zero to three" % key
	return ""


static func _ending_error(value: Variant) -> String:
	if value == null:
		return ""
	var error: String = _shape(value, ["id", "outcome", "reasons"], "state.ending")
	if not error.is_empty():
		return error
	if not value["id"] is String or not ["held-the-line", "shelter-secured", "overrun", "lost-in-bamboo"].has(value["id"]):
		return "state.ending.id: unknown ending"
	if not value["outcome"] is String or not ["survived", "death"].has(value["outcome"]):
		return "state.ending.outcome: unknown outcome"
	var expected: String = "survived" if ["held-the-line", "shelter-secured"].has(value["id"]) else "death"
	if value["outcome"] != expected:
		return "state.ending.outcome: outcome does not match ending"
	if not value["reasons"] is Array:
		return "state.ending.reasons: expected an array"
	for reason: Variant in value["reasons"]:
		if not _text(reason):
			return "state.ending.reasons[]: expected a nonempty string"
	return ""


static func _counts_error(value: Variant) -> String:
	if not value is Dictionary:
		return "state.actionCounts: expected an object"
	for key: Variant in value:
		if not _text(key) or not _integer(value[key], 0, MAX_SAFE):
			return "state.actionCounts: expected named nonnegative integer counters"
		for index: int in range(String(key).length()):
			if String(key).unicode_at(index) > 127:
				return "state.actionCounts: counter keys must be ASCII"
	return ""


static func _ledger_error(value: Variant, day: int) -> String:
	if not value is Array:
		return "state.ledger: expected an array"
	for entry: Variant in value:
		var error: String = _shape(entry, ["day", "source", "resource", "amount"], "state.ledger[]")
		if not error.is_empty():
			return error
		if not _integer(entry["day"], 1, day):
			return "state.ledger[].day: expected an elapsed day"
		if not _text(entry["source"]):
			return "state.ledger[].source: expected a nonempty string"
		if not entry["resource"] is String or not RESOURCES.has(entry["resource"]):
			return "state.ledger[].resource: unknown resource"
		if not _integer(entry["amount"], -MAX_SAFE, MAX_SAFE):
			return "state.ledger[].amount: expected a safe integer"
	return ""


static func _log_error(value: Variant, day: int) -> String:
	if not value is Array:
		return "state.log: expected an array"
	for entry: Variant in value:
		var error: String = _shape(entry, ["day", "kind", "message"], "state.log[]")
		if not error.is_empty():
			return error
		if not _integer(entry["day"], 1, day):
			return "state.log[].day: expected an elapsed day"
		if not entry["kind"] is String or not LOG_KINDS.has(entry["kind"]):
			return "state.log[].kind: unknown log kind"
		if not _text(entry["message"]):
			return "state.log[].message: expected a nonempty string"
	return ""


static func _from_validated(data: Dictionary) -> GameState:
	var state := GameState.new()
	state.scenario_id = data["scenarioId"]
	state.rules_version = data["rulesVersion"]
	state.content_version = data["contentVersion"]
	state.seed = int(data["seed"])
	state.rng = int(data["rng"])
	state.rng_draws = int(data["rngDraws"])
	state.day = int(data["day"])
	state.actions = int(data["actions"])
	state.location = data["location"]
	state.hp = int(data["hp"])
	state.qi = int(data["qi"])
	state.cultivation = int(data["cultivation"])
	state.clues = int(data["clues"])
	state.suspicion = int(data["suspicion"])
	for id: String in data["resources"]:
		state.resources[id] = int(data["resources"][id])
	for id: String in data["relations"]:
		state.relations[id] = int(data["relations"][id])
	for id: String in data["inventory"]:
		var gu := GameState.GuState.new()
		gu.mode = data["inventory"][id]["mode"]
		gu.equipped = data["inventory"][id]["equipped"]
		state.inventory[id] = gu
	state.upkeep_due.assign(data["upkeepDue"])
	state.flags.assign(data["flags"])
	state.completed_events.assign(data["completedEvents"])
	state.missed_events.assign(data["missedEvents"])
	state.active_event = data["activeEvent"]
	state.crisis = data["crisis"]
	for entry: Dictionary in data["exposures"]:
		var exposure := GameState.ExposureState.new()
		exposure.id = entry["id"]
		exposure.source = entry["source"]
		exposure.day = int(entry["day"])
		state.exposures.append(exposure)
	if data["combat"] != null:
		var combat: Dictionary = data["combat"]
		state.combat = GameState.CombatState.new()
		state.combat.enemy_id = combat["enemyId"]
		state.combat.purpose = combat["purpose"]
		state.combat.enemy_hp = int(combat["enemyHp"])
		state.combat.turn = int(combat["turn"])
		state.combat.guard = int(combat["guard"])
		state.combat.herbs_used = int(combat["herbsUsed"])
		state.combat.wine_used = int(combat["wineUsed"])
	if data["ending"] != null:
		state.ending = GameState.EndingState.new()
		state.ending.id = data["ending"]["id"]
		state.ending.outcome = data["ending"]["outcome"]
		state.ending.reasons.assign(data["ending"]["reasons"])
	for key: String in data["actionCounts"]:
		state.action_counts[key] = int(data["actionCounts"][key])
	for entry: Dictionary in data["ledger"]:
		var ledger_entry := GameState.LedgerEntry.new()
		ledger_entry.day = int(entry["day"])
		ledger_entry.source = entry["source"]
		ledger_entry.resource = entry["resource"]
		ledger_entry.amount = int(entry["amount"])
		state.ledger.append(ledger_entry)
	for entry: Dictionary in data["log"]:
		var log_entry := GameState.LogEntry.new()
		log_entry.day = int(entry["day"])
		log_entry.kind = entry["kind"]
		log_entry.message = entry["message"]
		state.log.append(log_entry)
	return state


static func _to_data(state: GameState) -> Dictionary:
	for id: String in state.inventory:
		if state.inventory[id] == null:
			return _fail("state.inventory.%s: null Gu model" % id)
	for exposure: GameState.ExposureState in state.exposures:
		if exposure == null:
			return _fail("state.exposures[]: null model")
	for entry: GameState.LedgerEntry in state.ledger:
		if entry == null:
			return _fail("state.ledger[]: null model")
	for entry: GameState.LogEntry in state.log:
		if entry == null:
			return _fail("state.log[]: null model")
	return {"ok": true, "data": state.to_data()}


static func _fail(error: String) -> Dictionary:
	return {"ok": false, "error": error}
