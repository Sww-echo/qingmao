import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve('dist');
let html = await readFile(resolve(dist, 'index.html'), 'utf8');
const script = html.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/);
const style = html.match(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/);
if (!script || !style) throw new Error('Missing built application script or stylesheet.');
const localAsset = value => {
  const clean = value.replace(/^\.\//, '').replace(/^\//, '');
  if (!clean.startsWith('assets/') || clean.includes('..')) throw new Error('Unexpected build asset path.');
  return resolve(dist, clean);
};
const javascript = await readFile(localAsset(script[1]), 'utf8');
const css = await readFile(localAsset(style[1]), 'utf8');
const favicon = await readFile(resolve(dist, 'favicon.svg'), 'utf8');
html = html.replace(script[0], () => `<script type="module">\n${javascript.replace(/<\/script/gi, '<\\/script')}\n</script>`);
html = html.replace(style[0], () => `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`);
html = html.replace(/href="\.\/favicon\.svg"/, `href="data:image/svg+xml,${encodeURIComponent(favicon)}"`);
await writeFile(resolve(dist, 'play.html'), html, 'utf8');
console.log('Offline edition: dist/play.html');
