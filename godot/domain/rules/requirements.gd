class_name V1Requirements
extends RefCounted
## V1 requirement checks and rejection order, shared by rules and public queries.


static func requirement_error(state: GameState, requirement: Dictionary) -> Variant:
	var id: String = str(requirement.get("id", ""))
	match requirement["kind"]:
		"flag":
			return null if state.flags.has(id) == requirement["present"] else "尚未落实：%s" % id
		"resource":
			return null if state.resources[id] >= int(requirement["min"]) else "%s至少需要%d" % [id, int(requirement["min"])]
		"relation":
			return null if state.relations[id] >= int(requirement["min"]) else "%s关系至少需要%d" % [id, int(requirement["min"])]
		"cultivation":
			return null if state.cultivation >= int(requirement["min"]) else "修为至少需要%d" % int(requirement["min"])
		"clues":
			return null if state.clues >= int(requirement["min"]) else "情报至少需要%d" % int(requirement["min"])
		"gu":
			if requirement["usable"]:
				return null if Queries.is_gu_usable(state, id) else "需要清醒并装备的%s" % id
			return null if state.inventory.has(id) else "尚未获得%s" % id
		"exposure":
			return null if Queries.has_exposure(state, id) else "没有这条暴露痕迹"
	return null


static func requirements_error(state: GameState, requirements: Array) -> Variant:
	for requirement: Dictionary in requirements:
		var error: Variant = requirement_error(state, requirement)
		if error != null:
			return error
	return null


static func action_error(state: GameState, action: Dictionary, catalog: ContentCatalog) -> Variant:
	if not action.get("type") is String:
		return "操作格式不正确"
	var type: String = action["type"]
	var parameters: Dictionary = catalog.parameters
	if state.ending != null:
		return "本局已经结算"
	if state.combat != null and type != "COMBAT":
		return "请先完成战斗"
	if state.combat == null and type == "COMBAT":
		return "当前没有战斗"
	if state.active_event != null and not ["CHOOSE", "DISMISS_EVENT"].has(type):
		return "请先处理当前事件"
	if state.active_event == null and ["CHOOSE", "DISMISS_EVENT"].has(type):
		return "当前没有待决事件"
	if state.crisis != "approaching" and not ["CHOOSE", "COMBAT"].has(type):
		return "狼群已经抵达，不能再筹备"
	if ["WORK", "TRAIN", "SCOUT", "REST", "GU_MODE", "CLEAR_EXPOSURE"].has(type) and state.actions < 1:
		return "今日行动已用完"
	match type:
		"TRAVEL":
			if not _only_keys(action, ["type", "location"]) or not _known_id(catalog, "locations", action.get("location")):
				return "未知地点"
			return "已经在此处" if action["location"] == state.location else null
		"OPEN_EVENT":
			if not _only_keys(action, ["type", "eventId"]):
				return "操作格式不正确"
			var event: Dictionary = {}
			for candidate: Dictionary in Queries.available_events(state, catalog):
				if candidate["id"] == action.get("eventId"):
					event = candidate
					break
			if event.is_empty():
				return "事件未开放、条件不足或已处理"
			if event["location"] != state.location:
				return "需要先到事件地点"
			return null if state.actions >= int(event["actionCost"]) else "今日行动不足以完成此事件"
		"CHOOSE":
			if not _only_keys(action, ["type", "choiceId"]):
				return "操作格式不正确"
			var event: Dictionary = catalog.by_id["events"].get(state.active_event, {})
			var choice: Dictionary = Rules._choice(event, action.get("choiceId"))
			if event.is_empty() or choice.is_empty():
				return "未知事件选项"
			if int(event["fromDay"]) > state.day or int(event["throughDay"]) < state.day or state.completed_events.has(event["id"]):
				return "事件已过期或已结算"
			var requirements: Array = event["requirements"].duplicate()
			requirements.append_array(choice["requirements"])
			var error: Variant = requirements_error(state, requirements)
			if error != null:
				return error
			if state.actions < int(event["actionCost"]):
				return "今日行动不足"
			for resource: String in choice["costs"]:
				var cost: int = int(choice["costs"][resource])
				var amount: int = state.qi if resource == "qi" else state.resources[resource]
				if amount < cost:
					return "%s不足，需要%d" % [resource, cost]
			return null
		"DISMISS_EVENT":
			if not _only_keys(action, ["type"]):
				return "操作格式不正确"
			return "狼群已抵达，必须选择应对方式" if state.active_event == "crisis-arrival" else null
		"WORK":
			if not _only_keys(action, ["type"]):
				return "操作格式不正确"
			return "安全劳作只在学堂或客栈提供" if state.location == "bamboo" else null
		"TRAIN":
			if not _only_keys(action, ["type"]):
				return "操作格式不正确"
			if state.location != "academy":
				return "需要在学堂修炼"
			if state.cultivation >= int(parameters["cultivationCap"]):
				return "本情境修为已经达到上限"
			return null if state.qi >= int(parameters["trainingQi"]) else "修炼需要3真元"
		"SCOUT":
			if not _only_keys(action, ["type"]):
				return "操作格式不正确"
			if state.location != "bamboo":
				return "需要在竹林侦察"
			return null if state.qi >= int(parameters["scoutQi"]) else "侦察需要3真元"
		"REST":
			if not _only_keys(action, ["type"]):
				return "操作格式不正确"
			if state.location == "bamboo":
				return "需要先返回安全地点"
			return null if state.hp < int(parameters["startingHp"]) or state.qi < Queries.max_qi(state, catalog) else "无需休整"
		"END_DAY":
			return null if _only_keys(action, ["type"]) else "操作格式不正确"
		"BUY":
			if not _only_keys(action, ["type", "item"]) or not ["herbs", "wine"].has(action.get("item")):
				return "未知补给"
			if state.location != "inn":
				return "需要到客栈买补给"
			var item: String = action["item"]
			var limit: int = int(parameters["herbCarryLimit"] if item == "herbs" else parameters["wineCarryLimit"])
			var price: int = int(parameters["herbPrice"] if item == "herbs" else parameters["winePrice"])
			if state.resources[item] >= limit:
				return "补给已达携带上限"
			return null if state.resources["stones"] >= price else "元石不足"
		"EQUIP":
			if not _only_keys(action, ["type", "guId", "equipped"]) or not _known_id(catalog, "gu", action.get("guId")) or not action.get("equipped") is bool:
				return "未知蛊或装备设置"
			if not state.inventory.has(action["guId"]):
				return "尚未获得此蛊"
			return "装备状态没有变化" if state.inventory[action["guId"]].equipped == action["equipped"] else null
		"GU_MODE":
			if not _only_keys(action, ["type", "guId", "mode"]) or not _known_id(catalog, "gu", action.get("guId")) or not ["seal", "wake"].has(action.get("mode")):
				return "未知蛊或养护操作"
			if not state.inventory.has(action["guId"]):
				return "尚未获得此蛊"
			var gu: GameState.GuState = state.inventory[action["guId"]]
			if action["mode"] == "seal" and gu.mode == "sealed":
				return "已经封存"
			if action["mode"] == "wake" and gu.mode == "active":
				return "已经清醒"
			var price: int = Rules._gu_price(gu, action["mode"], parameters)
			return null if state.resources["stones"] >= price else "养护需要%d元石" % price
		"CLEAR_EXPOSURE":
			if not _only_keys(action, ["type", "exposureId"]) or not Queries.has_exposure(state, action.get("exposureId")):
				return "没有这条暴露痕迹"
			if state.location != "inn":
				return "需要在客栈处理物证"
			return null if state.resources["stones"] >= int(parameters["clearExposureCost"]) else "处理物证需要4元石"
		"COMBAT":
			if not _only_keys(action, ["type", "move"]):
				return "操作格式不正确"
			match action.get("move"):
				"attack", "defend", "retreat":
					return null
				"moonlight", "jade-skin":
					var id: String = action["move"]
					if not Queries.is_gu_usable(state, id):
						return "需要清醒且装备的蛊"
					return null if state.qi >= int(catalog.by_id["gu"][id]["qiCost"]) else "真元不足"
				"herbs":
					if state.hp >= int(parameters["startingHp"]):
						return "生命已满"
					return null if state.resources["herbs"] > 0 and state.combat.herbs_used < 3 else "无药草或已用完本场3次疗伤机会"
				"wine":
					if state.qi >= Queries.max_qi(state, catalog):
						return "真元已满"
					return null if state.resources["wine"] > 0 and state.combat.wine_used < 3 else "无酒或已用完本场3次补充机会"
				_:
					return "未知战斗操作"
	return "未知操作"


static func _only_keys(action: Dictionary, allowed: Array[String]) -> bool:
	for key: Variant in action:
		if not allowed.has(key):
			return false
	return true


static func _known_id(catalog: ContentCatalog, section: String, id: Variant) -> bool:
	return id is String and catalog.has_id(section, id)
