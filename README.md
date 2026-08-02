# Wei 的旅行手帖

以單一 Obsidian Markdown 筆記產生的靜態旅遊行程網站。原始筆記留在 private vault；repository 只保存通過 schema 驗證與安全掃描的公開 JSON。首頁自動建立旅程卡片，行程網址為 `/{trip_slug}/`。

## Local workflow

1. `npm install`
2. `npm run dev`
3. 更新筆記後執行 `npm run publish`

`publish` 會重新解析筆記、更新可公開的外部預覽、執行測試與型別檢查、建立靜態網站、掃描公開輸出，再提交行程資料。程式碼或格式規格有變動時，需一併提交相關檔案。

## Travel schema 2

完整 canonical 規格見 [`TRAVEL_NOTE_FORMAT.md`](./TRAVEL_NOTE_FORMAT.md)。每趟旅程使用一個 Markdown 檔案，frontmatter 必須包含 `travel_schema: 2`，並以 `trip_start` / `trip_end` 作為日期唯一驗證來源。

只有以下二級 section 會進入公開資料：

- `Overview`
- `Itinerary`
- `Daily Plan`
- `Accommodation`
- `Food`
- `Places`
- `Transportation`
- `References`

其他 section 一律視為 private。公開 entity 由所在 section 決定型別，住宿、餐飲、景點與交通使用各自的固定欄位與畫面元件，不再將任意 `label：value` 轉成通用資料列。

每日公開程度由 `Publish：full` 或 `Publish：summary` 控制。完整時間軸必須使用 `#travel/move`、`#travel/food`、`#travel/place`、`#travel/shopping`、`#travel/activity`、`#travel/rest`、`#travel/buffer` 其中一種標籤；時間必須放在 Markdown link 外。

`trip_status` 只接受：

- `draft`：不產生公開 JSON、首頁卡片或行程頁。
- `active`：公開並優先作為目前旅程。
- `archived`：保留公開，排序在目前旅程之後。

## Build validation

以下任一情況都會中止同步與發布：

- 必要 section、欄位或 frontmatter 缺漏。
- 出現未知公開欄位、未知 timeline tag 或無 tag 的 full-day 行程。
- frontmatter、Overview、Itinerary、Daily Plan 日期不一致、缺日、重複或順序錯誤。
- 公開內部連結失效、住宿或交通連到錯誤 entity 類型。
- entity 標題或 reference key 重複。
- `Private：` 指紋或常見訂單機密出現在公開 JSON / `dist`。

## Privacy boundary

Entity 的 `Private：` 必須放在最後；其後內容完全不會進入公開資料。Parser 會記住私人值的比對指紋，並在 JSON 與完整網站輸出中反查。訂房／訂位編號、認證碼、票號、價格與管理網址即使誤放到公開欄位，也會被最後一道掃描阻止發布。

Booking & Tasks、Candidates、Related Notes 等非 allowlist section 不依名稱特判；它們因不在公開清單中而預設不公開。
