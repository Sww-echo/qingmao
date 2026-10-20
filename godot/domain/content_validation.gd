class_name ContentValidation
extends RefCounted
## Strict versioned content boundary. V1 is mirrored from the frozen TypeScript
## validator; V2 is the W6 schema with a deliberately small set of extensions.

const VERSIONS: Dictionary = {
	"scenarioId": "qingmao-fourteen-day-prototype",
	"rulesVersion": "prototype-rules-1",
	"contentVersion": "prototype-content-1",
}
const V2_VERSIONS: Dictionary = {
	"scenarioId": "qingmao-fourteen-day-v2",
	"rulesVersion": "qingmao-rules-2",
	"contentVersion": "qingmao-content-2",
}
const V2_PARAMETER_RANGES: Dictionary = {
	"inquiryThreshold": [1, 100],
	"phaseBreatherQi": [0, 100],
	"shelterRouteDiscount": [0, 100000],
	"shelterBuyoutMaxGap": [0, 2],
	"shelterBuyoutStonePerPoint": [1, 100000],
	"fortifyTurns": [0, 2],
	"fortifyDamageReduction": [0, 100],
}
const V2_NEW_EVENTS: PackedStringArray = [
	"patrol-overtime", "academy-drill", "inquiry", "route-review", "fortify",
	"market-herbs", "market-wine", "final-march", "final-freight",
]
const PARAMETER_NAMES: PackedStringArray = [
	"days", "actionsPerDay", "startingHp", "startingQi", "startingStones", "startingHerbs",
	"laborIncome", "trainingQi", "trainingGain", "liquorTrainingBonus", "cultivationCap",
	"cultivationStep", "maxQiBonusPerStep", "herbCarryLimit", "wineCarryLimit", "herbPrice",
	"winePrice", "herbHealing", "wineQi", "nightlyHealing", "suspicionDecay", "scoutQi",
	"clueCap", "sealCost", "wakeSealedCost", "wakeDormantCost", "clearExposureCost",
	"crisisThreatMin", "crisisThreatMax", "shelterCost", "retreatDamage", "retreatStoneLoss",
	"scoutProtection",
]
const RESOURCES: PackedStringArray = ["stones", "herbs", "wine"]

var _errors: PackedStringArray = []
var _ids: Dictionary = {}
var _flag_producers: Dictionary = {}
var _gu_producers: Dictionary = {}
var _event_requirements: Dictionary = {}
var _choice_data: Dictionary = {}
var _graph: Dictionary = {}


static func validate(value: Variant) -> PackedStringArray:
	return ContentValidation.new()._validate(value)


func _validate(content: Variant) -> PackedStringArray:
	_json(content, "content", [], 0)
	if not _errors.is_empty():
		return _errors
	if not content is Dictionary:
		_fail("content", "expected an object")
		return _errors
	if _tuple(content) == _tuple(V2_VERSIONS):
		return _validate_v2(content)
	if _tuple(content) != _tuple(VERSIONS):
		_fail("content", "unsupported content version tuple")
		return _errors
	return _validate_v1(content)


func _validate_v1(content: Variant) -> PackedStringArray:
	_keys(content, ["scenarioId", "rulesVersion", "contentVersion", "parameters", "locations", "gu", "relations", "exposures", "enemies", "events"], "content")
	var parameters: Dictionary = content.get("parameters", {}) if content.get("parameters") is Dictionary else {}
	if not content.get("parameters") is Dictionary:
		_fail("parameters", "expected an object")
	else:
		_keys(parameters, PARAMETER_NAMES, "parameters")
		for key in PARAMETER_NAMES:
			_number(parameters.get(key), "parameters." + key, 1)
		if parameters.get("days") != 14 or parameters.get("actionsPerDay") != 3:
			_fail("parameters", "P1 requires fourteen days and three actions per day")
		if _integer(parameters.get("crisisThreatMin")) and _integer(parameters.get("crisisThreatMax")) and parameters.crisisThreatMin > parameters.crisisThreatMax:
			_fail("parameters", "crisis threat range is reversed")
	var sections: Dictionary = {}
	for section in ["locations", "gu", "relations", "exposures", "enemies", "events"]:
		sections[section] = _indexed(content.get(section), section)
		_ids[section] = _ids_of(sections[section])
	_reference("unlicensed-survey", _ids.exposures, "exposures.SCOUT")
	var canonical_ids: Dictionary = {
		"locations": ["academy", "inn", "bamboo"],
		"gu": ["moonlight", "jade-skin", "ear-grass", "liquor-worm"],
		"relations": ["guard-captain", "innkeeper"],
		"enemies": ["scout-wolf", "crisis-pack"],
	}
	for section: String in canonical_ids:
		var expected: Array = canonical_ids[section]
		if sections[section].size() != expected.size() or not _contains_all(_ids[section], expected):
			_fail(section, "P1 requires exactly " + ", ".join(expected))
	if sections.events.size() < 12:
		_fail("events", "at least twelve independent events are required")
	_definitions(sections)
	for event: Dictionary in sections.events:
		_event(event)
	_crisis(sections.events)
	if not _errors.is_empty():
		return _errors
	_dependencies(sections.events)
	_monotone(sections.events, parameters)
	return _errors


func _validate_v2(content: Dictionary) -> PackedStringArray:
	_keys(content, ["scenarioId", "rulesVersion", "contentVersion", "parameters", "locations", "gu", "relations", "exposures", "enemies", "events"], "content")
	var parameters: Dictionary = content.get("parameters", {}) if content.get("parameters") is Dictionary else {}
	if not content.get("parameters") is Dictionary:
		_fail("parameters", "expected an object")
	else:
		var allowed: Array = PARAMETER_NAMES.duplicate()
		for key in V2_PARAMETER_RANGES:
			allowed.append(key)
		_keys(parameters, allowed, "parameters")
		for key in PARAMETER_NAMES:
			_number(parameters.get(key), "parameters." + key, 1)
		for key: String in V2_PARAMETER_RANGES:
			var bounds: Array = V2_PARAMETER_RANGES[key]
			_number(parameters.get(key), "parameters." + key, int(bounds[0]), int(bounds[1]))
		if parameters.get("days") != 14 or parameters.get("actionsPerDay") != 3:
			_fail("parameters", "V2 requires fourteen days and three actions per day")
		if _integer(parameters.get("crisisThreatMin")) and _integer(parameters.get("crisisThreatMax")) and parameters.crisisThreatMin > parameters.crisisThreatMax:
			_fail("parameters", "crisis threat range is reversed")
		if _integer(parameters.get("shelterRouteDiscount")) and _integer(parameters.get("crisisThreatMin")) and parameters.shelterRouteDiscount > parameters.crisisThreatMin:
			_fail("parameters.shelterRouteDiscount", "exceeds crisisThreatMin")
	var sections: Dictionary = {}
	for section in ["locations", "gu", "relations", "exposures", "enemies", "events"]:
		sections[section] = _indexed(content.get(section), section)
		_ids[section] = _ids_of(sections[section])
	var canonical: Dictionary = {
		"locations": ["academy", "inn", "bamboo"],
		"gu": ["moonlight", "jade-skin", "ear-grass", "liquor-worm"],
		"relations": ["guard-captain", "innkeeper"],
		"enemies": ["scout-wolf", "crisis-pack", "crisis-alpha"],
	}
	for section: String in canonical:
		var expected: Array = canonical[section]
		if sections[section].size() != expected.size() or not _contains_all(_ids[section], expected):
			_fail(section, "V2 requires exactly " + ", ".join(expected))
	if sections.events.size() != 28:
		_fail("events", "V2 requires exactly 28 events")
	for id in V2_NEW_EVENTS:
		if not _ids.events.has(id):
			_fail("events", "missing V2 event " + id)
	if sections.exposures.size() != 2 or not _contains_all(_ids.exposures, ["unlicensed-survey", "inquiry-unresolved"]):
		_fail("exposures", "V2 requires exactly unlicensed-survey and inquiry-unresolved")
	for item: Dictionary in sections.enemies:
		var path: String = "enemies." + str(item.get("id"))
		_keys(item, ["id", "name", "hpMin", "hpMax", "intents", "rewardStones", "next"], path)
		_string(item.get("name"), path + ".name")
		_number(item.get("hpMin"), path + ".hpMin", 1)
		_number(item.get("hpMax"), path + ".hpMax", 1)
		_number(item.get("rewardStones"), path + ".rewardStones")
		if _integer(item.get("hpMin")) and _integer(item.get("hpMax")) and item.hpMin > item.hpMax:
			_fail(path, "HP range is reversed")
		var intents: Array[Dictionary] = _list(item.get("intents"), path + ".intents")
		if intents.is_empty():
			_fail(path + ".intents", "at least one intent is required")
		for intent: Dictionary in intents:
			_keys(intent, ["label", "damage"], path + ".intents")
			_string(intent.get("label"), path + ".intent.label")
			_number(intent.get("damage"), path + ".intent.damage")
		if item.has("next"):
			if item.get("id") != "crisis-pack" or item.get("next") != "crisis-alpha":
				_fail(path + ".next", "only crisis-pack -> crisis-alpha is allowed")
	for event: Dictionary in sections.events:
		for choice: Dictionary in event.get("choices", []):
			for effect: Dictionary in choice.get("effects", []):
				if effect.get("kind") == "flag" and ["crisis-arrived", "inquiry-due"].has(effect.get("id")):
					_fail("events." + str(event.get("id")), "reserved engine flag " + str(effect.get("id")))
				if effect.get("kind") == "exposure" and effect.get("id") == "inquiry-unresolved":
					_fail("events." + str(event.get("id")), "inquiry-unresolved is engine-generated")
	# Reuse the frozen V1 validator on a detached V1-compatible shadow. V2-only
	# fields are checked above; this keeps schema, graph and monotone audits in
	# one place and guarantees the reused events keep V1 semantics.
	var shadow: Dictionary = content.duplicate(true)
	shadow.scenarioId = VERSIONS.scenarioId
	shadow.rulesVersion = VERSIONS.rulesVersion
	shadow.contentVersion = VERSIONS.contentVersion
	var shadow_parameters: Dictionary = {}
	for key in PARAMETER_NAMES:
		shadow_parameters[key] = parameters.get(key)
	shadow.parameters = shadow_parameters
	var shadow_enemies: Array = []
	for enemy: Dictionary in sections.enemies:
		if enemy.get("id") == "crisis-alpha":
			continue
		var copy: Dictionary = enemy.duplicate(true)
		copy.erase("next")
		shadow_enemies.append(copy)
	shadow.enemies = shadow_enemies
	var shadow_exposures: Array = []
	for exposure: Dictionary in sections.exposures:
		if exposure.get("id") == "inquiry-unresolved":
			continue
		shadow_exposures.append(exposure.duplicate(true))
	shadow.exposures = shadow_exposures
	var shadow_events: Array = []
	for event: Dictionary in sections.events:
		shadow_events.append(event.duplicate(true))
	shadow_events.append({
		"id": "engine-inquiry-root", "title": "engine inquiry root", "location": "academy",
		"fromDay": 1, "throughDay": 14, "actionCost": 0, "requirements": [],
		"description": "Synthetic engine producer used only for schema/graph validation.",
		"choices": [{"id": "emit", "label": "emit", "costs": {}, "requirements": [],
			"effects": [{"kind": "flag", "id": "inquiry-due"}], "risk": "engine only"}],
	})
	shadow.events = shadow_events
	var shadow_errors: PackedStringArray = ContentValidation.new()._validate_v1(shadow)
	for error in shadow_errors:
		_fail("v2-shadow", error)
	return _errors


static func _tuple(value: Dictionary) -> String:
	return "%s|%s|%s" % [value.get("scenarioId", ""), value.get("rulesVersion", ""), value.get("contentVersion", "")]


func _definitions(sections: Dictionary) -> void:
	for item: Dictionary in sections.locations:
		var path: String = "locations." + str(item.get("id"))
		_keys(item, ["id", "name", "description"], path)
		_string(item.get("name"), path + ".name")
		_string(item.get("description"), path + ".description")
	for item: Dictionary in sections.gu:
		var path: String = "gu." + str(item.get("id"))
		_keys(item, ["id", "name", "role", "upkeep", "qiCost", "power", "description"], path)
		_string(item.get("name"), path + ".name")
		_string(item.get("description"), path + ".description")
		if not ["attack", "guard", "scout", "growth"].has(item.get("role")):
			_fail(path + ".role", "unknown role")
		for key in ["upkeep", "qiCost", "power"]:
			_number(item.get(key), path + "." + key)
	for item: Dictionary in sections.relations:
		var path: String = "relations." + str(item.get("id"))
		_keys(item, ["id", "name", "purpose"], path)
		_string(item.get("name"), path + ".name")
		_string(item.get("purpose"), path + ".purpose")
	for item: Dictionary in sections.exposures:
		var path: String = "exposures." + str(item.get("id"))
		_keys(item, ["id", "source", "consequence", "remedy"], path)
		for key in ["source", "consequence", "remedy"]:
			_string(item.get(key), path + "." + key)
	for item: Dictionary in sections.enemies:
		var path: String = "enemies." + str(item.get("id"))
		_keys(item, ["id", "name", "hpMin", "hpMax", "intents", "rewardStones"], path)
		_string(item.get("name"), path + ".name")
		_number(item.get("hpMin"), path + ".hpMin", 1)
		_number(item.get("hpMax"), path + ".hpMax", 1)
		_number(item.get("rewardStones"), path + ".rewardStones")
		if _integer(item.get("hpMin")) and _integer(item.get("hpMax")) and item.hpMin > item.hpMax:
			_fail(path, "HP range is reversed")
		var intents: Array[Dictionary] = _list(item.get("intents"), path + ".intents")
		if intents.is_empty():
			_fail(path + ".intents", "at least one intent is required")
		for intent: Dictionary in intents:
			_keys(intent, ["label", "damage"], path + ".intents")
			_string(intent.get("label"), path + ".intent.label")
			_number(intent.get("damage"), path + ".intent.damage")


func _requirement(value: Dictionary, path: String) -> void:
	match value.get("kind"):
		"flag":
			_keys(value, ["kind", "id", "present"], path)
			_string(value.get("id"), path + ".id")
			_boolean(value.get("present"), path + ".present")
		"resource":
			_keys(value, ["kind", "id", "min"], path)
			_reference(value.get("id"), RESOURCES, path + ".id")
			_number(value.get("min"), path + ".min")
		"relation":
			_keys(value, ["kind", "id", "min"], path)
			_reference(value.get("id"), _ids.relations, path + ".id")
			_number(value.get("min"), path + ".min", -100, 100)
		"cultivation", "clues":
			_keys(value, ["kind", "min"], path)
			_number(value.get("min"), path + ".min")
		"gu":
			_keys(value, ["kind", "id", "usable"], path)
			_reference(value.get("id"), _ids.gu, path + ".id")
			_boolean(value.get("usable"), path + ".usable")
		"exposure":
			_keys(value, ["kind", "id"], path)
			_reference(value.get("id"), _ids.exposures, path + ".id")
		_:
			_fail(path, "unknown requirement kind " + str(value.get("kind")))


func _effect(value: Dictionary, path: String, event_id: String) -> void:
	match value.get("kind"):
		"resource":
			_keys(value, ["kind", "id", "amount"], path)
			_reference(value.get("id"), RESOURCES, path + ".id")
			_number(value.get("amount"), path + ".amount")
		"relation":
			_keys(value, ["kind", "id", "amount"], path)
			_reference(value.get("id"), _ids.relations, path + ".id")
			_number(value.get("amount"), path + ".amount", -100, 100)
		"clues", "hp", "qi", "suspicion":
			_keys(value, ["kind", "amount"], path)
			_number(value.get("amount"), path + ".amount", -100, 100)
		"flag", "gu":
			_keys(value, ["kind", "id"], path)
			_string(value.get("id"), path + ".id")
			if value.kind == "gu":
				_reference(value.get("id"), _ids.gu, path + ".id")
			if value.get("id") is String:
				var producers: Dictionary = _gu_producers if value.kind == "gu" else _flag_producers
				var entries: Array = producers.get(value.id, [])
				if not entries.has(event_id):
					entries.append(event_id)
				producers[value.id] = entries
		"exposure":
			_keys(value, ["kind", "id", "source"], path)
			_reference(value.get("id"), _ids.exposures, path + ".id")
			_string(value.get("source"), path + ".source")
		"battle":
			_keys(value, ["kind", "enemyId", "purpose"], path)
			_reference(value.get("enemyId"), _ids.enemies, path + ".enemyId")
			if value.get("enemyId") != "scout-wolf" or value.get("purpose") != "patrol":
				_fail(path, "only the defined patrol battle effect is supported")
		"crisis":
			_keys(value, ["kind", "response"], path)
			if not ["fight", "shelter"].has(value.get("response")):
				_fail(path, "unknown crisis response")
			if event_id != "crisis-arrival":
				_fail(path, "crisis resolution must belong to crisis-arrival")
		_:
			_fail(path, "unknown effect kind " + str(value.get("kind")))


func _event(event: Dictionary) -> void:
	var id: String = str(event.get("id"))
	var path: String = "events." + id
	_keys(event, ["id", "title", "location", "fromDay", "throughDay", "actionCost", "requirements", "description", "choices"], path)
	_string(event.get("title"), path + ".title")
	_string(event.get("description"), path + ".description")
	_reference(event.get("location"), _ids.locations, path + ".location")
	_number(event.get("fromDay"), path + ".fromDay", 1, 14)
	_number(event.get("throughDay"), path + ".throughDay", 1, 14)
	if _integer(event.get("fromDay")) and _integer(event.get("throughDay")) and event.fromDay > event.throughDay:
		_fail(path, "event window is reversed")
	_number(event.get("actionCost"), path + ".actionCost", 0, 3)
	var requirements: Array[Dictionary] = _list(event.get("requirements"), path + ".requirements")
	for item: Dictionary in requirements:
		_requirement(item, path + ".requirements")
	_event_requirements[id] = requirements
	var choices: Array[Dictionary] = _indexed(event.get("choices"), path + ".choices")
	if choices.is_empty():
		_fail(path + ".choices", "an event must have a meaningful choice")
	var parsed_choices: Array[Dictionary] = []
	for choice: Dictionary in choices:
		var choice_path: String = path + ".choices." + str(choice.get("id"))
		_keys(choice, ["id", "label", "costs", "requirements", "effects", "risk"], choice_path)
		_string(choice.get("label"), choice_path + ".label")
		_string(choice.get("risk"), choice_path + ".risk")
		if not choice.get("costs") is Dictionary:
			_fail(choice_path + ".costs", "expected an object")
		else:
			_keys(choice.costs, ["stones", "herbs", "wine", "qi"], choice_path + ".costs")
			for resource: String in choice.costs:
				_number(choice.costs[resource], choice_path + ".costs." + resource)
		var choice_requirements: Array[Dictionary] = _list(choice.get("requirements"), choice_path + ".requirements")
		for item: Dictionary in choice_requirements:
			_requirement(item, choice_path + ".requirements")
		var effects: Array[Dictionary] = _list(choice.get("effects"), choice_path + ".effects")
		if effects.is_empty():
			_fail(choice_path + ".effects", "empty reward/decision")
		for item: Dictionary in effects:
			_effect(item, choice_path + ".effects", id)
		parsed_choices.append({"requirements": choice_requirements, "effects": effects})
	_choice_data[id] = parsed_choices


func _crisis(events: Array) -> void:
	var crisis: Dictionary = _find(events, "crisis-arrival")
	if crisis.is_empty():
		_fail("events", "missing engine-required crisis-arrival event")
	else:
		if crisis.get("fromDay") != 14 or crisis.get("throughDay") != 14 or crisis.get("actionCost") != 0:
			_fail("events.crisis-arrival", "the forced final decision must be free and available on day fourteen")
		var requirements: Array = _event_requirements.get("crisis-arrival", [])
		if requirements.size() != 1 or requirements[0].get("kind") != "flag" or requirements[0].get("id") != "crisis-arrived" or requirements[0].get("present") != true:
			_fail("events.crisis-arrival", "only the engine-generated arrival flag may gate the forced final decision")
		var stand: Dictionary = _find(crisis.get("choices", []) if crisis.get("choices") is Array else [], "stand")
		var valid: bool = not stand.is_empty() and stand.get("costs") is Dictionary and stand.get("requirements") is Array and stand.get("effects") is Array
		if valid:
			for cost: Variant in stand.costs.values():
				if cost != 0:
					valid = false
			valid = valid and stand.requirements.is_empty() and stand.effects.size() == 1
			if valid:
				valid = stand.effects[0] is Dictionary and stand.effects[0].get("kind") == "crisis" and stand.effects[0].get("response") == "fight"
		if not valid:
			_fail("events.crisis-arrival", "stand must be an unconditional, free fight response")
	if _flag_producers.has("crisis-arrived"):
		_fail("events", "crisis-arrived is reserved for END_DAY")


func _dependencies(events: Array) -> void:
	for event: Dictionary in events:
		var id: String = str(event.get("id"))
		var base: Array = _event_requirements.get(id, [])
		var choices: Array = _choice_data.get(id, [])
		var requirements: Array = base.duplicate()
		var mandatory: Dictionary = {}
		for req: Dictionary in base:
			var key: String = _dependency_key(req)
			if not key.is_empty():
				mandatory[key] = true
		for choice: Dictionary in choices:
			requirements.append_array(choice.requirements)
		# OR alternatives are mandatory only when every choice shares the gate.
		if not choices.is_empty():
			for req: Dictionary in choices[0].requirements:
				var key: String = _dependency_key(req)
				if key.is_empty():
					continue
				var shared: bool = true
				for choice: Dictionary in choices:
					var found: bool = false
					for candidate: Dictionary in choice.requirements:
						if _dependency_key(candidate) == key:
							found = true
					shared = shared and found
				if shared:
					mandatory[key] = true
		var dependencies: Dictionary = {}
		for req: Dictionary in requirements:
			var kind: Variant = req.get("kind")
			if kind != "gu" and not (kind == "flag" and req.get("present") == true):
				continue
			if kind == "flag" and req.get("id") == "crisis-arrived":
				continue
			var producers: Array = (_gu_producers if kind == "gu" else _flag_producers).get(str(req.get("id")), [])
			if producers.is_empty():
				_fail("events." + id, "missing producer for " + str(req.get("id")))
			elif producers.size() == 1:
				if mandatory.has(_dependency_key(req)):
					dependencies[producers[0]] = true
				var producer: Dictionary = _find(events, producers[0])
				if not producer.is_empty() and _integer(producer.get("fromDay")) and _integer(event.get("throughDay")) and producer.fromDay > event.throughDay:
					_fail("events." + id, "producer %s opens after this window closes" % producers[0])
		_graph[id] = dependencies
	var visited: Dictionary = {}
	var stack: Dictionary = {}
	for id: String in _graph:
		_visit(id, visited, stack)


func _visit(id: String, visited: Dictionary, stack: Dictionary) -> void:
	if stack.has(id):
		_fail("events." + id, "cyclic mandatory flag/gu dependency")
		return
	if visited.has(id):
		return
	stack[id] = true
	for dependency: String in _graph.get(id, {}):
		_visit(dependency, visited, stack)
	stack.erase(id)
	visited[id] = true


func _monotone(events: Array, parameters: Dictionary) -> void:
	var reachable: Dictionary = {}
	var flags: Dictionary = {"crisis-arrived": true}
	var owned: Dictionary = {}
	var relation_maximum: Dictionary = {}
	var clue_maximum: int = 0
	for pass_index in range(events.size()):
		var progress: bool = false
		for event: Dictionary in events:
			var id: String = str(event.get("id"))
			if reachable.has(id) or not _can_meet_all(_event_requirements.get(id, []), flags, owned, relation_maximum, clue_maximum, parameters):
				continue
			var choices: Array[Dictionary] = []
			for choice: Dictionary in _choice_data.get(id, []):
				if _can_meet_all(choice.requirements, flags, owned, relation_maximum, clue_maximum, parameters):
					choices.append(choice)
			if choices.is_empty():
				continue
			reachable[id] = true
			progress = true
			var increments: Dictionary = {}
			var clue_increment: int = 0
			for choice: Dictionary in choices:
				var choice_relation: Dictionary = {}
				var choice_clues: int = 0
				for item: Dictionary in choice.effects:
					var item_id: String = str(item.get("id"))
					var amount: int = int(item.get("amount", 0))
					match item.get("kind"):
						"flag":
							flags[item_id] = true
						"gu":
							owned[item_id] = true
						"relation":
							choice_relation[item_id] = choice_relation.get(item_id, 0) + maxi(0, amount)
						"clues":
							choice_clues += maxi(0, amount)
						"battle":
							choice_relation["guard-captain"] = choice_relation.get("guard-captain", 0) + 3
				clue_increment = maxi(clue_increment, choice_clues)
				for relation: String in choice_relation:
					increments[relation] = maxi(increments.get(relation, 0), choice_relation[relation])
			clue_maximum += clue_increment
			clue_maximum = maxi(clue_maximum, int(parameters.get("clueCap", 0)))
			for relation: String in increments:
				relation_maximum[relation] = mini(100, relation_maximum.get(relation, 0) + increments[relation])
		if not progress:
			break
	for event: Dictionary in events:
		if not reachable.has(str(event.get("id"))):
			_fail("events." + str(event.get("id")), "unreachable requirement chain in monotone audit")


func _can_meet_all(requirements: Array, flags: Dictionary, owned: Dictionary, relations: Dictionary, clues: int, parameters: Dictionary) -> bool:
	for req: Dictionary in requirements:
		var id: String = str(req.get("id"))
		var minimum: Variant = req.get("min", 0)
		match req.get("kind"):
			"flag":
				if req.get("present") != false and not flags.has(id):
					return false
			"gu":
				if not owned.has(id):
					return false
			"relation":
				if not _integer(minimum, -100000, 100000) or relations.get(id, 0) < minimum:
					return false
			"clues":
				if not _integer(minimum) or clues < minimum:
					return false
			"cultivation":
				if not _integer(minimum) or parameters.is_empty() or minimum > parameters.get("cultivationCap", 0):
					return false
			"exposure":
				if not _ids.exposures.has(id):
					return false
			"resource":
				pass
			_:
				return false
	return true


func _json(value: Variant, path: String, ancestors: Array, depth: int) -> void:
	if value == null or value is bool:
		return
	if value is String:
		for index in range(value.length()):
			var code: int = value.unicode_at(index)
			if code < 32:
				_fail(path, "content strings must not contain control characters")
				break
		return
	if typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT:
		if not _integer(value, -100000, 100000):
			_fail(path, "expected a bounded finite integer")
		return
	if not value is Dictionary and not value is Array:
		_fail(path, "expected plain JSON data")
		return
	for ancestor: Variant in ancestors:
		if is_same(value, ancestor):
			_fail(path, "cyclic object")
			return
	if depth >= 128:
		_fail(path, "JSON nesting exceeds 128 levels")
		return
	var next_ancestors: Array = ancestors.duplicate()
	next_ancestors.append(value)
	if value is Array:
		for index in range(value.size()):
			_json(value[index], path + "." + str(index), next_ancestors, depth + 1)
	else:
		for key: Variant in value:
			if not key is String:
				_fail(path, "object keys must be ASCII strings")
				continue
			if key.is_empty():
				_fail(path, "object keys must be printable ASCII strings")
			for index in range(key.length()):
				var code: int = key.unicode_at(index)
				if code < 32 or code > 126:
					_fail(path, "object keys must be printable ASCII strings")
					break
			_json(value[key], path + "." + key, next_ancestors, depth + 1)


func _list(value: Variant, path: String) -> Array[Dictionary]:
	var objects: Array[Dictionary] = []
	if not value is Array:
		_fail(path, "expected an array")
		return objects
	for index in range(value.size()):
		if not value[index] is Dictionary:
			_fail("%s[%d]" % [path, index], "expected an object")
		else:
			objects.append(value[index])
	return objects


func _indexed(value: Variant, path: String) -> Array[Dictionary]:
	var items: Array[Dictionary] = _list(value, path)
	var ids: Dictionary = {}
	for index in range(items.size()):
		var id: Variant = items[index].get("id")
		_string(id, "%s[%d].id" % [path, index])
		if id is String:
			if ids.has(id):
				_fail(path, "duplicate ID " + id)
			ids[id] = true
	return items


static func _ids_of(items: Array) -> Dictionary:
	var result: Dictionary = {}
	for item: Dictionary in items:
		if item.get("id") is String:
			result[item.id] = true
	return result


static func _find(items: Array, id: String) -> Dictionary:
	for item: Variant in items:
		if item is Dictionary and item.get("id") == id:
			return item
	return {}


static func _contains_all(ids: Dictionary, expected: Array) -> bool:
	for id: String in expected:
		if not ids.has(id):
			return false
	return true


static func _dependency_key(req: Dictionary) -> String:
	if req.get("kind") == "gu":
		return "gu:" + str(req.get("id"))
	if req.get("kind") == "flag" and req.get("present") == true:
		return "flag:" + str(req.get("id"))
	return ""


func _keys(value: Dictionary, allowed: Variant, path: String) -> void:
	for key: String in value:
		if not allowed.has(key):
			_fail(path, "unknown field " + key)


func _string(value: Variant, path: String) -> void:
	if not value is String or value.is_empty():
		_fail(path, "expected a nonempty string")


func _boolean(value: Variant, path: String) -> void:
	if not value is bool:
		_fail(path, "expected a boolean")


func _number(value: Variant, path: String, minimum: int = 0, maximum: int = 100000) -> void:
	if not _integer(value, minimum, maximum):
		_fail(path, "expected integer %d..%d" % [minimum, maximum])


static func _integer(value: Variant, minimum: int = 0, maximum: int = 100000) -> bool:
	return (typeof(value) == TYPE_INT or typeof(value) == TYPE_FLOAT) and is_finite(value) and value == floor(value) and value >= minimum and value <= maximum


func _reference(value: Variant, ids: Variant, path: String) -> void:
	if not value is String or not ids.has(value):
		_fail(path, "unknown reference " + str(value))


func _fail(path: String, message: String) -> void:
	var error: String = path + ": " + message
	if not _errors.has(error):
		_errors.append(error)
