import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTrip } from './lib/trip-parser.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultSource = '/Users/ywfan/Library/Mobile Documents/iCloud~md~obsidian/Documents/SecondBrain/01_Inbox_Notes/福岡之旅 20260827~0903.md';
const sourcePath = process.env.TRAVEL_NOTE_PATH || defaultSource;
const fetchPreviews = process.argv.includes('--fetch-previews');

function decodeHtml(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function meta(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i'),
  ];
  return decodeHtml(patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean) ?? '');
}

async function loadPreview(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'WeiTravelPreview/1.0 (+https://travel.weiweifan.com)' },
    });
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('text/html')) return null;
    const html = (await response.text()).slice(0, 500_000);
    const title = meta(html, 'og:title') || decodeHtml(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? '');
    const description = meta(html, 'og:description') || meta(html, 'description');
    const image = meta(html, 'og:image');
    return title || description || image ? { title, description, image: image.startsWith('https://') ? image : '' } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const markdown = await fs.readFile(sourcePath, 'utf8');
const { trip } = parseTrip(markdown);
const outputDir = path.join(projectRoot, 'src/data/trips');
const outputPath = path.join(outputDir, `${trip.slug}.json`);
await fs.mkdir(outputDir, { recursive: true });
let previous = null;
try { previous = JSON.parse(await fs.readFile(outputPath, 'utf8')); } catch { /* first sync */ }
const previousPreviews = new Map((previous?.entities ?? []).map((entity) => [entity.id, entity.preview]).filter(([, preview]) => preview));
for (const entity of trip.entities) {
  entity.preview = previousPreviews.get(entity.id) ?? null;
  if (fetchPreviews) {
    const previewAction = entity.actions.find((action) => action.kind === 'official' || action.kind === 'link');
    if (previewAction) entity.preview = await loadPreview(previewAction.url) ?? entity.preview;
  }
}
await fs.writeFile(outputPath, `${JSON.stringify(trip, null, 2)}\n`);
console.log(`Public trip data updated: ${trip.title} · ${trip.days.length} days · ${trip.entities.length} detail cards`);
