extends SceneTree
## W6 balance report: seeds x strategies, full public-view policy loop.
## Usage:
##   -- --set=development|holdout|all [--out=/path/report.json]
## This is a balance instrument, not a scene playthrough.

const ContentLoaderScript := preload("res://infrastructure/content_loader.gd")

var _catalog: ContentCatalog
var _report: Dictionary = {}
var _out: String = ""

func _initialize() -> void:
	_run()

func _run() -> void:
	var options: Dictionary = _arguments()
	if not options.ok:
		printerr(options.error)
		quit(2)
		return
	_out = options.out
	var loaded: Dictionary = ContentLoaderScript.load_pack("qingmao14-v2")
	if not loaded.ok:
		printerr(loaded.error)
		quit(2)
		return
	_catalog = loaded.catalog
	var sets: Dictionary = {}
	if options.set in ["development", "all"]:
		sets.development = _seeds(1, 100)
	if options.set in ["holdout", "all"]:
		sets.holdout = _seeds(20001, 20100)
	_report = {
		"formatVersion": 1, "scenarioId": _catalog.data.scenarioId,
		"rulesVersion": _catalog.data.rulesVersion, "contentVersion": _catalog.data.contentVersion,
		"contentSha256": loaded.content_sha256, "set": options.set,
		"ablation": options.ablation,
		"seeds": sets, "startedAt": Time.get_datetime_string_from_system(),
		"windows": _window_coverage(), "strategies": {},
	}
	var strategy_reports: Dictionary = _report["strategies"]
	for cohort: String in sets:
		for strategy_id: String in V2Policies.STRATEGIES:
			var key: String = "%s/%s" % [cohort, strategy_id]
			strategy_reports[key] = _run_strategy(cohort, strategy_id, sets[cohort])
	_report["strategies"] = strategy_reports
	_report.finishedAt = Time.get_datetime_string_from_system()
	print(JSON.stringify(_report, "  ", false))
	if not _out.is_empty():
		var file: FileAccess = FileAccess.open(_out, FileAccess.WRITE)
		if file != null:
			file.store_string(JSON.stringify(_report, "  ", false) + "\n")
	print("W6 balance done: %s" % options.set)
	quit(0)

func _arguments() -> Dictionary:
	var set: String = "development"
	var out: String = ""
	var ablation: String = "none"
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--set="):
			set = argument.trim_prefix("--set=")
		elif argument.begins_with("--out="):
			out = argument.trim_prefix("--out=")
		elif argument.begins_with("--ablation="):
			ablation = argument.trim_prefix("--ablation=")
		else:
			return {"ok": false, "error": "unknown argument " + argument}
	if ablation not in V2Policies.ABLATIONS:
		return {"ok": false, "error": "unknown ablation " + ablation}
	V2Policies.ablation = ablation
	if set not in ["development", "holdout", "all"]:
		return {"ok": false, "error": "unknown set " + set}
	return {"ok": true, "set": set, "out": out, "ablation": ablation}

## Static window coverage: all events on days 5-13, and the nine V2-only events
## on days 7-13. This is a schema/table check, not proof that a player can meet
## every event's requirements on that day.
func _window_coverage() -> Dictionary:
	var new_ids: PackedStringArray = [
		"patrol-overtime", "academy-drill", "inquiry", "route-review", "fortify",
		"market-herbs", "market-wine", "final-march", "final-freight",
	]
	var all_by_day: Dictionary = {}
	var new_by_day: Dictionary = {}
	for day: int in range(1, 15):
		var all_ids: Array[String] = []
		var new_events: Array[String] = []
		for event: Dictionary in _catalog.data.events:
			if int(event.fromDay) <= day and day <= int(event.throughDay):
				all_ids.append(String(event.id))
				if new_ids.has(String(event.id)):
					new_events.append(String(event.id))
		all_by_day[day] = all_ids
		new_by_day[day] = new_events
	var full_ok: bool = true
	for day: int in range(5, 14):
		if (all_by_day[day] as Array).is_empty():
			full_ok = false
	var new_ok: bool = true
	for day: int in range(7, 14):
		if (new_by_day[day] as Array).is_empty():
			new_ok = false
	return {"all": all_by_day, "new": new_by_day, "days5to13Covered": full_ok, "days7to13NewCovered": new_ok}


func _seeds(from: int, to: int) -> Array[int]:
	var seeds: Array[int] = []
	for seed: int in range(from, to + 1):
		seeds.append(seed)
	return seeds

func _run_strategy(cohort: String, strategy_id: String, seeds: Array[int]) -> Dictionary:
	var survived: int = 0
	var deaths: int = 0
	var total_actions: int = 0
	var late_non_work: int = 0
	var late_actions: Array[int] = []
	var endings: Dictionary = {}
	var failure_reasons: Dictionary = {}
	var opened: Dictionary = {}
	var completed: Dictionary = {}
	var action_counts: Dictionary = {}
	var remaining_stones: int = 0
	var inquiry_exposures: int = 0
	var daily_opportunities: Dictionary = {}
	for seed: int in seeds:
		var state: GameState = Rules.create(seed, _catalog)
		if state == null:
			continue
		var steps: int = 0
		var late: int = 0
		var seen_events: Dictionary = {}
		while state.ending == null and steps < 400:
			steps += 1
			var view: Dictionary = ViewProjector.project(state, _catalog, "balance-%s-%d" % [strategy_id, seed], steps - 1, {})
			var before: Dictionary = state.to_data()
			# Sample the public opportunity list once at the start of each day.
			if state.actions == int(_catalog.parameters.actionsPerDay) and state.active_event == null \
					and state.combat == null and not daily_opportunities.has(str(state.day)):
				var day_key: String = str(state.day)
				var day_map: Dictionary = {}
				for event: Dictionary in view.availableEvents:
					day_map[String(event.id)] = 1
				daily_opportunities[day_key] = day_map
			var action: Dictionary = V2Policies.choose(strategy_id, view, _catalog)
			if action.is_empty():
				break
			var applied: Dictionary = Rules.apply(state, action, _catalog)
			if not applied.ok:
				break
			# Track a free/open action before replacing state.
			if action.type == "OPEN_EVENT":
				seen_events[action.eventId] = true
			state = applied.state
			var type: String = String(action.type)
			action_counts[type] = int(action_counts.get(type, 0)) + 1
			if state.day >= 8 and state.day <= 14 and _spends_day_action(before, state.to_data(), action):
				late += 1
			if action.type == "CHOOSE":
				completed[before.activeEvent] = true
		if state.ending != null:
			endings[state.ending.id] = int(endings.get(state.ending.id, 0)) + 1
			if state.ending.outcome == "survived":
				survived += 1
			else:
				deaths += 1
				for reason: String in state.ending.reasons:
					failure_reasons[reason] = int(failure_reasons.get(reason, 0)) + 1
			remaining_stones += state.resources.stones
		else:
			deaths += 1
			failure_reasons["unfinished"] = int(failure_reasons.get("unfinished", 0)) + 1
		for event_id: String in seen_events:
			opened[event_id] = int(opened.get(event_id, 0)) + 1
		if state.exposures.size() > 0:
			for exposure: GameState.ExposureState in state.exposures:
				if exposure.id == "inquiry-unresolved":
					inquiry_exposures += 1
		total_actions += steps
		late_non_work += late
		late_actions.append(late)
	var runs: int = seeds.size()
	return {
		"runs": runs, "survived": survived, "deaths": deaths,
		"survivalRate": float(survived) / maxf(1.0, float(runs)),
		"averageActions": float(total_actions) / maxf(1.0, float(runs)),
		"averageRemainingStones": float(remaining_stones) / maxf(1.0, float(runs)),
		"lateNonWork": late_actions,
		"averageLateNonWork": float(late_non_work) / maxf(1.0, float(runs)),
		"minLateNonWork": _min_int(late_actions),
		"endings": endings, "failureReasons": failure_reasons,
		"openedEvents": opened, "completedEvents": completed,
		"actionCounts": action_counts, "inquiryExposures": inquiry_exposures,
		"dailyOpportunities": daily_opportunities,
	}

## Count only actions that consumed a real day action, excluding WORK and free
## travel/open/equip/buy/combat moves. Coffee / no-cost actions do not count.
func _spends_day_action(before: Dictionary, after: Dictionary, action: Dictionary) -> bool:
	if action.type == "WORK" or action.type == "END_DAY":
		return false
	if action.type == "CHOOSE":
		var event: Dictionary = _catalog.by_id.events.get(str(before.activeEvent), {})
		return int(event.get("actionCost", 0)) > 0
	return int(after.actions) < int(before.actions)

func _min_int(values: Array[int]) -> int:
	if values.is_empty():
		return 0
	var result: int = values[0]
	for value: int in values:
		result = mini(result, value)
	return result
