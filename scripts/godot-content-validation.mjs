import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validatePrototypeContent } from '../src/game/prototype/validation.ts';
import { ROOT, fail, parseOptions } from './prototype-common.mjs';

export const V1_VERSIONS = {
  scenarioId: 'qingmao-fourteen-day-prototype',
  rulesVersion: 'prototype-rules-1',
  contentVersion: 'prototype-content-1',
};
export const V2_VERSIONS = {
  scenarioId: 'qingmao-fourteen-day-v2',
  rulesVersion: 'qingmao-rules-2',
  contentVersion: 'qingmao-content-2',
};
const V1_PARAMETERS = [
  'days', 'actionsPerDay', 'startingHp', 'startingQi', 'startingStones', 'startingHerbs',
  'laborIncome', 'trainingQi', 'trainingGain', 'liquorTrainingBonus', 'cultivationCap',
  'cultivationStep', 'maxQiBonusPerStep', 'herbCarryLimit', 'wineCarryLimit', 'herbPrice',
  'winePrice', 'herbHealing', 'wineQi', 'nightlyHealing', 'suspicionDecay', 'scoutQi',
  'clueCap', 'sealCost', 'wakeSealedCost', 'wakeDormantCost', 'clearExposureCost',
  'crisisThreatMin', 'crisisThreatMax', 'shelterCost', 'retreatDamage', 'retreatStoneLoss',
  'scoutProtection',
];
const V2_PARAMETERS = {
  inquiryThreshold: [1, 100],
  phaseBreatherQi: [0, 100],
  shelterRouteDiscount: [0, 100000],
  shelterBuyoutMaxGap: [0, 2],
  shelterBuyoutStonePerPoint: [1, 100000],
  fortifyTurns: [0, 2],
  fortifyDamageReduction: [0, 100],
};
const V2_EVENTS = [
  'patrol-overtime', 'academy-drill', 'inquiry', 'route-review', 'fortify',
  'market-herbs', 'market-wine', 'final-march', 'final-freight',
];

function versionTuple(content) {
  return content && typeof content === 'object'
    ? [content.scenarioId, content.rulesVersion, content.contentVersion].join('|') : '';
}

function equalsTuple(content, tuple) {
  return versionTuple(content) === [tuple.scenarioId, tuple.rulesVersion, tuple.contentVersion].join('|');
}

function validateV2(content) {
  const errors = [];
  if (!content || Array.isArray(content) || typeof content !== 'object') return ['content: expected an object'];
  if (!equalsTuple(content, V2_VERSIONS)) return ['content: unsupported scenario/rules/content version tuple'];
  const top = ['scenarioId', 'rulesVersion', 'contentVersion', 'parameters', 'locations', 'gu', 'relations', 'exposures', 'enemies', 'events'];
  for (const key of Object.keys(content)) if (!top.includes(key)) errors.push(`content: unknown field ${key}`);
  const parameters = content.parameters;
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    errors.push('parameters: expected an object');
  } else {
    const allowed = [...V1_PARAMETERS, ...Object.keys(V2_PARAMETERS)];
    for (const key of Object.keys(parameters)) if (!allowed.includes(key)) errors.push(`parameters: unknown field ${key}`);
    for (const key of V1_PARAMETERS) {
      if (!Number.isInteger(parameters[key]) || parameters[key] < 1 || parameters[key] > 100000) {
        errors.push(`parameters.${key}: expected integer 1..100000`);
      }
    }
    for (const [key, [min, max]] of Object.entries(V2_PARAMETERS)) {
      if (!Number.isInteger(parameters[key]) || parameters[key] < min || parameters[key] > max) {
        errors.push(`parameters.${key}: expected integer ${min}..${max}`);
      }
    }
    if (parameters.days !== 14 || parameters.actionsPerDay !== 3) errors.push('parameters: requires fourteen days and three actions per day');
    if (Number.isInteger(parameters.crisisThreatMin) && Number.isInteger(parameters.crisisThreatMax)
      && parameters.crisisThreatMin > parameters.crisisThreatMax) errors.push('parameters: crisis threat range is reversed');
    if (Number.isInteger(parameters.shelterRouteDiscount) && Number.isInteger(parameters.crisisThreatMin)
      && parameters.shelterRouteDiscount > parameters.crisisThreatMin) errors.push('parameters.shelterRouteDiscount: exceeds crisisThreatMin');
  }
  if (!Array.isArray(content.enemies) || content.enemies.length !== 3) {
    errors.push('enemies: V2 requires exactly scout-wolf, crisis-pack, crisis-alpha');
  } else {
    const ids = content.enemies.map(enemy => enemy && enemy.id);
    for (const id of ['scout-wolf', 'crisis-pack', 'crisis-alpha']) if (!ids.includes(id)) errors.push(`enemies: missing ${id}`);
    for (const enemy of content.enemies) {
      const allowed = ['id', 'name', 'hpMin', 'hpMax', 'intents', 'rewardStones', 'next'];
      for (const key of Object.keys(enemy)) if (!allowed.includes(key)) errors.push(`enemies.${enemy.id}: unknown field ${key}`);
      if (!Number.isInteger(enemy.hpMin) || !Number.isInteger(enemy.hpMax) || enemy.hpMin < 1 || enemy.hpMin > enemy.hpMax) {
        errors.push(`enemies.${enemy.id}: invalid HP range`);
      }
      if (!Array.isArray(enemy.intents) || enemy.intents.length === 0) errors.push(`enemies.${enemy.id}.intents: at least one intent is required`);
      if ('next' in enemy) {
        if (enemy.id !== 'crisis-pack' || enemy.next !== 'crisis-alpha') errors.push(`enemies.${enemy.id}.next: only crisis-pack -> crisis-alpha is allowed`);
      }
    }
    if (content.enemies.find(enemy => enemy.id === 'crisis-alpha' && 'next' in enemy)) errors.push('enemies.crisis-alpha.next: terminal phase must not chain');
  }
  if (!Array.isArray(content.exposures) || content.exposures.length !== 2) {
    errors.push('exposures: V2 requires unlicensed-survey and inquiry-unresolved');
  } else {
    for (const id of ['unlicensed-survey', 'inquiry-unresolved']) {
      if (!content.exposures.some(exposure => exposure && exposure.id === id)) errors.push(`exposures: missing ${id}`);
    }
  }
  if (!Array.isArray(content.events) || content.events.length !== 28) {
    errors.push('events: V2 requires 28 events');
  } else {
    for (const id of V2_EVENTS) {
      if (!content.events.some(event => event && event.id === id)) errors.push(`events: missing ${id}`);
    }
    // Reserved engine flags and the unresolved-inquiry exposure may only be
    // produced by the engine, never by content effects.
    for (const event of content.events) {
      for (const choice of Array.isArray(event.choices) ? event.choices : []) {
        for (const effect of Array.isArray(choice.effects) ? choice.effects : []) {
          if (effect && effect.kind === 'flag' && ['crisis-arrived', 'inquiry-due'].includes(effect.id)) {
            errors.push(`events.${event.id}: reserved engine flag ${effect.id}`);
          }
          if (effect && effect.kind === 'exposure' && effect.id === 'inquiry-unresolved') {
            errors.push(`events.${event.id}: inquiry-unresolved is engine-generated`);
          }
        }
      }
    }
  }
  if (errors.length) return errors;

  // Reuse the frozen V1 validator for shared schema, event graph and monotone
  // audit. The shadow strips V2-only extensions and adds a synthetic producer
  // for the engine-owned inquiry-due flag; the real content is checked above.
  const shadow = structuredClone(content);
  shadow.scenarioId = V1_VERSIONS.scenarioId;
  shadow.rulesVersion = V1_VERSIONS.rulesVersion;
  shadow.contentVersion = V1_VERSIONS.contentVersion;
  shadow.parameters = Object.fromEntries(V1_PARAMETERS.map(key => [key, parameters[key]]));
  shadow.enemies = content.enemies.filter(enemy => enemy.id !== 'crisis-alpha')
    .map(({ next, ...enemy }) => enemy);
  shadow.exposures = content.exposures.filter(exposure => exposure.id === 'unlicensed-survey');
  shadow.events = [...content.events, {
    id: 'engine-inquiry-root', title: 'engine inquiry root', location: 'academy',
    fromDay: 1, throughDay: 14, actionCost: 0, requirements: [],
    description: 'Synthetic engine producer used only for schema/graph validation.',
    choices: [{ id: 'emit', label: 'emit', costs: {}, requirements: [], effects: [{ kind: 'flag', id: 'inquiry-due' }], risk: 'engine only' }],
  }];
  try {
    errors.push(...validatePrototypeContent(shadow));
  } catch {
    errors.push('content: V2 shadow validation failed');
  }
  return [...new Set(errors)];
}

export function validateGodotContent(content) {
  if (!content || Array.isArray(content) || typeof content !== 'object') return ['content: expected an object'];
  if (equalsTuple(content, V2_VERSIONS)) return validateV2(content);
  if (!equalsTuple(content, V1_VERSIONS)) {
    return ['content: unsupported scenario/rules/content version tuple'];
  }
  const errors = [];
  function inspect(value, path, ancestors, depth = 0) {
    if (depth > 128) { errors.push(`${path}: nesting exceeds the interchange depth limit`); return; }
    if (typeof value === 'string') {
      if (/[\u0000-\u001f]/u.test(value)) errors.push(`${path}: control characters are not allowed`);
    } else if (value && typeof value === 'object') {
      if (ancestors.has(value)) { errors.push(`${path}: cyclic object`); return; }
      const next = new Set(ancestors).add(value);
      for (const [key, nested] of Object.entries(value)) {
        if (!/^[\x20-\x7e]+$/u.test(key)) errors.push(`${path}: expected printable ASCII keys`);
        inspect(nested, `${path}.${key}`, next, depth + 1);
      }
    }
  }
  inspect(content, 'content', new Set());
  if (errors.length) return errors;
  try {
    return validatePrototypeContent(content);
  } catch {
    // The frozen validator may stringify malformed reference objects. Keep its
    // implementation untouched while preserving this boundary's error result.
    return ['content: malformed V1 payload'];
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseOptions(process.argv.slice(2), ['--file']);
    const path = resolve(ROOT, options['--file'] ?? 'shared/prototype/content.json');
    const errors = validateGodotContent(JSON.parse(await readFile(path, 'utf8')));
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Godot V1 content validation passed.');
  } catch (error) {
    fail(error);
  }
}
