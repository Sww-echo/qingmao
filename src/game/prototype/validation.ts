import { PROTOTYPE_CONTENT } from './content.ts';

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min = 0, max = 100000): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** A content boundary validator, not an arbitrary script interpreter or a save loader. */
export function validatePrototypeContent(content: unknown = PROTOTYPE_CONTENT): string[] {
  const errors: string[] = [];
  function fail(path: string, message: string): void { errors.push(`${path}: ${message}`); }
  function json(value: unknown, path: string, ancestors: Set<object>): void {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number') {
      if (!integer(value, -100000, 100000)) fail(path, 'expected a bounded finite integer');
      return;
    }
    if (typeof value !== 'object' || value === undefined) { fail(path, 'expected plain JSON, without functions or undefined'); return; }
    if (ancestors.has(value)) { fail(path, 'cyclic object'); return; }
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) { fail(path, 'expected a plain JSON object'); return; }
    const next = new Set(ancestors).add(value);
    for (const [key, nested] of Object.entries(value)) json(nested, `${path}.${key}`, next);
  }
  json(content, 'content', new Set());
  if (!isRecord(content)) return [...errors, 'content: expected an object'];
  function keys(value: RecordValue, allowed: string[], path: string): void {
    for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(path, `unknown field ${key}`);
  }
  function string(value: unknown, path: string): void { if (!nonempty(value)) fail(path, 'expected a nonempty string'); }
  function number(value: unknown, path: string, min = 0, max = 100000): void { if (!integer(value, min, max)) fail(path, `expected integer ${min}..${max}`); }
  function list(value: unknown, path: string): RecordValue[] {
    if (!Array.isArray(value)) { fail(path, 'expected an array'); return []; }
    const objects: RecordValue[] = [];
    for (const [index, item] of value.entries()) {
      if (!isRecord(item)) fail(`${path}[${index}]`, 'expected an object');
      else objects.push(item);
    }
    return objects;
  }
  function indexed(value: unknown, path: string): RecordValue[] {
    const items = list(value, path);
    const ids = new Set<string>();
    for (const [index, item] of items.entries()) {
      string(item.id, `${path}[${index}].id`);
      if (typeof item.id === 'string') {
        if (ids.has(item.id)) fail(path, `duplicate ID ${item.id}`);
        ids.add(item.id);
      }
    }
    return items;
  }
  keys(content, ['scenarioId', 'rulesVersion', 'contentVersion', 'parameters', 'locations', 'gu', 'relations', 'exposures', 'enemies', 'events'], 'content');
  for (const key of ['scenarioId', 'rulesVersion', 'contentVersion']) string(content[key], `content.${key}`);
  const canonicalParameterNames = Object.keys(PROTOTYPE_CONTENT.parameters);
  const parameters = isRecord(content.parameters) ? content.parameters : null;
  if (!isRecord(content.parameters)) fail('parameters', 'expected an object');
  else {
    keys(content.parameters, canonicalParameterNames, 'parameters');
    for (const key of canonicalParameterNames) number(content.parameters[key], `parameters.${key}`, 1);
    if (content.parameters.days !== 14 || content.parameters.actionsPerDay !== 3) fail('parameters', 'P1 requires fourteen days and three actions per day');
    if (integer(content.parameters.crisisThreatMin) && integer(content.parameters.crisisThreatMax)
      && content.parameters.crisisThreatMin > content.parameters.crisisThreatMax) fail('parameters', 'crisis threat range is reversed');
  }
  const locations = indexed(content.locations, 'locations');
  const gu = indexed(content.gu, 'gu');
  const relations = indexed(content.relations, 'relations');
  const exposures = indexed(content.exposures, 'exposures');
  const enemies = indexed(content.enemies, 'enemies');
  const events = indexed(content.events, 'events');
  const idsOf = (items: RecordValue[]) => new Set(items.map(item => item.id).filter((id): id is string => typeof id === 'string'));
  const locationIds = idsOf(locations); const guIds = idsOf(gu); const relationIds = idsOf(relations);
  const exposureIds = idsOf(exposures); const enemyIds = idsOf(enemies);
  function reference(value: unknown, ids: Set<string>, path: string): void { if (typeof value !== 'string' || !ids.has(value)) fail(path, `unknown reference ${String(value)}`); }
  // SCOUT can create this exposure without passing through an event effect.
  reference('unlicensed-survey', exposureIds, 'exposures.SCOUT');
  for (const [items, canonical, path] of [
    [locations, ['academy', 'inn', 'bamboo'], 'locations'],
    [gu, ['moonlight', 'jade-skin', 'ear-grass', 'liquor-worm'], 'gu'],
    [relations, ['guard-captain', 'innkeeper'], 'relations'],
    [enemies, ['scout-wolf', 'crisis-pack'], 'enemies'],
  ] as const) {
    if (items.length !== canonical.length || canonical.some(id => !idsOf(items).has(id))) fail(path, `P1 requires exactly ${canonical.join(', ')}`);
  }
  if (events.length < 12) fail('events', 'at least twelve independent events are required');
  for (const item of locations) {
    keys(item, ['id', 'name', 'description'], `locations.${item.id}`);
    string(item.name, `locations.${item.id}.name`); string(item.description, `locations.${item.id}.description`);
  }
  for (const item of gu) {
    keys(item, ['id', 'name', 'role', 'upkeep', 'qiCost', 'power', 'description'], `gu.${item.id}`);
    string(item.name, `gu.${item.id}.name`); string(item.description, `gu.${item.id}.description`);
    if (!['attack', 'guard', 'scout', 'growth'].includes(String(item.role))) fail(`gu.${item.id}.role`, 'unknown role');
    for (const key of ['upkeep', 'qiCost', 'power']) number(item[key], `gu.${item.id}.${key}`);
  }
  for (const item of relations) {
    keys(item, ['id', 'name', 'purpose'], `relations.${item.id}`);
    string(item.name, `relations.${item.id}.name`); string(item.purpose, `relations.${item.id}.purpose`);
  }
  for (const item of exposures) {
    keys(item, ['id', 'source', 'consequence', 'remedy'], `exposures.${item.id}`);
    for (const key of ['source', 'consequence', 'remedy']) string(item[key], `exposures.${item.id}.${key}`);
  }
  for (const item of enemies) {
    keys(item, ['id', 'name', 'hpMin', 'hpMax', 'intents', 'rewardStones'], `enemies.${item.id}`);
    string(item.name, `enemies.${item.id}.name`);
    number(item.hpMin, `enemies.${item.id}.hpMin`, 1); number(item.hpMax, `enemies.${item.id}.hpMax`, 1);
    if (integer(item.hpMin) && integer(item.hpMax) && item.hpMin > item.hpMax) fail(`enemies.${item.id}`, 'HP range is reversed');
    number(item.rewardStones, `enemies.${item.id}.rewardStones`);
    const intents = list(item.intents, `enemies.${item.id}.intents`);
    if (!intents.length) fail(`enemies.${item.id}.intents`, 'at least one intent is required');
    for (const intent of intents) {
      keys(intent, ['label', 'damage'], `enemies.${item.id}.intents`);
      string(intent.label, `enemies.${item.id}.intent.label`); number(intent.damage, `enemies.${item.id}.intent.damage`);
    }
  }
  const flagProducers = new Map<string, string[]>();
  const guProducers = new Map<string, string[]>();
  const graph = new Map<string, Set<string>>();
  const eventRequirements = new Map<string, RecordValue[]>();
  const choiceData = new Map<string, { requirements: RecordValue[]; effects: RecordValue[] }[]>();
  function requirement(value: RecordValue, path: string): void {
    switch (value.kind) {
      case 'flag':
        keys(value, ['kind', 'id', 'present'], path); string(value.id, `${path}.id`);
        if (typeof value.present !== 'boolean') fail(`${path}.present`, 'expected a boolean');
        break;
      case 'resource': keys(value, ['kind', 'id', 'min'], path); reference(value.id, new Set(['stones', 'herbs', 'wine']), `${path}.id`); number(value.min, `${path}.min`); break;
      case 'relation': keys(value, ['kind', 'id', 'min'], path); reference(value.id, relationIds, `${path}.id`); number(value.min, `${path}.min`, -100, 100); break;
      case 'cultivation': case 'clues': keys(value, ['kind', 'min'], path); number(value.min, `${path}.min`); break;
      case 'gu':
        keys(value, ['kind', 'id', 'usable'], path); reference(value.id, guIds, `${path}.id`);
        if (typeof value.usable !== 'boolean') fail(`${path}.usable`, 'expected a boolean');
        break;
      case 'exposure': keys(value, ['kind', 'id'], path); reference(value.id, exposureIds, `${path}.id`); break;
      default: fail(path, `unknown requirement kind ${String(value.kind)}`);
    }
  }
  function effect(value: RecordValue, path: string, eventId: string): void {
    switch (value.kind) {
      case 'resource': keys(value, ['kind', 'id', 'amount'], path); reference(value.id, new Set(['stones', 'herbs', 'wine']), `${path}.id`); number(value.amount, `${path}.amount`); break;
      case 'relation': keys(value, ['kind', 'id', 'amount'], path); reference(value.id, relationIds, `${path}.id`); number(value.amount, `${path}.amount`, -100, 100); break;
      case 'clues': case 'hp': case 'qi': case 'suspicion': keys(value, ['kind', 'amount'], path); number(value.amount, `${path}.amount`, -100, 100); break;
      case 'flag': case 'gu': {
        keys(value, ['kind', 'id'], path); string(value.id, `${path}.id`);
        if (value.kind === 'gu') reference(value.id, guIds, `${path}.id`);
        const producers = value.kind === 'flag' ? flagProducers : guProducers;
        if (typeof value.id === 'string') producers.set(value.id, [...new Set([...(producers.get(value.id) ?? []), eventId])]);
        break;
      }
      case 'exposure': keys(value, ['kind', 'id', 'source'], path); reference(value.id, exposureIds, `${path}.id`); string(value.source, `${path}.source`); break;
      case 'battle':
        keys(value, ['kind', 'enemyId', 'purpose'], path); reference(value.enemyId, enemyIds, `${path}.enemyId`);
        if (value.enemyId !== 'scout-wolf' || value.purpose !== 'patrol') fail(path, 'only the defined patrol battle effect is supported');
        break;
      case 'crisis':
        keys(value, ['kind', 'response'], path);
        if (!['fight', 'shelter'].includes(String(value.response))) fail(path, 'unknown crisis response');
        if (eventId !== 'crisis-arrival') fail(path, 'crisis resolution must belong to crisis-arrival');
        break;
      default: fail(path, `unknown effect kind ${String(value.kind)}`);
    }
  }
  for (const event of events) {
    const id = String(event.id); const path = `events.${id}`;
    keys(event, ['id', 'title', 'location', 'fromDay', 'throughDay', 'actionCost', 'requirements', 'description', 'choices'], path);
    string(event.title, `${path}.title`); string(event.description, `${path}.description`);
    reference(event.location, locationIds, `${path}.location`);
    number(event.fromDay, `${path}.fromDay`, 1, 14); number(event.throughDay, `${path}.throughDay`, 1, 14);
    if (integer(event.fromDay) && integer(event.throughDay) && event.fromDay > event.throughDay) fail(path, 'event window is reversed');
    number(event.actionCost, `${path}.actionCost`, 0, 3);
    const requirements = list(event.requirements, `${path}.requirements`);
    for (const item of requirements) requirement(item, `${path}.requirements`);
    eventRequirements.set(id, requirements);
    const choices = indexed(event.choices, `${path}.choices`);
    if (!choices.length) fail(`${path}.choices`, 'an event must have a meaningful choice');
    const parsedChoices: { requirements: RecordValue[]; effects: RecordValue[] }[] = [];
    for (const choice of choices) {
      const choicePath = `${path}.choices.${choice.id}`;
      keys(choice, ['id', 'label', 'costs', 'requirements', 'effects', 'risk'], choicePath);
      string(choice.label, `${choicePath}.label`); string(choice.risk, `${choicePath}.risk`);
      if (!isRecord(choice.costs)) fail(`${choicePath}.costs`, 'expected an object');
      else {
        keys(choice.costs, ['stones', 'herbs', 'wine', 'qi'], `${choicePath}.costs`);
        for (const [resource, cost] of Object.entries(choice.costs)) number(cost, `${choicePath}.costs.${resource}`);
      }
      const choiceRequirements = list(choice.requirements, `${choicePath}.requirements`);
      for (const item of choiceRequirements) requirement(item, `${choicePath}.requirements`);
      const effects = list(choice.effects, `${choicePath}.effects`);
      if (!effects.length) fail(`${choicePath}.effects`, 'empty reward/decision');
      for (const item of effects) effect(item, `${choicePath}.effects`, id);
      parsedChoices.push({ requirements: choiceRequirements, effects });
    }
    choiceData.set(id, parsedChoices);
  }
  // END_DAY opens this node directly and blocks all further preparation. Keep a
  // legal fallback even after every optional window has been missed.
  const crisis = events.find(event => event.id === 'crisis-arrival');
  if (!crisis) fail('events', 'missing engine-required crisis-arrival event');
  else {
    if (crisis.fromDay !== 14 || crisis.throughDay !== 14 || crisis.actionCost !== 0) fail('events.crisis-arrival', 'the forced final decision must be free and available on day fourteen');
    const requirements = eventRequirements.get('crisis-arrival') ?? [];
    if (requirements.length !== 1 || requirements[0]?.kind !== 'flag' || requirements[0].id !== 'crisis-arrived' || requirements[0].present !== true) fail('events.crisis-arrival', 'only the engine-generated arrival flag may gate the forced final decision');
    const stand = Array.isArray(crisis.choices) ? crisis.choices.find(choice => isRecord(choice) && choice.id === 'stand') : null;
    if (!isRecord(stand) || !isRecord(stand.costs) || Object.values(stand.costs).some(cost => cost !== 0)
      || !Array.isArray(stand.requirements) || stand.requirements.length !== 0
      || !Array.isArray(stand.effects) || stand.effects.length !== 1
      || !isRecord(stand.effects[0]) || stand.effects[0].kind !== 'crisis' || stand.effects[0].response !== 'fight') {
      fail('events.crisis-arrival', 'stand must be an unconditional, free fight response');
    }
  }
  if (flagProducers.has('crisis-arrived')) fail('events', 'crisis-arrived is reserved for END_DAY');
  const dependencyKey = (req: RecordValue): string | null => req.kind === 'gu' ? `gu:${String(req.id)}`
    : req.kind === 'flag' && req.present === true ? `flag:${String(req.id)}` : null;
  for (const event of events) {
    const id = String(event.id);
    const base = eventRequirements.get(id) ?? [];
    const choices = choiceData.get(id) ?? [];
    const requirements = [...base, ...choices.flatMap(choice => choice.requirements)];
    // Alternatives are OR branches. Only requirements shared by every branch
    // can turn an event into a mandatory dependency cycle.
    const mandatory = new Set(base.map(dependencyKey).filter(key => key !== null));
    for (const req of choices[0]?.requirements ?? []) {
      const key = dependencyKey(req);
      if (key && choices.every(choice => choice.requirements.some(candidate => dependencyKey(candidate) === key))) mandatory.add(key);
    }
    const dependencies = new Set<string>();
    for (const req of requirements) {
      if (req.kind !== 'gu' && !(req.kind === 'flag' && req.present === true)) continue;
      if (req.kind === 'flag' && req.id === 'crisis-arrived') continue; // Generated by END_DAY, not an event reward.
      const producers = (req.kind === 'gu' ? guProducers : flagProducers).get(String(req.id));
      if (!producers?.length) fail(`events.${id}`, `missing producer for ${String(req.id)}`);
      else if (producers.length === 1) {
        const key = dependencyKey(req);
        if (key && mandatory.has(key)) dependencies.add(producers[0]!);
        const producer = events.find(item => item.id === producers[0]);
        if (producer && integer(producer.fromDay) && integer(event.throughDay) && producer.fromDay > event.throughDay) fail(`events.${id}`, `producer ${producers[0]} opens after this window closes`);
      }
    }
    graph.set(id, dependencies);
  }
  const visited = new Set<string>(); const stack = new Set<string>();
  function visit(id: string): void {
    if (stack.has(id)) { fail(`events.${id}`, 'cyclic mandatory flag/gu dependency'); return; }
    if (visited.has(id)) return;
    stack.add(id);
    for (const dependency of graph.get(id) ?? []) visit(dependency);
    stack.delete(id); visited.add(id);
  }
  for (const id of graph.keys()) visit(id);

  // Monotone feasibility audit: catches self-locked relation/clue gates without
  // pretending that this abstraction proves full economic/path reachability.
  const reachable = new Set<string>(); const flags = new Set(['crisis-arrived']); const owned = new Set<string>();
  const relationMaximum = new Map<string, number>(); let clueMaximum = 0;
  function canMeet(req: RecordValue): boolean {
    switch (req.kind) {
      case 'flag': return req.present === false || flags.has(String(req.id));
      case 'gu': return owned.has(String(req.id));
      case 'relation': return (relationMaximum.get(String(req.id)) ?? 0) >= Number(req.min);
      case 'clues': return clueMaximum >= Number(req.min);
      case 'cultivation': return !!parameters && Number(req.min) <= Number(parameters.cultivationCap);
      case 'exposure': return exposureIds.has(String(req.id));
      case 'resource': return true;
      default: return false;
    }
  }
  for (let pass = 0; pass < events.length; pass += 1) {
    let progress = false;
    for (const event of events) {
      const id = String(event.id);
      if (reachable.has(id) || !(eventRequirements.get(id) ?? []).every(canMeet)) continue;
      const choices = (choiceData.get(id) ?? []).filter(choice => choice.requirements.every(canMeet));
      if (!choices.length) continue;
      reachable.add(id); progress = true;
      const increments = new Map<string, number>(); let clueIncrement = 0;
      for (const choice of choices) {
        const choiceRelation = new Map<string, number>(); let choiceClues = 0;
        for (const item of choice.effects) {
          if (item.kind === 'flag') flags.add(String(item.id));
          if (item.kind === 'gu') owned.add(String(item.id));
          if (item.kind === 'relation') choiceRelation.set(String(item.id), (choiceRelation.get(String(item.id)) ?? 0) + Math.max(0, Number(item.amount)));
          if (item.kind === 'clues') choiceClues += Math.max(0, Number(item.amount));
          if (item.kind === 'battle') choiceRelation.set('guard-captain', (choiceRelation.get('guard-captain') ?? 0) + 3);
        }
        clueIncrement = Math.max(clueIncrement, choiceClues);
        for (const [relation, amount] of choiceRelation) increments.set(relation, Math.max(increments.get(relation) ?? 0, amount));
      }
      clueMaximum += clueIncrement;
      // Repeatable public SCOUT supplies additional information once the game begins.
      clueMaximum = Math.max(clueMaximum, parameters ? Number(parameters.clueCap) : 0);
      for (const [relation, amount] of increments) relationMaximum.set(relation, Math.min(100, (relationMaximum.get(relation) ?? 0) + amount));
    }
    if (!progress) break;
  }
  for (const event of events) if (!reachable.has(String(event.id))) fail(`events.${event.id}`, 'unreachable requirement chain in monotone audit');
  return [...new Set(errors)];
}
