extends Node2D
## W4 playable day 1: session-driven HUD, location/action panel, event, gu,
## combat, day-review, pause and ending modals. No rule state is stored here.

signal exit_requested()
signal quit_requested()

const SCOPE_NOTE := "真实规则 · 可玩第 1 日（三地点场景属 W5）"
const WORLD_SCENE_LOCATION := "academy"
## Safe spawn points per location; scenes never persist these (W5 design).
const LOCATION_SPAWNS := {
	"academy": Vector2(900, 580),
	"inn": Vector2(520, 520),
	"bamboo": Vector2(620, 520),
}
const ENDING_NAMES := {
	"held-the-line": "守住通道",
	"shelter-secured": "庇护所落定",
	"overrun": "被狼群击溃",
	"lost-in-bamboo": "折损于竹林",
}
const MOVE_LABELS := {
	"attack": "普通攻击（回1真元）",
	"defend": "防御（减伤并回气）",
	"moonlight": "月刃",
	"jade-skin": "玉皮护盾",
	"herbs": "用药草疗伤（1药草）",
	"wine": "饮清酒回气（1清酒）",
	"retreat": "撤退（受伤并损失元石）",
}
const KIND_COLORS := {
	"event": "#d8c48a",
	"economy": "#9fd4a6",
	"growth": "#8fc4e8",
	"management": "#c9c9c9",
	"risk": "#e8a08f",
	"combat": "#e8b06f",
	"upkeep": "#c9a6e0",
	"crisis": "#e8a08f",
}
const KIND_LABELS := {
	"event": "事件",
	"economy": "经济",
	"growth": "成长",
	"management": "经营",
	"risk": "风险",
	"combat": "战斗",
	"upkeep": "供养",
	"crisis": "危机",
}
## Ledger source ids are stable rule keys; only the display layer translates them.
const SOURCE_LABELS := {
	"safe-labor": "安全劳作",
	"daily-upkeep": "日暮供养",
	"buy-herbs": "购买药草",
	"buy-wine": "购买清酒",
	"gu-seal": "封存蛊虫",
	"gu-wake": "唤醒蛊虫",
	"clear-exposure": "处理物证",
	"combat-healing": "战斗疗伤",
	"combat-qi": "战斗饮酒",
	"combat-victory": "战斗胜利",
	"retreat": "撤退",
	"bamboo-survey": "竹林侦察",
	"work": "安全劳作",
}
const SAVE_ERROR_LABELS := {
	"storage-unavailable": "存储不可用",
	"enqueue-failed": "保存入队失败",
	"not-configured": "保存未配置",
	"busy": "保存繁忙",
	"no-active-run": "尚无进行中的一局",
	"stale-save": "快照已过期",
	"superseded": "本次保存已被新进度取代",
	"tmp-validation-failed": "临时存档校验失败",
	"final-validation-failed": "存档确认校验失败",
	"recovery-failed": "从备份恢复后写盘失败",
	"no-valid-save": "没有可用的正式存档",
	"no-save": "尚无存档",
}
## A real double-click delivers two pressed signals; only the first identical
## action may spend. Distinct actions are never suppressed.
const DOUBLE_CLICK_GUARD_MSEC := 250

@onready var _player: CharacterBody2D = %Player
@onready var _interaction: Node = %InteractionController
@onready var _prompt: Label = %Prompt
@onready var _panel: PanelContainer = %ExplainPanel
@onready var _panel_title: Label = %ExplainTitle
@onready var _panel_body: Label = %ExplainBody
@onready var _status_line: Label = %StatusLine
@onready var _session_hud: Label = %SessionHud
@onready var _save_status: Label = %SaveStatus
@onready var _location_name: Label = %LocationName
@onready var _location_desc: Label = %LocationDesc
@onready var _event_list: VBoxContainer = %EventList
@onready var _last_event: Label = %LastEvent
@onready var _log_list: RichTextLabel = %LogList
@onready var _modal_layer: Control = %ModalLayer
@onready var _event_center: CenterContainer = %EventCenter
@onready var _gu_center: CenterContainer = %GuCenter
@onready var _combat_center: CenterContainer = %CombatCenter
@onready var _review_center: CenterContainer = %DayReviewCenter
@onready var _pause_center: CenterContainer = %PauseCenter
@onready var _ending_center: CenterContainer = %EndingCenter
@onready var _event_choices: VBoxContainer = %EventChoices
@onready var _gu_list: VBoxContainer = %GuList
@onready var _combat_actions: VBoxContainer = %CombatActions
@onready var _review_body: RichTextLabel = %DayReviewBody
@onready var _ending_body: RichTextLabel = %EndingBody

var _session: GameSession
var _load_notice: String = ""
var _command_serial: int = 0
var _view: Dictionary = {}
var _pause_open: bool = false
var _review_dismissed_revision: int = -1
var _event_key: String = ""
var _focus_before_modal: Control = null
var _last_submit_action: Dictionary = {}
var _last_submit_msec: int = -100000
var _notice: String = ""
var _review_key: String = ""
var _had_modal: bool = false
var _last_location: String = ""
var _last_visual_location: String = ""
var _panel_location: String = ""

func configure(session: GameSession, load_notice: String = "") -> void:
	_session = session
	_load_notice = load_notice

func _ready() -> void:
	_prompt.visible = false
	_panel.visible = false
	_modal_layer.visible = false
	_status_line.text = SCOPE_NOTE
	for hotspot in get_tree().get_nodes_in_group("interactable"):
		_interaction.register(hotspot)
	_interaction.focus_changed.connect(_on_focus_changed)
	_interaction.focus_cleared.connect(_on_focus_cleared)
	_interaction.interaction_requested.connect(_on_interaction_requested)
	%TravelAcademy.pressed.connect(_travel.bind("academy"))
	%TravelInn.pressed.connect(_travel.bind("inn"))
	%TravelBamboo.pressed.connect(_travel.bind("bamboo"))
	%WorkButton.pressed.connect(_submit.bind({"type": "WORK"}))
	%TrainButton.pressed.connect(_submit.bind({"type": "TRAIN"}))
	%ScoutButton.pressed.connect(_submit.bind({"type": "SCOUT"}))
	%RestButton.pressed.connect(_submit.bind({"type": "REST"}))
	%EndDayButton.pressed.connect(_submit.bind({"type": "END_DAY"}))
	%BuyHerbsButton.pressed.connect(_submit.bind({"type": "BUY", "item": "herbs"}))
	%BuyWineButton.pressed.connect(_submit.bind({"type": "BUY", "item": "wine"}))
	%GuButton.pressed.connect(_open_gu)
	%GuCloseButton.pressed.connect(_close_gu)
	%ClearExposureButton.pressed.connect(_clear_exposure)
	%PauseButton.pressed.connect(_open_pause)
	%PauseResume.pressed.connect(_close_pause)
	%PauseTitleReturn.pressed.connect(_return_to_title)
	%PauseQuit.pressed.connect(func() -> void: quit_requested.emit())
	%EventDismissButton.pressed.connect(_dismiss_event)
	%DayReviewContinue.pressed.connect(_dismiss_review)
	%EndingReturn.pressed.connect(_return_to_title)
	if _session != null:
		_session.state_committed.connect(_on_state_committed)
		_session.command_rejected.connect(_on_command_rejected)
		_session.save_status_changed.connect(_on_save_status_changed)
		_render(_session.snapshot_view())
		if not _load_notice.is_empty():
			_set_notice(_load_notice)
	else:
		_session_hud.text = "没有活动会话"

func _unhandled_input(event: InputEvent) -> void:
	if _panel.visible and event.is_action_pressed("interact"):
		get_viewport().set_input_as_handled()
		_close_panel()
		return
	if not event.is_action_pressed("ui_cancel"):
		return
	get_viewport().set_input_as_handled()
	if _panel.visible:
		_close_panel()
	elif _ending_center.visible:
		_return_to_title()
	elif _pause_center.visible:
		_close_pause()
	elif _review_center.visible:
		_dismiss_review()
	elif _gu_center.visible:
		_close_gu()
	elif _event_center.visible:
		_dismiss_event()
	elif _combat_center.visible:
		_set_notice("战斗尚未结束：请选择一招或撤退。")
	else:
		_open_pause()

func _on_focus_changed(_target_id: String, display_name: String, _description: String) -> void:
	if _panel.visible or _any_modal_visible() or not _world_scene_active():
		return
	_prompt.text = "按 E 查看「%s」" % display_name
	_prompt.visible = true

func _on_focus_cleared() -> void:
	_prompt.visible = false

func _on_interaction_requested(
	_target_id: String, display_name: String, description: String
) -> void:
	if _panel.visible or _any_modal_visible() or not _world_scene_active():
		return
	_panel_title.text = display_name
	_panel_body.text = description
	_panel_location = String(_view.state.location)
	_panel.visible = true
	_prompt.visible = false
	_set_world_input(false)

func _world_scene_active() -> bool:
	# W5: the avatar exists in all three locations, not only the academy.
	return not _view.is_empty()

func _close_panel() -> void:
	_panel.visible = false
	_set_world_input(not _modal_layer.visible)
	_interaction.refocus()

func _travel(location: String) -> void:
	_submit({"type": "TRAVEL", "location": location})

func _clear_exposure() -> void:
	if _view.is_empty():
		return
	var exposures: Array = _view.state.exposures
	if exposures.is_empty():
		return
	_submit({"type": "CLEAR_EXPOSURE", "exposureId": exposures[0].id})

func _submit(action: Dictionary) -> void:
	if _session == null or _view.is_empty():
		return
	# The explain panel belongs to the world view. Clicking a toolbar action
	# closes it first, then runs the action the player asked for.
	if _panel.visible:
		_close_panel()
	# A modal owns the screen: only the actions that modal renders may run.
	# Buttons behind the dimmer must not be reachable even through focus/Enter.
	if not _modal_action_allowed(action):
		return
	var now: int = Time.get_ticks_msec()
	if action == _last_submit_action and now - _last_submit_msec <= DOUBLE_CLICK_GUARD_MSEC:
		return
	_last_submit_action = action.duplicate(true)
	_last_submit_msec = now
	# A fresh command clears the previous rejection/notice. The committed signal
	# renders the new log entry; a rejection renders its reason below.
	_notice = ""
	_command_serial += 1
	var result: Dictionary = _session.dispatch({
		"commandId": "ui-%d-%d" % [int(_view.revision), _command_serial],
		"runId": _view.runId,
		"baseRevision": int(_view.revision),
		"type": "action",
		"action": action,
	})
	if not result.ok:
		_set_notice("动作被拒绝：%s" % result.error.message)
		_render(_session.snapshot_view())
	elif bool(result.get("dedup", false)):
		# A replayed result emits no state_committed signal.
		_render(_session.snapshot_view())

func _on_state_committed(_revision: int, view: Dictionary, _events: Array) -> void:
	_render(view)

func _on_command_rejected(_command_id: String, error: Dictionary) -> void:
	_set_notice("动作被拒绝：%s" % error.message)

func _on_save_status_changed(status: String, saved_revision: int, error_code: String) -> void:
	if _view.is_empty():
		return
	# Save progress only changes two labels. Rebuilding action lists here would
	# drop keyboard focus and could rebuild a modal mid-click.
	_view["saveStatus"] = SessionContracts.save_status(status, saved_revision, error_code)
	var label: String = _save_label(_view.saveStatus)
	_save_status.text = label
	%PauseStatus.text = "当前 revision %d · %s" % [int(_view.revision), label]

func _set_notice(text: String) -> void:
	_notice = text
	_last_event.text = text

func _render(view: Dictionary) -> void:
	if view.is_empty():
		return
	_view = view
	var state: Dictionary = view.state
	# The explanation panel belongs to the location it was opened in. Any
	# location change must close it and release the avatar.
	var location_id: String = String(state.location)
	if _panel.visible and location_id != _panel_location:
		_panel.visible = false
		_set_world_input(not _modal_layer.visible)
	# Apply geometry/visibility/spawn first: refocus() must observe the new
	# location's hotspot set, not the previous location's stale candidates.
	_apply_location_visuals(location_id)
	# Hotspot focus/prompt is world-scene state, not rule state. Moving between
	# locations does not move the avatar, so no enter/exit signal fires: rebuild
	# or clear the prompt explicitly or a stale "按 E" stays over the inn.
	if location_id != _last_location:
		_last_location = location_id
		if location_id != WORLD_SCENE_LOCATION:
			_prompt.visible = false
		_interaction.refocus()
	var status: Dictionary = view.saveStatus
	var location: Dictionary = _definition(view.locations, state.location)
	_status_line.text = "%s · 第%d日 · 行动%d · 生命%d/%d · 真元%d/%d · 元石%d · 维持%d · revision %d" % [
		SCOPE_NOTE, int(state.day), int(state.actions), int(state.hp), int(view.maxHp),
		int(state.qi), int(view.maxQi), int(state.resources.stones), int(view.upkeep),
		int(view.revision),
	]
	_session_hud.text = "第%d日 · 行动%d · 生命%d/%d · 真元%d/%d\n修为%d · 情报%d · 元石%d · 药草%d · 清酒%d" % [
		int(state.day), int(state.actions), int(state.hp), int(view.maxHp),
		int(state.qi), int(view.maxQi), int(state.cultivation), int(state.clues),
		int(state.resources.stones), int(state.resources.herbs), int(state.resources.wine),
	]
	_save_status.text = _save_label(status)
	_location_name.text = String(location.get("name", state.location))
	_location_desc.text = String(location.get("description", ""))
	_render_travel(view, state)
	_render_events(view, state)
	_render_actions(view)
	_render_utilities(view, state)
	_render_log(state)
	%PauseStatus.text = "当前 revision %d · %s" % [int(view.revision), _save_label(status)]
	_sync_modals(view)
	# The explain panel disables HUD focus as well; never grab focus on a
	# control the current overlay has deliberately made unreachable.
	if not _modal_layer.visible and not _panel.visible:
		_ensure_visible_focus()

func _render_travel(view: Dictionary, state: Dictionary) -> void:
	var buttons: Dictionary = {
		"academy": %TravelAcademy, "inn": %TravelInn, "bamboo": %TravelBamboo,
	}
	for id: String in buttons:
		var button: Button = buttons[id]
		var option: Dictionary = _option(view, {"type": "TRAVEL", "location": id})
		button.disabled = not option.ok
		button.tooltip_text = option.reason if not option.ok else "移动不消耗行动"
		var location_name: String = String(_definition(view.locations, id).get("name", id))
		button.text = ("● " + location_name) if String(state.location) == id else location_name

func _render_events(view: Dictionary, state: Dictionary) -> void:
	var wanted: Variant = _remember_focus_action(_event_list)
	_clear_children(_event_list)
	var here: String = String(state.location)
	var shown: int = 0
	for event: Dictionary in view.availableEvents:
		if String(event.location) != here:
			continue
		shown += 1
		var cost: int = int(event.actionCost)
		var button := Button.new()
		button.text = "%s（%s）" % [event.title, "免费" if cost == 0 else "%d行动" % cost]
		button.custom_minimum_size = Vector2(0, 40)
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var option: Dictionary = _option(view, {"type": "OPEN_EVENT", "eventId": event.id})
		button.disabled = not option.ok
		button.tooltip_text = option.reason if not option.ok else String(event.description)
		var action: Dictionary = {"type": "OPEN_EVENT", "eventId": event.id}
		button.set_meta("action", action)
		button.pressed.connect(_submit.bind(action))
		_event_list.add_child(button)
	_restore_focus_action(_event_list, wanted)
	if shown == 0:
		var empty := Label.new()
		empty.text = "此处暂无可用机会"
		empty.add_theme_color_override("font_color", Color(0.62, 0.66, 0.72))
		empty.add_theme_font_size_override("font_size", 15)
		_event_list.add_child(empty)
	var elsewhere: PackedStringArray = []
	for event: Dictionary in view.availableEvents:
		if String(event.location) == here:
			continue
		elsewhere.append("%s「%s」" % [_definition(view.locations, event.location).get("name", event.location), event.title])
	if not elsewhere.is_empty():
		var hint := Label.new()
		hint.text = "别处机会：" + "、".join(elsewhere)
		hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		hint.add_theme_color_override("font_color", Color(0.62, 0.66, 0.72))
		hint.add_theme_font_size_override("font_size", 14)
		_event_list.add_child(hint)

func _render_actions(view: Dictionary) -> void:
	var costs: Dictionary = view.costs
	_set_action_button(%WorkButton, view, {"type": "WORK"},
		"安全劳作（1行动，+%d元石）" % int(costs.laborIncome))
	_set_action_button(%TrainButton, view, {"type": "TRAIN"},
		"演武修行（1行动，%d真元）" % int(costs.trainingQi))
	_set_action_button(%ScoutButton, view, {"type": "SCOUT"},
		"竹林侦查（1行动，%d真元）" % int(costs.scoutQi))
	_set_action_button(%RestButton, view, {"type": "REST"}, "歇息调息（1行动）")
	_set_action_button(%BuyHerbsButton, view, {"type": "BUY", "item": "herbs"},
		"购买药草（%d元石）" % int(costs.herbPrice))
	_set_action_button(%BuyWineButton, view, {"type": "BUY", "item": "wine"},
		"购买清酒（%d元石）" % int(costs.winePrice))
	_set_action_button(%EndDayButton, view, {"type": "END_DAY"},
		"结束此日（供养%d元石）" % int(view.upkeep))

func _set_action_button(button: Button, view: Dictionary, action: Dictionary, label: String) -> void:
	var option: Dictionary = _option(view, action)
	button.text = label
	button.disabled = not option.ok
	button.tooltip_text = option.reason if not option.ok else "按当前地点与资源结算"

func _render_utilities(view: Dictionary, state: Dictionary) -> void:
	%GuButton.text = "蛊虫（%d）" % state.inventory.size()
	# Read-only relationship/risk readout: rules already own these numbers.
	var relations: Dictionary = state.relations
	var exposure_count: int = (state.exposures as Array).size()
	%RelationLine.text = "巡山队长 %d · 客栈掌柜 %d · 嫌疑 %d · 暴露 %d" % [
		int(relations.get("guard-captain", 0)), int(relations.get("innkeeper", 0)),
		int(state.suspicion), exposure_count,
	]
	var exposures: Array = state.exposures
	%ClearExposureButton.visible = not exposures.is_empty()
	if not exposures.is_empty():
		var exposure: Dictionary = exposures[0]
		var option: Dictionary = _option(view, {"type": "CLEAR_EXPOSURE", "exposureId": exposure.id})
		%ClearExposureButton.disabled = not option.ok
		%ClearExposureButton.text = "处理物证（%s，%d元石）" % [
			exposure.source, int(view.costs.clearExposureCost),
		]
		%ClearExposureButton.tooltip_text = option.reason if not option.ok \
			else "花1行动和%d元石处理这条痕迹" % int(view.costs.clearExposureCost)

func _render_log(state: Dictionary) -> void:
	var lines: PackedStringArray = []
	var log_entries: Array = state.log
	var start: int = maxi(0, log_entries.size() - 40)
	for index: int in range(start, log_entries.size()):
		var entry: Dictionary = log_entries[index]
		var kind: String = String(entry.kind)
		var color: String = KIND_COLORS.get(kind, "#c9c9c9")
		lines.append("[color=%s]第%d日 · %s[/color]  %s" % [
			color, int(entry.day), KIND_LABELS.get(kind, kind), entry.message,
		])
	_log_list.text = "\n".join(lines)
	if not log_entries.is_empty() and _notice.is_empty():
		_last_event.text = String(log_entries[log_entries.size() - 1].message)

func _sync_modals(view: Dictionary) -> void:
	var state: Dictionary = view.state
	var ending_visible: bool = view.has("endingView") and view.endingView != null
	var combat_visible: bool = state.combat != null
	var event_visible: bool = view.activeEvent != null
	var review_visible: bool = view.has("dayReview") and view.dayReview != null \
		and int(view.revision) != _review_dismissed_revision
	var gu_open: bool = _gu_center.visible
	var had_ending: bool = _ending_center.visible
	var had_combat: bool = _combat_center.visible
	var had_event: bool = _event_center.visible
	var had_review: bool = _review_center.visible
	# Pause is a lower-priority modal. If another modal takes the screen while it
	# is open, drop the pause flag so it cannot resurface after that modal closes.
	if _pause_open and (ending_visible or combat_visible or event_visible or review_visible):
		_pause_open = false
	if ending_visible:
		_populate_ending(view)
	elif combat_visible:
		_populate_combat(view)
	elif review_visible:
		# The final day both settles upkeep and opens the crisis event. The
		# player must see the day ledger before the decision modal.
		_populate_review(view)
	elif event_visible:
		_populate_event(view)
	_ending_center.visible = ending_visible
	_combat_center.visible = combat_visible and not ending_visible
	_review_center.visible = review_visible and not ending_visible and not combat_visible
	_event_center.visible = event_visible and not ending_visible and not combat_visible \
		and not review_visible
	_pause_center.visible = _pause_open and not ending_visible and not combat_visible \
		and not event_visible and not review_visible
	var gu_visible: bool = gu_open and not _ending_center.visible and not _combat_center.visible \
		and not _event_center.visible and not _review_center.visible and not _pause_center.visible
	_gu_center.visible = gu_visible
	if gu_visible:
		_populate_gu(view)
	_modal_layer.visible = _ending_center.visible or _combat_center.visible \
		or _event_center.visible or _review_center.visible or _pause_center.visible or _gu_center.visible
	# Focus can only be grabbed by controls that are visible in the tree, so the
	# modal-specific default focus belongs after the visibility assignments.
	if _ending_center.visible and not had_ending:
		%EndingReturn.grab_focus()
	elif _review_center.visible and not had_review:
		%DayReviewContinue.grab_focus()
	elif _event_center.visible and not had_event:
		_focus_event_default()
	elif _combat_center.visible and not had_combat:
		_focus_first_enabled(_combat_actions)
	_set_world_input(not (_modal_layer.visible or _panel.visible))
	# Closing a modal must rebuild the hotspot prompt: the avatar never moved,
	# so no enter/exit signal will fire on its own.
	if _had_modal and not _modal_layer.visible and not _panel.visible:
		_interaction.refocus()
	_had_modal = _modal_layer.visible

func _populate_event(view: Dictionary) -> void:
	var event: Dictionary = view.activeEvent
	var key: String = "%s:%d" % [event.id, int(view.revision)]
	if key == _event_key:
		return
	_event_key = key
	%EventTitle.text = String(event.title)
	%EventMeta.text = "%s · 第%d–%d日 · %s" % [
		_definition(view.locations, event.location).get("name", event.location),
		int(event.fromDay), int(event.throughDay),
		"免费" if int(event.actionCost) == 0 else "消耗%d行动" % int(event.actionCost),
	]
	%EventDesc.text = String(event.description)
	_clear_children(_event_choices)
	for choice: Dictionary in event.choices:
		var button := Button.new()
		button.text = "%s%s" % [choice.label, _cost_suffix(choice.costs)]
		button.custom_minimum_size = Vector2(0, 44)
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		var option: Dictionary = _option(view, {"type": "CHOOSE", "choiceId": choice.id})
		button.disabled = not option.ok
		button.tooltip_text = option.reason if not option.ok else String(choice.risk)
		var action: Dictionary = {"type": "CHOOSE", "choiceId": choice.id}
		button.set_meta("action", action)
		button.pressed.connect(_submit.bind(action))
		_event_choices.add_child(button)
	var dismiss: Dictionary = _option(view, {"type": "DISMISS_EVENT"})
	%EventDismissButton.disabled = not dismiss.ok
	%EventDismissButton.tooltip_text = dismiss.reason if not dismiss.ok else "收起后可以继续筹备"
	if _focus_before_modal == null:
		_focus_before_modal = get_viewport().gui_get_focus_owner()

func _populate_gu(view: Dictionary) -> void:
	var wanted: Variant = _remember_focus_action(_gu_list)
	_clear_children(_gu_list)
	var state: Dictionary = view.state
	var costs: Dictionary = view.costs
	for definition: Dictionary in view.gu:
		var id: String = definition.id
		var row := VBoxContainer.new()
		row.add_theme_constant_override("separation", 4)
		var title := Label.new()
		title.text = "%s · %s" % [definition.name, definition.description]
		title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		title.add_theme_font_size_override("font_size", 17)
		row.add_child(title)
		if not state.inventory.has(id):
			var missing := Label.new()
			missing.text = "尚未获得 · 每日供养 %d 元石" % int(definition.upkeep)
			missing.add_theme_color_override("font_color", Color(0.62, 0.66, 0.72))
			missing.add_theme_font_size_override("font_size", 15)
			row.add_child(missing)
		else:
			var inventory: Dictionary = state.inventory[id]
			var status := Label.new()
			var mode: String = String(inventory.mode)
			var mode_label: String = {"active": "清醒", "dormant": "休眠", "sealed": "封存"}.get(mode, mode)
			status.text = "%s · %s · 每日供养 %d 元石" % [
				mode_label, "已装备" if inventory.equipped else "未装备", int(definition.upkeep),
			]
			status.add_theme_color_override("font_color", Color(0.72, 0.74, 0.78))
			status.add_theme_font_size_override("font_size", 15)
			row.add_child(status)
			var buttons := HBoxContainer.new()
			buttons.add_theme_constant_override("separation", 8)
			var equip := Button.new()
			equip.text = "卸下" if inventory.equipped else "装备"
			equip.custom_minimum_size = Vector2(0, 38)
			equip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			var equip_action: Dictionary = {"type": "EQUIP", "guId": id, "equipped": not bool(inventory.equipped)}
			var equip_option: Dictionary = _option(view, equip_action)
			equip.disabled = not equip_option.ok
			equip.tooltip_text = equip_option.reason if not equip_option.ok else "装备切换不消耗行动"
			equip.set_meta("action", equip_action)
			equip.pressed.connect(_submit.bind(equip_action))
			buttons.add_child(equip)
			var wake: bool = mode == "sealed" or mode == "dormant"
			var mode_price: int = int(costs.sealCost) if not wake else (
				int(costs.wakeSealedCost) if mode == "sealed" else int(costs.wakeDormantCost))
			var mode_button := Button.new()
			mode_button.text = "%s（1行动，%d元石）" % ["唤醒" if wake else "封存", mode_price]
			mode_button.custom_minimum_size = Vector2(0, 38)
			mode_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			var mode_action: Dictionary = {"type": "GU_MODE", "guId": id, "mode": "wake" if wake else "seal"}
			var mode_option: Dictionary = _option(view, mode_action)
			mode_button.disabled = not mode_option.ok
			mode_button.tooltip_text = mode_option.reason if not mode_option.ok \
				else "养护消耗1行动和%d元石" % mode_price
			mode_button.set_meta("action", mode_action)
			mode_button.pressed.connect(_submit.bind(mode_action))
			buttons.add_child(mode_button)
			row.add_child(buttons)
		_gu_list.add_child(row)
		_gu_list.add_child(HSeparator.new())
	_restore_focus_action(_gu_list, wanted)

func _populate_combat(view: Dictionary) -> void:
	var state: Dictionary = view.state
	var combat: Dictionary = state.combat
	var enemy: Dictionary = _definition(view.enemies, combat.enemyId)
	var forecast: Dictionary = view.combatForecast
	%CombatTitle.text = "战斗 · %s" % enemy.get("name", combat.enemyId)
	%CombatForecast.text = "敌方生命 %d/%d · 第%d回合\n下一招：%s（预计受 %d 伤害；防御后 %d）\n我方生命 %d/%d · 真元 %d/%d · 护体 %d\n药草 %d（本场已用 %d/3）· 清酒 %d（本场已用 %d/3）" % [
		int(combat.enemyHp), int(enemy.get("hpMax", combat.enemyHp)),
		int(combat.turn) + 1, forecast.intent, int(forecast.incomingDamage),
		int(forecast.defendingDamage), int(state.hp), int(view.maxHp),
		int(state.qi), int(view.maxQi), int(combat.guard),
		int(state.resources.herbs), int(combat.herbsUsed),
		int(state.resources.wine), int(combat.wineUsed),
	]
	var wanted: Variant = _remember_focus_action(_combat_actions)
	_clear_children(_combat_actions)
	var labels: Dictionary = MOVE_LABELS.duplicate()
	var moon_qi: int = int(_definition(view.gu, "moonlight").get("qiCost", 0))
	var jade_qi: int = int(_definition(view.gu, "jade-skin").get("qiCost", 0))
	labels["moonlight"] = "月刃（%d真元）" % moon_qi
	labels["jade-skin"] = "玉皮护盾（%d真元）" % jade_qi
	for move: String in ["attack", "defend", "moonlight", "jade-skin", "herbs", "wine", "retreat"]:
		var button := Button.new()
		button.text = String(labels.get(move, move))
		button.custom_minimum_size = Vector2(0, 40)
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var action: Dictionary = {"type": "COMBAT", "move": move}
		var option: Dictionary = _option(view, action)
		button.disabled = not option.ok
		button.tooltip_text = option.reason if not option.ok else "选择后敌人会按展示的意图行动"
		button.set_meta("action", action)
		button.pressed.connect(_submit.bind(action))
		_combat_actions.add_child(button)
	if not _restore_focus_action(_combat_actions, wanted) and _combat_center.visible:
		# The previously focused move may be disabled this turn (e.g. the last
		# herb is spent). Keep keyboard combat playable instead of dropping focus.
		_focus_first_enabled(_combat_actions)

func _populate_review(view: Dictionary) -> void:
	var key: String = str(int(view.revision))
	if key == _review_key:
		return
	_review_key = key
	var review: Dictionary = view.dayReview
	var lines: PackedStringArray = []
	lines.append("[font_size=22]第%d日结束 → 第%d日[/font_size]" % [int(review.day), int(review.nextDay)])
	lines.append("供养应付 %d 元石，实付 %d 元石。" % [int(review.upkeep.due), int(review.upkeep.paid)])
	if review.ledger.is_empty():
		lines.append("本日没有新的资源账目。")
	else:
		lines.append("本日账目：")
		for entry: Dictionary in review.ledger:
			lines.append("· %s：%s %+d" % [
				_source_label(view, String(entry.source)),
				_resource_name(String(entry.resource)), int(entry.amount),
			])
	if not review.missedEvents.is_empty():
		var titles: PackedStringArray = []
		for id: String in review.missedEvents:
			titles.append(String(view.eventTitles.get(id, id)))
		lines.append("[color=#e8a08f]错过窗口：%s[/color]" % "、".join(titles))
	lines.append("庇护承诺：%s · 备粮：%s" % [
		"已立约" if review.commitments.pledged else "未立约",
		"已备好" if review.commitments.stocked else "未备好",
	])
	lines.append("危机状态：%s" % ("狼群已抵达" if String(review.crisis) != "approaching" else "仍在逼近"))
	_review_body.text = "\n".join(lines)

func _populate_ending(view: Dictionary) -> void:
	var ending: Dictionary = view.endingView
	%EndingTitle.text = "结局 · %s" % ENDING_NAMES.get(String(ending.id), ending.id)
	var lines: PackedStringArray = []
	lines.append("结果：%s" % ("存活" if String(ending.outcome) == "survived" else "失败"))
	lines.append("")
	lines.append("原因：")
	for reason: String in ending.reasons:
		lines.append("· %s" % reason)
	lines.append("")
	lines.append("第%d日 · 生命%d · 真元%d · 修为%d · 情报%d · 元石%d" % [
		int(ending.summary.day), int(ending.summary.hp), int(ending.summary.qi),
		int(ending.summary.cultivation), int(ending.summary.clues), int(ending.summary.stones),
	])
	_ending_body.text = "\n".join(lines)

func _open_gu() -> void:
	if _panel.visible:
		_close_panel()
	if _view.is_empty() or _any_modal_visible():
		return
	_focus_before_modal = get_viewport().gui_get_focus_owner()
	_populate_gu(_view)
	_gu_center.visible = true
	_modal_layer.visible = true
	_set_world_input(false)
	if not _focus_first_enabled(_gu_list):
		%GuCloseButton.grab_focus()

func _close_gu() -> void:
	_gu_center.visible = false
	_restore_modal_layer()
	_restore_focus()

func _open_pause() -> void:
	if _panel.visible:
		_close_panel()
	if _view.is_empty() or _any_modal_visible():
		return
	_pause_open = true
	_focus_before_modal = get_viewport().gui_get_focus_owner()
	_pause_center.visible = true
	_modal_layer.visible = true
	_set_world_input(false)
	%PauseResume.grab_focus()

func _close_pause() -> void:
	_pause_open = false
	_pause_center.visible = false
	_restore_modal_layer()
	_restore_focus()

func _dismiss_event() -> void:
	if _view.is_empty():
		return
	var option: Dictionary = _option(_view, {"type": "DISMISS_EVENT"})
	if not option.ok:
		_set_notice("不能收起：%s" % option.reason)
		return
	_submit({"type": "DISMISS_EVENT"})

func _dismiss_review() -> void:
	if _view.is_empty():
		return
	_review_dismissed_revision = int(_view.revision)
	# A final-day review can hide a pending crisis event; re-sync so it surfaces.
	_sync_modals(_view)
	if not _modal_layer.visible:
		_restore_focus()

func _return_to_title() -> void:
	exit_requested.emit()

func _restore_modal_layer() -> void:
	var any_modal: bool = _event_center.visible or _gu_center.visible or _combat_center.visible \
		or _review_center.visible or _pause_center.visible or _ending_center.visible
	_modal_layer.visible = any_modal
	_set_world_input(not (any_modal or _panel.visible))
	# Closing a modal does not move the avatar, so no hotspot enter/exit event
	# will fire. Re-emit the current focus explicitly.
	if not any_modal and not _panel.visible:
		_interaction.refocus()

func _ensure_visible_focus() -> void:
	var focused: Control = get_viewport().gui_get_focus_owner()
	if focused != null and focused.is_visible_in_tree():
		return
	_restore_focus()

func _restore_focus() -> void:
	if _focus_before_modal != null and is_instance_valid(_focus_before_modal) \
			and _focus_before_modal.is_visible_in_tree():
		_focus_before_modal.grab_focus()
		_focus_before_modal = null
		return
	_focus_before_modal = null
	var focused: Control = get_viewport().gui_get_focus_owner()
	if focused != null and focused.is_visible_in_tree():
		return
	# A modal opened from the keyboard has no prior focus owner. Leaving focus on
	# its now-hidden button would break Tab traversal, so return to a stable
	# daily action instead.
	for button: Button in [%WorkButton, %TrainButton, %ScoutButton, %RestButton, %EndDayButton, %PauseButton]:
		if not button.disabled and button.is_visible_in_tree():
			button.grab_focus()
			return

func _set_world_input(enabled: bool) -> void:
	_player.input_locked = not enabled
	_interaction.enabled = enabled
	_set_hud_focus_enabled(enabled)
	if not enabled:
		_prompt.visible = false

## Keep keyboard focus inside the modal that owns the screen. Mouse clicks are
## covered by `_modal_action_allowed`; this is the Tab/Enter half of the same
## contract.
func _set_hud_focus_enabled(enabled: bool) -> void:
	var mode: Control.FocusBehaviorRecursive = Control.FOCUS_BEHAVIOR_INHERITED \
		if enabled else Control.FOCUS_BEHAVIOR_DISABLED
	for path: String in ["StatusBar", "LogPanel", "SessionPanel", "ExplainPanel"]:
		var panel: Control = get_node_or_null("UI/Root/" + path)
		if panel != null and panel.focus_behavior_recursive != mode:
			panel.focus_behavior_recursive = mode

func _focus_event_default() -> void:
	# Choices can all be unaffordable; then the dismiss button is the only exit.
	if not _focus_first_enabled(_event_choices) and not %EventDismissButton.disabled:
		%EventDismissButton.grab_focus()

func _modal_action_allowed(action: Dictionary) -> bool:
	if _ending_center.visible or _pause_center.visible or _review_center.visible:
		return false
	var type: String = String(action.get("type", ""))
	if _combat_center.visible:
		return type == "COMBAT"
	if _event_center.visible:
		return type == "CHOOSE" or type == "DISMISS_EVENT"
	if _gu_center.visible:
		return type == "EQUIP" or type == "GU_MODE"
	return not _modal_layer.visible

func _any_modal_visible() -> bool:
	return _modal_layer.visible or _panel.visible

func _option(view: Dictionary, wanted: Dictionary) -> Dictionary:
	for option: Dictionary in view.actionOptions:
		if option.action == wanted:
			return option
	return {"ok": false, "reason": "当前不可用", "action": wanted}

func _remember_focus_action(container: Node) -> Variant:
	var focused: Control = get_viewport().gui_get_focus_owner()
	if focused == null or not container.is_ancestor_of(focused):
		return null
	return focused.get_meta("action", null)

func _restore_focus_action(container: Node, wanted: Variant) -> bool:
	if wanted == null:
		return false
	var button: Button = _find_button_with_action(container, wanted)
	if button == null or button.disabled or not button.is_visible_in_tree():
		return false
	button.grab_focus()
	return true

func _find_button_with_action(container: Node, wanted: Variant) -> Button:
	for child: Node in container.get_children():
		if child is Button and child.get_meta("action", null) == wanted:
			return child
		var found: Button = _find_button_with_action(child, wanted)
		if found != null:
			return found
	return null

func _focus_first_enabled(container: Node) -> bool:
	for child: Node in container.get_children():
		if child is Button and not (child as Button).disabled \
				and (child as Button).is_visible_in_tree():
			(child as Button).grab_focus()
			return true
		if _focus_first_enabled(child):
			return true
	return false

func _source_label(view: Dictionary, source: String) -> String:
	if SOURCE_LABELS.has(source):
		return String(SOURCE_LABELS[source])
	if view.eventTitles.has(source):
		return String(view.eventTitles[source])
	return source

func _definition(definitions: Array, id: String) -> Dictionary:
	for definition: Dictionary in definitions:
		if definition.id == id:
			return definition
	return {}

func _cost_suffix(costs: Dictionary) -> String:
	if costs.is_empty():
		return ""
	var parts: PackedStringArray = []
	for resource: String in costs:
		parts.append("%s %d" % [_resource_name(resource), int(costs[resource])])
	return "（费用：" + "、".join(parts) + "）"

func _resource_name(resource: String) -> String:
	return {"stones": "元石", "herbs": "药草", "wine": "清酒", "qi": "真元"}.get(resource, resource)

func _save_label(status: Dictionary) -> String:
	match String(status.state):
		"saving":
			return "保存中"
		"failed":
			var code: String = String(status.get("errorCode", "unknown"))
			return "未保存：%s" % SAVE_ERROR_LABELS.get(code, code)
		_:
			return "已保存 revision %d" % int(status.savedRevision)

func _clear_children(container: Node) -> void:
	for child: Node in container.get_children():
		container.remove_child(child)
		child.queue_free()

func _apply_location_visuals(location: String) -> void:
	var ground: Polygon2D = $World/Ground
	match location:
		"inn":
			ground.color = Color(0.22, 0.17, 0.12)
		"bamboo":
			ground.color = Color(0.1, 0.2, 0.13)
		_:
			ground.color = Color(0.14, 0.18, 0.15)
	var academy: bool = location == "academy"
	$World/LectureHall.visible = academy
	$World/DrillGround.visible = academy
	$World/SpiritField.visible = academy
	$World/InnCounter.visible = location == "inn"
	$World/InnRooms.visible = location == "inn"
	$World/InnYard.visible = location == "inn"
	$World/BambooEdge.visible = location == "bamboo"
	$World/BambooPath.visible = location == "bamboo"
	$World/BambooDen.visible = location == "bamboo"
	$World/Hotspots/LectureHallSpot.visible = academy
	$World/Hotspots/DrillGroundSpot.visible = academy
	$World/Hotspots/SpiritFieldSpot.visible = academy
	$World/Hotspots/InnSpots.visible = location == "inn"
	$World/Hotspots/BambooSpots.visible = location == "bamboo"
	# Location changes teleport to a safe spawn: the scene owns layout, the
	# session owns which location is active.
	if location != _last_visual_location:
		_last_visual_location = location
		if LOCATION_SPAWNS.has(location):
			_player.position = LOCATION_SPAWNS[location]
			_player.velocity = Vector2.ZERO
