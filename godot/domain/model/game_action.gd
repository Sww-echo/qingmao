class_name GameAction
extends RefCounted
## A decoded tagged action. Only fields selected by `type` are serialized.

const TYPES: PackedStringArray = [
	"TRAVEL", "OPEN_EVENT", "CHOOSE", "DISMISS_EVENT", "WORK", "TRAIN", "SCOUT",
	"REST", "END_DAY", "BUY", "EQUIP", "GU_MODE", "CLEAR_EXPOSURE", "COMBAT",
]
const MOVES: PackedStringArray = [
	"attack", "defend", "moonlight", "jade-skin", "herbs", "wine", "retreat",
]

var type: String = ""
var location: String = ""
var event_id: String = ""
var choice_id: String = ""
var item: String = ""
var gu_id: String = ""
var equipped: bool = false
var mode: String = ""
var exposure_id: String = ""
var move: String = ""


static func decode(value: Variant, catalog: ContentCatalog, active_event: String = "") -> Dictionary:
	if catalog == null:
		return _fail("action: content catalog is required")
	var tuple: String = "%s|%s|%s" % [
		catalog.data.get("scenarioId", ""), catalog.data.get("rulesVersion", ""),
		catalog.data.get("contentVersion", ""),
	]
	if tuple != "qingmao-fourteen-day-prototype|prototype-rules-1|prototype-content-1" \
			and tuple != "qingmao-fourteen-day-v2|qingmao-rules-2|qingmao-content-2":
		return _fail("action: unsupported content version")
	if not value is Dictionary:
		return _fail("action: expected an object")
	var data: Dictionary = value
	if not data.get("type") is String or not TYPES.has(data["type"]):
		return _fail("action.type: unknown action type")
	var keys: Array[String] = ["type"]
	match data["type"]:
		"TRAVEL":
			keys.append("location")
		"OPEN_EVENT":
			keys.append("eventId")
		"CHOOSE":
			keys.append("choiceId")
		"BUY":
			keys.append("item")
		"EQUIP":
			keys.append_array(["guId", "equipped"])
		"GU_MODE":
			keys.append_array(["guId", "mode"])
		"CLEAR_EXPOSURE":
			keys.append("exposureId")
		"COMBAT":
			keys.append("move")
	if data.size() != keys.size():
		return _fail("action: missing or unknown fields")
	for key in keys:
		if not data.has(key):
			return _fail("action.%s: missing field" % key)
		if key == "equipped":
			if not data[key] is bool:
				return _fail("action.equipped: expected a boolean")
		elif not data[key] is String or String(data[key]).is_empty():
			return _fail("action.%s: expected a nonempty string" % key)

	var action := GameAction.new()
	action.type = data["type"]
	match action.type:
		"TRAVEL":
			action.location = data["location"]
			if not catalog.has_id("locations", action.location):
				return _fail("action.location: unknown location")
		"OPEN_EVENT":
			action.event_id = data["eventId"]
			if not catalog.has_id("events", action.event_id):
				return _fail("action.eventId: unknown event")
		"CHOOSE":
			action.choice_id = data["choiceId"]
			var found: bool = false
			for event: Dictionary in catalog.data["events"]:
				if not active_event.is_empty() and event["id"] != active_event:
					continue
				for choice: Dictionary in event["choices"]:
					if choice["id"] == action.choice_id:
						found = true
			if not found:
				return _fail("action.choiceId: unknown choice for the selected event")
		"BUY":
			action.item = data["item"]
			if not ["herbs", "wine"].has(action.item):
				return _fail("action.item: unknown purchasable resource")
		"EQUIP", "GU_MODE":
			action.gu_id = data["guId"]
			if not catalog.has_id("gu", action.gu_id):
				return _fail("action.guId: unknown Gu")
			if action.type == "EQUIP":
				action.equipped = data["equipped"]
			else:
				action.mode = data["mode"]
				if not ["seal", "wake"].has(action.mode):
					return _fail("action.mode: expected seal or wake")
		"CLEAR_EXPOSURE":
			action.exposure_id = data["exposureId"]
			if not catalog.has_id("exposures", action.exposure_id):
				return _fail("action.exposureId: unknown exposure")
		"COMBAT":
			action.move = data["move"]
			if not MOVES.has(action.move):
				return _fail("action.move: unknown combat move")
	return {"ok": true, "action": action}


func to_data() -> Dictionary:
	var data: Dictionary = {"type": type}
	match type:
		"TRAVEL":
			data["location"] = location
		"OPEN_EVENT":
			data["eventId"] = event_id
		"CHOOSE":
			data["choiceId"] = choice_id
		"BUY":
			data["item"] = item
		"EQUIP":
			data["guId"] = gu_id
			data["equipped"] = equipped
		"GU_MODE":
			data["guId"] = gu_id
			data["mode"] = mode
		"CLEAR_EXPOSURE":
			data["exposureId"] = exposure_id
		"COMBAT":
			data["move"] = move
	return data


static func _fail(error: String) -> Dictionary:
	return {"ok": false, "error": error}
