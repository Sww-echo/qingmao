class_name Queries
extends RefCounted
## Pure V1 public projections. Future/random information stays out of policy inputs.


static func max_qi(state: GameState, catalog: ContentCatalog) -> int:
	var parameters: Dictionary = catalog.parameters
	return int(parameters["startingQi"]) + floori(float(state.cultivation) / int(parameters["cultivationStep"])) * int(parameters["maxQiBonusPerStep"])


static func is_gu_usable(state: GameState, gu_id: String) -> bool:
	return state.inventory.has(gu_id) and state.inventory[gu_id].mode == "active" and state.inventory[gu_id].equipped


static func upkeep(state: GameState, catalog: ContentCatalog) -> int:
	var total: int = 0
	for definition: Dictionary in catalog.data["gu"]:
		var id: String = definition["id"]
		if state.inventory.has(id) and (state.inventory[id].mode != "sealed" or state.upkeep_due.has(id)):
			total += int(definition["upkeep"])
	return total


static func requirement_error(state: GameState, requirement: Dictionary) -> Variant:
	return V1Requirements.requirement_error(state, requirement)


static func requirements_error(state: GameState, requirements: Array) -> Variant:
	return V1Requirements.requirements_error(state, requirements)


static func has_exposure(state: GameState, id: Variant) -> bool:
	for exposure: GameState.ExposureState in state.exposures:
		if exposure.id == id:
			return true
	return false


static func available_events(state: GameState, catalog: ContentCatalog) -> Array[Dictionary]:
	var events: Array[Dictionary] = []
	if state.ending != null or state.combat != null or state.active_event != null:
		return events
	for event: Dictionary in catalog.data["events"]:
		if int(event["fromDay"]) > state.day or int(event["throughDay"]) < state.day:
			continue
		if state.completed_events.has(event["id"]) or state.missed_events.has(event["id"]):
			continue
		if requirements_error(state, event["requirements"]) != null:
			continue
		if (state.crisis == "approaching" and event["id"] == "crisis-arrival") or (state.crisis != "approaching" and event["id"] != "crisis-arrival"):
			continue
		events.append(event.duplicate(true))
	return events


static func combat_forecast(state: GameState, catalog: ContentCatalog) -> Variant:
	if state.combat == null:
		return null
	var enemy: Dictionary = catalog.by_id["enemies"][state.combat.enemy_id]
	var intent: Dictionary = enemy["intents"][state.combat.turn % enemy["intents"].size()]
	var damage: int = int(intent["damage"]) + state.exposures.size() * 2
	var passive: int = int(catalog.by_id["gu"]["jade-skin"]["power"]) if is_gu_usable(state, "jade-skin") else 0
	var reduction: int = fortify_reduction(state, catalog, state.combat.enemy_id)
	return {
		"enemyHp": state.combat.enemy_hp, "intent": intent["label"],
		"incomingDamage": maxi(0, damage - passive - state.combat.guard - reduction),
		"defendingDamage": maxi(0, damage - passive - state.combat.guard - 6 - reduction),
	}


## D5: only the first crisis phase and the first `fortifyTurns` enemy turns.
static func fortify_reduction(state: GameState, catalog: ContentCatalog, enemy_id: String) -> int:
	if not catalog.is_v2() or state.combat == null or state.combat.purpose != "crisis":
		return 0
	if enemy_id != "crisis-pack" or not state.flags.has("fortified"):
		return 0
	if state.combat.turn >= int(catalog.parameters["fortifyTurns"]):
		return 0
	return int(catalog.parameters["fortifyDamageReduction"])


static func action_options(state: GameState, catalog: ContentCatalog) -> Array[Dictionary]:
	var candidates: Array[Dictionary] = []
	for location: Dictionary in catalog.data["locations"]:
		candidates.append({"type": "TRAVEL", "location": location["id"]})
	for event: Dictionary in available_events(state, catalog):
		candidates.append({"type": "OPEN_EVENT", "eventId": event["id"]})
	for type: String in ["WORK", "TRAIN", "SCOUT", "REST", "END_DAY", "DISMISS_EVENT"]:
		candidates.append({"type": type})
	for item: String in ["herbs", "wine"]:
		candidates.append({"type": "BUY", "item": item})
	for definition: Dictionary in catalog.data["gu"]:
		var id: String = definition["id"]
		candidates.append({"type": "EQUIP", "guId": id, "equipped": true})
		candidates.append({"type": "EQUIP", "guId": id, "equipped": false})
		candidates.append({"type": "GU_MODE", "guId": id, "mode": "wake"})
		candidates.append({"type": "GU_MODE", "guId": id, "mode": "seal"})
	for exposure: GameState.ExposureState in state.exposures:
		candidates.append({"type": "CLEAR_EXPOSURE", "exposureId": exposure.id})
	for move: String in ["attack", "defend", "moonlight", "jade-skin", "herbs", "wine", "retreat"]:
		candidates.append({"type": "COMBAT", "move": move})
	if state.active_event != null and catalog.has_id("events", state.active_event):
		for choice: Dictionary in catalog.by_id["events"][state.active_event]["choices"]:
			candidates.append({"type": "CHOOSE", "choiceId": choice["id"]})
	var options: Array[Dictionary] = []
	for action: Dictionary in candidates:
		var error: Variant = V1Requirements.action_error(state, action, catalog)
		options.append({
			"action": action, "ok": error == null,
			"reason": "" if error == null else String(error),
		})
	return options


static func legal_actions(state: GameState, catalog: ContentCatalog) -> Array[Dictionary]:
	var legal: Array[Dictionary] = []
	for option: Dictionary in action_options(state, catalog):
		if option["ok"]:
			legal.append(option["action"])
	return legal


static func public_view(state: GameState, catalog: ContentCatalog) -> Dictionary:
	var public_state: Dictionary = state.to_data()
	public_state.erase("seed")
	public_state.erase("rng")
	public_state.erase("rngDraws")
	var event_titles: Dictionary = {}
	for event: Dictionary in catalog.data["events"]:
		event_titles[event["id"]] = event["title"]
	return {
		"state": public_state, "availableEvents": available_events(state, catalog),
		"legalActions": legal_actions(state, catalog), "actionOptions": action_options(state, catalog),
		"combatForecast": combat_forecast(state, catalog),
		"activeEvent": catalog.definition("events", state.active_event) if state.active_event != null else null,
		"locations": catalog.data["locations"].duplicate(true),
		"gu": catalog.data["gu"].duplicate(true),
		"relations": catalog.data["relations"].duplicate(true),
		"enemies": catalog.data["enemies"].duplicate(true),
		"eventTitles": event_titles,
		# Display-only cost hints. The UI must still submit actions and let the
		# rules decide legality; these numbers never replace validation.
		"costs": {
			"laborIncome": int(catalog.parameters["laborIncome"]),
			"trainingQi": int(catalog.parameters["trainingQi"]),
			"scoutQi": int(catalog.parameters["scoutQi"]),
			"herbPrice": int(catalog.parameters["herbPrice"]),
			"winePrice": int(catalog.parameters["winePrice"]),
			"clearExposureCost": int(catalog.parameters["clearExposureCost"]),
			"sealCost": int(catalog.parameters["sealCost"]),
			"wakeSealedCost": int(catalog.parameters["wakeSealedCost"]),
			"wakeDormantCost": int(catalog.parameters["wakeDormantCost"]),
		},
		"maxHp": int(catalog.parameters["startingHp"]), "maxQi": max_qi(state, catalog),
		"upkeep": upkeep(state, catalog),
	}
