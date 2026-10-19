class_name ViewProjector
extends RefCounted
## The only conversion from owned state to the public application view.

static func project(
	state: GameState,
	catalog: ContentCatalog,
	run_id: String,
	revision: int,
	save_status: Dictionary,
	day_review: Variant = null
) -> Dictionary:
	var view: Dictionary = Queries.public_view(state, catalog)
	view["runId"] = run_id
	view["revision"] = revision
	view["saveStatus"] = save_status.duplicate(true)
	if day_review != null:
		view["dayReview"] = day_review.duplicate(true)
	if state.ending != null:
		view["endingView"] = {
			"id": state.ending.id,
			"outcome": state.ending.outcome,
			"reasons": state.ending.reasons.duplicate(),
			"summary": {
				"day": state.day,
				"hp": state.hp,
				"qi": state.qi,
				"cultivation": state.cultivation,
				"clues": state.clues,
				"stones": state.resources.get("stones", 0),
			},
		}
	return view

static func day_review(before: GameState, state: GameState, events: Array, catalog: ContentCatalog) -> Dictionary:
	var ledger: Array = []
	var paid: int = 0
	for index: int in range(before.ledger.size(), state.ledger.size()):
		var entry: GameState.LedgerEntry = state.ledger[index]
		ledger.append({
			"day": entry.day, "source": entry.source,
			"resource": entry.resource, "amount": entry.amount,
		})
		if entry.source == "daily-upkeep" and entry.resource == "stones":
			paid -= entry.amount
	var missed: Array[String] = []
	for id: String in state.missed_events:
		if not before.missed_events.has(id):
			missed.append(id)
	return {
		"day": before.day,
		"nextDay": state.day,
		"events": events.duplicate(true),
		"ledger": ledger,
		"upkeep": {"due": Queries.upkeep(before, catalog), "paid": paid},
		"missedEvents": missed,
		"commitments": {
			"pledged": state.flags.has("shelter-pledged"),
			"stocked": state.flags.has("shelter-stocked"),
		},
		"crisis": state.crisis,
	}
