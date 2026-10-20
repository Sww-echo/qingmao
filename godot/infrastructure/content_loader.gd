class_name ContentLoader
extends RefCounted
## Only bundled generated resources are loadable; fixtures are development-only.

const Canonical = preload("res://infrastructure/canonical_json.gd")
const Validator = preload("res://domain/content_validation.gd")
const Catalog = preload("res://domain/content_catalog.gd")
const GENERATED_ROOT := "res://content/generated"
const MAX_CONTENT_BYTES := 2 * 1024 * 1024
const PACKS := {
	"prototype": {
		"scenarioId": "qingmao-fourteen-day-prototype",
		"rulesVersion": "prototype-rules-1",
		"contentVersion": "prototype-content-1",
		"source": "shared/prototype/content.json",
		"files": 4,
	},
	"qingmao14-v2": {
		"scenarioId": "qingmao-fourteen-day-v2",
		"rulesVersion": "qingmao-rules-2",
		"contentVersion": "qingmao-content-2",
		"source": "shared/scenarios/qingmao14-v2/content.json",
		"files": 1,
	},
}
const MANIFEST_KEYS := ["formatVersion", "packId", "scenarioId", "rulesVersion", "contentVersion", "files"]
const FILE_KEYS := ["source", "path", "kind", "sha256"]


static func load_pack(pack_id: String = "prototype") -> Dictionary:
	if not PACKS.has(pack_id):
		return _failure("Unsupported built-in pack: %s" % pack_id)
	var expected_versions: Dictionary = PACKS[pack_id]
	var base := "%s/%s" % [GENERATED_ROOT, pack_id]
	var manifest_result := _read_json("%s/manifest.json" % base)
	if not manifest_result.ok:
		return manifest_result
	var manifest: Variant = manifest_result.data
	if not _exact_keys(manifest, MANIFEST_KEYS):
		return _failure("%s: invalid manifest fields" % base)
	if typeof(manifest.formatVersion) not in [TYPE_INT, TYPE_FLOAT] or manifest.formatVersion != 1:
		return _failure("%s: unsupported manifest format" % base)
	if manifest.packId != pack_id:
		return _failure("%s: manifest packId mismatch" % base)
	for key in ["scenarioId", "rulesVersion", "contentVersion"]:
		if manifest[key] != expected_versions[key]:
			return _failure("%s: manifest version mismatch at %s" % [base, key])
	if not manifest.files is Array or manifest.files.size() != int(expected_versions.files):
		return _failure("%s: expected %d manifest files" % [base, int(expected_versions.files)])
	var seen := {}
	var content: Variant = null
	var content_sha256 := ""
	for entry in manifest.files:
		if not _exact_keys(entry, FILE_KEYS):
			return _failure("%s: invalid manifest file record" % base)
		for key in FILE_KEYS:
			if not entry[key] is String or entry[key].is_empty():
				return _failure("%s: invalid file field %s" % [base, key])
		if not _is_sha256(entry.sha256):
			return _failure("%s: invalid file SHA256" % base)
		if seen.has(entry.path):
			return _failure("%s: duplicate manifest path" % base)
		seen[entry.path] = true
		var source: String = expected_versions.source
		if entry.kind == "content":
			if content != null or entry.path != "%s/content.json" % base or entry.source != source:
				return _failure("%s: invalid content resource mapping" % base)
			var parsed := _read_json(entry.path)
			if not parsed.ok:
				return parsed
			content = parsed.data
			content_sha256 = Canonical.sha256(parsed.bytes)
			if entry.sha256 != content_sha256:
				return _failure("%s: content SHA256 mismatch" % entry.path)
		elif entry.kind == "fixture":
			if pack_id != "prototype":
				return _failure("%s: V2 has no fixture records" % base)
			var filename: String = entry.path.get_file()
			if filename not in ["war-ready-42.json", "network-42.json", "labor-42.json"]:
				return _failure("%s: unknown fixture" % base)
			if entry.path != "res://tests/fixtures/prototype/%s" % filename \
					or entry.source != "shared/fixtures/prototype/%s" % filename:
				return _failure("%s: invalid fixture resource mapping" % base)
			# Tests are excluded from exports. Their hashes are checked by the
			# sync tool; production loading never tries to read these paths.
		else:
			return _failure("%s: unknown manifest file kind" % base)
	if content == null:
		return _failure("%s: missing content record" % base)
	var errors: PackedStringArray = Validator.validate(content)
	if not errors.is_empty():
		return _failure("Content validation failed: %s" % "; ".join(errors))
	return {"ok": true, "catalog": Catalog.new(content), "content_sha256": content_sha256}


static func verify_all() -> Dictionary:
	var directory := DirAccess.open(GENERATED_ROOT)
	if directory == null:
		return _failure("Missing generated content root: %s" % GENERATED_ROOT)
	var packs := directory.get_directories()
	packs.sort()
	if packs.is_empty():
		return _failure("No built-in content packs found")
	var results: Array[Dictionary] = []
	for pack_id in packs:
		var result := load_pack(pack_id)
		if not result.ok:
			return result
		results.append({
			"pack_id": pack_id,
			"content_version": result.catalog.data.contentVersion,
			"content_sha256": result.content_sha256,
		})
	return {"ok": true, "packs": results}


static func _read_json(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return _failure("%s: read failed (%s)" % [path, error_string(FileAccess.get_open_error())])
	if file.get_length() > MAX_CONTENT_BYTES:
		return _failure("%s: exceeds 2 MiB" % path)
	var bytes := file.get_buffer(file.get_length())
	if file.get_error() != OK:
		return _failure("%s: incomplete read" % path)
	var parser := JSON.new()
	if parser.parse(bytes.get_string_from_utf8()) != OK:
		return _failure("%s: JSON parse error at line %d" % [path, parser.get_error_line()])
	var encoded := Canonical.encode(parser.data)
	if not encoded.ok:
		return _failure("%s: %s" % [path, encoded.error])
	if encoded.bytes != bytes:
		return _failure("%s: not canonical JSON" % path)
	return {"ok": true, "data": parser.data, "bytes": bytes}


static func _exact_keys(value: Variant, expected: Array) -> bool:
	if not value is Dictionary or value.size() != expected.size():
		return false
	for key in expected:
		if not value.has(key):
			return false
	return true


static func _is_sha256(value: String) -> bool:
	if value.length() != 64:
		return false
	for index in range(value.length()):
		if not "0123456789abcdef".contains(value[index]):
			return false
	return true


static func _failure(message: String) -> Dictionary:
	return {"ok": false, "error": message}
