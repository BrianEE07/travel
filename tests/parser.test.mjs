import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTrip, scanPublicPayload } from '../scripts/lib/trip-parser.mjs';

const fixture = `---
trip_slug: test-trip
trip_title: 測試之旅
trip_kicker: Early autumn · Test
trip_summary: 兩天的測試旅行。
trip_intro: 測試旅行公開內容。
trip_code: TST
trip_cover: /test-cover.png
trip_cover_alt: 測試旅行封面
trip_start: 2026-08-27
trip_end: 2026-08-28
publish_through: 2026-08-27
trip_status: active
noindex: true
---
# 測試之旅

## Overview
- 地點：福岡、太宰府

## Itinerary
| Date | Area | Stay | Notes |
| --- | --- | --- | --- |
| [2026-08-27 Thu](<#2026-08-27 Thu>) | 博多 | [紙屋](<#紙屋｜8/27>) | [BR102](<#測試航班>) |
| [2026-08-28 Fri](<#2026-08-28 Fri>) | 太宰府 | 紙屋 | 規劃中 |

## Daily Plan
### 2026-08-27 Thu
- 09:00 [測試咖啡](<#測試咖啡｜8/27>)
Stay：[紙屋](<#紙屋｜8/27>)
Notes：
- 記得提早出門

### 2026-08-28 Fri
- 10:00 零碎項目
Stay：紙屋

## Accommodation
### 紙屋｜8/27
Map：[Google Maps][stay]
- 訂房人：Private Person
- 訂房編號：AB12345678
- 認證碼：SECRET9988
- 支付：JPY 12,345
- 地址：福岡市公開地址
- 確認 / 取消：https://example.com/manage?token=never-public

## Restaurant Reservations

## Place Notes
### 測試咖啡｜8/27
Map：[Google Maps][cafe]
- 重點：安靜的早晨咖啡店。
- 官網：https://example.com/cafe

## Transportation
### 測試航班
- 去程：2026-08-27 BR102 15:10-18:20 TPE → FUK
訂位：
- Private Person：BOOK99，票號 695 1234567890，總額 TWD 20,000
費用：
- 合計：TWD 20,000
行李：
- 去程託運：1PC

## Booking & Tasks
- [ ] 不應公開

## Candidates
- 不應公開的候選

## References
[stay]: https://www.google.com/maps/search/?api=1&query=hotel
[cafe]: https://www.google.com/maps/search/?api=1&query=cafe
`;

test('parses a single Obsidian trip into public entities and day states', () => {
  const { trip } = parseTrip(fixture);
  assert.equal(trip.slug, 'test-trip');
  assert.equal(trip.code, 'TST');
  assert.equal(trip.coverImage, '/test-cover.png');
  assert.match(trip.summary, /兩天/);
  assert.equal(trip.days.length, 2);
  assert.equal(trip.days[0].detailed, true);
  assert.equal(trip.days[0].timeline.length, 1);
  assert.match(trip.days[0].timeline[0].textHtml, /data-entity="place-/);
  assert.match(trip.days[0].stayEntityId, /^stay-/);
  assert.equal(trip.days[1].detailed, false);
  assert.deepEqual(trip.days[1].timeline, []);
  assert.ok(trip.entities.some((entity) => entity.type === 'stay'));
  assert.ok(trip.entities.some((entity) => entity.type === 'transport'));
});

test('removes booking credentials, management links, names and prices', () => {
  const { trip } = parseTrip(fixture);
  const output = JSON.stringify(trip);
  for (const forbidden of ['Private Person', 'AB12345678', 'SECRET9988', 'never-public', '1234567890', '12,345', '20,000', 'Booking & Tasks', 'Candidates']) {
    assert.equal(output.includes(forbidden), false, forbidden);
  }
  assert.match(output, /福岡市公開地址/);
  assert.match(output, /BR102/);
  assert.match(output, /去程託運/);
});

test('fails a public scan when a secret-shaped value is reintroduced', () => {
  const findings = scanPublicPayload('訂房編號：AB12345678 https://x.test/?auth_key=oops JPY 9,999');
  assert.ok(findings.includes('sensitive field label'));
  assert.ok(findings.includes('management URL parameter'));
  assert.ok(findings.includes('visible price'));
});
