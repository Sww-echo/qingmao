class_name V1Combat
extends RefCounted
## V1 battle start, announced-intent turns, victory, retreat and death.


static func start_battle(state: GameState, enemy_id: String, purpose: String, catalog: ContentCatalog) -> void:
	var enemy: Dictionary = catalog.by_id["enemies"][enemy_id]
	var combat := GameState.CombatState.new()
	combat.enemy_id = enemy_id
	combat.purpose = purpose
	combat.enemy_hp = int(enemy["hpMin"]) + floori(Rules._draw(state) * (int(enemy["hpMax"]) - int(enemy["hpMin"]) + 1))
	state.combat = combat
	if purpose == "crisis":
		state.crisis = "fighting"
	Rules._log(state, "combat", "%s接战，生命%d。意图和每次伤害在行动前可查。" % [enemy["name"], combat.enemy_hp])
	# D4: drilled gives one free opening strike in crisis battles only.
	if purpose == "crisis" and catalog.is_v2() and state.flags.has("drilled"):
		_opening_strike(state, catalog)


static func die(state: GameState, reason: String) -> void:
	state.hp = 0
	var was_crisis: bool = state.crisis != "approaching"
	state.ending = GameState.EndingState.new()
	state.ending.id = "overrun" if was_crisis else "lost-in-bamboo"
	state.ending.outcome = "death"
	state.ending.reasons.append(reason)
	if was_crisis:
		if state.cultivation < 12:
			state.ending.reasons.append("修为不足12，月刃威力与真元容量没有形成战备优势。")
		if not Queries.is_gu_usable(state, "jade-skin"):
			state.ending.reasons.append("没有有效玉皮蛊，连续攻击缺少减伤。")
		if not Queries.is_gu_usable(state, "moonlight"):
			state.ending.reasons.append("月光蛊未装备、休眠或封存，无法打出月刃。")
		if not state.flags.has("shelter-stocked"):
			state.ending.reasons.append("未落实庇护备粮，囤积的元石不能临时替代完整安排。")
		if not state.exposures.is_empty():
			state.ending.reasons.append("未处理的越界痕迹增加了追击压力。")
	state.combat = null
	state.active_event = null
	state.crisis = "resolved"
	Rules._log(state, "crisis", " ".join(state.ending.reasons))


static func apply(state: GameState, move: String, catalog: ContentCatalog) -> void:
	var combat: GameState.CombatState = state.combat
	var forecast: Dictionary = Queries.combat_forecast(state, catalog)
	var parameters: Dictionary = catalog.parameters
	if move == "retreat":
		state.action_counts["combat:retreat"] = state.action_counts.get("combat:retreat", 0) + 1
		var injury: int = maxi(0, int(parameters["retreatDamage"]) - (int(parameters["scoutProtection"]) if Queries.is_gu_usable(state, "ear-grass") else 0))
		state.hp = maxi(0, state.hp - injury)
		Rules._resource_delta(state, "stones", -mini(int(parameters["retreatStoneLoss"]), state.resources["stones"]), "retreat", catalog)
		state.combat = null
		state.location = "academy"
		Rules._log(state, "combat", "撤退，受%d伤害并损失至多%d元石；无胜利奖励。" % [injury, int(parameters["retreatStoneLoss"])])
		if combat.purpose == "crisis":
			die(state, "最终守望时放弃通道，未安排替代撤离，随后被狼群围困。")
		return
	var damage: int = 0
	match move:
		"attack":
			damage = 3 + floori(float(state.cultivation) / 6)
			state.qi = mini(Queries.max_qi(state, catalog), state.qi + 1)
		"moonlight":
			state.qi -= int(catalog.by_id["gu"]["moonlight"]["qiCost"])
			damage = int(catalog.by_id["gu"]["moonlight"]["power"]) + floori(float(state.cultivation) / 6) * 2
		"jade-skin":
			state.qi -= int(catalog.by_id["gu"]["jade-skin"]["qiCost"])
			combat.guard += 8
		"defend":
			combat.guard += 6
			state.qi = mini(Queries.max_qi(state, catalog), state.qi + 3)
		"herbs":
			Rules._resource_delta(state, "herbs", -1, "combat-healing", catalog)
			combat.herbs_used += 1
			state.hp = mini(int(parameters["startingHp"]), state.hp + int(parameters["herbHealing"]))
		"wine":
			Rules._resource_delta(state, "wine", -1, "combat-qi", catalog)
			combat.wine_used += 1
			state.qi = mini(Queries.max_qi(state, catalog), state.qi + int(parameters["wineQi"]))
	combat.enemy_hp = maxi(0, combat.enemy_hp - damage)
	var count: String = "combat:%s" % move
	state.action_counts[count] = state.action_counts.get(count, 0) + 1
	if combat.enemy_hp == 0:
		_resolve_defeat(state, catalog, combat)
		return
	# Defensive moves change guard, so recalculate damage without changing the published intent.
	var incoming: int = int(Queries.combat_forecast(state, catalog)["incomingDamage"])
	state.hp = maxi(0, state.hp - incoming)
	combat.guard = 0
	combat.turn += 1
	Rules._log(state, "combat", "%s造成%d伤害；%s造成%d伤害，剩余生命%d。" % [move, damage, forecast["intent"], incoming, state.hp])


## D3 shared defeat path: phase transition first, then the normal V1 victory.
static func _resolve_defeat(state: GameState, catalog: ContentCatalog, combat: GameState.CombatState) -> void:
	var enemy: Dictionary = catalog.by_id["enemies"][combat.enemy_id]
	if catalog.is_v2() and enemy.has("next"):
		var next_id: String = String(enemy["next"])
		var next_enemy: Dictionary = catalog.by_id["enemies"].get(next_id, {})
		if not next_enemy.is_empty():
			state.combat = GameState.CombatState.new()
			state.combat.enemy_id = next_id
			state.combat.purpose = combat.purpose
			state.combat.enemy_hp = int(next_enemy["hpMin"]) + floori(
				Rules._draw(state) * (int(next_enemy["hpMax"]) - int(next_enemy["hpMin"]) + 1))
			state.combat.turn = combat.turn
			state.combat.guard = 0
			state.combat.herbs_used = combat.herbs_used
			state.combat.wine_used = combat.wine_used
			state.qi = mini(Queries.max_qi(state, catalog), state.qi + int(catalog.parameters["phaseBreatherQi"]))
			Rules._log(state, "combat", "%s倒下；喘息回气，%s接战，生命%d。" % [
				enemy["name"], next_enemy["name"], state.combat.enemy_hp,
			])
			return
	state.combat = null
	if combat.purpose != "survey":
		Rules._resource_delta(state, "stones", int(enemy["rewardStones"]), "combat-victory", catalog)
	if combat.purpose == "patrol":
		state.relations["guard-captain"] = mini(100, state.relations["guard-captain"] + 3)
		Rules._flag(state, "patrol-cleared")
		Rules._log(state, "combat", "救援胜利：获得10元石和队长关系+3，敌人不再出手。")
	elif combat.purpose == "survey":
		Rules._log(state, "combat", "驱走侦察途中遇到的山狼；保留已采情报和药草，无巡山委托报酬或队长关系奖励。")
	else:
		state.crisis = "resolved"
		state.ending = GameState.EndingState.new()
		state.ending.id = "held-the-line"
		state.ending.outcome = "survived"
		state.ending.reasons.assign([
			"修为%d决定月刃伤害和真元容量；%s完成击退。" % [state.cultivation, "清醒月光蛊" if Queries.is_gu_usable(state, "moonlight") else "普通攻击"],
			"%s，剩余%d生命；本场使用药草%d份、酒%d份。" % ["清醒玉皮蛊降低连续受伤" if Queries.is_gu_usable(state, "jade-skin") else "没有玉皮减伤", state.hp, combat.herbs_used, combat.wine_used],
		])
		Rules._log(state, "crisis", " ".join(state.ending.reasons))


## D4 free opening strike. It shares the normal damage path but never triggers
## the enemy response or consumes a daily action.
static func _opening_strike(state: GameState, catalog: ContentCatalog) -> void:
	var combat: GameState.CombatState = state.combat
	if combat == null:
		return
	var moonlight: bool = Queries.is_gu_usable(state, "moonlight")
	var cost: int = int(catalog.by_id["gu"]["moonlight"]["qiCost"])
	var move: String = "moonlight" if moonlight and state.qi >= cost else "attack"
	var damage: int = 0
	if move == "moonlight":
		state.qi -= cost
		damage = int(catalog.by_id["gu"]["moonlight"]["power"]) + floori(float(state.cultivation) / 6) * 2
	else:
		damage = 3 + floori(float(state.cultivation) / 6)
		state.qi = mini(Queries.max_qi(state, catalog), state.qi + 1)
	combat.enemy_hp = maxi(0, combat.enemy_hp - damage)
	Rules._log(state, "combat", "演武先手：%s造成%d伤害。" % ["月刃" if move == "moonlight" else "普通攻击", damage])
	if combat.enemy_hp == 0:
		_resolve_defeat(state, catalog, combat)
