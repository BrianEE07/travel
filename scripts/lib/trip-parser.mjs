import crypto from 'node:crypto';
import YAML from 'yaml';

const PUBLIC_SECTION_NAMES = [
  'Overview',
  'Itinerary',
  'Daily Plan',
  'Accommodation',
  'Food',
  'Places',
  'Transportation',
  'References',
];

const ENTITY_SECTIONS = new Map([
  ['Accommodation', 'stay'],
  ['Food', 'food'],
  ['Places', 'place'],
  ['Transportation', 'transport'],
]);

const ENTITY_FIELDS = {
  stay: {
    allowed: ['Area', 'Summary', 'Map', 'Official', 'CheckIn', 'CheckOut', 'Room', 'Access', 'Contact', 'Policy'],
    required: ['Area', 'Summary', 'Map', 'CheckIn', 'CheckOut', 'Room', 'Access', 'Contact', 'Policy'],
    properties: { Area: 'area', Summary: 'summary', CheckIn: 'checkIn', CheckOut: 'checkOut', Room: 'room', Access: 'access', Contact: 'contact', Policy: 'policy' },
  },
  food: {
    allowed: ['Area', 'Summary', 'Map', 'Official', 'Hours', 'Reservation', 'ReservationTime', 'Party', 'Why', 'Risk', 'Backup'],
    required: ['Area', 'Summary', 'Map', 'Hours', 'Reservation', 'ReservationTime', 'Party', 'Why', 'Risk', 'Backup'],
    properties: { Area: 'area', Summary: 'summary', Hours: 'hours', Reservation: 'reservation', ReservationTime: 'reservationTime', Party: 'party', Why: 'why', Risk: 'risk', Backup: 'backup' },
  },
  place: {
    allowed: ['Area', 'Summary', 'Map', 'Official', 'Hours', 'Why', 'BestFor', 'Nearby', 'Risk'],
    required: ['Area', 'Summary', 'Map', 'Hours', 'Why', 'BestFor', 'Nearby', 'Risk'],
    properties: { Area: 'area', Summary: 'summary', Hours: 'hours', Why: 'why', BestFor: 'bestFor', Nearby: 'nearby', Risk: 'risk' },
  },
  transport: {
    allowed: ['Area', 'Summary', 'Official', 'Operator', 'Route', 'Duration', 'Decision', 'Buffer'],
    required: ['Area', 'Summary', 'Operator', 'Route', 'Duration', 'Decision', 'Buffer'],
    properties: { Area: 'area', Summary: 'summary', Operator: 'operator', Route: 'route', Duration: 'duration', Decision: 'decision', Buffer: 'buffer' },
  },
};

const FRONTMATTER_REQUIRED = [
  'travel_schema', 'trip_slug', 'trip_title', 'trip_kicker', 'trip_summary', 'trip_intro',
  'trip_code', 'trip_cover', 'trip_cover_alt', 'trip_start', 'trip_end', 'trip_status', 'noindex',
];
const TRIP_STATUSES = new Set(['draft', 'active', 'archived']);
const TIMELINE_TAGS = new Set(['move', 'food', 'place', 'shopping', 'activity', 'rest', 'buffer']);
const RESERVATION_VALUES = new Set(['done', 'none', 'needed', 'tbd']);
const MANAGEMENT_PARAM = /[?&](?:auth(?:_key)?|token|code|bok|booking|reservation|login|transaction)(?:=|%3D)/i;
const SENSITIVE_LABEL = /(?:訂房編號|訂位編號|預訂編號|認證碼|認證編號|Login ID|交易編號|票號)/i;
const PRIVATE_VALUE_LABEL = /(?:訂房人|訂位人|預訂人|旅客姓名|乘客姓名|姓名|訂房編號|訂位編號|預訂編號|認證碼|認證編號|Login ID|交易編號|票號|付款|支付|總額|金額|價格|費用|確認|取消|管理|登入|auth)/i;
const PRIVATE_FIELD_LABEL = /^(?:訂房人|訂位人|預訂人|旅客姓名|乘客姓名|姓名|訂房編號|訂位編號|預訂編號|認證碼|認證編號|Login ID|交易編號|票號|付款|支付|總額|金額|價格|費用|確認|取消|管理|登入|auth|電話|日期|入住日期|退房日期|時間|人數|內容|備註|航班|座位|平台)$/i;
const LOCAL_IMAGE_PATH = /^\/[\w\-/.]+\.(?:png|jpe?g|webp|avif)$/i;

function isSafeLocalImagePath(value) {
  return LOCAL_IMAGE_PATH.test(value) && value.split('/').every((segment) => segment !== '.' && segment !== '..');
}

export function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) return { data: {}, body: markdown };
  const end = markdown.indexOf('\n---\n', 4);
  if (end < 0) return { data: {}, body: markdown };
  return {
    data: YAML.parse(markdown.slice(4, end)) ?? {},
    body: markdown.slice(end + 5),
  };
}

function sectionList(body, level) {
  const marker = '#'.repeat(level);
  const matches = [...body.matchAll(new RegExp(`^${marker} (.+)$`, 'gm'))];
  return matches.map((match, index) => ({
    title: match[1].trim(),
    content: body.slice(match.index + match[0].length, matches[index + 1]?.index ?? body.length).trim(),
  }));
}

function sectionMap(items, context, errors) {
  const result = new Map();
  for (const item of items) {
    if (result.has(item.title)) errors.push(`${context} 有重複標題：${item.title}`);
    else result.set(item.title, item.content);
  }
  return result;
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

function stripLinks(value = '') {
  return value
    .replace(/\[([^\]]+)\]\(<#.*?>\)/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]+\]/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim();
}

function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeFragment(target) {
  const raw = target.replace(/^<#/, '').replace(/>$/, '');
  try { return decodeURIComponent(raw); } catch { return raw; }
}

function isSafePublicUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !MANAGEMENT_PARAM.test(url.href);
  } catch {
    return false;
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
      const date = title.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
      if (entityId) html += `<button class="inline-detail" type="button" data-entity="${escapeHtml(entityId)}">${escapeHtml(label)}</button>`;
      else if (date) html += `<a href="#day-${date}">${escapeHtml(label)}</a>`;
      else html += escapeHtml(label);
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

function richText(value, entityIds, references) {
  return { text: stripLinks(value), html: inlineHtml(value, entityIds, references) };
}

function isBackToTop(line) {
  return /^\[Back to top\]\(<#[^)]+>\)$/.test(line.trim());
}

function rememberPrivateLine(raw, secrets) {
  const line = raw.replace(/^[-*]\s*/, '').trim();
  const separator = line.indexOf('：');
  const label = separator >= 0 ? line.slice(0, separator).trim() : '';
  const rawValue = separator >= 0 ? line.slice(separator + 1).trim() : line;
  const value = stripLinks(rawValue).trim();

  if (PRIVATE_VALUE_LABEL.test(label) && value.length >= 4) secrets.add(value);
  if (!PRIVATE_FIELD_LABEL.test(label) && (/^[A-Za-z]+(?:\s+[A-Za-z]+){1,3}$/.test(label) || /^\p{Script=Han}{2,4}$/u.test(label))) {
    secrets.add(label);
  }
  for (const match of raw.matchAll(/https?:\/\/[^\s)>]+/gi)) {
    if (MANAGEMENT_PARAM.test(match[0])) secrets.add(match[0]);
  }
  for (const match of rawValue.matchAll(/\b(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{5,}\b/gi)) {
    secrets.add(match[0]);
  }
  for (const match of rawValue.matchAll(/\b\d{3}[ -]?\d{10}\b/g)) secrets.add(match[0]);
  for (const match of rawValue.matchAll(/\b(?:JPY|TWD|NTD|USD|EUR)\s*[\d,.]+/gi)) secrets.add(match[0]);
}

function parseReferences(section, errors) {
  const references = new Map();
  const seen = new Set();
  for (const rawLine of section.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^\[([^\]]+)\]:\s*(\S+)$/);
    if (!match) {
      errors.push(`References 含無法辨識的內容：${line}`);
      continue;
    }
    const [, key, url] = match;
    if (seen.has(key)) errors.push(`References 有重複 key：${key}`);
    seen.add(key);
    if (!isSafePublicUrl(url)) errors.push(`References 的網址不安全或不是 HTTPS：${key}`);
    references.set(key, url);
  }
  return references;
}

function collectHeadings(body, publicSections) {
  const headings = new Set(sectionList(body, 1).map((item) => item.title));
  for (const name of PUBLIC_SECTION_NAMES) {
    headings.add(name);
    for (const item of sectionList(publicSections.get(name) ?? '', 3)) headings.add(item.title);
  }
  return headings;
}

function validatePublicLinks(publicSections, headings, references, entitySectionsByTitle, errors) {
  for (const sectionName of PUBLIC_SECTION_NAMES.filter((name) => name !== 'References')) {
    const rawContent = publicSections.get(sectionName) ?? '';
    const content = ENTITY_SECTIONS.has(sectionName)
      ? sectionList(rawContent, 3).map((item) => item.content.split(/^Private：$/m)[0]).join('\n')
      : rawContent;
    for (const match of content.matchAll(/\[[^\]]+\]\((<#[^)]+>)\)/g)) {
      const target = normalizeFragment(match[1]);
      if (!headings.has(target)) errors.push(`${sectionName} 的內部連結找不到標題：${target}`);
    }
    for (const match of content.matchAll(/\[[^\]]+\]\[([^\]]+)\]/g)) {
      if (!references.has(match[1])) errors.push(`${sectionName} 使用未定義的 reference：${match[1]}`);
    }
  }

  const overview = publicSections.get('Overview') ?? '';
  const transportBlock = overview.match(/^Transport：\s*\n([\s\S]*?)(?=^Stay：)/m)?.[1] ?? '';
  const stayBlock = overview.match(/^Stay：\s*\n([\s\S]*?)(?=^- Status：)/m)?.[1] ?? '';
  for (const match of transportBlock.matchAll(/\(<#([^)]+)>\)/g)) {
    if (entitySectionsByTitle.get(match[1]) !== 'transport') errors.push(`Overview Transport 必須連到 Transportation：${match[1]}`);
  }
  for (const match of stayBlock.matchAll(/\(<#([^)]+)>\)/g)) {
    if (entitySectionsByTitle.get(match[1]) !== 'stay') errors.push(`Overview Stay 必須連到 Accommodation：${match[1]}`);
  }
}

function parseEntity(title, content, type, entityIds, references, secrets, errors) {
  const config = ENTITY_FIELDS[type];
  const contentLines = content.split('\n');
  const privateMarkers = contentLines.map((line, index) => line.trim() === 'Private：' ? index : -1).filter((index) => index >= 0);
  if (privateMarkers.length > 1) errors.push(`${title} 只能有一個 Private block`);
  const privateMarker = privateMarkers[0] ?? -1;
  const publicContent = privateMarker >= 0 ? contentLines.slice(0, privateMarker).join('\n') : content;
  const privateContent = privateMarker >= 0 ? contentLines.slice(privateMarker + 1) : [];
  let privateNavigationSeen = false;
  for (const line of privateContent) {
    if (!line.trim()) continue;
    if (isBackToTop(line)) {
      if (privateNavigationSeen) errors.push(`${title} 的 Back to top 不可重複`);
      privateNavigationSeen = true;
      continue;
    }
    if (privateNavigationSeen || !line.trim().startsWith('- ')) {
      errors.push(`${title} 的 Private 內容必須使用 bullet，且 Private 後只允許最後一個 Back to top`);
      continue;
    }
    rememberPrivateLine(line, secrets);
  }

  const fields = new Map();
  let publicNavigationSeen = false;
  for (const rawLine of publicContent.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (isBackToTop(line)) {
      if (publicNavigationSeen) errors.push(`${title} 的 Back to top 不可重複`);
      if (privateMarker >= 0) errors.push(`${title} 的 Back to top 必須放在 Private block 之後`);
      publicNavigationSeen = true;
      continue;
    }
    if (publicNavigationSeen) {
      errors.push(`${title} 的 Back to top 必須是最後一行`);
      continue;
    }
    const match = line.match(/^- ([A-Za-z]+)：\s*(.+)$/);
    if (!match) {
      errors.push(`${title} 含無法辨識的公開內容：${line}`);
      continue;
    }
    const [, label, value] = match;
    if (!config.allowed.includes(label)) errors.push(`${title} 使用未知欄位：${label}`);
    if (fields.has(label)) errors.push(`${title} 有重複欄位：${label}`);
    fields.set(label, value.trim());
  }
  for (const field of config.required) {
    if (!fields.get(field)) errors.push(`${title} 缺少必要欄位：${field}`);
  }
  if (type === 'food' && fields.has('Reservation') && !RESERVATION_VALUES.has(fields.get('Reservation'))) {
    errors.push(`${title} 的 Reservation 必須是 done / none / needed / tbd`);
  }

  const actions = [];
  const mapValue = fields.get('Map');
  if (mapValue) {
    const match = mapValue.match(/^\[([^\]]+)\]\[([^\]]+)\]$/);
    if (!match) errors.push(`${title} 的 Map 必須使用 reference link`);
    else {
      const url = references.get(match[2]);
      if (!url) errors.push(`${title} 的 Map reference 未定義：${match[2]}`);
      else actions.push({ label: match[1], url, kind: 'map' });
    }
  }
  const official = fields.get('Official');
  if (official) {
    if (!isSafePublicUrl(official)) errors.push(`${title} 的 Official 必須是安全的 HTTPS 網址`);
    else actions.push({ label: '官方網站', url: official, kind: 'official' });
  }

  const entity = { id: entityIds.get(title), title, type, actions };
  for (const [field, property] of Object.entries(config.properties)) {
    if (fields.has(field)) entity[property] = richText(fields.get(field), entityIds, references);
  }
  return entity;
}

function parseOverview(section, entityIds, references, frontmatter, errors) {
  const allowed = new Set(['Date', 'Places', 'People', 'Transport', 'Stay', 'Status']);
  const scalarFields = new Set(['Date', 'Places', 'People', 'Status']);
  const blockFields = new Set(['Transport', 'Stay']);
  const fields = new Map();
  let current = '';
  for (const rawLine of section.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const scalar = line.match(/^- ([A-Za-z]+)：\s*(.+)$/);
    const block = line.match(/^([A-Za-z]+)：\s*$/);
    if (scalar) {
      current = scalar[1];
      if (!allowed.has(current)) errors.push(`Overview 使用未知欄位：${current}`);
      if (!scalarFields.has(current)) errors.push(`Overview 的 ${current} 必須是 block heading`);
      if (fields.has(current)) errors.push(`Overview 有重複欄位：${current}`);
      fields.set(current, [scalar[2]]);
    } else if (block) {
      current = block[1];
      if (!allowed.has(current)) errors.push(`Overview 使用未知欄位：${current}`);
      if (!blockFields.has(current)) errors.push(`Overview 的 ${current} 必須使用 list field`);
      if (fields.has(current)) errors.push(`Overview 有重複欄位：${current}`);
      fields.set(current, []);
    } else if (line.startsWith('- ') && blockFields.has(current)) {
      fields.get(current).push(line.slice(2));
    } else {
      errors.push(`Overview 含無法辨識的內容：${line}`);
    }
  }
  for (const field of allowed) if (!fields.has(field) || fields.get(field).length === 0) errors.push(`Overview 缺少必要欄位：${field}`);

  const displayDate = fields.get('Date')?.[0] ?? '';
  const dates = [...displayDate.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((match) => match[0]);
  if (dates.length !== 2 || dates[0] !== String(frontmatter.trip_start) || dates[1] !== String(frontmatter.trip_end)) {
    errors.push('Overview Date 必須與 trip_start / trip_end 完全一致');
  }
  const placesText = fields.get('Places')?.[0] ?? '';
  return {
    date: displayDate,
    places: placesText.split(/[、,]/).map((item) => item.trim()).filter(Boolean),
    people: fields.get('People')?.[0] ?? '',
    transports: (fields.get('Transport') ?? []).map((value) => richText(value, entityIds, references)),
    stays: (fields.get('Stay') ?? []).map((value) => richText(value, entityIds, references)),
    status: fields.get('Status')?.[0] ?? '',
  };
}

function parseItinerary(section, entityIds, entityTypes, errors) {
  const rows = [];
  let headerSeen = false;
  for (const rawLine of section.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!line.startsWith('|')) {
      errors.push(`Itinerary 含表格以外的公開內容：${line}`);
      continue;
    }
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (!headerSeen) {
      headerSeen = true;
      if (cells.join('|') !== 'Date|Area|Stay|Notes') errors.push('Itinerary 表頭必須是 Date / Area / Stay / Notes');
      continue;
    }
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')))) continue;
    if (cells.length !== 4) {
      errors.push(`Itinerary 每列必須有四欄：${line}`);
      continue;
    }
    const date = cells[0].match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (!date) {
      errors.push(`Itinerary 日期無法辨識：${cells[0]}`);
      continue;
    }
    const stayTarget = cells[2].match(/\[[^\]]+\]\(<#([^)]+)>\)/)?.[1] ?? '';
    if (stayTarget && entityTypes.get(stayTarget) !== 'stay') errors.push(`Itinerary Stay 必須連到 Accommodation：${stayTarget}`);
    rows.push({
      date,
      area: stripLinks(cells[1]),
      stay: stripLinks(cells[2]),
      stayTarget,
      stayEntityId: stayTarget ? entityIds.get(stayTarget) ?? '' : '',
      notes: stripLinks(cells[3]),
    });
  }
  return rows;
}

function weekdayFor(date) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${date}T12:00:00Z`).getUTCDay()];
}

function parseDays(section, itinerary, entityIds, references, errors) {
  const itineraryByDate = new Map(itinerary.map((row) => [row.date, row]));
  return sectionList(section, 3).map(({ title, content }) => {
    const titleMatch = title.match(/^(\d{4}-\d{2}-\d{2})\s+(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/);
    if (!titleMatch) errors.push(`Daily Plan 標題格式錯誤：${title}`);
    const date = titleMatch?.[1] ?? title.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
    if (date && titleMatch?.[2] !== weekdayFor(date)) errors.push(`Daily Plan 星期錯誤：${title}`);
    const itineraryRow = itineraryByDate.get(date) ?? { area: '', stay: '', stayTarget: '', stayEntityId: '', notes: '' };
    const lines = content.split('\n');
    const meaningful = lines.map((line) => line.trim()).filter(Boolean);
    const publishMatch = meaningful[0]?.match(/^Publish：(full|summary)$/);
    if (!publishMatch) errors.push(`${title} 第一個欄位必須是 Publish：full 或 Publish：summary`);
    const publish = publishMatch?.[1] ?? 'summary';
    const timeline = [];
    const notes = [];
    let summary = '';
    let dailyStay = '';
    let dailyStayTarget = '';
    let mode = 'timeline';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || /^\[Back to top\]/.test(line) || /^Publish：/.test(line)) continue;
      const field = line.match(/^(Summary|Stay|Notes)：\s*(.*)$/);
      if (field) {
        const [, name, value] = field;
        if (name === 'Summary') summary = stripLinks(value);
        if (name === 'Stay') {
          dailyStay = stripLinks(value);
          dailyStayTarget = value.match(/\[[^\]]+\]\(<#([^)]+)>\)/)?.[1] ?? '';
        }
        if (name === 'Notes') mode = 'notes';
        else mode = 'fields';
        continue;
      }
      if (line.startsWith('- ') && mode === 'notes') {
        const value = line.slice(2).trim();
        notes.push(richText(value, entityIds, references));
        continue;
      }
      if (line.startsWith('- ') && mode === 'timeline') {
        const value = line.slice(2).trim();
        const timeMatch = value.match(/^(\d{2}:\d{2}(?:[-–]\d{2}:\d{2})?)\s+(.+)$/);
        if (!timeMatch) {
          errors.push(`${title} 的時間軸時間必須放在連結外：${value}`);
          continue;
        }
        const tags = [...value.matchAll(/#travel\/([a-z]+)/g)].map((match) => match[1]);
        if (tags.length !== 1) errors.push(`${title} 的 full 時間軸每項必須恰好有一個 travel tag：${value}`);
        const kind = tags[0] ?? '';
        if (kind && !TIMELINE_TAGS.has(kind)) errors.push(`${title} 使用未知 timeline tag：#travel/${kind}`);
        const visible = timeMatch[2].replace(/\s*#travel\/[a-z]+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
        timeline.push({ time: timeMatch[1].replace('–', '-'), kind, text: stripLinks(visible), textHtml: inlineHtml(visible, entityIds, references) });
        continue;
      }
      errors.push(`${title} 含無法辨識的公開內容：${line}`);
    }

    if (publish === 'full' && timeline.length === 0) errors.push(`${title} 設為 full 但沒有時間軸`);
    if (publish === 'summary' && !summary) errors.push(`${title} 設為 summary 時必須有 Summary`);
    if (publish === 'summary' && timeline.length) errors.push(`${title} 設為 summary 時不可放完整時間軸`);
    if (!dailyStay) errors.push(`${title} 缺少 Stay`);
    if (dailyStay && dailyStay !== itineraryRow.stay) errors.push(`${title} 的 Stay 與 Itinerary 不一致`);
    if (dailyStayTarget !== itineraryRow.stayTarget) errors.push(`${title} 的 Stay 連結與 Itinerary 不一致`);

    return {
      date,
      weekday: titleMatch?.[2] ?? '',
      area: itineraryRow.area,
      stay: itineraryRow.stay,
      stayEntityId: itineraryRow.stayEntityId,
      itineraryNote: itineraryRow.notes,
      publish,
      summary,
      detailed: publish === 'full',
      timeline: publish === 'full' ? timeline : [],
      notes,
    };
  });
}

function inclusiveDates(start, end, errors) {
  const dates = [];
  const first = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime()) || first > last) {
    errors.push('trip_start / trip_end 必須是有效且由早到晚的日期');
    return dates;
  }
  for (let date = first; date <= last; date = new Date(date.getTime() + 86_400_000)) dates.push(date.toISOString().slice(0, 10));
  return dates;
}

function validateDateSets(expected, itinerary, days, errors) {
  const check = (label, values) => {
    if (new Set(values).size !== values.length) errors.push(`${label} 含重複日期`);
    if (values.join('|') !== expected.join('|')) errors.push(`${label} 日期必須完整且依序等於 trip_start ～ trip_end`);
  };
  check('Itinerary', itinerary.map((row) => row.date));
  check('Daily Plan', days.map((day) => day.date));
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
  for (const [name, pattern] of patterns) if (pattern.test(serialized)) findings.push(name);
  for (const secret of secrets) if (secret.length >= 4 && serialized.includes(secret)) findings.push(`source secret fingerprint: ${secret.slice(0, 2)}…`);
  return [...new Set(findings)];
}

export function parseTrip(markdown) {
  const errors = [];
  const secrets = new Set();
  const { data, body } = parseFrontmatter(markdown);
  for (const key of FRONTMATTER_REQUIRED) if (data[key] === undefined || data[key] === '') errors.push(`frontmatter 缺少：${key}`);
  if (Number(data.travel_schema) !== 2) errors.push('travel_schema 必須是 2');
  if ('publish_through' in data) errors.push('schema 2 不可使用 publish_through');
  if (!TRIP_STATUSES.has(String(data.trip_status))) errors.push('trip_status 必須是 draft / active / archived');

  const sectionItems = sectionList(body, 2);
  const sections = sectionMap(sectionItems, '二級 section', errors);
  for (const name of PUBLIC_SECTION_NAMES) if (!sections.has(name)) errors.push(`缺少必要 public section：${name}`);

  const references = parseReferences(sections.get('References') ?? '', errors);
  const entityIds = new Map();
  const entityTypes = new Map();
  const entitySubsections = new Map();
  for (const [sectionName, type] of ENTITY_SECTIONS) {
    const items = sectionList(sections.get(sectionName) ?? '', 3);
    entitySubsections.set(sectionName, items);
    for (const { title } of items) {
      if (entityIds.has(title)) errors.push(`Entity 標題必須全站唯一：${title}`);
      entityIds.set(title, `${type}-${slugify(title)}`);
      entityTypes.set(title, type);
    }
  }

  const headings = collectHeadings(body, sections);
  validatePublicLinks(sections, headings, references, entityTypes, errors);

  const entities = [];
  for (const [sectionName, type] of ENTITY_SECTIONS) {
    for (const { title, content } of entitySubsections.get(sectionName)) {
      entities.push(parseEntity(title, content, type, entityIds, references, secrets, errors));
    }
  }

  for (const line of markdown.split('\n')) {
    const label = line.replace(/^[-*]\s*/, '').split('：', 1)[0];
    if (PRIVATE_VALUE_LABEL.test(label) || SENSITIVE_LABEL.test(line) || MANAGEMENT_PARAM.test(line)) {
      rememberPrivateLine(line, secrets);
    }
  }
  const overview = parseOverview(sections.get('Overview') ?? '', entityIds, references, data, errors);
  const itinerary = parseItinerary(sections.get('Itinerary') ?? '', entityIds, entityTypes, errors);
  const days = parseDays(sections.get('Daily Plan') ?? '', itinerary, entityIds, references, errors);
  const start = String(data.trip_start ?? '');
  const end = String(data.trip_end ?? '');
  validateDateSets(inclusiveDates(start, end, errors), itinerary, days, errors);

  const title = String(data.trip_title ?? body.match(/^# (.+)$/m)?.[1] ?? '旅行手帖');
  const briefingImageValue = String(data.trip_briefing_image ?? '');
  if (briefingImageValue && !isSafeLocalImagePath(briefingImageValue)) {
    errors.push('trip_briefing_image 必須是 public 目錄內的安全本機圖片路徑');
  }
  const trip = {
    schemaVersion: 2,
    slug: String(data.trip_slug ?? slugify(title)),
    title,
    kicker: String(data.trip_kicker ?? ''),
    summary: String(data.trip_summary ?? ''),
    intro: String(data.trip_intro ?? ''),
    code: String(data.trip_code ?? '').toUpperCase().slice(0, 6),
    coverImage: /^\/[\w\-/.]+\.(?:png|jpe?g|webp|avif)$/i.test(String(data.trip_cover ?? '')) ? String(data.trip_cover) : '/icons/icon-512.png',
    coverAlt: String(data.trip_cover_alt ?? ''),
    briefingImage: briefingImageValue && isSafeLocalImagePath(briefingImageValue) ? briefingImageValue : '/home-travel-map.jpg',
    start,
    end,
    status: String(data.trip_status ?? ''),
    noindex: data.noindex !== false,
    updatedAt: new Date().toISOString(),
    sourceHash: crypto.createHash('sha256').update(markdown).digest('hex').slice(0, 16),
    locations: overview.places,
    overview,
    days,
    entities,
  };

  const findings = scanPublicPayload(trip, secrets);
  for (const finding of findings) errors.push(`公開資料安全檢查：${finding}`);
  if (errors.length) throw new Error(`Travel schema 2 validation failed:\n- ${[...new Set(errors)].join('\n- ')}`);
  return { trip, secrets: [...secrets] };
}
