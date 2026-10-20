class_name ContentValidationSuite
extends RefCounted

const VALIDATOR = preload("res://domain/content_validation.gd")
const CATALOG = preload("res://domain/content_catalog.gd")
const LOADER = preload("res://infrastructure/content_loader.gd")
const CHECKS = preload("res://tests/suite_checks.gd")
const CONTENT_PATH: String = "res://content/generated/prototype/content.json"


func run(_tree: SceneTree) -> Dictionary:
	var check := CHECKS.new()
	var file := FileAccess.open(CONTENT_PATH, FileAccess.READ)
	if not check.expect(file != null, "frozen content is synchronized"):
		return check.result()
	var parser := JSON.new()
	if not check.expect(parser.parse(file.get_as_text()) == OK and parser.data is Dictionary, "frozen content parses as an object"):
		return check.result()
	var content: Dictionary = parser.data
	var errors: PackedStringArray = VALIDATOR.validate(content)
	if not check.expect(errors.is_empty(), "frozen V1 content accepted: " + "; ".join(errors)):
		return check.result()
	var catalog := CATALOG.new(content)
	check.expect(catalog.has_id("events", "crisis-arrival"), "catalog indexes event IDs")
	check.expect(catalog.has_id("gu", "moonlight"), "catalog indexes Gu IDs")
	check.expect(not catalog.has_id("enemies", "crisis-alpha"), "V1 catalog has no V2 enemy")
	check.expect(not catalog.has_id("unknown", "moonlight"), "unknown catalog sections are safe")
	var detached: Dictionary = content.duplicate(true)
	var detached_catalog := CATALOG.new(detached)
	detached.parameters.days = 99
	check.expect(detached_catalog.parameters.days == 14, "catalog copies source content")
	var definition: Dictionary = detached_catalog.definition("events", "briefing")
	definition.title = "changed"
	check.expect(detached_catalog.definition("events", "briefing").title != "changed", "definition query returns a detached value")
	_simple_negatives(check, content)
	_graph_cases(check, content)
	var loaded: Dictionary = LOADER.load_pack("prototype")
	check.expect(loaded.ok, "ContentLoader accepts and verifies bundled prototype content")
	if loaded.ok:
		check.expect(loaded.content_sha256.length() == 64, "ContentLoader reports the content SHA256")
	var v2: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://content/generated/qingmao14-v2/content.json"))
	var v2_errors: PackedStringArray = VALIDATOR.validate(v2)
	check.expect(v2_errors.is_empty(), "frozen V2 content accepted: " + "; ".join(v2_errors))
	_v2_negatives(check, v2)
	var loaded_v2: Dictionary = LOADER.load_pack("qingmao14-v2")
	check.expect(loaded_v2.ok, "ContentLoader accepts and verifies bundled V2 content")
	if loaded_v2.ok:
		check.expect(loaded_v2.catalog.is_v2() and loaded_v2.catalog.data.events.size() == 28,
			"V2 catalog exposes 28 events and V2 versions")
		check.expect(loaded_v2.catalog.has_id("enemies", "crisis-alpha"), "V2 catalog has the phase-two enemy")
	var verified: Dictionary = LOADER.verify_all()
	check.expect(verified.ok and verified.get("packs", []).size() == 2, "all bundled packs verify")
	return check.result()


func _simple_negatives(check: RefCounted, original: Dictionary) -> void:
	_reject(check, [], "top-level array")
	_reject(check, null, "top-level null")
	var content: Dictionary = original.duplicate(true)
	content.rulesVersion = "qingmao-rules-2"
	_reject(check, content, "unknown version tuple", "unsupported content version")
	content = original.duplicate(true)
	content["script"] = "not executable"
	_reject(check, content, "unknown top-level field", "unknown field")
	content = original.duplicate(true)
	content.parameters["inquiryThreshold"] = 4
	_reject(check, content, "V2 parameter under V1", "unknown field")
	content = original.duplicate(true)
	content.parameters.erase("startingHp")
	_reject(check, content, "missing parameter")
	content = original.duplicate(true)
	content.parameters.days = 13
	_reject(check, content, "changed fourteen-day boundary")
	content = original.duplicate(true)
	content.parameters.laborIncome = 0.5
	_reject(check, content, "fractional parameter")
	content = original.duplicate(true)
	content.parameters.laborIncome = true
	_reject(check, content, "boolean parameter")
	content = original.duplicate(true)
	content.parameters.crisisThreatMin = 20
	content.parameters.crisisThreatMax = 10
	_reject(check, content, "reversed crisis range")
	content = original.duplicate(true)
	content.locations[1].id = content.locations[0].id
	_reject(check, content, "duplicate definition ID", "duplicate ID")
	content = original.duplicate(true)
	var alpha: Dictionary = content.enemies[1].duplicate(true)
	alpha.id = "crisis-alpha"
	content.enemies.append(alpha)
	_reject(check, content, "V2 enemy under V1")
	content = original.duplicate(true)
	content.enemies[1]["next"] = "crisis-alpha"
	_reject(check, content, "V2 next link under V1", "unknown field")
	content = original.duplicate(true)
	content.enemies[0].hpMin = content.enemies[0].hpMax + 1
	_reject(check, content, "reversed enemy HP range")
	content = original.duplicate(true)
	content.enemies[0].intents = []
	_reject(check, content, "missing enemy intent")
	content = original.duplicate(true)
	content.exposures = []
	_reject(check, content, "missing engine-created SCOUT exposure", "exposures.SCOUT")
	content = original.duplicate(true)
	content.events[0].location = "market"
	_reject(check, content, "unknown event location")
	content = original.duplicate(true)
	content.events[0].requirements.append({"kind": "script", "code": "anything"})
	_reject(check, content, "unknown requirement discriminant")
	content = original.duplicate(true)
	content.events[0].requirements.append({"kind": "gu", "id": "unknown", "usable": true})
	_reject(check, content, "unknown Gu reference")
	content = original.duplicate(true)
	content.events[0].requirements.append({"kind": "exposure", "id": "inquiry-unresolved"})
	_reject(check, content, "V2 exposure under V1")
	content = original.duplicate(true)
	content.events[0].choices[0].effects = []
	_reject(check, content, "empty event decision")
	content = original.duplicate(true)
	content.events[0].choices[0].effects = [{"kind": "battle", "enemyId": "crisis-pack", "purpose": "crisis"}]
	_reject(check, content, "unsupported battle effect")
	content = original.duplicate(true)
	content.events[0].choices[0].costs = {"stones": -1}
	_reject(check, content, "negative choice cost")
	content = original.duplicate(true)
	content.events[0].choices[0].effects.append({"kind": "flag", "id": "crisis-arrived"})
	_reject(check, content, "forged engine flag", "reserved for END_DAY")
	content = original.duplicate(true)
	content.events[0].throughDay = 0
	_reject(check, content, "out-of-range window")
	content = original.duplicate(true)
	var crisis: Dictionary = _find_event(content, "crisis-arrival")
	crisis.choices[0].costs = {"stones": 1}
	_reject(check, content, "forced stand must be free", "stand must be")
	content = original.duplicate(true)
	crisis = _find_event(content, "crisis-arrival")
	crisis.requirements.append({"kind": "resource", "id": "stones", "min": 1})
	_reject(check, content, "forced decision cannot have an extra gate")
	content = original.duplicate(true)
	content.events.erase(_find_event(content, "crisis-arrival"))
	_reject(check, content, "missing forced crisis")
	content = original.duplicate(true)
	content.locations[0].description += "\n"
	_reject(check, content, "content control character")
	content = original.duplicate(true)
	content["非ASCII"] = 1
	_reject(check, content, "non-ASCII key")
	content = original.duplicate(true)
	content.parameters.laborIncome = 100001
	_reject(check, content, "oversized numeric value")
	var cycle: Dictionary = {}
	cycle.self = cycle
	_reject(check, cycle, "cyclic plain JSON object")
	cycle.clear()
	content = original.duplicate(true)
	content.events[0].choices[0].effects[0].id = {"not": "a string"}
	_reject(check, content, "malformed effect ID does not crash graph audit")
	content = original.duplicate(true)
	content.events[0].choices[0].effects = [{"kind": "relation", "id": "innkeeper", "amount": {}}]
	_reject(check, content, "malformed effect amount does not crash monotone audit")


func _v2_negatives(check: RefCounted, original: Dictionary) -> void:
	var content: Dictionary = original.duplicate(true)
	content.scenarioId = "qingmao-fourteen-day-prototype"
	content.rulesVersion = "prototype-rules-1"
	content.contentVersion = "prototype-content-1"
	_reject(check, content, "V2 content with a V1 tuple")
	content = original.duplicate(true)
	content.parameters.erase("inquiryThreshold")
	_reject(check, content, "V2 missing a new parameter", "inquiryThreshold")
	content = original.duplicate(true)
	content.parameters.inquiryThreshold = 1.5
	_reject(check, content, "V2 fractional threshold")
	content = original.duplicate(true)
	content.parameters.fortifyTurns = 3
	_reject(check, content, "V2 out-of-range fortify turns")
	content = original.duplicate(true)
	content.enemies.pop_back()
	_reject(check, content, "V2 missing the phase-two enemy")
	content = original.duplicate(true)
	_find_enemy(content, "crisis-pack")["next"] = "missing-enemy"
	_reject(check, content, "V2 next points at an unknown enemy")
	content = original.duplicate(true)
	_find_enemy(content, "crisis-alpha")["next"] = "crisis-pack"
	_reject(check, content, "V2 terminal phase chains back")
	content = original.duplicate(true)
	content.exposures.pop_back()
	_reject(check, content, "V2 missing the inquiry exposure")
	content = original.duplicate(true)
	_find_event(content, "briefing").choices[0].effects.append({"kind": "flag", "id": "crisis-arrived"})
	_reject(check, content, "V2 content forges a reserved arrival flag")
	content = original.duplicate(true)
	_find_event(content, "briefing").choices[0].effects.append({"kind": "exposure", "id": "inquiry-unresolved", "source": "forged"})
	_reject(check, content, "V2 content forges the inquiry exposure")
	content = original.duplicate(true)
	_find_enemy(content, "crisis-alpha").hpMin = _find_enemy(content, "crisis-alpha").hpMax + 1
	_reject(check, content, "V2 reversed phase-two HP")
	content = original.duplicate(true)
	_find_event(content, "final-march").choices[0].requirements = []
	_find_event(content, "final-freight").choices[0].requirements = []
	# Mutual exclusion is a content contract; removing it must still pass schema
	# but is checked explicitly here as a regression guard.
	var errors: PackedStringArray = VALIDATOR.validate(content)
	check.expect(errors.is_empty(), "schema alone does not encode the final duty exclusivity")
	check.expect(_find_event(original, "final-march").choices[0].requirements[0].present == false,
		"final-march excludes final-freight")
	check.expect(_find_event(original, "final-freight").choices[0].requirements[0].present == false,
		"final-freight excludes final-march")

func _find_enemy(content: Dictionary, id: String) -> Dictionary:
	for enemy: Dictionary in content.enemies:
		if enemy.id == id:
			return enemy
	return {}

func _graph_cases(check: RefCounted, original: Dictionary) -> void:
	var content: Dictionary = original.duplicate(true)
	content.events.append(_event("missing-producer", [{"kind": "flag", "id": "never-produced", "present": true}], [{"kind": "flag", "id": "unrelated"}]))
	_reject(check, content, "missing producer", "missing producer")
	content = original.duplicate(true)
	content.events.append(_event("cycle-a", [{"kind": "flag", "id": "cycle-b", "present": true}], [{"kind": "flag", "id": "cycle-a"}]))
	content.events.append(_event("cycle-b", [{"kind": "flag", "id": "cycle-a", "present": true}], [{"kind": "flag", "id": "cycle-b"}]))
	_reject(check, content, "mandatory two-event cycle", "cyclic mandatory")
	content = original.duplicate(true)
	var late: Dictionary = _event("late-producer", [], [{"kind": "flag", "id": "late-token"}])
	late.fromDay = 10
	var early: Dictionary = _event("early-consumer", [{"kind": "flag", "id": "late-token", "present": true}], [{"kind": "flag", "id": "early-done"}])
	early.throughDay = 3
	content.events.append(late)
	content.events.append(early)
	_reject(check, content, "producer opens after consumer closes", "opens after")
	content = original.duplicate(true)
	content.events.append(_event("relation-lock", [{"kind": "relation", "id": "innkeeper", "min": 100}], [{"kind": "relation", "id": "innkeeper", "amount": 100}]))
	_reject(check, content, "self-locked relation gate", "monotone audit")
	content = original.duplicate(true)
	content.events.append(_event("clue-lock", [{"kind": "clues", "min": 100000}], [{"kind": "clues", "amount": 100}]))
	_reject(check, content, "self-locked clue gate", "monotone audit")
	content = original.duplicate(true)
	content.events.append(_event("over-cap", [{"kind": "cultivation", "min": int(content.parameters.cultivationCap) + 1}], [{"kind": "flag", "id": "over-cap"}]))
	_reject(check, content, "cultivation exceeds cap", "monotone audit")
	content = original.duplicate(true)
	content.events.append(_event("multi-a", [{"kind": "flag", "id": "multi-token", "present": true}], [{"kind": "flag", "id": "multi-token"}]))
	content.events.append(_event("multi-b", [{"kind": "flag", "id": "multi-token", "present": true}], [{"kind": "flag", "id": "multi-token"}]))
	_reject(check, content, "multiple producers cannot hide a monotone self-lock", "monotone audit")
	content = original.duplicate(true)
	var optional: Dictionary = _event("optional-self", [], [{"kind": "flag", "id": "optional-token"}])
	optional.choices[0].requirements = [{"kind": "flag", "id": "optional-token", "present": true}]
	optional.choices.append({"id": "fallback", "label": "Free fallback", "costs": {}, "requirements": [], "effects": [{"kind": "flag", "id": "fallback-token"}], "risk": "No risk"})
	content.events.append(optional)
	var errors: PackedStringArray = VALIDATOR.validate(content)
	check.expect(errors.is_empty(), "optional OR gate must not be treated as a mandatory self-cycle: " + "; ".join(errors))
	content = original.duplicate(true)
	var same_gate: Dictionary = _event("all-choices-locked", [], [{"kind": "flag", "id": "shared-lock"}])
	same_gate.choices[0].requirements = [{"kind": "flag", "id": "shared-lock", "present": true}]
	var alternative: Dictionary = same_gate.choices[0].duplicate(true)
	alternative.id = "alternative"
	same_gate.choices.append(alternative)
	content.events.append(same_gate)
	_reject(check, content, "gate shared by every OR branch remains mandatory", "cyclic mandatory")
	content = original.duplicate(true)
	content.events.append(_event("negative-flag", [{"kind": "flag", "id": "does-not-need-producer", "present": false}], [{"kind": "flag", "id": "negative-done"}]))
	errors = VALIDATOR.validate(content)
	check.expect(errors.is_empty(), "negative flag conditions do not require producers")


func _reject(check: RefCounted, value: Variant, label: String, fragment: String = "") -> void:
	var errors: PackedStringArray = VALIDATOR.validate(value)
	check.expect(not errors.is_empty(), "reject " + label)
	if not fragment.is_empty():
		check.expect("; ".join(errors).contains(fragment), label + ": diagnostic contains " + fragment)


func _event(id: String, requirements: Array, effects: Array) -> Dictionary:
	return {
		"id": id, "title": id, "location": "academy", "fromDay": 1, "throughDay": 14,
		"actionCost": 0, "requirements": requirements, "description": "Graph audit fixture",
		"choices": [{"id": "accept", "label": "Accept", "costs": {}, "requirements": [], "effects": effects, "risk": "No risk"}],
	}


func _find_event(content: Dictionary, id: String) -> Dictionary:
	for event: Dictionary in content.events:
		if event.id == id:
			return event
	return {}
