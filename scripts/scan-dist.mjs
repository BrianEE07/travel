import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanPublicPayload } from './lib/trip-parser.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const roots = [path.join(projectRoot, 'src/data/trips'), path.join(projectRoot, 'dist')];
const files = [];
const allowedPrices = [];

for (const entry of await fs.readdir(path.join(projectRoot, 'src/data/trips'))) {
  if (!entry.endsWith('.json')) continue;
  const trip = JSON.parse(await fs.readFile(path.join(projectRoot, 'src/data/trips', entry), 'utf8'));
  for (const entity of trip.entities ?? []) {
    if ((entity.type === 'stay' || entity.type === 'transport') && entity.price?.text) allowedPrices.push(entity.price.text);
  }
}

async function walk(target) {
  const stat = await fs.stat(target);
  if (stat.isFile()) return files.push(target);
  for (const entry of await fs.readdir(target, { withFileTypes: true })) {
    if (entry.isDirectory()) await walk(path.join(target, entry.name));
    else if (/\.(?:html|js|json|xml|txt|webmanifest)$/.test(entry.name)) files.push(path.join(target, entry.name));
  }
}

for (const root of roots) await walk(root);
const findings = [];
for (const file of files) {
  const content = await fs.readFile(file, 'utf8');
  for (const finding of scanPublicPayload(content, [], allowedPrices)) findings.push(`${path.relative(projectRoot, file)}: ${finding}`);
}
if (findings.length) throw new Error(`Secret scan failed:\n${findings.join('\n')}`);
console.log(`Secret scan passed across ${files.length} public files.`);
