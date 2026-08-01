# Wei 的旅行手帖

以單一 Obsidian Markdown 筆記產生的靜態旅遊行程網站。原始筆記留在 private vault；repository 只保存通過遮罩與安全掃描的公開 JSON。輸出依 `trip_slug` 放進 `src/data/trips/`，首頁會自動建立旅程卡片，行程網址為 `/{trip_slug}/`。

## Local workflow

1. 複製 `.env.example` 為 `.env.local`，或直接讓預設路徑指向福岡筆記。
2. `npm install`
3. `npm run dev`
4. 更新筆記後執行 `npm run publish`。它會重新解析、更新外部連結預覽、測試、建置、掃描、commit 與 push。

首次發布前需要建立 Git repository、設定 `origin`，並在 GitHub Pages 將 Custom domain 設為 `travel.weiweifan.com`。DNS 建立 `travel` CNAME 指向 `BrianEE07.github.io`。

## Travel note contract

每趟旅程只使用一個 Markdown 檔案，frontmatter 至少包含：

```yaml
trip_slug: fukuoka-2026
trip_title: 福岡之旅
trip_kicker: Late summer · Kyushu
trip_summary: 八天，沿著九州的城市與山海慢慢走。
trip_intro: 從博多出發，穿過太宰府與由布院，再把最後幾天留給北九州、高千穗與糸島。
trip_code: FUK
trip_cover: /hero-fukuoka.png
trip_cover_alt: 福岡與北九州旅行意象拼貼
trip_start: 2026-08-27
trip_end: 2026-09-03
publish_through: 2026-08-30
trip_status: active
noindex: true
```

`trip_cover` 使用專案 `public/` 下的根路徑圖片；首頁卡片與行程主圖共用。`trip_summary` 同時用於首頁卡片與行程導言，`trip_intro` 則是行程頁的說明段落。

固定二級段落：

- `Overview`：日期與地點。
- `Itinerary`：每一天的 Date／Area／Stay／Notes 表格。
- `Daily Plan`：使用 `### YYYY-MM-DD ddd`，時間項目採 `- HH:MM` 或 `- HH:MM-HH:MM`。
- `Accommodation`、`Restaurant Reservations`、`Place Notes`、`Transportation`：每筆資料使用三級標題。
- `Booking & Tasks`、`Candidates`：永不公開。
- `References`：Google Maps 等 reference-style links。

`publish_through` 當天以前顯示完整時間軸，之後只顯示 Itinerary 摘要與「規劃中」。同頁連結 `[名稱](<#三級標題>)` 會轉為資訊視窗按鈕。

## Privacy boundary

解析器會移除旅客／訂房／訂位人、訂房／訂位／預訂編號、票號、認證碼、Login ID、交易編號、座位號、付款與價格，以及確認／變更／取消／登入／收據管理網址。被移除的原始值會在記憶體中轉成比對指紋，再檢查公開 JSON 與完整 `dist`；任何命中都中止發布。

公共地址、公共電話、交通說明、行李規則、地圖與官網可以保留。新欄位若可能識別旅客或控制訂單，必須先加入 denylist 才能發布。
