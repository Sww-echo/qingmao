class_name V1DayCycle
extends RefCounted
## Upkeep precedes either ordinary recovery or the final-day crisis decision.


static func apply(state: GameState, catalog: ContentCatalog) -> void:
	var parameters: Dictionary = catalog.parameters
	var cost: int = Queries.upkeep(state, catalog)
	var can_feed: bool = state.resources["stones"] >= cost
	if can_feed:
		Rules._resource_delta(state, "stones", -cost, "daily-upkeep", catalog)
	for definition: Dictionary in catalog.data["gu"]:
		var id: String = definition["id"]
		if state.inventory.has(id) and state.inventory[id].mode != "sealed":
			state.inventory[id].mode = "active" if can_feed else "dormant"
	Rules._log(state, "upkeep", "供养%d元石；全体未封存蛊清醒，卸装不减免。" % cost if can_feed else "应付%d，余额%d不足；本轮不扣款，未封存蛊全部休眠。安全劳作和休整仍可用。" % [cost, state.resources["stones"]])
	if state.day == int(parameters["days"]):
		Rules._flag(state, "crisis-arrived")
		state.crisis = "decision"
		state.active_event = "crisis-arrival"
		Rules._log(state, "crisis", "最后一轮供养已结清。狼群抵达，请按已有准备应对。")
		return
	state.day += 1
	for event: Dictionary in catalog.data["events"]:
		if int(event["throughDay"]) < state.day and not state.completed_events.has(event["id"]) and not state.missed_events.has(event["id"]):
			state.missed_events.append(event["id"])
			Rules._log(state, "event", "%s的窗口已关闭；本局不补发该次奖励。" % event["title"])
	state.actions = int(parameters["actionsPerDay"])
	state.hp = mini(int(parameters["startingHp"]), state.hp + int(parameters["nightlyHealing"]))
	state.qi = Queries.max_qi(state, catalog)
	state.suspicion = maxi(0, state.suspicion - int(parameters["suspicionDecay"]))
	state.upkeep_due.clear()
	for definition: Dictionary in catalog.data["gu"]:
		var id: String = definition["id"]
		if state.inventory.has(id) and state.inventory[id].mode != "sealed":
			state.upkeep_due.append(id)
