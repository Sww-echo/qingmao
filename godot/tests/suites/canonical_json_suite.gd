class_name CanonicalJsonSuite
extends RefCounted

const CANONICAL = preload("res://infrastructure/canonical_json.gd")
const CHECKS = preload("res://tests/suite_checks.gd")
const CONTENT_PATH: String = "res://content/generated/prototype/content.json"


func run(_tree: SceneTree) -> Dictionary:
	var check := CHECKS.new()
	_expect_encoding(check, {}, "{}\n", "empty object")
	_expect_encoding(check, [], "[]\n", "empty array")
	_expect_encoding(check, null, "null\n", "null")
	_expect_encoding(check, {"z": [0, "", false], "a": {"b": true}}, "{\n  \"a\": {\n    \"b\": true\n  },\n  \"z\": [\n    0,\n    \"\",\n    false\n  ]\n}\n", "recursive order and arrays")
	_expect_encoding(check, {"name": "青茅山"}, "{\n  \"name\": \"青茅山\"\n}\n", "UTF-8 remains literal")
	_expect_encoding(check, "\"\\\b\t\n\f\r" + String.chr(1), "\"\\\"\\\\\\b\\t\\n\\f\\r\\u0001\"\n", "JSON string escaping")
	_expect_encoding(check, [-0.0, 1.0, -9007199254740991, 9007199254740991], "[\n  0,\n  1,\n  -9007199254740991,\n  9007199254740991\n]\n", "integer decimal spelling")
	_expect_encoding(check, {"10": 10, "2": 2, "01": 1, "4294967295": 5, "a": 0, "0": 0}, "{\n  \"0\": 0,\n  \"2\": 2,\n  \"10\": 10,\n  \"01\": 1,\n  \"4294967295\": 5,\n  \"a\": 0\n}\n", "Node array-index property order")
	for invalid: Variant in [0.5, INF, NAN, 9007199254740992, Vector2.ZERO, {"中文": 1}, {1: "not a string key"}]:
		check.expect(not CANONICAL.encode(invalid).ok, "noncanonical data rejected: " + str(invalid))
	var cycle: Array = []
	cycle.append(cycle)
	check.expect(not CANONICAL.encode(cycle).ok, "cyclic data rejected")
	cycle.clear()
	var shared: Dictionary = {"valid": 1}
	check.expect(CANONICAL.encode([shared, shared]).ok, "shared noncyclic objects are allowed")
	check.expect(CANONICAL.sha256("abc".to_utf8_buffer()) == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "SHA256 known vector")
	var large: PackedByteArray = "a".repeat(70000).to_utf8_buffer()
	check.expect(CANONICAL.sha256(large) == "66915c0872933db504e7578828dd85b7e74a4e0a061f9756793b89c4151bd4b5", "SHA256 updates multiple chunks")
	var file := FileAccess.open(CONTENT_PATH, FileAccess.READ)
	if check.expect(file != null, "frozen content must be synchronized inside res://"):
		var bytes: PackedByteArray = file.get_buffer(file.get_length())
		var parser := JSON.new()
		if check.expect(parser.parse(bytes.get_string_from_utf8()) == OK, "frozen content must parse"):
			var encoded: Dictionary = CANONICAL.encode(parser.data)
			if check.expect(encoded.ok, "frozen content must be canonicalizable"):
				check.expect(encoded.bytes == bytes, "HARD GATE: parse/re-serialize must preserve exact frozen content bytes")
				check.expect(CANONICAL.sha256(encoded.bytes) == CANONICAL.sha256(bytes), "canonical/original content hashes must match")
	return check.result()


func _expect_encoding(check: RefCounted, value: Variant, expected: String, label: String) -> void:
	var result: Dictionary = CANONICAL.encode(value)
	if check.expect(result.ok, label + ": encodable"):
		check.expect(result.text == expected, label + ": exact text")
		check.expect(result.bytes == expected.to_utf8_buffer(), label + ": exact bytes")
