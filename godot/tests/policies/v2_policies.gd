class_name V2Policies
extends RefCounted
## W6 V2 policy candidates. They read only the public, RNG-free view, just like
## V1Policies; these are balance-test instruments, not shipped player AI.

const STRATEGIES: PackedStringArray = ["war-ready", "network", "labor"]
const ABLATIONS: PackedStringArray = ["none", "drill", "route", "gu"]
static var ablation: String = "none" if not OS.get_environment("QINGMAO_ABLATION") in ABLATIONS else OS.get_environment("QINGMAO_ABLATION")


static func choose(strategy_id: String, view: Dictionary, catalog: ContentCatalog) -> Dictionary:
	if not STRATEGIES.has(strategy_id):
		return {}
	var state: Dictionary = view.state
	if state.ending != null:
		return {}
	if state.combat != null:
		return _battle_policy(view, catalog)
	if state.activeEvent != null:
		return _event_choice(view)
	for event_id: String in ["briefing", "moonlight-issue", "alarm"]:
		var action: Dictionary = _opportunity(view, event_id)
		if not action.is_empty():
			return action
	# Resolve the inquiry as soon as it opens; leaving it creates an exposure.
	var inquiry: Dictionary = _opportunity(view, "inquiry")
	if not inquiry.is_empty():
		return inquiry
	if state.actions == 0:
		return _legal(view, {"type": "END_DAY"})
	match strategy_id:
		"war-ready":
			return _war_ready(view, catalog)
		"network":
			return _network(view, catalog)
		_:
			return _labor(view, catalog)


static func _war_ready(view: Dictionary, catalog: ContentCatalog) -> Dictionary:
	var state: Dictionary = view.state
	var parameters: Dictionary = catalog.parameters
	for gu_id: String in ["moonlight", "jade-skin"]:
		var gu: Dictionary = state.inventory.get(gu_id, {})
		if not gu.is_empty() and gu.mode != "active" and state.resources.stones >= view.upkeep + 2:
			var wake: Dictionary = _legal(view, {"type": "GU_MODE", "guId": gu_id, "mode": "wake"})
			if not wake.is_empty():
				return wake
	if not state.flags.has("patrol-contract"):
		var commission: Dictionary = _opportunity(view, "academy-commission")
		if not commission.is_empty():
			return commission
	if ablation != "gu" and not state.inventory.has("jade-skin"):
		var jade: Dictionary = _opportunity(view, "jade-offer")
		if not jade.is_empty():
			return jade
	if not state.inventory.has("liquor-worm"):
		var liquor: Dictionary = _opportunity(view, "liquor-offer")
		if not liquor.is_empty():
			return liquor
	# Drill is the V2 combat upgrade; reach cultivation 18 first, then buy it.
	if state.cultivation < 18 and state.qi >= parameters.trainingQi and state.resources.stones >= view.upkeep:
		var train: Dictionary = _travel_or(view, "academy", {"type": "TRAIN"})
		if not train.is_empty():
			return train
	if ablation != "drill" and not state.flags.has("drilled"):
		var drill: Dictionary = _opportunity(view, "academy-drill")
		if not drill.is_empty():
			return drill
	if state.cultivation >= 12 and _usable(state, "jade-skin"):
		var rescue: Dictionary = _opportunity(view, "patrol-rescue")
		if not rescue.is_empty():
			return rescue
	if state.day >= 9 and state.day <= 12 and state.relations.get("guard-captain", 0) >= 3 \
			and state.resources.get("herbs", 0) >= 1 and not state.flags.has("watch-served"):
		var watch: Dictionary = _opportunity(view, "watch-duty")
		if not watch.is_empty():
			return watch
	if state.day >= 9 and state.day <= 10 and state.resources.herbs < 4:
		var healer: Dictionary = _opportunity(view, "healer-herbs")
		if not healer.is_empty():
			return healer
	if state.day >= 10 and state.resources.stones >= 8 and not state.flags.has("fortified"):
		var fortify: Dictionary = _opportunity(view, "fortify")
		if not fortify.is_empty():
			return fortify
	if state.day >= 8 and state.day <= 11 and state.relations.get("guard-captain", 0) >= 2:
		var overtime: Dictionary = _opportunity(view, "patrol-overtime")
		if not overtime.is_empty():
			return overtime
	if state.day >= 11 and state.relations.get("guard-captain", 0) >= 3 and not state.flags.has("final-freight"):
		var march: Dictionary = _opportunity(view, "final-march")
		if not march.is_empty():
			return march
	# The war-ready route keeps converting qi into cultivation through the last
	# days; this is a real preparation action, not a free click.
	if state.cultivation < int(parameters.cultivationCap) and state.resources.stones >= view.upkeep + 2:
		if state.qi >= int(parameters.trainingQi):
			var more: Dictionary = _travel_or(view, "academy", {"type": "TRAIN"})
			if not more.is_empty():
				return more
		if state.qi < view.maxQi:
			var rest: Dictionary = _travel_or(view, "academy", {"type": "REST"})
			if not rest.is_empty():
				return rest
	if state.day >= 12:
		if state.resources.herbs < int(parameters.herbCarryLimit) and state.resources.stones >= int(parameters.herbPrice) + view.upkeep:
			var herbs: Dictionary = _travel_or(view, "inn", {"type": "BUY", "item": "herbs"})
			if not herbs.is_empty():
				return herbs
		if state.resources.wine < int(parameters.wineCarryLimit) and state.resources.stones >= int(parameters.winePrice) + view.upkeep:
			var wine: Dictionary = _travel_or(view, "inn", {"type": "BUY", "item": "wine"})
			if not wine.is_empty():
				return wine
	var work: Dictionary = _travel_or(view, "inn", {"type": "WORK"})
	return work if not work.is_empty() else _legal(view, {"type": "END_DAY"})


static func _network(view: Dictionary, catalog: ContentCatalog) -> Dictionary:
	var state: Dictionary = view.state
	var parameters: Dictionary = catalog.parameters
	if ablation != "gu" and not state.inventory.has("ear-grass"):
		var ears: Dictionary = _opportunity(view, "eargrass-offer")
		if not ears.is_empty():
			return ears
	var ear: Dictionary = state.inventory.get("ear-grass", {})
	if not ear.is_empty() and ear.mode != "active" and state.resources.stones >= view.upkeep + 2:
		var wake: Dictionary = _legal(view, {"type": "GU_MODE", "guId": "ear-grass", "mode": "wake"})
		if not wake.is_empty():
			return wake
	for event_id: String in [
		"inn-introduction", "supply-ledger", "bamboo-signs", "guide-report",
		"signal-markers", "shelter-pledge", "watch-duty", "shelter-stock",
		"route-review", "academy-service",
	]:
		if event_id == "route-review" and ablation == "route":
			continue
		var action: Dictionary = _opportunity(view, event_id)
		if not action.is_empty():
			return action
	if _usable(state, "ear-grass") and state.clues < int(parameters.clueCap):
		if state.qi >= int(parameters.scoutQi):
			var scout: Dictionary = _travel_or(view, "bamboo", {"type": "SCOUT"})
			if not scout.is_empty():
				return scout
		if state.qi < view.maxQi:
			var rest: Dictionary = _travel_or(view, "academy", {"type": "REST"})
			if not rest.is_empty():
				return rest
	if state.day >= 9 and state.day <= 10 and state.resources.herbs < 4:
		var healer: Dictionary = _opportunity(view, "healer-herbs")
		if not healer.is_empty():
			return healer
	if state.day >= 11 and state.relations.get("innkeeper", 0) >= 3 and not state.flags.has("final-march"):
		var freight: Dictionary = _opportunity(view, "final-freight")
		if not freight.is_empty():
			return freight
	if state.day >= 11 and state.day <= 12 and state.clues >= int(parameters.clueCap) \
			and _usable(state, "ear-grass") and state.qi >= int(parameters.scoutQi):
		var late_scout: Dictionary = _travel_or(view, "bamboo", {"type": "SCOUT"})
		if not late_scout.is_empty():
			return late_scout
	if state.day >= 12:
		if state.resources.herbs < int(parameters.herbCarryLimit) and state.resources.stones >= int(parameters.herbPrice) + view.upkeep:
			var herbs: Dictionary = _travel_or(view, "inn", {"type": "BUY", "item": "herbs"})
			if not herbs.is_empty():
				return herbs
		if state.resources.wine < int(parameters.wineCarryLimit) and state.resources.stones >= int(parameters.winePrice) + view.upkeep:
			var wine: Dictionary = _travel_or(view, "inn", {"type": "BUY", "item": "wine"})
			if not wine.is_empty():
				return wine
	var work: Dictionary = _travel_or(view, "inn", {"type": "WORK"})
	return work if not work.is_empty() else _legal(view, {"type": "END_DAY"})


static func _labor(view: Dictionary, _catalog: ContentCatalog) -> Dictionary:
	var state: Dictionary = view.state
	if state.day >= 12:
		if state.resources.herbs < 4:
			var herbs: Dictionary = _travel_or(view, "inn", {"type": "BUY", "item": "herbs"})
			if not herbs.is_empty():
				return herbs
		if state.resources.wine < 2:
			var wine: Dictionary = _travel_or(view, "inn", {"type": "BUY", "item": "wine"})
			if not wine.is_empty():
				return wine
	var work: Dictionary = _travel_or(view, "inn", {"type": "WORK"})
	return work if not work.is_empty() else _legal(view, {"type": "END_DAY"})


static func _event_choice(view: Dictionary) -> Dictionary:
	var state: Dictionary = view.state
	if state.activeEvent == "crisis-arrival":
		var shelter: Dictionary = _legal(view, {"type": "CHOOSE", "choiceId": "take-shelter"})
		return shelter if not shelter.is_empty() else _legal(view, {"type": "CHOOSE", "choiceId": "stand"})
	if state.activeEvent == "inquiry":
		# Prefer paying when affordable; otherwise call in the favor.
		for choice_id: String in ["pay-off", "call-favor"]:
			var choice: Dictionary = _legal(view, {"type": "CHOOSE", "choiceId": choice_id})
			if not choice.is_empty():
				return choice
		return _legal(view, {"type": "DISMISS_EVENT"})
	if state.activeEvent == "bamboo-signs":
		var listen: Dictionary = _legal(view, {"type": "CHOOSE", "choiceId": "listen"})
		if not listen.is_empty():
			return listen
	for action: Dictionary in view.legalActions:
		if action.type == "CHOOSE":
			return action
	return _legal(view, {"type": "DISMISS_EVENT"})


static func _legal(view: Dictionary, action: Dictionary) -> Dictionary:
	for candidate: Dictionary in view.legalActions:
		if candidate == action:
			return candidate
	return {}


static func _travel_or(view: Dictionary, location: String, action: Dictionary) -> Dictionary:
	return _legal(view, action) if view.state.location == location else _legal(view, {"type": "TRAVEL", "location": location})


static func _opportunity(view: Dictionary, event_id: String) -> Dictionary:
	var event: Dictionary = {}
	for candidate: Dictionary in view.availableEvents:
		if candidate.id == event_id:
			event = candidate
			break
	var state: Dictionary = view.state
	if event.is_empty() or state.actions < event.actionCost:
		return {}
	var usable: bool = false
	for choice: Dictionary in event.choices:
		var can_pay: bool = true
		for id: String in choice.costs:
			var available: int = int(state.qi if id == "qi" else state.resources[id])
			if available < choice.costs[id]:
				can_pay = false
				break
		if not can_pay:
			continue
		var meets: bool = true
		for requirement: Dictionary in choice.requirements:
			if not _meets_requirement(state, requirement):
				meets = false
				break
		if meets:
			usable = true
			break
	if not usable:
		return {}
	return _travel_or(view, event.location, {"type": "OPEN_EVENT", "eventId": event_id})


static func _meets_requirement(state: Dictionary, requirement: Dictionary) -> bool:
	match requirement.kind:
		"gu":
			return _usable(state, requirement.id) if requirement.usable else state.inventory.has(requirement.id)
		"flag":
			return state.flags.has(requirement.id) == requirement.present
		"relation":
			return state.relations[requirement.id] >= requirement.min
		"resource":
			return state.resources[requirement.id] >= requirement.min
		"clues":
			return state.clues >= requirement.min
		"cultivation":
			return state.cultivation >= requirement.min
		"exposure":
			for exposure: Dictionary in state.exposures:
				if exposure.id == requirement.id:
					return true
	return false


static func _usable(state: Dictionary, gu_id: String) -> bool:
	var gu: Dictionary = state.inventory.get(gu_id, {})
	return gu.get("mode") == "active" and gu.get("equipped", false)


static func _battle_policy(view: Dictionary, catalog: ContentCatalog) -> Dictionary:
	var forecast: Dictionary = view.combatForecast
	var state: Dictionary = view.state
	var hp: int = int(state.hp)
	var cultivation_step: int = floori(float(state.cultivation) / 6.0)
	var strike: int = int(catalog.by_id["gu"]["moonlight"]["power"]) + cultivation_step * 2
	var can_strike: Dictionary = _legal(view, {"type": "COMBAT", "move": "moonlight"})
	if not can_strike.is_empty() and forecast.enemyHp <= strike:
		return can_strike
	var attack: Dictionary = _legal(view, {"type": "COMBAT", "move": "attack"})
	if forecast.enemyHp <= 3 + cultivation_step:
		return attack
	var herbs: Dictionary = _legal(view, {"type": "COMBAT", "move": "herbs"})
	if not herbs.is_empty() and (hp <= forecast.incomingDamage + 4 or hp <= 10):
		return herbs
	if not can_strike.is_empty():
		return can_strike
	var wine: Dictionary = _legal(view, {"type": "COMBAT", "move": "wine"})
	if not wine.is_empty() and _usable(state, "moonlight") and hp > forecast.incomingDamage:
		return wine
	if _usable(state, "moonlight") and forecast.incomingDamage >= 8 and state.qi < 3 and hp > forecast.defendingDamage:
		return _legal(view, {"type": "COMBAT", "move": "defend"})
	return attack
