class_name CanonicalJson
extends RefCounted
## Node-compatible canonical JSON: ASCII key order, integer numbers, final LF.

const MAX_SAFE_INTEGER: int = 9007199254740991
const HASH_CHUNK_BYTES: int = 65536


static func encode(value: Variant) -> Dictionary:
	var result: Dictionary = _encode_value(value, 0, [])
	if not result.ok:
		return result
	var text: String = result.text + "\n"
	return {"ok": true, "text": text, "bytes": text.to_utf8_buffer()}


static func sha256(bytes: PackedByteArray) -> String:
	var context := HashingContext.new()
	if context.start(HashingContext.HASH_SHA256) != OK:
		return ""
	for offset in range(0, bytes.size(), HASH_CHUNK_BYTES):
		if context.update(bytes.slice(offset, mini(offset + HASH_CHUNK_BYTES, bytes.size()))) != OK:
			return ""
	return context.finish().hex_encode()


static func _encode_value(value: Variant, depth: int, ancestors: Array) -> Dictionary:
	match typeof(value):
		TYPE_NIL:
			return {"ok": true, "text": "null"}
		TYPE_BOOL:
			return {"ok": true, "text": "true" if value else "false"}
		TYPE_INT, TYPE_FLOAT:
			if typeof(value) == TYPE_FLOAT and (not is_finite(value) or value != floor(value)):
				return _error("expected a finite integer")
			if value < -MAX_SAFE_INTEGER or value > MAX_SAFE_INTEGER:
				return _error("integer exceeds the JSON safe range")
			return {"ok": true, "text": str(int(value))}
		TYPE_STRING:
			return {"ok": true, "text": _quote(value)}
		TYPE_DICTIONARY, TYPE_ARRAY:
			for ancestor in ancestors:
				if is_same(value, ancestor):
					return _error("cyclic JSON value")
			if depth >= 128:
				return _error("JSON nesting exceeds 128 levels")
			var next_ancestors: Array = ancestors.duplicate()
			next_ancestors.append(value)
			return _encode_container(value, depth, next_ancestors)
		_:
			return _error("expected plain JSON data")


static func _encode_container(value: Variant, depth: int, ancestors: Array) -> Dictionary:
	var object: bool = value is Dictionary
	var open: String = "{" if object else "["
	var close: String = "}" if object else "]"
	if value.is_empty():
		return {"ok": true, "text": open + close}
	var entries: PackedStringArray = []
	var indent: String = "  ".repeat(depth + 1)
	var keys: Array = value.keys() if object else range(value.size())
	if object:
		for key in keys:
			if not key is String:
				return _error("object keys must be ASCII strings")
			for index in range(key.length()):
				if key.unicode_at(index) > 127:
					return _error("object keys must be ASCII strings")
		keys.sort_custom(_key_less)
	for key in keys:
		var nested: Dictionary = _encode_value(value[key], depth + 1, ancestors)
		if not nested.ok:
			return nested
		var prefix: String = _quote(key) + ": " if object else ""
		entries.append(indent + prefix + nested.text)
	return {"ok": true, "text": open + "\n" + ",\n".join(entries) + "\n" + "  ".repeat(depth) + close}


static func _quote(value: String) -> String:
	var result: String = "\""
	for index in range(value.length()):
		var code: int = value.unicode_at(index)
		match code:
			34:
				result += "\\\""
			92:
				result += "\\\\"
			8:
				result += "\\b"
			9:
				result += "\\t"
			10:
				result += "\\n"
			12:
				result += "\\f"
			13:
				result += "\\r"
			_:
				result += "\\u%04x" % code if code < 32 else value[index]
	return result + "\""


static func _key_less(left: String, right: String) -> bool:
	# JSON.stringify enumerates array-index keys before other sorted keys.
	var left_index: int = _array_index(left)
	var right_index: int = _array_index(right)
	if left_index >= 0 and right_index >= 0:
		return left_index < right_index
	if left_index >= 0 or right_index >= 0:
		return left_index >= 0
	return left < right


static func _array_index(key: String) -> int:
	if key.is_empty() or key.length() > 10 or not key.is_valid_int():
		return -1
	var value: int = key.to_int()
	return value if value >= 0 and value < 4294967295 and str(value) == key else -1


static func _error(message: String) -> Dictionary:
	return {"ok": false, "error": message}
