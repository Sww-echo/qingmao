class_name GameState
extends RefCounted
## Pure rule data and detached camelCase projection; StateCodec validates interchange data.

class GuState extends RefCounted:
	var mode: String = "active"
	var equipped: bool = false


class CombatState extends RefCounted:
	var enemy_id: String = ""
	var purpose: String = ""
	var enemy_hp: int = 0
	var turn: int = 0
	var guard: int = 0
	var herbs_used: int = 0
	var wine_used: int = 0


class EndingState extends RefCounted:
	var id: String = ""
	var outcome: String = ""
	var reasons: Array[String] = []


class ExposureState extends RefCounted:
	var id: String = ""
	var source: String = ""
	var day: int = 1


class LedgerEntry extends RefCounted:
	var day: int = 1
	var source: String = ""
	var resource: String = ""
	var amount: int = 0


class LogEntry extends RefCounted:
	var day: int = 1
	var kind: String = ""
	var message: String = ""


var scenario_id: String = ""
var rules_version: String = ""
var content_version: String = ""
var seed: int = 0
var rng: int = 0
var rng_draws: int = 0
var day: int = 1
var actions: int = 0
var location: String = ""
var hp: int = 0
var qi: int = 0
var cultivation: int = 0
var clues: int = 0
var suspicion: int = 0
var resources: Dictionary[String, int] = {}
var relations: Dictionary[String, int] = {}
var inventory: Dictionary[String, GuState] = {}
var upkeep_due: Array[String] = []
var flags: Array[String] = []
var exposures: Array[ExposureState] = []
var completed_events: Array[String] = []
var missed_events: Array[String] = []
var active_event: Variant = null
var combat: CombatState = null
var crisis: String = "approaching"
var ending: EndingState = null
var action_counts: Dictionary[String, int] = {}
var ledger: Array[LedgerEntry] = []
var log: Array[LogEntry] = []


func clone() -> GameState:
	var copy := GameState.new()
	copy.scenario_id = scenario_id
	copy.rules_version = rules_version
	copy.content_version = content_version
	copy.seed = seed
	copy.rng = rng
	copy.rng_draws = rng_draws
	copy.day = day
	copy.actions = actions
	copy.location = location
	copy.hp = hp
	copy.qi = qi
	copy.cultivation = cultivation
	copy.clues = clues
	copy.suspicion = suspicion
	copy.resources = resources.duplicate()
	copy.relations = relations.duplicate()
	copy.upkeep_due = upkeep_due.duplicate()
	copy.flags = flags.duplicate()
	copy.completed_events = completed_events.duplicate()
	copy.missed_events = missed_events.duplicate()
	copy.active_event = active_event
	copy.crisis = crisis
	copy.action_counts = action_counts.duplicate()
	for id: String in inventory:
		var gu := GuState.new()
		gu.mode = inventory[id].mode
		gu.equipped = inventory[id].equipped
		copy.inventory[id] = gu
	for entry: ExposureState in exposures:
		var exposure := ExposureState.new()
		exposure.id = entry.id
		exposure.source = entry.source
		exposure.day = entry.day
		copy.exposures.append(exposure)
	if combat != null:
		copy.combat = CombatState.new()
		copy.combat.enemy_id = combat.enemy_id
		copy.combat.purpose = combat.purpose
		copy.combat.enemy_hp = combat.enemy_hp
		copy.combat.turn = combat.turn
		copy.combat.guard = combat.guard
		copy.combat.herbs_used = combat.herbs_used
		copy.combat.wine_used = combat.wine_used
	if ending != null:
		copy.ending = EndingState.new()
		copy.ending.id = ending.id
		copy.ending.outcome = ending.outcome
		copy.ending.reasons = ending.reasons.duplicate()
	for entry: LedgerEntry in ledger:
		var ledger_entry := LedgerEntry.new()
		ledger_entry.day = entry.day
		ledger_entry.source = entry.source
		ledger_entry.resource = entry.resource
		ledger_entry.amount = entry.amount
		copy.ledger.append(ledger_entry)
	for entry: LogEntry in log:
		var log_entry := LogEntry.new()
		log_entry.day = entry.day
		log_entry.kind = entry.kind
		log_entry.message = entry.message
		copy.log.append(log_entry)
	return copy


func to_data() -> Dictionary:
	var data: Dictionary = {
		"scenarioId": scenario_id, "rulesVersion": rules_version,
		"contentVersion": content_version, "seed": seed, "rng": rng,
		"rngDraws": rng_draws, "day": day, "actions": actions, "location": location,
		"hp": hp, "qi": qi, "cultivation": cultivation, "clues": clues,
		"suspicion": suspicion, "resources": resources.duplicate(),
		"relations": relations.duplicate(), "inventory": {}, "upkeepDue": upkeep_due.duplicate(),
		"flags": flags.duplicate(), "exposures": [], "completedEvents": completed_events.duplicate(),
		"missedEvents": missed_events.duplicate(), "activeEvent": active_event,
		"combat": null, "crisis": crisis, "ending": null, "actionCounts": action_counts.duplicate(),
		"ledger": [], "log": [],
	}
	for id: String in inventory:
		data["inventory"][id] = {"mode": inventory[id].mode, "equipped": inventory[id].equipped}
	for entry: ExposureState in exposures:
		data["exposures"].append({"id": entry.id, "source": entry.source, "day": entry.day})
	if combat != null:
		data["combat"] = {
			"enemyId": combat.enemy_id, "purpose": combat.purpose, "enemyHp": combat.enemy_hp,
			"turn": combat.turn, "guard": combat.guard, "herbsUsed": combat.herbs_used,
			"wineUsed": combat.wine_used,
		}
	if ending != null:
		data["ending"] = {"id": ending.id, "outcome": ending.outcome, "reasons": ending.reasons.duplicate()}
	for entry: LedgerEntry in ledger:
		data["ledger"].append({"day": entry.day, "source": entry.source, "resource": entry.resource, "amount": entry.amount})
	for entry: LogEntry in log:
		data["log"].append({"day": entry.day, "kind": entry.kind, "message": entry.message})
	return data
