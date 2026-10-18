class_name V1Policies
extends RefCounted
## Frozen V1 policy decisions read only the public, RNG-free projection.

const STRATEGIES: PackedStringArray = ["war-ready", "network", "labor"]


static func choose(strategy_id: String, view: Dictionary, catalog: ContentCatalog) -> Dictionary:
	if not STRATEGIES.has(strategy_id):
		push_error("Unknown V1 strategy: " + strategy_id)
		return {}
	var state: Dictionary = view["state"]
	if state["ending"] != null:
		push_error("Cannot choose an action for a finished V1 run")
		return {}
	if state["combat"] != null:
		return _battle_policy(view)
	if state["activeEvent"] != null:
		if state["activeEvent"] == "crisis-arrival":
			var shelter: Dictionary = _legal(view, {"type": "CHOOSE", "choiceId": "take-shelter"})
			return shelter if not shelter.is_empty() else _legal(view, {"type": "CHOOSE", "choiceId": "stand"})
		var listen: Dictionary = _legal(view, {"type": "CHOOSE", "choiceId": "listen"})
		if not listen.is_empty():
			return listen
		for action: Dictionary in view["legalActions"]:
			if action["type"] == "CHOOSE":
				return action
		return _legal(view, {"type": "DISMISS_EVENT"})
	for event_id: String in ["briefing", "moonlight-issue", "alarm"]:
		var action: Dictionary = _opportunity(view, event_id)
		if not action.is_empty():
			return action
	if state["actions"] == 0:
		return _legal(view, {"type": "END_DAY"})
	var parameters: Dictionary = catalog.parameters
	if strategy_id != "labor":
		var essential: PackedStringArray = ["moonlight", "jade-skin"] if strategy_id == "war-ready" else ["ear-grass"]
		for gu_id: String in essential:
			var gu: Dictionary = state["inventory"].get(gu_id, {})
			if not gu.is_empty() and gu["mode"] != "active" and state["resources"]["stones"] >= view["upkeep"] + 2:
				var wake: Dictionary = _legal(view, {"type": "GU_MODE", "guId": gu_id, "mode": "wake"})
				if not wake.is_empty():
					return wake
		for event_id: String in ["inn-introduction", "academy-commission", "supply-ledger"]:
			var action: Dictionary = _opportunity(view, event_id)
			if not action.is_empty():
				return action
		if strategy_id == "war-ready":
			for event_id: String in ["jade-offer", "liquor-offer"]:
				var action: Dictionary = _opportunity(view, event_id)
				if not action.is_empty():
					return action
			if state["cultivation"] >= 12 and _usable(state, "jade-skin"):
				var rescue: Dictionary = _opportunity(view, "patrol-rescue")
				if not rescue.is_empty():
					return rescue
			if state["cultivation"] >= 30 and state["inventory"].get("liquor-worm", {}).get("mode") != "sealed":
				var seal: Dictionary = _legal(view, {"type": "GU_MODE", "guId": "liquor-worm", "mode": "seal"})
				if not seal.is_empty():
					return seal
			if state["cultivation"] < 30 and state["resources"]["stones"] >= view["upkeep"]:
				if state["qi"] >= parameters["trainingQi"]:
					var train: Dictionary = _travel_or(view, "academy", {"type": "TRAIN"})
					if not train.is_empty():
						return train
		else:
			for event_id: String in ["eargrass-offer", "bamboo-signs", "academy-service", "guide-report", "signal-markers", "shelter-pledge", "watch-duty", "shelter-stock"]:
				var action: Dictionary = _opportunity(view, event_id)
				if not action.is_empty():
					return action
			if _usable(state, "ear-grass") and state["inventory"].get("moonlight", {}).get("mode") != "sealed":
				var seal: Dictionary = _legal(view, {"type": "GU_MODE", "guId": "moonlight", "mode": "seal"})
				if not seal.is_empty():
					return seal
			if state["day"] >= 8 and state["clues"] < 7 and state["qi"] >= parameters["scoutQi"] and _usable(state, "ear-grass"):
				var scout: Dictionary = _travel_or(view, "bamboo", {"type": "SCOUT"})
				if not scout.is_empty():
					return scout
		if state["resources"]["herbs"] < 4:
			var herbs: Dictionary = _opportunity(view, "healer-herbs")
			if not herbs.is_empty():
				return herbs
		if state["hp"] <= 18:
			var rest: Dictionary = _travel_or(view, "academy", {"type": "REST"})
			if not rest.is_empty():
				return rest
		if not state["exposures"].is_empty() and state["resources"]["stones"] >= parameters["clearExposureCost"]:
			var clear: Dictionary = _travel_or(view, "inn", {"type": "CLEAR_EXPOSURE", "exposureId": state["exposures"][0]["id"]})
			if not clear.is_empty():
				return clear
	if state["day"] == 14:
		for item: String in ["herbs", "wine"]:
			var limit: int = int(parameters["herbCarryLimit"] if item == "herbs" else parameters["wineCarryLimit"])
			var price: int = int(parameters["herbPrice"] if item == "herbs" else parameters["winePrice"])
			if state["resources"][item] < limit and state["resources"]["stones"] >= price + view["upkeep"]:
				var buy: Dictionary = _travel_or(view, "inn", {"type": "BUY", "item": item})
				if not buy.is_empty():
					return buy
		if state["hp"] < view["maxHp"] or state["qi"] < view["maxQi"]:
			var rest: Dictionary = _travel_or(view, "academy", {"type": "REST"})
			if not rest.is_empty():
				return rest
	var work: Dictionary = _travel_or(view, "inn", {"type": "WORK"})
	return work if not work.is_empty() else _legal(view, {"type": "END_DAY"})


static func summarize(state: GameState, catalog: ContentCatalog) -> Dictionary:
	if state.ending == null:
		push_error("Cannot summarize an unfinished V1 run")
		return {}
	var active_gu: Array[String] = []
	for gu: Dictionary in catalog.data["gu"]:
		var id: String = gu["id"]
		if state.inventory.has(id) and state.inventory[id].mode == "active" and state.inventory[id].equipped:
			active_gu.append(id)
	var exposures: Array[String] = []
	for exposure: GameState.ExposureState in state.exposures:
		exposures.append(exposure.id)
	return {
		"survived": state.ending.outcome == "survived", "endingId": state.ending.id,
		"reasons": state.ending.reasons.duplicate(), "stones": state.resources["stones"],
		"cultivation": state.cultivation, "activeGu": active_gu,
		"wounds": int(catalog.parameters["startingHp"]) - state.hp,
		"exposures": exposures, "actionCounts": state.action_counts.duplicate(),
	}


static func _legal(view: Dictionary, action: Dictionary) -> Dictionary:
	for candidate: Dictionary in view["legalActions"]:
		if candidate == action:
			return candidate
	return {}


static func _travel_or(view: Dictionary, location: String, action: Dictionary) -> Dictionary:
	return _legal(view, action) if view["state"]["location"] == location else _legal(view, {"type": "TRAVEL", "location": location})


static func _opportunity(view: Dictionary, event_id: String) -> Dictionary:
	var event: Dictionary = {}
	for candidate: Dictionary in view["availableEvents"]:
		if candidate["id"] == event_id:
			event = candidate
			break
	var state: Dictionary = view["state"]
	if event.is_empty() or state["actions"] < event["actionCost"]:
		return {}
	var affordable: bool = false
	for choice: Dictionary in event["choices"]:
		var can_pay: bool = true
		for id: String in choice["costs"]:
			var available: int = int(state["qi"] if id == "qi" else state["resources"][id])
			if available < choice["costs"][id]:
				can_pay = false
				break
		if not can_pay:
			continue
		var meets_requirements: bool = true
		for requirement: Dictionary in choice["requirements"]:
			if not _meets_requirement(state, requirement):
				meets_requirements = false
				break
		if meets_requirements:
			affordable = true
			break
	if not affordable:
		return {}
	return _travel_or(view, event["location"], {"type": "OPEN_EVENT", "eventId": event_id})


static func _meets_requirement(state: Dictionary, requirement: Dictionary) -> bool:
	match requirement["kind"]:
		"gu":
			return _usable(state, requirement["id"]) if requirement["usable"] else state["inventory"].has(requirement["id"])
		"flag":
			return state["flags"].has(requirement["id"]) == requirement["present"]
		"relation":
			return state["relations"][requirement["id"]] >= requirement["min"]
		"resource":
			return state["resources"][requirement["id"]] >= requirement["min"]
		"clues":
			return state["clues"] >= requirement["min"]
		"cultivation":
			return state["cultivation"] >= requirement["min"]
		"exposure":
			for exposure: Dictionary in state["exposures"]:
				if exposure["id"] == requirement["id"]:
					return true
	return false


static func _usable(state: Dictionary, gu_id: String) -> bool:
	var gu: Dictionary = state["inventory"].get(gu_id, {})
	return gu.get("mode") == "active" and gu.get("equipped", false)


static func _battle_policy(view: Dictionary) -> Dictionary:
	var forecast: Dictionary = view["combatForecast"]
	var state: Dictionary = view["state"]
	var hp: int = int(state["hp"])
	var cultivation_step: int = floori(float(state["cultivation"]) / 6.0)
	var strike: int = 8 + cultivation_step * 2
	var can_strike: Dictionary = _legal(view, {"type": "COMBAT", "move": "moonlight"})
	if not can_strike.is_empty() and forecast["enemyHp"] <= strike:
		return can_strike
	var attack: Dictionary = _legal(view, {"type": "COMBAT", "move": "attack"})
	if forecast["enemyHp"] <= 3 + cultivation_step:
		return attack
	var herbs: Dictionary = _legal(view, {"type": "COMBAT", "move": "herbs"})
	if not herbs.is_empty() and (hp <= forecast["incomingDamage"] + 4 or hp <= 10):
		return herbs
	if not can_strike.is_empty():
		return can_strike
	var wine: Dictionary = _legal(view, {"type": "COMBAT", "move": "wine"})
	if not wine.is_empty() and _usable(state, "moonlight") and hp > forecast["incomingDamage"]:
		return wine
	if _usable(state, "moonlight") and forecast["incomingDamage"] >= 8 and state["qi"] < 3 and hp > forecast["defendingDamage"]:
		return _legal(view, {"type": "COMBAT", "move": "defend"})
	return attack
