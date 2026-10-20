extends SceneTree
## W4 UI flow evidence: drives the real play scene through its own controls
## (button presses, modals, day review) for a complete war-ready run, then
## verifies the save round-trips. Not a substitute for human playtesting.

const PLAY_SCENE := preload("res://scenes/play.tscn")
const ContentLoaderScript := preload("res://infrastructure/content_loader.gd")

var _checks: int = 0
var _failures: PackedStringArray = []
var _play: Node
var _session: GameSession
var _save: SaveService
var _catalog: ContentCatalog
var _steps: int = 0
var _counts: Dictionary = {}
var _rejections: PackedStringArray = []
var _last_revision: int = -1
var _last_action: Dictionary = {}
## W5: run the same scene-driven flow for each policy. Default stays war-ready
## so the documented command is unchanged.
var _strategy: String = OS.get_environment("QINGMAO_FLOW_STRATEGY") \
	if OS.get_environment("QINGMAO_FLOW_STRATEGY") in V1Policies.STRATEGIES else "war-ready"
## W6: reuse the same scene-driven smoke run against the V2 pack. V2 has its own
## policies/balance work in the next increment; this only proves integration.
var _pack: String = OS.get_environment("QINGMAO_FLOW_PACK") \
	if OS.get_environment("QINGMAO_FLOW_PACK") in ["prototype", "qingmao14-v2"] else "prototype"

func _initialize() -> void:
	_run()

func _run() -> void:
	var loaded: Dictionary = ContentLoaderScript.load_pack(_pack)
	if not loaded.ok:
		_fail("content load failed: %s" % loaded.error)
		_finish()
		return
	_catalog = loaded.catalog
	var root_path: String = "user://w4-flow-%s-%d" % [_pack, Time.get_ticks_usec()]
	_session = GameSession.new()
	root.add_child(_session)
	_save = SaveService.new()
	root.add_child(_save)
	_save.configure(_catalog, loaded.content_sha256, DesktopSaveStore.new(), root_path)
	_session.configure(_catalog, _save)
	_session.command_rejected.connect(func(command_id: String, error: Dictionary) -> void:
		_rejections.append("%s: %s" % [command_id, error.message])
	)
	var started: Dictionary = _session.new_run(42)
	_expect(started.ok, "new run starts")
	_play = PLAY_SCENE.instantiate()
	_play.configure(_session)
	root.add_child(_play)
	await process_frame
	await process_frame
	_expect(_play.get_node("%ModalLayer").visible == false, "no modal on a fresh run")
	_expect(_play.get_node("%TravelInn").disabled == false, "travel is enabled on day one")
	_expect(_play.get_node("%TrainButton").disabled == false, "training is enabled on day one")
	_expect(_play.get_node("%ScoutButton").disabled, "scouting is disabled away from the bamboo")
	await _check_panel_and_location_contract()
	await _check_location_contract()
	await _check_pause_contract()

	var guard: int = 0
	while _session.snapshot_view().get("endingView", null) == null:
		guard += 1
		if guard > 400:
			_fail("run did not finish within 400 UI actions")
			break
		var view: Dictionary = _session.snapshot_view()
		var action: Dictionary = V1Policies.choose(_strategy, view, _catalog)
		if action.is_empty():
			_fail("policy returned no action on day %d" % int(view.state.day))
			break
		# The scene debounces an identical action repeated within 250 ms so a
		# double click cannot spend twice. A headless loop runs faster than that,
		# so model a human cadence instead of silently losing presses.
		if action == _last_action:
			await create_timer(0.3).timeout
		_last_action = action.duplicate(true)
		if not _press(action, view):
			break
		_steps += 1
		var action_type: String = String(action.type)
		_counts[action_type] = int(_counts.get(action_type, 0)) + 1
		await process_frame
		await process_frame
		var revision: int = _session.current_revision()
		if revision < _last_revision:
			_fail("revision went backwards: %d -> %d" % [_last_revision, revision])
		_last_revision = revision
		# The day review must be dismissed through its own button, and it must
		# block HUD actions even when a stale control is force-focused.
		if _play.get_node("%DayReviewCenter").visible:
			_expect(_play.get_node("%DayReviewContinue").disabled == false, "day review continue is enabled")
			var review_revision: int = _session.current_revision()
			_play._submit({"type": "WORK"})
			await process_frame
			await process_frame
			_expect(_session.current_revision() == review_revision, "day review blocks HUD actions")
			_expect(_play.get_node("%DayReviewCenter").visible, "day review stays until its own button is pressed")
			_press_button(_play.get_node("%DayReviewContinue"))
			await process_frame
			await process_frame

	var final_view: Dictionary = _session.snapshot_view()
	_expect(final_view.get("endingView", null) != null, "the UI run reaches an ending")
	_expect(_rejections.is_empty(), "no UI command was rejected (%s)" % "; ".join(_rejections))
	# Every policy must exercise events, work and day end through the real rules.
	for kind: String in ["OPEN_EVENT", "CHOOSE", "WORK", "END_DAY"]:
		_expect(int(_counts.get(kind, 0)) > 0, "%s UI run used %s at least once" % [_strategy, kind])
	if _strategy == "war-ready":
		_expect(int(_counts.get("TRAIN", 0)) > 0, "war-ready UI run trained")
		_expect(int(_counts.get("COMBAT", 0)) > 0, "war-ready UI run fought")
	if final_view.get("endingView", null) != null:
		var ending: Dictionary = final_view.endingView
		_expect(not (ending.reasons as Array).is_empty(), "%s ending explains reasons" % _strategy)
		if _pack == "prototype":
			var expected_id: String = {"war-ready": "held-the-line", "network": "shelter-secured", "labor": "overrun"}[_strategy]
			var expected_outcome: String = "death" if _strategy == "labor" else "survived"
			_expect(String(ending.outcome) == expected_outcome,
				"%s UI run outcome=%s (expected %s)" % [_strategy, ending.outcome, expected_outcome])
			_expect(String(ending.id) == expected_id,
				"%s UI run ending=%s (expected %s)" % [_strategy, ending.id, expected_id])
		_expect(_play.get_node("%EndingCenter").visible, "ending modal is shown")
		_expect(String(_play.get_node("%EndingBody").text).contains("原因"), "ending modal explains reasons")
	# The final state must be on disk and readable.
	_save.flush_pending()
	await process_frame
	var reloaded: Dictionary = _save.load(false)
	_expect(reloaded.ok, "final save is readable")
	if reloaded.ok:
		_expect(int(reloaded.body.revision) == _session.current_revision(), "save revision matches the session")
		var resumed: GameSession = GameSession.new()
		root.add_child(resumed)
		resumed.configure(_catalog, null)
		var loaded_run: Dictionary = resumed.load_run(reloaded.body)
		_expect(loaded_run.ok, "the final body loads into a fresh session")
		if loaded_run.ok:
			var reloaded_view: Dictionary = resumed.snapshot_view()
			_expect(str(reloaded_view.get("endingView", {}).get("id", "")) == str(final_view.get("endingView", {}).get("id", "")),
				"reloaded ending matches")
			# The HUD reads these fields, so they must survive the save round-trip.
			var expected_state: Dictionary = final_view.state
			var actual_state: Dictionary = reloaded_view.state
			var expected_json: Dictionary = CanonicalJson.encode(expected_state)
			var actual_json: Dictionary = CanonicalJson.encode(actual_state)
			_expect(expected_json.ok and actual_json.ok, "reloaded state encodes canonically")
			if expected_json.ok and actual_json.ok:
				_expect(String(actual_json.text) == String(expected_json.text), "reloaded state matches the final UI state")
			_expect(int(reloaded_view.maxHp) == int(final_view.maxHp), "reloaded maxHp matches")
			_expect(int(reloaded_view.maxQi) == int(final_view.maxQi), "reloaded maxQi matches")
			_expect(int(reloaded_view.upkeep) == int(final_view.upkeep), "reloaded upkeep matches")
		resumed.queue_free()
	print("W4 UI flow %s/%s: %d UI actions, %d checks, %d failures" % [
		_pack, _strategy, _steps, _checks, _failures.size()])
	_finish()

## The explain panel belongs to the academy world view; leaving the academy
## must close it and release the avatar. Academy hotspots must not be drawn over
## other locations.
func _check_panel_and_location_contract() -> void:
	_play._on_interaction_requested("academy.lecture", "学堂讲堂", "先生在此讲授蛊道基础。")
	await process_frame
	_expect(_play.get_node("%ExplainPanel").visible, "the explain panel opens for a hotspot")
	_expect(_play.get_node("%Prompt").visible == false, "opening the panel clears the hotspot prompt")
	_expect(_play.get_node("%Player").input_locked, "the avatar is locked while the panel is open")
	_play.get_node("%TravelInn").pressed.emit()
	await process_frame
	await process_frame
	_expect(not _play.get_node("%ExplainPanel").visible, "leaving the academy closes the explain panel")
	_expect(not _play.get_node("%Player").input_locked, "the avatar is unlocked after the panel closes")
	_expect(not _play.get_node("World/Hotspots/LectureHallSpot").visible,
		"academy hotspots are hidden outside the academy")
	_expect(_play.get_node("World/Hotspots/InnSpots").visible, "inn hotspots are visible in the inn")
	_play.get_node("%TravelAcademy").pressed.emit()
	await process_frame
	await process_frame
	_expect(_play.get_node("World/Hotspots/LectureHallSpot").visible,
		"academy hotspots return with the academy")
	_expect(not _play.get_node("%Player").input_locked, "the avatar stays unlocked back in the academy")
	# A prompt built while standing on a hotspot must not survive the location
	# change (the avatar never moves, so no focus-cleared signal fires).
	_play._on_focus_changed("academy.lecture", "学堂讲堂", "先生在此讲授蛊道基础。")
	await process_frame
	_expect(_play.get_node("%Prompt").visible, "focus shows the hotspot prompt in the academy")
	_play.get_node("%TravelBamboo").pressed.emit()
	await process_frame
	await process_frame
	_expect(not _play.get_node("%Prompt").visible, "leaving the academy clears the hotspot prompt")
	_play.get_node("%TravelAcademy").pressed.emit()
	await process_frame
	await process_frame

## W5: each location has its own geometry, hotspots and safe spawn point.
func _check_location_contract() -> void:
	var player: Node2D = _play.get_node("%Player")
	for location: String in ["inn", "bamboo", "academy"]:
		_play.get_node("%Travel" + location.capitalize()).pressed.emit()
		await process_frame
		await process_frame
		var state: Dictionary = _session.snapshot_view().state
		_expect(String(state.location) == location, "travel reaches %s" % location)
		var spawn: Vector2 = _play.LOCATION_SPAWNS[location]
		_expect(_play.get_node("%Player").position.is_equal_approx(spawn),
			"player spawns at the safe point in %s" % location)
		var inn: bool = location == "inn"
		var bamboo: bool = location == "bamboo"
		var academy: bool = location == "academy"
		_expect(_play.get_node("World/InnCounter").visible == inn, "inn counter follows the inn")
		_expect(_play.get_node("World/BambooEdge").visible == bamboo, "bamboo edge follows the bamboo")
		_expect(_play.get_node("World/LectureHall").visible == academy, "academy hall follows the academy")
		_expect(_play.get_node("World/Hotspots/InnSpots").visible == inn, "inn hotspots follow the inn")
		_expect(_play.get_node("World/Hotspots/BambooSpots").visible == bamboo, "bamboo hotspots follow the bamboo")
		var visible_ids: PackedStringArray = []
		for hotspot in _play.get_tree().get_nodes_in_group("interactable"):
			if hotspot.is_visible_in_tree():
				visible_ids.append(String(hotspot.target_id))
		_expect(visible_ids.size() == (2 if inn else (3 if bamboo else 3)),
			"only %s hotspots are interactable (%s)" % [location, ", ".join(visible_ids)])
		var expected_target: String = {"inn": "inn.counter", "bamboo": "bamboo.edge", "academy": "academy.lecture"}[location]
		var target_hotspot: Node2D = null
		for hotspot in _play.get_tree().get_nodes_in_group("interactable"):
			if hotspot.target_id == expected_target and hotspot.is_visible_in_tree():
				target_hotspot = hotspot
				break
		_expect(target_hotspot != null, "%s hotspot is registered" % location)
		if target_hotspot != null:
			# Standing on the hotspot must focus it and E must open its panel.
			player.position = target_hotspot.position
			for frame: int in range(4):
				await physics_frame
				await process_frame
			_expect(_play.get_node("%Prompt").visible, "%s hotspot shows an interaction prompt" % location)
			_key(KEY_E)
			await process_frame
			await process_frame
			_expect(_play.get_node("%ExplainPanel").visible, "%s hotspot opens the explain panel" % location)
			if _play.get_node("%ExplainPanel").visible:
				_play._close_panel()
				await process_frame
	# The relation/risk readout is a projection of state, not UI math.
	var relations: Dictionary = _session.snapshot_view().state.relations
	var line: String = String(_play.get_node("%RelationLine").text)
	_expect(line.contains("巡山队长 %d" % int(relations.get("guard-captain", 0))),
		"relation line shows the guard captain")
	_expect(line.contains("客栈掌柜 %d" % int(relations.get("innkeeper", 0))),
		"relation line shows the innkeeper")

## Pause owns the screen: neither Tab nor a force-focused HUD button may reach
## the daily actions behind it.
func _check_pause_contract() -> void:
	_play.get_node("%PauseButton").pressed.emit()
	await process_frame
	_expect(_play.get_node("%PauseCenter").visible, "pause modal opens")
	var escaped: bool = false
	for index: int in range(24):
		_key(KEY_TAB)
		await process_frame
		var owner: Control = _play.get_viewport().gui_get_focus_owner()
		if owner == null or not _play.get_node("%ModalLayer").is_ancestor_of(owner):
			escaped = true
			break
	_expect(not escaped, "Tab stays inside the pause modal")
	var pause_revision: int = _session.current_revision()
	# Submit through the same entry point a HUD button uses. Focus is already
	# contained by the test above; this asserts the modal gate itself.
	_play._submit({"type": "WORK"})
	await process_frame
	await process_frame
	_expect(_session.current_revision() == pause_revision, "pause blocks HUD actions")
	_expect(_play.get_node("%PauseCenter").visible, "pause stays visible until resumed")
	_press_button(_play.get_node("%PauseResume"))
	await process_frame
	_expect(not _play.get_node("%PauseCenter").visible, "resuming closes the pause modal")

func _key(code: Key) -> void:
	for pressed: bool in [true, false]:
		var event := InputEventKey.new()
		event.keycode = code
		event.physical_keycode = code
		event.pressed = pressed
		Input.parse_input_event(event)

func _press(action: Dictionary, view: Dictionary) -> bool:
	match String(action.type):
		"TRAVEL":
			var buttons: Dictionary = {
				"academy": "%TravelAcademy", "inn": "%TravelInn", "bamboo": "%TravelBamboo",
			}
			return _press_button(_play.get_node(buttons[action.location]))
		"OPEN_EVENT":
			var title: String = ""
			for event: Dictionary in view.availableEvents:
				if event.id == action.eventId:
					title = String(event.title)
			return _press_matching(_play.get_node("%EventList"), title)
		"CHOOSE":
			var label: String = ""
			for choice: Dictionary in view.activeEvent.choices:
				if choice.id == action.choiceId:
					label = String(choice.label)
			return _press_matching(_play.get_node("%EventChoices"), label)
		"DISMISS_EVENT":
			return _press_button(_play.get_node("%EventDismissButton"))
		"COMBAT":
			var move_labels: Dictionary = {
				"attack": "普通攻击", "defend": "防御（减伤并回气）", "moonlight": "月刃",
				"jade-skin": "玉皮护盾", "herbs": "用药草疗伤", "wine": "饮清酒回气",
				"retreat": "撤退",
			}
			return _press_matching(_play.get_node("%CombatActions"), move_labels[action.move])
		"WORK":
			return _press_button(_play.get_node("%WorkButton"))
		"TRAIN":
			return _press_button(_play.get_node("%TrainButton"))
		"SCOUT":
			return _press_button(_play.get_node("%ScoutButton"))
		"REST":
			return _press_button(_play.get_node("%RestButton"))
		"END_DAY":
			return _press_button(_play.get_node("%EndDayButton"))
		"BUY":
			return _press_button(_play.get_node("%BuyHerbsButton" if action.item == "herbs" else "%BuyWineButton"))
		"CLEAR_EXPOSURE":
			return _press_button(_play.get_node("%ClearExposureButton"))
		"EQUIP", "GU_MODE":
			return _press_gu(action, view)
	return false

func _press_gu(action: Dictionary, view: Dictionary) -> bool:
	if not _press_button(_play.get_node("%GuButton")):
		return false
	var list: VBoxContainer = _play.get_node("%GuList")
	var index: int = 0
	for definition: Dictionary in view.gu:
		if definition.id == action.guId:
			break
		index += 1
	var row: Node = list.get_child(index * 2)
	var buttons: HBoxContainer = row.get_child(row.get_child_count() - 1)
	var pressed: bool = _press_button(buttons.get_child(0)) if action.type == "EQUIP" \
		else _press_button(buttons.get_child(1))
	_press_button(_play.get_node("%GuCloseButton"))
	return pressed

func _press_matching(container: Node, prefix: String) -> bool:
	for child: Node in container.get_children():
		if child is Button and String(child.text).begins_with(prefix):
			if (child as Button).disabled:
				_fail("control for '%s' is disabled" % prefix)
				return false
			return _press_button(child)
	_fail("no control found for '%s'" % prefix)
	return false

func _press_button(button: Node) -> bool:
	if button == null or not button is Button:
		_fail("control is missing")
		return false
	if (button as Button).disabled:
		_fail("control '%s' is disabled" % button.name)
		return false
	(button as Button).pressed.emit()
	return true

func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		printerr("W4 flow fail: " + message)

func _fail(message: String) -> void:
	_checks += 1
	_failures.append(message)
	printerr("W4 flow fail: " + message)

func _finish() -> void:
	quit(0 if _failures.is_empty() else 1)
