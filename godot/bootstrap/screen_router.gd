class_name ScreenRouter
extends RefCounted
## Owns the single-screen host under the composition root.
##
## Swapping screens is presentation plumbing: it detaches the old screen before
## freeing it and never touches session or rule state. Extracted from the W0
## `main.gd` swap helper as planned in W4.

var _host: Node


func configure(host: Node) -> void:
	_host = host


func show(screen: Node) -> void:
	if _host == null:
		push_error("ScreenRouter has no host; call configure() first")
		return
	for child: Node in _host.get_children():
		_host.remove_child(child)
		child.queue_free()
	_host.add_child(screen)
