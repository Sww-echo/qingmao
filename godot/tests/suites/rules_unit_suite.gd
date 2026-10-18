class_name RulesUnitSuite
extends RefCounted

var _checks: int = 0
var _failures: PackedStringArray = []
var _catalog: ContentCatalog


func run(_tree: SceneTree) -> Dictionary:
	_checks = 0
	_failures = []
	var loaded: Dictionary = ContentLoader.load_pack()
	if not _expect(loaded["ok"], "rules unit content must load: %s" % loaded.get("error", "")):
		return _result()
	_catalog = loaded["catalog"]
	_requirement_boundaries()
	_rejected_actions()
	_event_boundaries()
	_query_and_input_isolation()
	_scout_rng_and_exposure()
	_upkeep_and_recovery()
	_final_day_boundary()
	_growth_and_caps()
	_combat_ordering()
	_combat_supplies_and_endings()
	_shelter_resolution()
	return _result()


func _requirement_boundaries() -> void:
	var state: GameState = Rules.create(42, _catalog)
	state.flags.append("briefed")
	state.cultivation = 12
	state.clues = 3
	state.relations["innkeeper"] = 2
	_add_gu(state, "moonlight")
	_add_exposure(state)
	var before: Dictionary = _data(state)
	for test: Dictionary in [
		{"requirement": {"kind": "flag", "id": "briefed", "present": true}, "error": null},
		{"requirement": {"kind": "flag", "id": "briefed", "present": false}, "error": "尚未落实：briefed"},
		{"requirement": {"kind": "flag", "id": "warned", "present": false}, "error": null},
		{"requirement": {"kind": "resource", "id": "stones", "min": 12}, "error": null},
		{"requirement": {"kind": "resource", "id": "stones", "min": 13}, "error": "stones至少需要13"},
		{"requirement": {"kind": "relation", "id": "innkeeper", "min": 2}, "error": null},
		{"requirement": {"kind": "relation", "id": "innkeeper", "min": 3}, "error": "innkeeper关系至少需要3"},
		{"requirement": {"kind": "cultivation", "min": 12}, "error": null},
		{"requirement": {"kind": "cultivation", "min": 13}, "error": "修为至少需要13"},
		{"requirement": {"kind": "clues", "min": 3}, "error": null},
		{"requirement": {"kind": "clues", "min": 4}, "error": "情报至少需要4"},
		{"requirement": {"kind": "gu", "id": "moonlight", "usable": false}, "error": null},
		{"requirement": {"kind": "gu", "id": "moonlight", "usable": true}, "error": null},
		{"requirement": {"kind": "gu", "id": "ear-grass", "usable": false}, "error": "尚未获得ear-grass"},
		{"requirement": {"kind": "gu", "id": "ear-grass", "usable": true}, "error": "需要清醒并装备的ear-grass"},
		{"requirement": {"kind": "exposure", "id": "unlicensed-survey"}, "error": null},
	]:
		var requirement: Dictionary = test["requirement"]
		var requirement_before: Dictionary = requirement.duplicate(true)
		_expect(Queries.requirement_error(state, requirement) == test["error"], "requirement boundary: %s" % requirement)
		_expect(_same(before, _data(state)) and _same(requirement_before, requirement), "requirement query preserves complete state and payload")
	state.exposures.clear()
	_expect(Queries.requirement_error(state, {"kind": "exposure", "id": "unlicensed-survey"}) == "没有这条暴露痕迹", "exposure requirement rejects absent evidence")
	state.inventory["moonlight"].mode = "dormant"
	_expect(Queries.requirement_error(state, {"kind": "gu", "id": "moonlight", "usable": false}) == null, "ownership requirement accepts a dormant owned Gu")
	_expect(Queries.requirement_error(state, {"kind": "gu", "id": "moonlight", "usable": true}) == "需要清醒并装备的moonlight", "usable requirement rejects dormant owned Gu")
	_expect(Queries.requirements_error(state, [{"kind": "clues", "min": 4}, {"kind": "resource", "id": "stones", "min": 13}]) == "情报至少需要4", "multiple requirements preserve first-failure order")


func _rejected_actions() -> void:
	var initial: GameState = Rules.create(5, _catalog)
	for test: Dictionary in [
		{"action": {}, "error": "操作格式不正确"},
		{"action": {"type": "UNKNOWN"}, "error": "未知操作"},
		{"action": {"type": "TRAVEL", "location": "missing"}, "error": "未知地点"},
		{"action": {"type": "TRAVEL", "location": "academy"}, "error": "已经在此处"},
		{"action": {"type": "TRAIN", "grant": 500}, "error": "操作格式不正确"},
		{"action": {"type": "CHOOSE", "choiceId": "receive"}, "error": "当前没有待决事件"},
		{"action": {"type": "COMBAT", "move": "attack"}, "error": "当前没有战斗"},
		{"action": {"type": "OPEN_EVENT", "eventId": "moonlight-issue"}, "error": "事件未开放、条件不足或已处理"},
		{"action": {"type": "BUY", "item": "jade-skin"}, "error": "未知补给"},
		{"action": {"type": "EQUIP", "guId": "moonlight", "equipped": 1}, "error": "未知蛊或装备设置"},
		{"action": {"type": "GU_MODE", "guId": "moonlight", "mode": "wake"}, "error": "尚未获得此蛊"},
	]:
		_reject(initial, test["action"], test["error"])
	var bamboo: GameState = _step(initial, {"type": "TRAVEL", "location": "bamboo"})
	_reject(bamboo, {"type": "WORK"}, "安全劳作只在学堂或客栈提供")
	_reject(bamboo, {"type": "TRAIN"}, "需要在学堂修炼")
	_reject(bamboo, {"type": "REST"}, "需要先返回安全地点")
	_reject(initial, {"type": "SCOUT"}, "需要在竹林侦察")
	_reject(initial, {"type": "REST"}, "无需休整")
	var tired: GameState = _copy(initial)
	tired.qi = 2
	_reject(tired, {"type": "TRAIN"}, "修炼需要3真元")
	tired.location = "bamboo"
	_reject(tired, {"type": "SCOUT"}, "侦察需要3真元")
	tired.actions = 0
	_reject(tired, {"type": "SCOUT"}, "今日行动已用完")
	var empty: GameState = _copy(initial)
	empty.location = "inn"
	empty.resources["stones"] = 0
	_reject(empty, {"type": "BUY", "item": "herbs"}, "元石不足")
	empty.resources["herbs"] = 6
	_reject(empty, {"type": "BUY", "item": "herbs"}, "补给已达携带上限")


func _event_boundaries() -> void:
	var initial: GameState = Rules.create(1, _catalog)
	var opened: GameState = _step(initial, {"type": "OPEN_EVENT", "eventId": "briefing"})
	_expect(opened.actions == 3 and opened.resources == initial.resources, "viewing an event costs no actions or resources")
	_reject(opened, {"type": "WORK"}, "请先处理当前事件")
	var dismissed: GameState = _step(opened, {"type": "DISMISS_EVENT"})
	_expect(dismissed.active_event == null and dismissed.completed_events.is_empty(), "dismissal does not complete an event")
	_expect(dismissed.actions == 3 and dismissed.log.size() == initial.log.size(), "dismissal consumes no time or log entries")
	var briefed: GameState = _event(dismissed, "briefing", "acknowledge")
	_expect(briefed.flags.has("briefed") and briefed.actions == 3, "free briefing applies its flag exactly once")
	var moonlight: GameState = _event(briefed, "moonlight-issue", "receive")
	_expect(moonlight.actions == 2 and moonlight.action_counts.get("event:moonlight-issue", 0) == 1, "committing an event pays its action cost once")
	_expect(moonlight.inventory.has("moonlight") and moonlight.upkeep_due == ["moonlight"], "receiving Gu equips it and incurs today's upkeep")
	_reject(moonlight, {"type": "OPEN_EVENT", "eventId": "moonlight-issue"}, "事件未开放、条件不足或已处理")
	_reject(moonlight, {"type": "CHOOSE", "choiceId": "receive"}, "当前没有待决事件")
	var second: GameState = _step(moonlight, {"type": "END_DAY"})
	var jade: GameState = _step(second, {"type": "OPEN_EVENT", "eventId": "jade-offer"})
	jade.resources["stones"] = 7
	_reject(jade, {"type": "CHOOSE", "choiceId": "buy-jade"}, "stones不足，需要8")
	jade.resources["stones"] = 8
	var bought: GameState = _step(jade, {"type": "CHOOSE", "choiceId": "buy-jade"})
	_expect(bought.resources["stones"] == 0 and bought.inventory.has("jade-skin"), "event cost is paid before its Gu reward")
	_expect(bought.ledger.back().source == "jade-offer" and bought.ledger.back().amount == -8, "event cost records its source in the ledger")
	var day_three: GameState = _step(_step(briefed, {"type": "END_DAY"}), {"type": "END_DAY"})
	_expect(_has_action(Queries.public_view(day_three, _catalog), {"type": "OPEN_EVENT", "eventId": "moonlight-issue"}), "event window includes its final date")
	var last_open: GameState = _step(day_three, {"type": "OPEN_EVENT", "eventId": "moonlight-issue"})
	var expired: GameState = _copy(last_open)
	expired.day = 4
	_reject(expired, {"type": "CHOOSE", "choiceId": "receive"}, "事件已过期或已结算")
	var late: GameState = _step(day_three, {"type": "END_DAY"})
	_expect(late.missed_events.has("moonlight-issue"), "advancing beyond an inclusive window records the missed event")
	_reject(late, {"type": "OPEN_EVENT", "eventId": "moonlight-issue"}, "事件未开放、条件不足或已处理")
	_expect(_step(late, {"type": "WORK"}).resources["stones"] == late.resources["stones"] + 2, "missing a reward leaves safe labor available")
	var wrong_location: GameState = _step(briefed, {"type": "TRAVEL", "location": "inn"})
	_reject(wrong_location, {"type": "OPEN_EVENT", "eventId": "moonlight-issue"}, "需要先到事件地点")


func _query_and_input_isolation() -> void:
	var state: GameState = _opening(1)
	state.actions = 0
	var before: Dictionary = _data(state)
	var moved: GameState = _step(state, {"type": "TRAVEL", "location": "inn"})
	_expect(moved.actions == 0 and moved.rng == state.rng and moved.rng_draws == state.rng_draws, "travel remains free with no daily actions left")
	var view: Dictionary = Queries.public_view(state, _catalog)
	_expect(not view["state"].has("seed") and not view["state"].has("rng") and not view["state"].has("rngDraws"), "public state excludes all private random fields")
	var other: GameState = _copy(state)
	other.seed = 999
	other.rng = 987654321
	other.rng_draws = 40
	_expect(_same(view, Queries.public_view(other, _catalog)), "queries are independent of private random state")
	_expect(_same(before, _data(state)), "queries preserve the complete source state")
	view["state"]["resources"]["stones"] = 999
	view["state"]["flags"].append("warned")
	view["state"]["inventory"]["moonlight"]["equipped"] = false
	_expect(_same(before, _data(state)), "public nested resources, flags and Gu records are detached")
	var opportunity: Dictionary = Queries.public_view(_opening(), _catalog)
	if _expect(not opportunity["availableEvents"].is_empty(), "there is an opportunity to test detached content"):
		opportunity["availableEvents"][0]["title"] = "mutated returned event"
		_expect(not _same(opportunity["availableEvents"], Queries.public_view(_opening(), _catalog)["availableEvents"]), "public opportunities are detached from content definitions")
	var clone: GameState = _step(state, {"type": "TRAVEL", "location": "inn"})
	clone.resources["stones"] = 99
	clone.inventory["moonlight"].equipped = false
	clone.flags.append("warned")
	clone.log[0].message = "changed accepted state"
	_expect(_same(before, _data(state)), "accepted action results deeply detach all mutable state records")


func _scout_rng_and_exposure() -> void:
	for seed: int in [0, 1]:
		var state: GameState = Rules.create(seed, _catalog)
		state.location = "bamboo"
		var first: Dictionary = Rng32.step(seed)
		var next: GameState = _step(state, {"type": "SCOUT"})
		_expect(next.actions == 2 and next.qi == 9 and next.clues == 1, "unaided scouting is legal and pays time and qi (seed %d)" % seed)
		_expect(next.resources["herbs"] == 3 and next.suspicion == 3, "unaided scouting grants herbs and concern (seed %d)" % seed)
		_expect(next.exposures.size() == 1 and next.exposures[0].id == "unlicensed-survey", "unaided scouting leaves concrete exposure (seed %d)" % seed)
		if seed == 0:
			var second: Dictionary = Rng32.step(first["rng"])
			_expect(next.combat != null and next.combat.purpose == "survey", "risk below 0.3 enters incidental survey combat")
			_expect(next.rng_draws == 2 and next.rng == second["rng"], "survey battle consumes risk then enemy-HP draws in order")
			if next.combat != null:
				_expect(next.combat.enemy_hp == 18 and next.hp == 28, "survey encounter rolls enemy HP without an opening enemy strike")
		else:
			_expect(next.combat == null and next.hp == 24, "risk at or above 0.3 resolves the deterministic injury formula")
			_expect(next.rng_draws == 1 and next.rng == first["rng"], "injury consumes only the one risk draw")
	var protected: GameState = Rules.create(0, _catalog)
	protected.location = "bamboo"
	_add_gu(protected, "ear-grass")
	var safe: GameState = _step(protected, {"type": "SCOUT"})
	_expect(safe.clues == 2 and safe.hp == protected.hp and safe.combat == null, "usable ear-grass prevents scouting injury and combat")
	_expect(safe.rng == protected.rng and safe.rng_draws == 0 and safe.exposures.is_empty(), "usable ear-grass suppresses the risk draw and exposure")
	for mode: String in ["dormant", "sealed"]:
		var inactive: GameState = _copy(protected)
		inactive.inventory["ear-grass"].mode = mode
		var risky: GameState = _step(inactive, {"type": "SCOUT"})
		_expect(risky.rng_draws == 2 and risky.clues == 1, "%s ear-grass confers no scouting protection" % mode)
	var unequipped: GameState = _copy(protected)
	unequipped.inventory["ear-grass"].equipped = false
	_expect(_step(unequipped, {"type": "SCOUT"}).rng_draws == 2, "unequipped ear-grass confers no scouting protection")
	var exposed: GameState = _step(Rules.create(42, _catalog), {"type": "TRAVEL", "location": "bamboo"})
	exposed = _step(exposed, {"type": "SCOUT"})
	exposed = _step(exposed, {"type": "SCOUT"})
	_expect(exposed.exposures.size() == 1, "repeated unaided surveys do not duplicate the exposure")
	var day_after: GameState = _step(exposed, {"type": "END_DAY"})
	_expect(day_after.exposures.size() == 1 and day_after.suspicion == 5, "nightly concern decay does not remove persistent evidence")
	day_after = _step(day_after, {"type": "TRAVEL", "location": "inn"})
	var cleared: GameState = _step(day_after, {"type": "CLEAR_EXPOSURE", "exposureId": "unlicensed-survey"})
	_expect(cleared.exposures.is_empty() and cleared.actions == day_after.actions - 1 and cleared.resources["stones"] == day_after.resources["stones"] - 4, "clearing evidence pays both costs and removes the exposure")
	_reject(cleared, {"type": "CLEAR_EXPOSURE", "exposureId": "unlicensed-survey"}, "没有这条暴露痕迹")


func _upkeep_and_recovery() -> void:
	var state: GameState = _opening()
	var unequipped: GameState = _step(state, {"type": "EQUIP", "guId": "moonlight", "equipped": false})
	_expect(Queries.upkeep(unequipped, _catalog) == 1, "unequipping does not waive upkeep")
	_expect(_step(unequipped, {"type": "END_DAY"}).resources["stones"] == 11, "unequipped Gu is charged at settlement")
	var sealed: GameState = _step(state, {"type": "GU_MODE", "guId": "moonlight", "mode": "seal"})
	_expect(sealed.resources["stones"] == 11 and sealed.actions == 1, "sealing pays one stone and one action")
	_expect(Queries.upkeep(sealed, _catalog) == 1 and sealed.upkeep_due.has("moonlight"), "sealing retains today's incurred obligation")
	var second: GameState = _step(sealed, {"type": "END_DAY"})
	_expect(second.resources["stones"] == 10 and Queries.upkeep(second, _catalog) == 0, "same-day sealed Gu is charged once and drops from next-day obligations")
	var third: GameState = _step(second, {"type": "END_DAY"})
	_expect(third.resources["stones"] == 10, "a Gu sealed for the whole day has no upkeep")
	var awake: GameState = _step(third, {"type": "GU_MODE", "guId": "moonlight", "mode": "wake"})
	_expect(awake.resources["stones"] == 8 and awake.upkeep_due == ["moonlight"], "waking sealed Gu pays two stones and restores today's obligation")
	_expect(_step(awake, {"type": "END_DAY"}).resources["stones"] == 7, "waking does not include the later daily food bill")
	var poor: GameState = _opening()
	_add_gu(poor, "jade-skin")
	poor.resources["stones"] = 1
	var starved: GameState = _step(poor, {"type": "END_DAY"})
	_expect(starved.resources["stones"] == 1 and starved.ledger.size() == poor.ledger.size(), "insufficient upkeep charges neither a partial bill nor a ledger entry")
	_expect(starved.inventory["moonlight"].mode == "dormant" and starved.inventory["jade-skin"].mode == "dormant", "insufficient upkeep makes all unsealed holdings dormant")
	_expect(Queries.upkeep(starved, _catalog) == 2, "dormant holdings still owe upkeep")
	var worked: GameState = _step(starved, {"type": "WORK"})
	var recovered: GameState = _step(worked, {"type": "END_DAY"})
	_expect(recovered.resources["stones"] == 1 and recovered.inventory["moonlight"].mode == "active" and recovered.inventory["jade-skin"].mode == "active", "safe labor funds later settlement and wakes dormant Gu")
	var empty: GameState = _opening()
	empty.resources["stones"] = 0
	var dormant: GameState = _step(empty, {"type": "END_DAY"})
	var earned: GameState = _step(dormant, {"type": "WORK"})
	var woken: GameState = _step(earned, {"type": "GU_MODE", "guId": "moonlight", "mode": "wake"})
	_expect(woken.resources["stones"] == 1 and woken.inventory["moonlight"].mode == "active", "a dormant Gu can be woken for one stone after safe work")


func _final_day_boundary() -> void:
	var before: GameState = _opening()
	before.day = 14
	before.actions = 1
	before.hp = 9
	before.qi = 2
	before.suspicion = 7
	before.resources["stones"] = 0
	var decision: GameState = _step(before, {"type": "END_DAY"})
	_expect(decision.day == 14 and decision.actions == 1, "final day settlement does not advance the date or reset actions")
	_expect(decision.hp == 9 and decision.qi == 2 and decision.suspicion == 7, "final day has no nightly healing, qi refill or concern decay")
	_expect(decision.inventory["moonlight"].mode == "dormant", "final food settlement precedes crisis capability checks")
	_expect(decision.active_event == "crisis-arrival" and decision.crisis == "decision" and decision.flags.has("crisis-arrived"), "final settlement opens the mandatory crisis decision")
	_expect(decision.upkeep_due == before.upkeep_due and decision.missed_events == before.missed_events, "final day skips next-day obligation reset and expired-window processing")
	_expect(decision.log[-2].kind == "upkeep" and decision.log[-1].kind == "crisis", "final logs put upkeep before arrival")
	_reject(decision, {"type": "TRAIN"}, "请先处理当前事件")
	_reject(decision, {"type": "GU_MODE", "guId": "moonlight", "mode": "wake"}, "请先处理当前事件")
	_reject(decision, {"type": "DISMISS_EVENT"}, "狼群已经抵达，不能再筹备")
	var battle: GameState = _step(decision, {"type": "CHOOSE", "choiceId": "stand"})
	_expect(battle.combat != null and battle.crisis == "fighting" and battle.rng_draws == decision.rng_draws + 1, "unconditional stand remains available after final starvation and rolls battle HP once")
	_reject(battle, {"type": "WORK"}, "请先完成战斗")


func _growth_and_caps() -> void:
	var regular: GameState = Rules.create(2, _catalog)
	var trained: GameState = _step(regular, {"type": "TRAIN"})
	_expect(trained.cultivation == 3 and trained.qi == 9 and trained.actions == 2, "ordinary cultivation pays qi and action for three growth")
	_add_gu(regular, "liquor-worm")
	_expect(_step(regular, {"type": "TRAIN"}).cultivation == 5, "usable liquor-worm grants two extra cultivation")
	regular.inventory["liquor-worm"].equipped = false
	_expect(_step(regular, {"type": "TRAIN"}).cultivation == 3, "unequipped liquor-worm does not increase cultivation")
	regular.inventory["liquor-worm"].equipped = true
	regular.inventory["liquor-worm"].mode = "sealed"
	_expect(_step(regular, {"type": "TRAIN"}).cultivation == 3, "sealed liquor-worm does not increase cultivation")
	regular.cultivation = 59
	_expect(_step(regular, {"type": "TRAIN"}).cultivation == 60, "cultivation gain clamps at the cap")
	regular.cultivation = 60
	_reject(regular, {"type": "TRAIN"}, "本情境修为已经达到上限")
	_expect(Queries.max_qi(regular, _catalog) == 22, "max qi grows by cultivation steps")
	var herbs: GameState = _opening()
	herbs.day = 4
	herbs.resources["herbs"] = 5
	var harvested: GameState = _event(herbs, "healer-herbs", "sort-herbs")
	_expect(harvested.resources["herbs"] == 6 and harvested.ledger.back().amount == 1, "event resource clamping records the actual one-herb delta")
	var full: GameState = _copy(herbs)
	full.resources["herbs"] = 6
	_expect(_event(full, "healer-herbs", "sort-herbs").ledger.size() == full.ledger.size(), "a fully clamped reward does not append a zero ledger entry")
	var rich: GameState = Rules.create(2, _catalog)
	rich.resources["stones"] = 99999
	var capped: GameState = _step(rich, {"type": "WORK"})
	_expect(capped.resources["stones"] == 100000 and capped.ledger.back().amount == 1, "safe labor clamps stones and records only the applied delta")
	var rest: GameState = Rules.create(2, _catalog)
	rest.hp = 27
	rest.qi = 11
	var rested: GameState = _step(rest, {"type": "REST"})
	_expect(rested.hp == 28 and rested.qi == 12 and rested.resources == rest.resources, "rest clamps both pools without resource costs")


func _combat_ordering() -> void:
	var state: GameState = _battle("patrol")
	_add_gu(state, "jade-skin")
	state.qi = 5
	var forecast: Dictionary = Queries.combat_forecast(state, _catalog)
	_expect(forecast["intent"] == "扑咬" and forecast["incomingDamage"] == 3 and forecast["defendingDamage"] == 0, "forecast includes usable passive armor and defensive reduction")
	var hit: GameState = _step(state, {"type": "COMBAT", "move": "attack"})
	_expect(hit.hp == state.hp - 3 and hit.qi == 6 and hit.combat.enemy_hp == 17, "ordinary attack restores qi before the published enemy strike")
	_expect(hit.actions == state.actions and hit.rng == state.rng and hit.rng_draws == state.rng_draws, "combat turns consume neither daily actions nor RNG")
	_expect(hit.combat.turn == 1 and hit.combat.guard == 0, "one enemy strike advances the intent cycle and clears temporary guard")
	var defended: GameState = _step(state, {"type": "COMBAT", "move": "defend"})
	_expect(defended.hp == state.hp and defended.qi == 8 and defended.combat.turn == 1, "defend applies new guard before exactly one enemy strike")
	var armored: GameState = _step(state, {"type": "COMBAT", "move": "jade-skin"})
	_expect(armored.hp == state.hp and armored.qi == 3 and armored.combat.guard == 0, "active jade-skin spends qi and applies its shield before retaliation")
	var asleep: GameState = _copy(state)
	asleep.inventory["jade-skin"].mode = "dormant"
	_expect(Queries.combat_forecast(asleep, _catalog)["incomingDamage"] == 5, "dormant armor grants no passive reduction")
	_reject(asleep, {"type": "COMBAT", "move": "jade-skin"}, "需要清醒且装备的蛊")
	var exposed: GameState = _copy(state)
	_add_exposure(exposed)
	_expect(Queries.combat_forecast(exposed, _catalog)["incomingDamage"] == 5, "each persistent exposure adds two incoming damage")
	var last: GameState = _copy(state)
	last.combat.enemy_hp = 1
	var won: GameState = _step(last, {"type": "COMBAT", "move": "attack"})
	_expect(won.combat == null and won.hp == last.hp, "lethal attack prevents any final enemy retaliation")
	_expect(won.resources["stones"] == last.resources["stones"] + 10 and won.relations["guard-captain"] == 3 and won.flags.has("patrol-cleared"), "patrol victory grants its real reward and relation")
	var survey: GameState = _copy(last)
	survey.combat.purpose = "survey"
	var incidental: GameState = _step(survey, {"type": "COMBAT", "move": "attack"})
	_expect(incidental.resources == survey.resources and incidental.relations == survey.relations and not incidental.flags.has("patrol-cleared"), "incidental survey victory grants no patrol reward")
	var escaped: GameState = _step(state, {"type": "COMBAT", "move": "retreat"})
	_expect(escaped.combat == null and escaped.location == "academy" and escaped.hp == 22 and escaped.resources["stones"] == 10, "retreat pays damage and stones then returns to safety")
	_expect(escaped.action_counts.get("combat:retreat", 0) == 1 and escaped.relations == state.relations and not escaped.flags.has("patrol-cleared"), "retreat is counted and pays no victory reward")
	var guided: GameState = _copy(state)
	_add_gu(guided, "ear-grass")
	guided.resources["stones"] = 1
	var guided_escape: GameState = _step(guided, {"type": "COMBAT", "move": "retreat"})
	_expect(guided_escape.hp == 26 and guided_escape.resources["stones"] == 0 and guided_escape.ledger.back().amount == -1, "usable ear-grass reduces retreat injury and stone loss clamps at the balance")


func _combat_supplies_and_endings() -> void:
	var state: GameState = _battle("crisis")
	state.hp = 27
	state.qi = 11
	state.resources["wine"] = 2
	var healed: GameState = _step(state, {"type": "COMBAT", "move": "herbs"})
	_expect(healed.hp == 22 and healed.resources["herbs"] == 1 and healed.combat.herbs_used == 1 and healed.combat.turn == 1, "herbs heal to max before exactly one enemy strike")
	var drank: GameState = _step(state, {"type": "COMBAT", "move": "wine"})
	_expect(drank.qi == 12 and drank.hp == 21 and drank.resources["wine"] == 1 and drank.combat.wine_used == 1, "wine caps qi before exactly one enemy strike")
	_expect(healed.rng_draws == state.rng_draws and drank.rng_draws == state.rng_draws, "combat supplies consume no random draws")
	var full: GameState = _copy(state)
	full.hp = 28
	full.qi = 12
	_reject(full, {"type": "COMBAT", "move": "herbs"}, "生命已满")
	_reject(full, {"type": "COMBAT", "move": "wine"}, "真元已满")
	var spent: GameState = _copy(state)
	spent.combat.herbs_used = 3
	spent.combat.wine_used = 3
	_reject(spent, {"type": "COMBAT", "move": "herbs"}, "无药草或已用完本场3次疗伤机会")
	_reject(spent, {"type": "COMBAT", "move": "wine"}, "无酒或已用完本场3次补充机会")
	var winning: GameState = _copy(state)
	winning.combat.enemy_hp = 1
	winning.combat.herbs_used = 2
	winning.combat.wine_used = 1
	var won: GameState = _step(winning, {"type": "COMBAT", "move": "attack"})
	if _expect(won.ending != null, "crisis victory creates an ending"):
		_expect(won.ending.id == "held-the-line" and won.ending.outcome == "survived" and won.crisis == "resolved", "crisis victory resolves the run")
		_expect("本场使用药草2份、酒1份" in " ".join(won.ending.reasons), "ending reports actual per-fight supplies rather than remaining reserve")
	_reject(won, {"type": "END_DAY"}, "本局已经结算")
	var fatal: GameState = _copy(state)
	fatal.hp = 1
	_add_exposure(fatal)
	var dead: GameState = _step(fatal, {"type": "COMBAT", "move": "attack"})
	if _expect(dead.ending != null, "a lethal published strike creates a death ending"):
		_expect(dead.hp == 0 and dead.combat == null and dead.active_event == null and dead.crisis == "resolved", "death clears combat and decision state")
		_expect(dead.ending.id == "overrun" and dead.ending.reasons.size() == 6, "crisis death accumulates cultivation, Gu, shelter and exposure causes")
		_expect(dead.ending.reasons[0] == "未能承受已展示的敌人意图，生命耗尽。", "combat death attributes its first cause to the published intent")
	var retreat: GameState = _step(state, {"type": "COMBAT", "move": "retreat"})
	_expect(retreat.ending != null and retreat.ending.id == "overrun" and retreat.hp == 0 and retreat.action_counts.get("combat:retreat", 0) == 1, "retreating from final defense ends in overrun and is counted")
	var early: GameState = _battle("survey")
	early.hp = 1
	var lost: GameState = _step(early, {"type": "COMBAT", "move": "attack"})
	_expect(lost.ending != null and lost.ending.id == "lost-in-bamboo" and lost.ending.reasons.size() == 1, "pre-crisis death retains its separate ending without final-crisis causes")


func _shelter_resolution() -> void:
	var decision: GameState = _decision("network")
	if decision == null:
		return
	var ready: GameState = _copy(decision)
	ready.clues = 8
	ready.relations["guard-captain"] = 100
	var sheltered: GameState = _step(ready, {"type": "CHOOSE", "choiceId": "take-shelter"})
	_expect(sheltered.ending != null and sheltered.ending.id == "shelter-secured" and sheltered.crisis == "resolved" and sheltered.combat == null, "sufficient real readiness fulfills shelter and ends safely")
	_expect(sheltered.resources["stones"] == ready.resources["stones"] - 6 and sheltered.rng_draws == ready.rng_draws + 1, "shelter pays escort fee once and consumes exactly one demand draw")
	var sleeping: GameState = _copy(decision)
	sleeping.inventory["ear-grass"].mode = "dormant"
	_reject(sleeping, {"type": "CHOOSE", "choiceId": "take-shelter"}, "需要清醒并装备的ear-grass")
	var untrusted: GameState = _copy(decision)
	untrusted.relations["guard-captain"] = 0
	_reject(untrusted, {"type": "CHOOSE", "choiceId": "take-shelter"}, "guard-captain关系至少需要3")
	var intercepted: GameState = _copy(decision)
	intercepted.hp = 11
	intercepted.clues = 5
	intercepted.relations["guard-captain"] = 3
	_add_exposure(intercepted)
	var fighting: GameState = _step(intercepted, {"type": "CHOOSE", "choiceId": "take-shelter"})
	_expect(fighting.hp == 1 and fighting.combat != null and fighting.crisis == "fighting", "failed shelter readiness injures before opening forced combat")
	_expect(fighting.resources["stones"] == intercepted.resources["stones"] - 6 and fighting.rng_draws == intercepted.rng_draws + 2, "failed shelter keeps its fee and draws demand before battle HP")
	intercepted.hp = 10
	var killed: GameState = _step(intercepted, {"type": "CHOOSE", "choiceId": "take-shelter"})
	if _expect(killed.ending != null, "lethal shelter interception creates an ending"):
		_expect(killed.ending.id == "overrun" and killed.combat == null and killed.rng_draws == intercepted.rng_draws + 1, "lethal interception never rolls an unused battle")
		_expect("遭截击损失10生命" in killed.ending.reasons[0] and "未能抵达庇护所" in killed.ending.reasons[0], "lethal shelter ending preserves the actual failed readiness cause")
		_expect(not "探索或撤退" in killed.ending.reasons[0], "shelter death does not fall through to the generic exploration cause")


func _opening(seed: int = 42) -> GameState:
	return _event(_event(Rules.create(seed, _catalog), "briefing", "acknowledge"), "moonlight-issue", "receive")


func _event(state: GameState, event_id: String, choice_id: String) -> GameState:
	var location: String = _catalog.by_id["events"][event_id]["location"]
	var next: GameState = state
	if next.location != location:
		next = _step(next, {"type": "TRAVEL", "location": location})
	next = _step(next, {"type": "OPEN_EVENT", "eventId": event_id})
	return _step(next, {"type": "CHOOSE", "choiceId": choice_id})


func _battle(purpose: String) -> GameState:
	var state: GameState = Rules.create(42, _catalog)
	state.combat = GameState.CombatState.new()
	state.combat.enemy_id = "crisis-pack" if purpose == "crisis" else "scout-wolf"
	state.combat.purpose = purpose
	state.combat.enemy_hp = 60 if purpose == "crisis" else 20
	if purpose == "crisis":
		state.day = 14
		state.crisis = "fighting"
		state.flags.append("crisis-arrived")
	return state


func _decision(strategy: String) -> GameState:
	var envelope: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://tests/fixtures/prototype/%s-42.json" % strategy))
	if not _expect(envelope is Dictionary, "boundary fixture must be readable for %s" % strategy):
		return null
	for step: Dictionary in envelope["trace"]["steps"]:
		if step["state"]["activeEvent"] == "crisis-arrival":
			var decoded: Dictionary = StateCodec.decode(step["state"], _catalog)
			if _expect(decoded["ok"], "crisis boundary fixture decodes for %s" % strategy):
				return decoded["state"]
	_expect(false, "missing crisis boundary fixture for %s" % strategy)
	return null


func _add_gu(state: GameState, id: String) -> void:
	var gu := GameState.GuState.new()
	gu.mode = "active"
	gu.equipped = true
	state.inventory[id] = gu
	if not state.upkeep_due.has(id):
		state.upkeep_due.append(id)


func _add_exposure(state: GameState) -> void:
	if not state.exposures.is_empty():
		return
	var exposure := GameState.ExposureState.new()
	exposure.id = "unlicensed-survey"
	exposure.source = "boundary fixture"
	exposure.day = state.day
	state.exposures.append(exposure)


func _copy(state: GameState) -> GameState:
	var decoded: Dictionary = StateCodec.decode(_data(state), _catalog)
	if not _expect(decoded["ok"], "boundary state clone must decode: %s" % decoded.get("error", "")):
		return state
	return decoded["state"]


func _step(state: GameState, action: Dictionary) -> GameState:
	var before: Dictionary = _data(state)
	var action_before: Dictionary = action.duplicate(true)
	var valid: Dictionary = Rules.validate(state, action, _catalog)
	if not _expect(valid["ok"], "action should be legal: %s (%s)" % [action, valid.get("error", "")]):
		return state
	var applied: Dictionary = Rules.apply(state, action, _catalog)
	if not _expect(applied["ok"], "legal action should apply: %s (%s)" % [action, applied.get("error", "")]):
		return state
	var next: GameState = applied["state"]
	_expect(next != state, "accepted %s creates a new state object" % action["type"])
	_expect(_same(before, _data(state)) and _same(action_before, action), "accepted %s preserves complete source state and action payload" % action["type"])
	_expect(StateCodec.encode(next, _catalog)["ok"], "accepted %s produces a codec-valid complete state" % action["type"])
	return next


func _reject(state: GameState, action: Dictionary, message: String) -> void:
	var before: Dictionary = _data(state)
	var action_before: Dictionary = action.duplicate(true)
	var valid: Dictionary = Rules.validate(state, action, _catalog)
	_expect(not valid["ok"] and valid.has("error"), "validation rejects %s" % action)
	if valid.has("error"):
		_expect(valid["error"] == {"code": "rule-rejected", "message": message, "fieldPath": "action"}, "rejection preserves exact reference reason for %s: %s" % [action, valid["error"]])
	_expect(_same(before, _data(state)), "rejected validation preserves full state including RNG, log, ledger and counts")
	var applied: Dictionary = Rules.apply(state, action, _catalog)
	_expect(not applied["ok"] and applied.get("error") == valid.get("error"), "apply returns the same rejection as validate")
	_expect(_same(before, _data(state)) and _same(action_before, action), "rejected apply preserves full state and action payload")


func _data(state: GameState) -> Dictionary:
	var encoded: Dictionary = StateCodec.encode(state, _catalog)
	if not _expect(encoded["ok"], "test state must encode: %s" % encoded.get("error", "")):
		return {}
	return encoded["data"]


func _same(first: Variant, second: Variant) -> bool:
	var left: Dictionary = CanonicalJson.encode(first)
	var right: Dictionary = CanonicalJson.encode(second)
	return left["ok"] and right["ok"] and left["bytes"] == right["bytes"]


func _has_action(view: Dictionary, action: Dictionary) -> bool:
	for candidate: Dictionary in view["legalActions"]:
		if candidate == action:
			return true
	return false


func _expect(condition: bool, message: String) -> bool:
	_checks += 1
	if not condition:
		_failures.append(message)
	return condition


func _result() -> Dictionary:
	return {"checks": _checks, "failures": _failures}
