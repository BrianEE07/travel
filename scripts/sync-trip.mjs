import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTrip } from './lib/trip-parser.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultSource = '/Users/ywfan/Library/Mobile Documents/iCloud~md~obsidian/Documents/SecondBrain/01_Inbox_Notes/福岡之旅 20260827~0903.md';
const sourcePath = process.env.TRAVEL_NOTE_PATH || defaultSource;

const markdown = await fs.readFile(sourcePath, 'utf8');
const { trip } = parseTrip(markdown);
for (const [label, asset] of [['trip_cover', trip.coverImage], ['trip_briefing_image', trip.briefingImage]]) {
  const assetPath = path.join(projectRoot, 'public', asset.slice(1));
  try {
    await fs.access(assetPath);
  } catch {
    throw new Error(`${label} 找不到 public asset：${asset}`);
  }
}
const outputDir = path.join(projectRoot, 'src/data/trips');
const outputPath = path.join(outputDir, `${trip.slug}.json`);
await fs.mkdir(outputDir, { recursive: true });
if (trip.status === 'draft') {
  await fs.rm(outputPath, { force: true });
  console.log(`Draft trip removed from public data: ${trip.title}`);
  process.exit(0);
}
const sourceStat = await fs.stat(sourcePath);
trip.updatedAt = sourceStat.mtime.toISOString();
await fs.writeFile(outputPath, `${JSON.stringify(trip, null, 2)}\n`);
console.log(`Public trip data updated: ${trip.title} · ${trip.days.length} days · ${trip.entities.length} detail cards`);
