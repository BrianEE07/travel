import crypto from 'node:crypto';
import YAML from 'yaml';

const PUBLIC_SECTIONS = new Map([
  ['Accommodation', 'stay'],
  ['Restaurant Reservations', 'food'],
  ['Place Notes', 'place'],
  ['Transportation', 'transport'],
]);

const FORBIDDEN_FIELD = /^(?:訂房人|訂位人|旅客|姓名|訂房編號|訂位編號|預訂編號|認證碼|認證編號|Login ID|交易編號|票號|座位號|支付|付款|費用|價格|總額|訂房日期|訂位日期|開票日期)$/i;
const OMIT_SUBSECTION = /^(?:訂位|費用)$/;
const MANAGEMENT_LABEL = /(?:確認|變更|取消|收據|登入|管理)/;
const MANAGEMENT_PARAM = /[?&](?:auth(?:_key)?|token|code|bok|booking|reservation|login|transaction)(?:=|%3D)/i;
const CURRENCY = /(?:JPY|TWD|NTD|USD|EUR)\s*[\d,.]+(?:\s*[×x]\s*\d+\s*=\s*(?:JPY|TWD|NTD|USD|EUR)?\s*[\d,.]+)?/gi;

export function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) return { data: {}, body: markdown };
  const end = markdown.indexOf('\n---\n', 4);
  if (end < 0) return { data: {}, body: markdown };
  return {
    data: YAML.parse(markdown.slice(4, end)) ?? {},
    body: markdown.slice(end + 5),
  };
}

function splitSections(body, level = 2) {
  const marker = '#'.repeat(level);
  const pattern = new RegExp(`^${marker} (.+)$`, 'gm');
  const matches = [...body.matchAll(pattern)];
  const result = new Map();
  for (let index = 0; index < matches.length; index += 1) {
    const title = matches[index][1].trim();
    const start = matches[index].index + matches[index][0].length;
    const end = matches[index + 1]?.index ?? body.length;
    result.set(title, body.slice(start, end).trim());
  }
  return result;
}

function splitSubsections(section) {
  return [...splitSections(section, 3)].map(([title, content]) => ({ title, content }));
}

function parseReferences(section = '') {
  const references = new Map();
  for (const match of section.matchAll(/^\[([^\]]+)\]:\s*(https?:\/\/\S+)$/gm)) {
    references.set(match[1], match[2]);
  }
  return references;
}

function slugify(value) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[｜|/]/g, '-')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function stripLinks(value) {
  return value
    .replace(/\[([^\]]+)\]\(<#.*?>\)/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]+\]/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim();
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isSafePublicUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    if (MANAGEMENT_PARAM.test(url.href)) return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeFragment(target) {
  try {
    return decodeURIComponent(target.replace(/^<#/, '').replace(/>$/, ''));
  } catch {
    return target.replace(/^<#/, '').replace(/>$/, '');
  }
}

function inlineHtml(value, entityIds, references) {
  const pattern = /\[([^\]]+)\]\((<#[^)]+>|https?:\/\/[^)]+)\)|\[([^\]]+)\]\[([^\]]+)\]/g;
  let html = '';
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    html += escapeHtml(value.slice(cursor, match.index));
    const label = match[1] ?? match[3];
    const rawTarget = match[2] ?? references.get(match[4]);
    if (rawTarget?.startsWith('<#')) {
      const title = normalizeFragment(rawTarget);
      const entityId = entityIds.get(title);
      const dateMatch = title.match(/^(\d{4}-\d{2}-\d{2})/);
      if (entityId) {
        html += `<button class="inline-detail" type="button" data-entity="${escapeHtml(entityId)}">${escapeHtml(label)}</button>`;
      } else if (dateMatch) {
        html += `<a href="#day-${dateMatch[1]}">${escapeHtml(label)}</a>`;
      } else {
        html += escapeHtml(label);
      }
    } else if (rawTarget && isSafePublicUrl(rawTarget)) {
      html += `<a href="${escapeHtml(rawTarget)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    } else {
      html += escapeHtml(label);
    }
    cursor = match.index + match[0].length;
  }
  html += escapeHtml(value.slice(cursor));
  return html.replace(/`([^`]+)`/g, '<code>$1</code>');
}

function rememberSecret(value, secrets) {
  const plain = stripLinks(value).trim();
  if (plain.length >= 4) secrets.add(plain);
  for (const token of plain.matchAll(/[A-Z0-9][A-Z0-9-]{5,}/gi)) {
    if (/\d/.test(token[0])) secrets.add(token[0]);
  }
}

function sanitizeValue(value) {
  let clean = value;
  clean = clean.replace(CURRENCY, '').replace(/\s*（\s*）/g, '');
  clean = clean.replace(/[，、]\s*(?=[，、。；]|$)/g, '');
  clean = clean.replace(/\s{2,}/g, ' ').trim();
  return clean.replace(/^[，、；]\s*|\s*[，、；]$/g, '').trim();
}

function parseActions(line, references) {
  const actions = [];
  const referenceMatch = line.match(/^(?:Map|地圖)：\[([^\]]+)\]\[([^\]]+)\]/i);
  if (referenceMatch) {
    const url = references.get(referenceMatch[2]);
    if (url && isSafePublicUrl(url)) actions.push({ label: 'Google Maps', url, kind: 'map' });
  }
  const directMatch = line.match(/^([^：]+)：\s*(https?:\/\/\S+)/);
  if (directMatch && !MANAGEMENT_LABEL.test(directMatch[1]) && isSafePublicUrl(directMatch[2])) {
    const kind = /官網|official/i.test(directMatch[1]) ? 'official' : 'link';
    actions.push({ label: stripLinks(directMatch[1]), url: directMatch[2], kind });
  }
  return actions;
}

function parseEntity(title, content, type, entityIds, references, secrets) {
  const details = [];
  const actions = [];
  let omitMode = false;
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || /^\[Back to top\]/.test(line)) continue;

    const subsection = line.match(/^([^：]{1,16})：$/);
    if (subsection) {
      omitMode = OMIT_SUBSECTION.test(subsection[1]);
      continue;
    }

    if (omitMode) {
      rememberSecret(line, secrets);
      continue;
    }

    const field = line.match(/^-?\s*([^：]+)：\s*(.*)$/);
    if (field) {
      const label = stripLinks(field[1]);
      const value = field[2].trim();
      if (FORBIDDEN_FIELD.test(label) || (MANAGEMENT_LABEL.test(label) && /https?:\/\//.test(value))) {
        rememberSecret(value, secrets);
        continue;
      }
      const foundActions = parseActions(line.replace(/^[-\s]+/, ''), references);
      if (foundActions.length) {
        actions.push(...foundActions);
        continue;
      }
      const clean = sanitizeValue(value);
      if (clean) details.push({ label, value: stripLinks(clean), valueHtml: inlineHtml(clean, entityIds, references) });
      continue;
    }

    if (omitMode || /票號|訂位編號|訂房編號|認證(?:碼|編號)|Login ID|交易編號/.test(line)) {
      rememberSecret(line, secrets);
      continue;
    }

    const clean = sanitizeValue(line.replace(/^[-*]\s*/, ''));
    if (clean && !/^#+\s/.test(clean)) {
      details.push({ label: '', value: stripLinks(clean), valueHtml: inlineHtml(clean, entityIds, references) });
    }
  }

  const uniqueActions = [...new Map(actions.map((action) => [action.url, action])).values()];
  return {
    id: entityIds.get(title),
    title,
    type,
    summary: details.find((item) => item.label === '重點')?.value ?? details[0]?.value ?? '',
    details,
    actions: uniqueActions,
  };
}

function parseItinerary(section = '', entityIds = new Map()) {
  const rows = [];
  for (const line of section.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 4 || /^-+$/.test(cells[0].replace(/\s/g, '')) || cells[0] === 'Date') continue;
    const date = cells[0].match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (!date) continue;
    const stayTarget = cells[2].match(/\[[^\]]+\]\((<#[^)]+>)\)/)?.[1];
    rows.push({
      date,
      area: stripLinks(cells[1]),
      stay: stripLinks(cells[2]),
      stayEntityId: stayTarget ? entityIds.get(normalizeFragment(stayTarget)) ?? '' : '',
      notes: stripLinks(cells[3]),
    });
  }
  return rows;
}

function parseDaily(section, itinerary, publishThrough, entityIds, references) {
  const itineraryByDate = new Map(itinerary.map((item) => [item.date, item]));
  return splitSubsections(section ?? '').map(({ title, content }) => {
    const date = title.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    const summary = itineraryByDate.get(date) ?? { date, area: '', stay: '', stayEntityId: '', notes: '' };
    const lines = content.split('\n');
    const stayIndex = lines.findIndex((line) => /^Stay：/.test(line.trim()));
    const notesIndex = lines.findIndex((line) => /^Notes：/.test(line.trim()));
    const endTimeline = stayIndex >= 0 ? stayIndex : notesIndex >= 0 ? notesIndex : lines.length;
    const timeline = [];
    let group = '';
    for (const rawLine of lines.slice(0, endTimeline)) {
      const line = rawLine.trim();
      if (!line) continue;
      if (/^[^：]{1,12}：$/.test(line)) {
        group = line.slice(0, -1);
        continue;
      }
      if (!line.startsWith('- ')) continue;
      const item = line.slice(2);
      const timeMatch = item.match(/^(\d{2}:\d{2}(?:-\d{2}:\d{2})?)\s*(.*)$/);
      timeline.push({
        time: timeMatch?.[1] ?? '',
        group,
        text: stripLinks(timeMatch?.[2] || item),
        textHtml: inlineHtml(timeMatch?.[2] || item, entityIds, references),
      });
    }
    const notes = [];
    if (notesIndex >= 0) {
      for (const rawLine of lines.slice(notesIndex + 1)) {
        const line = rawLine.trim();
        if (line.startsWith('- ')) {
          const clean = sanitizeValue(line.slice(2));
          if (clean) notes.push({ text: stripLinks(clean), textHtml: inlineHtml(clean, entityIds, references) });
        }
      }
    }
    return {
      date,
      weekday: title.replace(date, '').trim(),
      area: summary.area,
      stay: summary.stay,
      stayEntityId: summary.stayEntityId,
      summaryNote: summary.notes,
      detailed: Boolean(date && date <= publishThrough),
      timeline: date && date <= publishThrough ? timeline : [],
      notes: date && date <= publishThrough ? notes : [],
    };
  });
}

function parseLocations(overview = '') {
  const match = overview.match(/^- 地點：(.+)$/m);
  return match ? match[1].split(/[、,]/).map((item) => item.trim()).filter(Boolean) : [];
}

export function scanPublicPayload(payload, secrets = []) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const findings = [];
  const patterns = [
    ['sensitive field label', /訂房編號|訂位編號|預訂編號|認證碼|認證編號|Login ID|交易編號|票號/gi],
    ['management URL parameter', /[?&](?:auth(?:_key)?|token|code|bok|booking|reservation|login|transaction)=/gi],
    ['air ticket number', /\b\d{3}[ -]?\d{10}\b/g],
    ['visible price', /\b(?:JPY|TWD|NTD|USD|EUR)\s*[\d,.]+/gi],
  ];
  for (const [name, pattern] of patterns) {
    if (pattern.test(serialized)) findings.push(name);
  }
  for (const secret of secrets) {
    if (secret.length >= 4 && serialized.includes(secret)) findings.push(`source secret fingerprint: ${secret.slice(0, 2)}…`);
  }
  return [...new Set(findings)];
}

export function parseTrip(markdown) {
  const { data, body } = parseFrontmatter(markdown);
  const sections = splitSections(body, 2);
  const references = parseReferences(sections.get('References'));
  const secrets = new Set();
  const entityIds = new Map();

  for (const [sectionName] of PUBLIC_SECTIONS) {
    for (const { title } of splitSubsections(sections.get(sectionName) ?? '')) {
      entityIds.set(title, `${PUBLIC_SECTIONS.get(sectionName)}-${slugify(title)}`);
    }
  }

  const entities = [];
  for (const [sectionName, type] of PUBLIC_SECTIONS) {
    for (const { title, content } of splitSubsections(sections.get(sectionName) ?? '')) {
      entities.push(parseEntity(title, content, type, entityIds, references, secrets));
    }
  }

  const itinerary = parseItinerary(sections.get('Itinerary'), entityIds);
  const title = data.trip_title ?? body.match(/^# (.+)$/m)?.[1] ?? '旅行手帖';
  const start = String(data.trip_start ?? itinerary[0]?.date ?? '');
  const end = String(data.trip_end ?? itinerary.at(-1)?.date ?? '');
  const publishThrough = String(data.publish_through ?? start);
  const trip = {
    schemaVersion: 1,
    slug: data.trip_slug ?? slugify(title),
    title,
    start,
    end,
    publishThrough,
    status: data.trip_status ?? 'active',
    noindex: data.noindex !== false,
    updatedAt: new Date().toISOString(),
    sourceHash: crypto.createHash('sha256').update(markdown).digest('hex').slice(0, 16),
    locations: parseLocations(sections.get('Overview')),
    days: parseDaily(sections.get('Daily Plan'), itinerary, publishThrough, entityIds, references),
    entities,
  };

  const findings = scanPublicPayload(trip, secrets);
  if (findings.length) {
    throw new Error(`Public payload rejected:\n- ${findings.join('\n- ')}`);
  }
  return { trip, secrets: [...secrets] };
}
