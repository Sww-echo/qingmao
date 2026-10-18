class_name Rules
extends RefCounted
## Frozen V1 rules. Accepted actions work on a detached model; rejected ones do nothing.


static func create(seed: int, catalog: ContentCatalog) -> GameState:
	if not Rng32.is_valid_state(seed):
		return null
	if catalog == null:
		return null
	var state := GameState.new()
	state.scenario_id = catalog.data["scenarioId"]
	state.rules_version = catalog.data["rulesVersion"]
	state.content_version = catalog.data["contentVersion"]
	state.seed = seed
	state.rng = seed
	state.actions = int(catalog.parameters["actionsPerDay"])
	state.location = "academy"
	state.hp = int(catalog.parameters["startingHp"])
	state.qi = int(catalog.parameters["startingQi"])
	state.resources = {"stones": int(catalog.parameters["startingStones"]), "herbs": int(catalog.parameters["startingHerbs"]), "wine": 0}
	state.relations = {"guard-captain": 0, "innkeeper": 0}
	_log(state, "event", "独立十四日情境：已开窍的一转方源。第14日日暮结算供养后应对狼群；先查看学堂守望说明。")
	return state


static func validate(state: GameState, action: Dictionary, catalog: ContentCatalog) -> Dictionary:
	var error: Variant = action_error(state, action, catalog)
	if error == null:
		return {"ok": true}
	return {"ok": false, "error": {"code": "rule-rejected", "message": error, "fieldPath": "action"}}


static func action_error(state: GameState, action: Dictionary, catalog: ContentCatalog) -> Variant:
	return V1Requirements.action_error(state, action, catalog)


static func apply(state: GameState, action: Dictionary, catalog: ContentCatalog) -> Dictionary:
	var checked: Dictionary = validate(state, action, catalog)
	if not checked["ok"]:
		return checked
	var next: GameState = state.clone()
	var parameters: Dictionary = catalog.parameters
	match action["type"]:
		"TRAVEL":
			next.location = action["location"]
		"OPEN_EVENT":
			next.active_event = action["eventId"]
		"DISMISS_EVENT":
			next.active_event = null
		"CHOOSE":
			var event: Dictionary = catalog.by_id["events"][next.active_event]
			var choice: Dictionary = _choice(event, action["choiceId"])
			for index: int in range(int(event["actionCost"])):
				_spend_action(next, "event:%s" % event["id"])
			for resource: String in choice["costs"]:
				var cost: int = int(choice["costs"][resource])
				if resource == "qi":
					next.qi -= cost
				else:
					_resource_delta(next, resource, -cost, event["id"], catalog)
			next.completed_events.append(event["id"])
			next.active_event = null
			_log(next, "event", "%s：%s。%s" % [event["title"], choice["label"], choice["risk"]])
			for effect: Dictionary in choice["effects"]:
				V1Effects.apply(next, effect, event["id"], catalog)
		"WORK":
			_spend_action(next, "work")
			_resource_delta(next, "stones", int(parameters["laborIncome"]), "safe-labor", catalog)
			_log(next, "economy", "安全劳作1行动，收入%d元石。" % int(parameters["laborIncome"]))
		"TRAIN":
			_spend_action(next, "train")
			next.qi -= int(parameters["trainingQi"])
			var gain: int = int(parameters["trainingGain"]) + (int(parameters["liquorTrainingBonus"]) if Queries.is_gu_usable(next, "liquor-worm") else 0)
			next.cultivation = mini(int(parameters["cultivationCap"]), next.cultivation + gain)
			_log(next, "growth", "修炼获得%d修为，当前%d；真元上限%d，月刃伤害%d。" % [gain, next.cultivation, Queries.max_qi(next, catalog), 8 + floori(float(next.cultivation) / 6) * 2])
		"SCOUT":
			_spend_action(next, "scout")
			next.qi -= int(parameters["scoutQi"])
			var protected_by_gu: bool = Queries.is_gu_usable(next, "ear-grass")
			next.clues = mini(int(parameters["clueCap"]), next.clues + (2 if protected_by_gu else 1))
			_resource_delta(next, "herbs", 1, "bamboo-survey", catalog)
			if protected_by_gu:
				_log(next, "event", "地听草排除危险，获得2情报及1药草。")
			else:
				var risk: float = _draw(next)
				V1Effects.apply(next, {"kind": "exposure", "id": "unlicensed-survey", "source": "无地听草的竹林侦察"}, "bamboo-survey", catalog)
				next.suspicion = mini(100, next.suspicion + 3)
				if risk < 0.3:
					V1Combat.start_battle(next, "scout-wolf", "survey", catalog)
				else:
					var injury: int = 2 + floori((risk - 0.3) / 0.7 * 5)
					next.hp = maxi(0, next.hp - injury)
					_log(next, "risk", "无侦察蛊的调查留下痕迹并受%d伤害；获得1情报及1药草。" % injury)
		"REST":
			_spend_action(next, "rest")
			next.hp = mini(int(parameters["startingHp"]), next.hp + 8)
			next.qi = mini(Queries.max_qi(next, catalog), next.qi + 5)
			_log(next, "management", "安全休整1行动，恢复至多8生命和5真元，无元石费用。")
		"END_DAY":
			V1DayCycle.apply(next, catalog)
		"BUY":
			var item: String = action["item"]
			var price: int = int(parameters["herbPrice"] if item == "herbs" else parameters["winePrice"])
			_resource_delta(next, "stones", -price, "buy-%s" % item, catalog)
			_resource_delta(next, item, 1, "buy-%s" % item, catalog)
		"EQUIP":
			next.inventory[action["guId"]].equipped = action["equipped"]
		"GU_MODE":
			var mode: String = action["mode"]
			var id: String = action["guId"]
			_spend_action(next, "seal-gu" if mode == "seal" else "wake-gu")
			var gu: GameState.GuState = next.inventory[id]
			var price: int = _gu_price(gu, mode, parameters)
			_resource_delta(next, "stones", -price, "gu-%s" % mode, catalog)
			gu.mode = "sealed" if mode == "seal" else "active"
			if mode == "wake" and not next.upkeep_due.has(id):
				next.upkeep_due.append(id)
			_log(next, "management", "%s%s，花%d元石和1行动。当日已产生供养义务不消除。" % [id, "封存" if mode == "seal" else "唤醒", price])
		"CLEAR_EXPOSURE":
			_spend_action(next, "clear-exposure")
			_resource_delta(next, "stones", -int(parameters["clearExposureCost"]), "clear-exposure", catalog)
			var remaining: Array[GameState.ExposureState] = []
			for exposure: GameState.ExposureState in next.exposures:
				if exposure.id != action["exposureId"]:
					remaining.append(exposure)
			next.exposures = remaining
			_log(next, "risk", "付出1行动和%d元石处理%s物证。" % [int(parameters["clearExposureCost"]), action["exposureId"]])
		"COMBAT":
			V1Combat.apply(next, action["move"], catalog)
	if next.hp == 0 and next.ending == null:
		V1Combat.die(next, "未能承受已展示的敌人意图，生命耗尽。" if next.combat != null else "探索或撤退造成的伤势耗尽生命。")
	var events: Array[Dictionary] = []
	for index: int in range(state.log.size(), next.log.size()):
		var entry: GameState.LogEntry = next.log[index]
		events.append({"day": entry.day, "kind": entry.kind, "message": entry.message})
	return {"ok": true, "state": next, "events": events}


static func _choice(event: Dictionary, id: Variant) -> Dictionary:
	for choice: Dictionary in event.get("choices", []):
		if choice["id"] == id:
			return choice
	return {}


static func _gu_price(gu: GameState.GuState, mode: String, parameters: Dictionary) -> int:
	if mode == "seal":
		return int(parameters["sealCost"])
	return int(parameters["wakeSealedCost"] if gu.mode == "sealed" else parameters["wakeDormantCost"])


static func _log(state: GameState, kind: String, message: String) -> void:
	var entry := GameState.LogEntry.new()
	entry.day = state.day
	entry.kind = kind
	entry.message = message
	state.log.append(entry)


static func _resource_delta(state: GameState, resource: String, amount: int, source: String, catalog: ContentCatalog) -> void:
	var limit: int = 100000
	if resource == "herbs":
		limit = int(catalog.parameters["herbCarryLimit"])
	elif resource == "wine":
		limit = int(catalog.parameters["wineCarryLimit"])
	var before: int = state.resources[resource]
	state.resources[resource] = clampi(before + amount, 0, limit)
	if before != state.resources[resource]:
		var entry := GameState.LedgerEntry.new()
		entry.day = state.day
		entry.source = source
		entry.resource = resource
		entry.amount = state.resources[resource] - before
		state.ledger.append(entry)


static func _flag(state: GameState, id: String) -> void:
	if not state.flags.has(id):
		state.flags.append(id)


static func _draw(state: GameState) -> float:
	var sample: Dictionary = Rng32.step(state.rng)
	state.rng = sample["rng"]
	state.rng_draws += 1
	return sample["value"]


static func _spend_action(state: GameState, source: String) -> void:
	state.actions -= 1
	state.action_counts[source] = state.action_counts.get(source, 0) + 1
