import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTrip, scanPublicPayload } from '../scripts/lib/trip-parser.mjs';

const fixture = `---
travel_schema: 2
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
trip_status: active
noindex: true
---
# 測試之旅

## Overview

Date：2026-08-27 Thu ～ 2026-08-28 Fri
Places：福岡、太宰府
People：2 人同行

Transport：
- [BR102 TPE → FUK](<#測試航班>)

Stay：
- 2026-08-27 ～ 2026-08-28：[紙屋](<#紙屋｜8/27>)

Status：第一天完整，第二天摘要。

## Itinerary

| Date | Area | Stay | Notes |
| --- | --- | --- | --- |
| [2026-08-27 Thu](<#2026-08-27 Thu>) | 博多 | [紙屋](<#紙屋｜8/27>) | [BR102](<#測試航班>) |
| [2026-08-28 Fri](<#2026-08-28 Fri>) | 太宰府 | 紙屋 | 規劃中 |

## Daily Plan

### 2026-08-27 Thu

Publish：full

- 09:00 [測試咖啡](<#測試咖啡｜8/27>) #travel/food

Stay：[紙屋](<#紙屋｜8/27>)

Notes：
- 記得提早出門

### 2026-08-28 Fri

Publish：summary
Summary：前往太宰府散步。
Stay：紙屋
Notes：
- 保持彈性

## Accommodation

### 紙屋｜8/27

Area：博多
Summary：安靜的小旅店。
Map：[Google Maps][stay]
CheckIn：2026-08-27 15:00
CheckOut：2026-08-28 11:00
Room：雙人房
Access：車站步行 3 分鐘
Contact：+81-92-000-0000
Policy：前一天可取消

Private：
- 訂房人：Private Person
- 訂房編號：AB12345678
- 認證碼：SECRET9988
- 支付：JPY 12,345
- 確認 / 取消：https://example.com/manage?token=never-public

## Food

## Places

### 測試咖啡｜8/27

Area：博多
Summary：安靜的早晨咖啡店。
Map：[Google Maps][cafe]
Hours：08:00-18:00
Why：早餐
BestFor：咖啡
Nearby：紙屋
Risk：可能客滿

## Transportation

### 測試航班

Area：TPE / FUK
Summary：測試去程航班。
Operator：EVA Air
Route：2026-08-27 BR102 TPE → FUK
Duration：2 小時
Decision：託運 1PC
Buffer：提早 3 小時抵達

Private：
- Fan Yung Wei：BOOK99，票號 695 1234567890，總額 TWD 20,000

## References

[stay]: https://www.google.com/maps/search/?api=1&query=hotel
[cafe]: https://www.google.com/maps/search/?api=1&query=cafe

## Booking & Tasks
- [ ] 不應公開

## Candidates
- 不應公開的候選
`;

test('parses schema 2 into structured public trip data', () => {
  const { trip } = parseTrip(fixture);
  assert.equal(trip.schemaVersion, 2);
  assert.equal(trip.slug, 'test-trip');
  assert.deepEqual(trip.locations, ['福岡', '太宰府']);
  assert.equal(trip.overview.transports.length, 1);
  assert.equal(trip.days.length, 2);
  assert.equal(trip.days[0].publish, 'full');
  assert.equal(trip.days[0].timeline[0].kind, 'food');
  assert.match(trip.days[0].timeline[0].textHtml, /data-entity="place-/);
  assert.match(trip.days[0].stayEntityId, /^stay-/);
  assert.equal(trip.days[1].publish, 'summary');
  assert.equal(trip.days[1].summary, '前往太宰府散步。');
  const stay = trip.entities.find((entity) => entity.type === 'stay');
  assert.equal(stay.checkIn.text, '2026-08-27 15:00');
  assert.equal('details' in stay, false);
});

test('omits private blocks and all non-allowlist sections', () => {
  const { trip } = parseTrip(fixture);
  const output = JSON.stringify(trip);
  for (const forbidden of ['Private Person', 'AB12345678', 'SECRET9988', 'never-public', '1234567890', '12,345', '20,000', 'Booking & Tasks', 'Candidates']) {
    assert.equal(output.includes(forbidden), false, forbidden);
  }
  assert.match(output, /測試去程航班/);
});

test('rejects date drift between frontmatter, itinerary and daily plan', () => {
  assert.throws(() => parseTrip(fixture.replace('trip_end: 2026-08-28', 'trip_end: 2026-08-29')), /Overview Date|日期必須完整/);
});

test('rejects full timeline entries without a canonical tag', () => {
  assert.throws(() => parseTrip(fixture.replace(' #travel\/food', '')), /travel tag/);
});

test('rejects unknown entity fields and broken public links', () => {
  assert.throws(() => parseTrip(fixture.replace('Risk：可能客滿', 'Mood：安靜')), /未知欄位：Mood/);
  assert.throws(() => parseTrip(fixture.replace('<#測試咖啡｜8\/27>', '<#不存在的咖啡>')), /找不到標題/);
});

test('rejects private fingerprints reintroduced into public output', () => {
  assert.throws(() => parseTrip(fixture.replace('Summary：安靜的小旅店。', 'Summary：AB12345678')), /source secret fingerprint/);
});

test('fails a public scan when a secret-shaped value is reintroduced', () => {
  const findings = scanPublicPayload('訂房編號：AB12345678 https://x.test/?auth_key=oops JPY 9,999');
  assert.ok(findings.includes('sensitive field label'));
  assert.ok(findings.includes('management URL parameter'));
  assert.ok(findings.includes('visible price'));
});
