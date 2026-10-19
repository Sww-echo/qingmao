class_name SaveEnvelope
extends RefCounted
## Canonical, versioned save envelope shared by all save stores.

const MAX_BYTES: int = 2 * 1024 * 1024
const KEYS: PackedStringArray = [
	"formatVersion", "scenarioId", "rulesVersion", "contentVersion",
	"contentSha256", "body", "bodySha256",
]
const BODY_KEYS: PackedStringArray = ["runId", "revision", "state"]

static func encode(body: Variant, catalog: ContentCatalog, content_sha256: String) -> Dictionary:
	if catalog == null:
		return _fail("save: content catalog is required")
	if not _is_sha256(content_sha256):
		return _fail("save.contentSha256: invalid SHA256")
	var body_error: String = _body_error(body, catalog)
	if not body_error.is_empty():
		return _fail(body_error)
	var body_hash_result: Dictionary = CanonicalJson.encode(body)
	if not body_hash_result.ok:
		return _fail("save.body: %s" % body_hash_result.error)
	var envelope: Dictionary = {
		"formatVersion": 1,
		"scenarioId": catalog.data["scenarioId"],
		"rulesVersion": catalog.data["rulesVersion"],
		"contentVersion": catalog.data["contentVersion"],
		"contentSha256": content_sha256,
		"body": body.duplicate(true),
		"bodySha256": CanonicalJson.sha256(body_hash_result.bytes),
	}
	var encoded: Dictionary = CanonicalJson.encode(envelope)
	if not encoded.ok:
		return _fail("save: %s" % encoded.error)
	if encoded.bytes.size() > MAX_BYTES:
		return _fail("save: exceeds 2 MiB")
	return {"ok": true, "bytes": encoded.bytes, "envelope": envelope}

static func decode(bytes: PackedByteArray, catalog: ContentCatalog, content_sha256: String) -> Dictionary:
	if catalog == null:
		return _fail("save: content catalog is required")
	if bytes.is_empty():
		return _fail("save: file is empty")
	if bytes.size() > MAX_BYTES:
		return _fail("save: exceeds 2 MiB")
	var parser := JSON.new()
	if parser.parse(bytes.get_string_from_utf8()) != OK:
		return _fail("save: JSON parse error at line %d" % parser.get_error_line())
	var value: Variant = parser.data
	if not value is Dictionary or value.size() != KEYS.size():
		return _fail("save: missing or unknown envelope fields")
	for key: String in KEYS:
		if not value.has(key):
			return _fail("save.%s: missing field" % key)
	var canonical: Dictionary = CanonicalJson.encode(value)
	if not canonical.ok or canonical.bytes != bytes:
		return _fail("save: not canonical JSON")
	if not _integer(value.formatVersion, 0, CanonicalJson.MAX_SAFE_INTEGER) \
			or int(value.formatVersion) != 1:
		return _fail("save.formatVersion: expected 1")
	for key: String in ["scenarioId", "rulesVersion", "contentVersion"]:
		if not value[key] is String or value[key] != catalog.data[key]:
			return _fail("save.%s: incompatible version" % key)
	if not value.contentSha256 is String or value.contentSha256 != content_sha256:
		return _fail("save.contentSha256: content changed")
	if not _is_sha256(value.bodySha256):
		return _fail("save.bodySha256: invalid SHA256")
	var body_error: String = _body_error(value.body, catalog)
	if not body_error.is_empty():
		return _fail(body_error)
	var body_bytes: Dictionary = CanonicalJson.encode(value.body)
	if not body_bytes.ok or CanonicalJson.sha256(body_bytes.bytes) != value.bodySha256:
		return _fail("save.bodySha256: body hash mismatch")
	var decoded_state: Dictionary = StateCodec.decode(value.body.state, catalog)
	if not decoded_state.ok:
		return _fail(decoded_state.error)
	return {
		"ok": true, "body": value.body.duplicate(true),
		"state": decoded_state.state, "envelope": value.duplicate(true),
	}

static func _body_error(value: Variant, catalog: ContentCatalog) -> String:
	if not value is Dictionary or value.size() != BODY_KEYS.size():
		return "save.body: missing or unknown fields"
	for key: String in BODY_KEYS:
		if not value.has(key):
			return "save.body.%s: missing field" % key
	if not value.runId is String or String(value.runId).is_empty():
		return "save.body.runId: expected a nonempty string"
	if not _integer(value.revision, 0, CanonicalJson.MAX_SAFE_INTEGER):
		return "save.body.revision: expected a nonnegative integer"
	var decoded: Dictionary = StateCodec.decode(value.state, catalog)
	if not decoded.ok:
		return decoded.error
	return ""

static func _is_sha256(value: Variant) -> bool:
	if not value is String or String(value).length() != 64:
		return false
	for index: int in range(String(value).length()):
		if not "0123456789abcdef".contains(String(value)[index]):
			return false
	return true

static func _integer(value: Variant, minimum: int, maximum: int) -> bool:
	if value is int:
		return value >= minimum and value <= maximum
	if value is float:
		return is_finite(value) and value == floor(value) \
			and value >= minimum and value <= maximum
	return false

static func _fail(error: String) -> Dictionary:
	return {"ok": false, "error": error, "errorCode": "invalid-save"}
