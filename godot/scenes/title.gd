extends Control
## New-run (with seed), validated continue, and placeholder import entry points.

signal start_requested(seed: int)
signal continue_requested()
signal quit_requested()

const MAX_SEED: int = 4294967295

var _can_continue: bool = false
var _overwrite_confirmed: bool = false

func _ready() -> void:
	%StartButton.pressed.connect(_on_start_pressed)
	%ContinueButton.pressed.connect(_on_continue_pressed)
	%QuitButton.pressed.connect(_on_quit_pressed)
	%SeedInput.text_changed.connect(_on_seed_changed)
	%SeedInput.text_submitted.connect(_on_seed_submitted)
	%SeedInput.grab_focus()

func _on_start_pressed() -> void:
	var parsed: Dictionary = _parse_seed(%SeedInput.text)
	if not parsed.ok:
		%SeedError.text = parsed.error
		%SeedError.visible = true
		%SeedInput.grab_focus()
		return
	# Starting a new run autosaves revision 0 and replaces the current slot.
	# Make that destructive step explicit instead of losing progress on one Enter.
	if _can_continue and not _overwrite_confirmed:
		_overwrite_confirmed = true
		%SeedError.text = "已有存档；再次点击“开始新局”将覆盖当前进度"
		%SeedError.visible = true
		%StartButton.text = "再次点击确认覆盖"
		%StartButton.grab_focus()
		return
	%SeedError.visible = false
	start_requested.emit(parsed.value)

func _on_seed_submitted(_text: String) -> void:
	_on_start_pressed()

func _on_seed_changed(_text: String) -> void:
	%SeedError.visible = false
	_reset_overwrite_confirmation()

func _on_continue_pressed() -> void:
	_reset_overwrite_confirmation()
	continue_requested.emit()

func _reset_overwrite_confirmation() -> void:
	_overwrite_confirmed = false
	%StartButton.text = "开始新局（覆盖现有进度）" if _can_continue else "开始新局"

func _on_quit_pressed() -> void:
	quit_requested.emit()

func configure(can_continue: bool, status_text: String) -> void:
	_can_continue = can_continue
	%ContinueButton.disabled = not can_continue
	%ContinueButton.text = "继续" if can_continue else "继续（暂无有效存档）"
	%SaveStatus.text = status_text
	_reset_overwrite_confirmation()

func _parse_seed(text: String) -> Dictionary:
	var trimmed: String = text.strip_edges()
	if trimmed.is_empty():
		return {"ok": false, "error": "请输入 0–4294967295 之间的种子"}
	for index: int in range(trimmed.length()):
		var code: int = trimmed.unicode_at(index)
		if code < 48 or code > 57:
			return {"ok": false, "error": "种子只能包含数字"}
	# Bound the significant digits before int(): a 20-digit paste exceeds int64
	# and would otherwise make the engine log an overflow before we reject it.
	var digits: String = trimmed.lstrip("0")
	if digits.is_empty():
		digits = "0"
	if digits.length() > 10:
		return {"ok": false, "error": "种子必须在 0–4294967295 之间"}
	var value: int = int(digits)
	if value < 0 or value > MAX_SEED:
		return {"ok": false, "error": "种子必须在 0–4294967295 之间"}
	return {"ok": true, "value": value}
