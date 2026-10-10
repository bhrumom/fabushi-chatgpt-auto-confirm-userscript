import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(resolve(root, 'src/manifest.json'), 'utf8'));
if (!Array.isArray(manifest) || new Set(manifest).size !== manifest.length) throw Error('Invalid source manifest');
const sources = [];
for (const path of manifest) {
  if (!/^src\/[a-z0-9/.-]+\.js$/.test(path) || path.includes('..')) throw Error('Invalid source path');
  sources.push(await readFile(resolve(root, path), 'utf8'));
}
const bundle = sources.join('\n');
const target = resolve(root, 'chatgpt-auto-confirm.user.js');
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== bundle) throw Error('Generated userscript is stale; run npm run build');
} else await writeFile(target, bundle);
