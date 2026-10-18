class_name SuiteChecks
extends RefCounted

var checks: int = 0
var failures: PackedStringArray = []


func expect(condition: bool, message: String) -> bool:
	checks += 1
	if not condition:
		failures.append(message)
	return condition


func result() -> Dictionary:
	return {"checks": checks, "failures": failures}
