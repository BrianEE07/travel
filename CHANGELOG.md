# Changelog

## v1.0.0 — Stable travel journal foundation (2026-08-09)

第一個可長期使用的穩定版本，以福岡之旅作為 Schema 2 與視覺基準。

### Included

- 多旅程首頁與 `/{trip_slug}/` 靜態行程網址。
- 響應式每日時間線、日期導覽、旅程總覽與資料庫卡片。
- 住宿、餐飲、景點與多分段交通的專用資訊視窗。
- 明確圖片來源、載入失敗降級與換卡時清除舊圖。
- Food / Places nested Note 與 Transportation `<br>` Note 條列。
- 行李／採買清單、裝置端勾選狀態、進度、篩選與重設。
- 動態 `English｜中文` 清單分類，不使用分類 allowlist。
- Schema 2 build 驗證、private fingerprint 與公開產物安全掃描。
- GitHub Pages 自動 build、檢查與部署。

### Baseline

後續旅程應沿用 `TRAVEL_NOTE_FORMAT.md`，由新筆記產生公開 JSON 與獨立 slug 頁面；不為單一旅程新增 checklist 專用 YAML 欄位。
