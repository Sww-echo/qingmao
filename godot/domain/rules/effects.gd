class_name V1Effects
extends RefCounted
## Ordered content effects, including the V1 crisis shelter response.


static func apply(state: GameState, effect: Dictionary, source: String, catalog: ContentCatalog) -> void:
	var parameters: Dictionary = catalog.parameters
	match effect["kind"]:
		"resource":
			Rules._resource_delta(state, effect["id"], int(effect["amount"]), source, catalog)
		"relation":
			var id: String = effect["id"]
			state.relations[id] = clampi(state.relations[id] + int(effect["amount"]), -100, 100)
		"clues":
			state.clues = clampi(state.clues + int(effect["amount"]), 0, int(parameters["clueCap"]))
		"hp":
			state.hp = clampi(state.hp + int(effect["amount"]), 0, int(parameters["startingHp"]))
		"qi":
			state.qi = clampi(state.qi + int(effect["amount"]), 0, Queries.max_qi(state, catalog))
		"suspicion":
			state.suspicion = clampi(state.suspicion + int(effect["amount"]), 0, 100)
		"flag":
			Rules._flag(state, effect["id"])
		"gu":
			var id: String = effect["id"]
			if not state.inventory.has(id):
				var gu := GameState.GuState.new()
				gu.equipped = true
				state.inventory[id] = gu
			if not state.upkeep_due.has(id):
				state.upkeep_due.append(id)
		"exposure":
			if not Queries.has_exposure(state, effect["id"]):
				var exposure := GameState.ExposureState.new()
				exposure.id = effect["id"]
				exposure.source = effect["source"]
				exposure.day = state.day
				state.exposures.append(exposure)
		"battle":
			V1Combat.start_battle(state, effect["enemyId"], effect["purpose"], catalog)
		"crisis":
			if effect["response"] == "fight":
				V1Combat.start_battle(state, "crisis-pack", "crisis", catalog)
			else:
				var demand: int = int(parameters["crisisThreatMin"]) + floori(Rules._draw(state) * (int(parameters["crisisThreatMax"]) - int(parameters["crisisThreatMin"]) + 1))
				var readiness: int = state.clues + state.relations["guard-captain"] - state.exposures.size()
				if readiness >= demand:
					state.ending = GameState.EndingState.new()
					state.ending.id = "shelter-secured"
					state.ending.outcome = "survived"
					state.ending.reasons.assign([
						"地听草与路线标记发挥作用：情报%d＋队长关系%d−暴露%d＝准备%d，覆盖本次需求%d。" % [state.clues, state.relations["guard-captain"], state.exposures.size(), readiness, demand],
						"掌柜庇护、已交付药资与已完成守望班次兑现，支付6元石护送费后安全撤入。",
					])
					state.crisis = "resolved"
					Rules._log(state, "crisis", " ".join(state.ending.reasons))
				else:
					state.hp = maxi(0, state.hp - 10)
					Rules._log(state, "risk", "庇护准备%d不足以覆盖需求%d，遭截击损失10生命，%s。" % [readiness, demand, "转入战斗" if state.hp > 0 else "未能抵达庇护所"])
					if state.hp > 0:
						V1Combat.start_battle(state, "crisis-pack", "crisis", catalog)
					else:
						V1Combat.die(state, "庇护准备%d不足以覆盖需求%d，遭截击损失10生命，未能抵达庇护所。" % [readiness, demand])
