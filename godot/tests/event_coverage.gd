extends SceneTree
## W5 event coverage: every one of the 19 V1 events must be reachable through
## the single generic event UI. We load golden states, render the real play
## scene, press the event button, and compare each choice's enabled state with
## the projected actionOptions. No per-event UI code is allowed.

const PLAY_SCENE := preload("res://scenes/play.tscn")
const ContentLoaderScript := preload("res://infrastructure/content_loader.gd")
const FIXTURES: Array[String] = [
	"res://tests/fixtures/prototype/war-ready-42.json",
	"res://tests/fixtures/prototype/network-42.json",
	"res://tests/fixtures/prototype/labor-42.json",
]

var _checks: int = 0
var _failures: PackedStringArray = []
var _catalog: ContentCatalog
var _probes: Dictionary = {}

func _initialize() -> void:
	_run()

func _run() -> void:
	var loaded: Dictionary = ContentLoaderScript.load_pack()
	if not loaded.ok:
		_fail("content load failed: %s" % loaded.error)
		_finish()
		return
	_catalog = loaded.catalog
	_collect_probes()
	var events: Array = _catalog.data.events
	_expect(events.size() == 19, "catalog has 19 events (found %d)" % events.size())
	for event: Dictionary in events:
		var id: String = event.id
		if not _probes.has(id):
			_fail("no golden state exposes %s" % id)
			continue
		await _check_event(event, _probes[id])
	print("W5 event coverage: %d events, %d checks, %d failures" % [
		events.size(), _checks, _failures.size()])
	_finish()

## For each event, keep the earliest decoded state where the event is actually
## available at its own location (or already active, for crisis-arrival).
func _collect_probes() -> void:
	for fixture: String in FIXTURES:
		var parsed: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(fixture))
		if parsed.is_empty():
			_fail("fixture did not parse: %s" % fixture)
			continue
		var trace: Dictionary = parsed.trace
		for index: int in range(trace.steps.size()):
			var raw: Dictionary = trace.steps[index].state
			if _probes.size() == _catalog.data.events.size():
				return
			if raw.ending != null or raw.combat != null:
				continue
			if raw.activeEvent != null:
				if not _probes.has(raw.activeEvent):
					_probes[raw.activeEvent] = {"state": raw, "index": index, "fixture": fixture, "active": true}
				continue
			var decoded: Dictionary = StateCodec.decode(raw, _catalog)
			if not decoded.ok:
				continue
			for event: Dictionary in Queries.available_events(decoded.state, _catalog):
				if event.location != raw.location:
					continue
				if not _probes.has(event.id):
					_probes[event.id] = {"state": raw, "index": index, "fixture": fixture, "active": false}

func _check_event(event: Dictionary, probe: Dictionary) -> void:
	var raw: Dictionary = probe.state
	var session: GameSession = GameSession.new()
	root.add_child(session)
	session.configure(_catalog, null)
	var run: Dictionary = session.load_run({
		"runId": "coverage-%s" % event.id, "revision": int(probe.index) + 1, "state": raw,
	})
	_expect(run.ok, "%s state loads" % event.id)
	if not run.ok:
		session.queue_free()
		return
	var play: Node = PLAY_SCENE.instantiate()
	play.configure(session)
	root.add_child(play)
	await process_frame
	await process_frame
	var view: Dictionary = session.snapshot_view()

	if bool(probe.active):
		_expect(play.get_node("%EventCenter").visible, "%s is already open in its golden state" % event.id)
	else:
		var button: Button = _find_event_button(play, String(event.title))
		_expect(button != null, "%s appears in the location's opportunity list" % event.id)
		if button != null:
			_expect(not button.disabled, "%s event button is enabled" % event.id)
			button.pressed.emit()
			await process_frame
			await process_frame
			_expect(play.get_node("%EventCenter").visible, "%s opens the generic event modal" % event.id)
	# Opening the event commits a new revision; choices only appear in the
	# refreshed projection, never in the pre-open view.
	view = session.snapshot_view()
	_expect(String(play.get_node("%EventTitle").text) == String(event.title),
		"%s modal title matches the content" % event.id)

	var choices: Array = event.choices
	var buttons: Array[Node] = _choice_buttons(play)
	_expect(buttons.size() == choices.size(), "%s renders %d choices" % [event.id, choices.size()])
	for index: int in range(mini(buttons.size(), choices.size())):
		var choice: Dictionary = choices[index]
		var option: Dictionary = _option(view, {"type": "CHOOSE", "choiceId": choice.id})
		var button: Button = buttons[index]
		_expect(not button.disabled == bool(option.ok),
			"%s/%s enabled state matches the view" % [event.id, choice.id])
		if not bool(option.ok):
			_expect(not String(button.tooltip_text).is_empty(),
				"%s/%s disabled choice explains why" % [event.id, choice.id])
	# The generic UI must not invent per-event buttons or hidden choices.
	_expect(play.get_node("%EventChoices").get_child_count() == choices.size(),
		"%s choice list has no extra controls" % event.id)
	play.queue_free()
	session.queue_free()
	await process_frame

func _find_event_button(play: Node, title: String) -> Button:
	for child: Node in play.get_node("%EventList").get_children():
		if child is Button and String(child.text).begins_with(title):
			return child
	return null

func _choice_buttons(play: Node) -> Array[Node]:
	var result: Array[Node] = []
	for child: Node in play.get_node("%EventChoices").get_children():
		if child is Button:
			result.append(child)
	return result

func _option(view: Dictionary, wanted: Dictionary) -> Dictionary:
	for option: Dictionary in view.actionOptions:
		if option.action == wanted:
			return option
	return {"ok": false, "reason": "missing option"}

func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		printerr("W5 event fail: " + message)

func _fail(message: String) -> void:
	_checks += 1
	_failures.append(message)
	printerr("W5 event fail: " + message)

func _finish() -> void:
	quit(0 if _failures.is_empty() else 1)
