> Superseded release status and actual browser verification: [NEARBY_OPTIONS_RELEASE.md](NEARBY_OPTIONS_RELEASE.md). The limitations below describe the earlier review stage.

# 主線＋附近選項：獨立審閱版本

## 狀態與界線

此分支提供前端實作與獨立示意預覽。**未部署 GitHub Pages、未更動 Google Sheet、未部署 Apps Script，亦未更動任何預訂。** 分支現在也包含公開 API 的選用資料表支援與離線遷移包，仍未上線。

正式資料來源仍使用原公開 API；Nearby Options 預設關閉，沒有新來源時主線照常顯示，不會擅自把 `notes` 或所有收藏解析成行程。`preview/` 的少量資料僅用於介面審閱，不是完整 11 天行程，也不表示營業時間、交通時間或訂位已確認。

## 預覽

```sh
npm ci
npm test
npm run preview
```

在執行伺服器的電腦開啟 `http://localhost:8091/preview/`。不需 API Key、登入或正式 Apps Script。預覽不註冊 service worker。

- 12/22：表參道主線附 LATTE ART MANIA；晚餐附 USHIGORO 表參道替代選項。
- 12/28：札幌自由活動附甜點、藥妝示例；P900/P901/P902/P903 是**僅預覽用** ID。
- 12/30：沒有 `place_id` 的區域行程仍保留在今日時間軸。
- 切換朋友組、展開全旅程，再由「更多→旅程地圖」測日期及主線／附近／全部地點。

## 改動

- 四個底部入口：今日、全旅程、預訂、更多。
- 今日先顯示主線，地圖收合且按需載入。每個主線區段可展開獨立附近／替代卡。
- 全旅程按日收合，保留 description、certainty、PlaceMemos 及原預訂 badge。
- 附近資料以 Itinerary 外鍵繼承日期及 group，不增加主線編號或預訂。
- 地圖按日及範圍過濾，預設當日主線；缺 Key、缺座標或 Maps 失敗仍保留清單與 Google Maps 連結。
- 防止晚到地圖請求覆寫新日期、群組或頁面；共用 Maps loader 與 importLibrary 各有 15 秒逾時；地圖繪製在背景執行，不占用日期／群組／導覽共用互動佇列。
- 公開 API 欄位及 Admin 身分驗證保持不變。新版資料契約見 `NEARBY_OPTIONS_SCHEMA.md`。

## 驗證結果

- 36 項 Node/VM/jsdom 測試通過，包括資料隔離、無來源、無效資料、缺地點、日期／群組、原航班交通住宿、預訂 badge、導覽／重整、HTML/URL 安全、地圖失敗與非同步競態、永不回應的地圖載入下仍可切換日期／群組／離頁、不同 choice_set 標記。
- 全部頂層與 preview JavaScript 語法檢查通過。
- `git diff --check` 通過。

**未驗證**：真實手機/Safari/PWA 像素版面、實際 Google Maps marker/觸控、正式資料端對端及真實地圖服務。

驗證環境限制：已安裝 Chromium 在啟動時收到 `socket() failed: Operation not permitted`，一次授權重試結果相同；雲端 CUA 瀏覽器不共享本機伺服器網路，開啟 localhost 收到 `ERR_CONNECTION_REFUSED`。jsdom 是 DOM/事件驗證，不是排版引擎，不能據此宣稱手機視覺已驗收。

## 上線前尚須

1. 在可用瀏覽器完成 390px/320px 與桌面視覺檢查、實際地圖及已安裝 PWA 測試。
2. 確認哪些收藏真要加入附屬資料，核實分店、營業、座標及父行程外鍵。
3. 若採新 Sheet/API 資源，另做授權的資料 migration、public whitelist 與 Admin 相容處理，部署並驗證後才啟用 `TRAVEL_PLANNER_OPTIONS_CONFIG`。
4. 另行確認合併與部署，不應直接把示意 fixture 接到正式入口。

## 回復方式

本次尚未部署，正式網站無需回復。日後若經同意上線，可回退此分支提交；新資料來源為選用、關閉後原主線仍可讀。

正式映射核查更正：P064 是原宿／表參道・Cat Street，不是咖啡店。preview 咖啡改用明示示意 P902；可遷移正式資料與 deferred 條件見 `NEARBY_OPTIONS_MIGRATION.md`。

預覽區域 ID 更正：I048 使用正式 P064；札幌示意區域使用 P903，避免誤用代表新青森站的 P020。
