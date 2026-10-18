class_name ContentCatalog
extends RefCounted
## A detached lookup index, constructed only after ContentValidation succeeds.

const SECTIONS: PackedStringArray = ["events", "gu", "enemies", "locations", "relations", "exposures"]

var data: Dictionary
var parameters: Dictionary
var by_id: Dictionary = {}


func _init(validated_content: Dictionary) -> void:
	data = validated_content.duplicate(true)
	parameters = data.parameters
	for section in SECTIONS:
		var entries: Dictionary = {}
		for definition: Dictionary in data[section]:
			entries[definition.id] = definition
		by_id[section] = entries


func has_id(section: String, id: String) -> bool:
	return by_id.has(section) and by_id[section].has(id)


func definition(section: String, id: String) -> Dictionary:
	return by_id.get(section, {}).get(id, {}).duplicate(true)
