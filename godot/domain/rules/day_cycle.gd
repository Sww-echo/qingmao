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
		# D1: unresolved inquiry becomes one persistent exposure after the final
		# upkeep, before the forced crisis opens.
		if catalog.is_v2() and state.flags.has("inquiry-due") \
				and not state.completed_events.has("inquiry") and not Queries.has_exposure(state, "inquiry-unresolved"):
			V1Effects.apply(state, {"kind": "exposure", "id": "inquiry-unresolved", "source": "学堂盘问未了结"}, "inquiry", catalog)
			Rules._log(state, "risk", "学堂盘问拖到狼群临门仍未了结，留下一条持久痕迹。")
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
	# D1: trigger before decay, using the pre-decay suspicion value.
	if catalog.is_v2() and state.suspicion >= int(parameters["inquiryThreshold"]) \
			and not state.flags.has("inquiry-due") \
			and not state.completed_events.has("inquiry") and not state.missed_events.has("inquiry"):
		Rules._flag(state, "inquiry-due")
		Rules._log(state, "risk", "疑心达到%d，学堂将在第8日后传唤盘问。" % int(parameters["inquiryThreshold"]))
	state.suspicion = maxi(0, state.suspicion - int(parameters["suspicionDecay"]))
	state.upkeep_due.clear()
	for definition: Dictionary in catalog.data["gu"]:
		var id: String = definition["id"]
		if state.inventory.has(id) and state.inventory[id].mode != "sealed":
			state.upkeep_due.append(id)
