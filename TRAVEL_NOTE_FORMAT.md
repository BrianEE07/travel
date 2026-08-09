---
tags:
  - travel
  - vault_system
  - format
aliases:
  - Travel Note Format
  - Travel Schema 2
---
# Travel Note Format

Format version：`travel_schema: 2`

This vault copy is the source of truth. The website project may keep a mirrored `TRAVEL_NOTE_FORMAT.md` for parser and frontend development, but the Obsidian version is canonical.

## Goals

- Keep travel notes comfortable to write in Obsidian.
- Give the website parser a strict, predictable schema.
- Prevent private booking data from leaking into public output.
- Fail builds loudly when the note structure is ambiguous.

## Frontmatter

Required:

```yaml
---
travel_schema: 2
trip_slug: fukuoka-2026
trip_title: 福岡之旅
trip_kicker: Late summer · Kyushu
trip_summary: 八天，沿著九州的城市與山海慢慢走。
trip_intro: 從博多出發，穿過太宰府與由布院，再把最後幾天留給北九州、高千穗與糸島。
trip_code: FUK
trip_cover: /hero-fukuoka.png
trip_cover_alt: 福岡與北九州旅行意象拼貼
trip_briefing_image: /briefing-fukuoka.jpg
trip_start: 2026-08-27
trip_end: 2026-09-03
trip_status: active
noindex: true
---
```

Rules:

- `travel_schema` must be `2`.
- `trip_start` and `trip_end` must match the first and last dates in `Itinerary` and `Daily Plan`.
- Do not use `publish_through`; each day controls its own visibility with `Publish：full` or `Publish：summary`.
- `trip_briefing_image` is optional. It must be a safe local image path under the website `public` directory. When omitted, the website uses its shared travel-map fallback.

## Public Sections

Only these second-level headings are public:

- `Overview`
- `Itinerary`
- `Daily Plan`
- `Accommodation`
- `Food`
- `Places`
- `Transportation`
- `References`

All other second-level headings are private by default.

The four entity sections must always exist, even when empty:

- `Accommodation`
- `Food`
- `Places`
- `Transportation`

Build must fail if a required public section is renamed, missing, or duplicated.

## Overview

Overview is the human-readable trip summary that can be rendered on the website. Frontmatter remains the machine metadata and validation source. When a value appears in both places, the website should display Overview text but validate it against frontmatter or entity sections.

Use Overview for the trip facts a traveler wants to scan quickly: dates, places, participants, major transport, stays, and planning status.

```md
## Overview

- Date：2026-08-27 Thu ～ 2026-09-03 Thu
- Places：福岡、太宰府、由布院
- People：4 人同行；8/31 後 Wei 獨排行程

Transport：
- [2026-08-27 BR102 15:10-18:20 TPE → FUK](<#EVA Air｜來回機票>)
- [2026-09-03 BR101 19:20-20:45 FUK → TPE（Wei）](<#EVA Air｜來回機票>)

Stay：
- 2026-08-27 ～ 2026-09-01：[西鐵 CROOM](<#西鐵 CROOM 飯店 博多祇園 櫛田神社前｜8/27-8/31>)

- Status：8/27-8/30 已完整規劃；8/31-9/3 仍在摘要規劃。
```

Rules:

- `Date`, `Places`, `People`, and `Status` should be list items in the form `- Field：value` for readable Obsidian preview.
- `Date` is display text, but must match `trip_start` and `trip_end`.
- `Places` is display text for the public overview.
- `People` only lives in Overview.
- `Transport` should link to `Transportation` headings.
- `Stay` should link to `Accommodation` headings.
- `trip_summary` and `trip_intro` remain frontmatter hero/intro copy; do not duplicate them as Overview `Summary`.

## Itinerary

The table is the only source for each day's area, stay label, and summary note.

```md
| Date | Area | Stay | Notes |
| --- | --- | --- | --- |
| [2026-08-27 Thu](<#2026-08-27 Thu>) | 抵達福岡、博多 | [西鐵 CROOM](<#西鐵 CROOM 飯店 博多祇園 櫛田神社前｜8/27-8/31>) | [BR102](<#EVA Air｜來回機票>)；[大東園](<#大東園 本店｜8/27>) |
```

Rules:

- Every itinerary date must have a matching `Daily Plan` heading.
- Every public internal link must point to an existing heading.
- Stay values should link to `Accommodation` headings when possible.

## Daily Plan

Every day must start with a publish mode.

```md
### 2026-08-30 Sun

Publish：full

- 09:30 [FUK COFFEE](<#FUK COFFEE｜8/30>) #travel/food / 飯店附近慢慢開始
- 10:15 [櫛田神社](<#櫛田神社｜8/30>) #travel/place
- 13:00-13:20 [前往天神](<#8/30 博多 → 天神 → 鳥田>) #travel/move

Stay：[西鐵 CROOM](<#西鐵 CROOM 飯店 博多祇園 櫛田神社前｜8/27-8/31>)

Notes：
- 這天主軸是輕鬆逛街。
```

Rules:

- `Publish` must be `full` or `summary`.
- Full days must use timeline tags.
- Summary days may omit detailed timeline items.
- Time must be outside Markdown links.
- Parser must accept `-` and `–` between time ranges, but notes should prefer `-`.
- Parser must remove travel tags from visible text.

Allowed timeline tags:

- `#travel/move`
- `#travel/food`
- `#travel/place`
- `#travel/shopping`
- `#travel/activity`
- `#travel/rest`
- `#travel/buffer`

Build must fail when a full day timeline item has no tag or uses an unknown tag.

## Entity Common Fields

Entity type is determined by its section. Do not write `Type：`.

Every public entity should use these common fields when applicable:

```md
### Entity Title

- Area：博多 / 祇園
- Summary：One short public summary.
- Map：[Google Maps][map-key]
- Official：https://example.com/

[Back to top](<#Trip Title>)
```

Rules:

- Entity fields must be list items in the form `- Field：value`. Do not use bare `Field：value` lines in public entity sections, because Obsidian preview may merge bare consecutive lines into one paragraph.
- `Area`, `Summary`, and `Map` are required unless the entity is a route-only transportation entity.
- `Official` is optional.
- Entity titles must be globally unique.
- Unknown public fields must fail the build.
- Every entity should end with `[Back to top](<#Trip Title>)` for note navigation. The website parser should ignore this navigation link.
- Google Maps references should prefer a verified Google Maps share URL (`maps.app.goo.gl`) or a full place URL with a place id. If no verified share URL is available, use `https://www.google.com/maps?q=<exact place name + address>` instead of hand-building `/maps/place/<text>` URLs; hand-built place URLs can open as blank `maps/place//@...` pages.

## Accommodation

Allowed fields:

- Common fields: `Area`, `Tags`, `Summary`, `Map`, `Official`
- Type fields: `CheckIn`, `CheckOut`, `Room`, `Price`, `Access`, `Contact`, `Policy`
- Private block: `Private：`

Rules:

- Title format: `### Accommodation Name｜Date Range`, for example `### 西鐵 CROOM 飯店 博多祇園 櫛田神社前｜8/27-8/31`.
- Split separate reservations or stay ranges into separate accommodation entities, even when they are the same hotel.
- `Summary` should describe the stay's character or main reason to choose it. Do not use it for administrative notes such as continuation stay, expected arrival, booking owner, or booking platform.
- `CheckIn` and `CheckOut` should contain hotel rule times only. Put expected arrival in `Private：`.
- `Room` should be written in readable Chinese when possible.
- `Access` is required and must not be `未記錄`; include at least the nearest station, exit, bus stop, or walking time.
- `Price` may be public when it is useful reference information. Keep payment method, booking links, verification codes, and booking numbers private.

Example:

```md
### 西鐵 CROOM 飯店 博多祇園 櫛田神社前｜8/27-8/31

- Area：博多 / 祇園
- Summary：櫛田神社前站旁，半露天大浴場和社交空間讓市區住宿也能好好休息。
- Map：[Google Maps][stay-croom]
- Official：https://croom-hakatagion.nnr-h.com/
- CheckIn：15:00-26:00
- CheckOut：11:00
- Room：地台雙人房 × 2 間，4 人，無早餐
- Price：JPY 118,426（4 人 / 4 晚，已付）
- Access：地下鐵七隈線 `櫛田神社前駅` 出口步行 1 分鐘。
- Contact：+81-92-235-5050 / croom-gion@hotels.nnr.co.jp
- Policy：2 天前免費；前日 50%，當日 80%，未入住 100%。

Private：
- 預計抵達：2026-08-27 19:30
- 訂房編號：...

[Back to top](<#福岡之旅 20260827~0903>)
```

`Private：` must be the last data block in the entity. A final `[Back to top](<#Trip Title>)` navigation link is allowed after it.

## Food

Allowed fields:

- Common fields: `Area`, `Summary`, `Map`, `Official`
- Type fields: `Hours`, `Reservation`, `ReservationTime`, `Party`, `Why`, `Risk`, `Backup`
- Private block: `Private：`

Use explicit values for reservations:

- `Reservation：done`
- `Reservation：none`
- `Reservation：needed`
- `Reservation：tbd`

Food tags:

- `breakfast`: breakfast or morning food stop.
- `lunch`: lunch option.
- `dinner`: dinner option.
- `cafe`: coffee shop or cafe stop.
- `snack`: small bite, dessert, or non-meal food stop.
- `souvenir`: food souvenir or packaged food purchase.
- `backup`: backup option, not the main choice.

## Places

Allowed fields:

- Common fields: `Area`, `Tags`, `Summary`, `Map`, `Official`
- Type fields: `Hours`, `Why`, `BestFor`, `Nearby`, `Risk`
- Private block: `Private：`

Place tags:

- `shrine`: shrine, temple, or worship site.
- `museum`: museum, exhibition, or cultural facility.
- `cafe`: cafe with place, architecture, or route value.
- `shopping`: shopping area, mall, department store, electronics store, or souvenir shopping area.
- `nature`: outdoor natural place such as coast, mountain, lake, gorge, or forest.
- `view`: lookout, night view, sunset, or scenic viewpoint.
- `station`: station-centered place or station operation.
- `service`: practical travel service rather than sightseeing.
- `backup`: backup place, not the main choice.

## Transportation

Allowed fields:

- Common fields: `Summary`
- Segment table columns: `Segment`, `Area`, `Time`, `Route`, `Plan`, `Note`, `Operator`, `Price`, `Official`
- Private block: `Private：`

Map is optional for transportation.

Rules:

- Title format: `### Transport Name｜Date` or `### Transport Name｜Date Range`.
- Keep a round-trip transportation entity together when both legs share the same booking, ticket pickup, baggage rules, or operational notes. Split into outbound / inbound entities only when the ticket, decision, risk, or user action is materially different.
- `Summary` is a card-level field.
- All route-specific public data must live in a Markdown table immediately after `Summary`.
- The table header must be exactly: `| Segment | Area | Time | Route | Plan | Note | Operator | Price | Official |`.
- Each row is one segment / leg. Do not use `；` to encode multiple segments inside a single table cell.
- `Segment` should be a short human-readable label such as `去程`, `回程`, `主線`, or `9/3 BR101`.
- `Area` is segment-level and should describe the relevant origin / destination area for that row.
- `Time` is for confirmed schedules, planned movement windows, and identifying service names such as flight numbers or train names.
- `Route` is path only. Keep alternatives, backup routes, candidate times, last departures, meetup details, and operational warnings in `Note`, not in `Route`.
- `Plan` is the main on-site action in one short instruction. It should answer "what should I do now?" without analysis.
- `Operator` is the operator for that row's main plan only. Put backup operators or optional alternatives in `Note`, not in `Operator`.
- `Price`, `Operator`, and `Official` are segment-level too. Leave the table cell empty when not applicable.
- Put confirmed or useful prices in `Price` using currency prefixes, for example `JPY 47,040（4 人來回，已付）` or `TWD 1,433（1 人，已付）`.
- Keep booking references, ticket numbers, voucher numbers, verification codes, and management URLs in `Private：`.

## Private Blocks

Use `Private：` inside an entity for private entity-specific data.

Rules:

- `Private：` must be the last data block in its entity; only the final Back to top navigation link may follow it.
- Parser must completely omit private contents from public output.
- Parser must fingerprint private values and verify that none of them appear in the public payload.

Private data includes:

- names
- booking numbers
- verification codes
- ticket numbers
- management links
- auth URLs
- payment details

Public operational prices that are useful during the trip, such as fares, admission fees, room totals, or public reference prices, may remain in public fields. Use consistent currency prefixes such as `JPY 1,150（單程）` or `TWD 1,433（1 人，已付）`. Booking numbers, verification codes, management links, auth URLs, ticket numbers, and payment-method details must stay in `Private：` and remain blocked by the build fingerprint scan.

## Parser Requirements

Schema 2 parser must fail on:

- missing required public sections
- missing required fields
- unknown public fields
- unknown timeline tags
- full-day timeline items without timeline tags
- date mismatch between frontmatter, `Itinerary`, and `Daily Plan`
- broken public internal links
- duplicate entity titles
- duplicate reference keys
- private fingerprint leakage

Parser must not convert arbitrary `label: value` into generic public rows.

Target website type model:

```ts
type Entity = StayEntity | FoodEntity | PlaceEntity | TransportEntity;
```

Each type should have its own frontend component.
