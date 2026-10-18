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

export function validateGodotContent(content) {
  if (!content || Array.isArray(content) || typeof content !== 'object') return ['content: expected an object'];
  if (Object.entries(V1_VERSIONS).some(([key, version]) => content[key] !== version)) {
    return ['content: unsupported scenario/rules/content version tuple (W1 supports prototype V1 only)'];
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
