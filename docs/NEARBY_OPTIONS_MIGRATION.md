# 附近選項：離線資料遷移提案

狀態：僅離線準備，未寫入 Sheet、未部署、未改動主行程或訂位。此提案不是可無條件執行的匯入授權，亦不提供自動寫入程式。

## 可核實的映射

來源是 2026-11-16 修改後的 Sheet 快照。`migrations/nearby-options/source-evidence.json` 記錄來源 SHA-256、必要欄位及當時列號；列號僅供追溯，匯入必須按 ID 重新查詢。沒有複製完整 notes、旅客、預訂、住宿或付款資料。

- I069 → P071：12/22 我方燒肉晚餐的 USHIGORO 表參道替代候選。原主行程 P070 青山まんぷく不變，二擇一，不代表訂位，也不新增第二餐或改時間。
- **P064 是原宿／表參道・Cat Street，不是 LATTE ART MANIA。** I048 的咖啡附屬點目前沒有真實 Places ID，不能沿用示意頁的映射。
- KINOTOYA BAKE POLE TOWN、鶴羽狸小路5丁目亦沒有快照中的 Places ID。P900/P901 為預覽專用，不得匯入。
- P047 確為札幌螃蟹家本店。I034（12/28）與 I040（12/30）皆為 group=all；跨日期擇一及適用同行群組尚待處理，先列 deferred，不擅自新增兩筆可見晚餐。

`deferred.json` 列出未完成項目與解鎖條件。完整 Places 71 筆已逐一核對；找不到 ID 不等於判定店家不存在。

## 檔案與啟用策略

`proposed-rows.json` / `.csv` 是同一筆提案的兩種格式，**二擇一匯入，不要重複匯入**。IO001 是預計配置的新關聯 ID，尚未在正式表保留，可能與後續變更撞號。

預設 `active=false`（CSV 為 `FALSE`），不是 TRUE。即使未來獲准先導入，仍不應立即公開未完成驗收的候選。只有來源、外鍵、群組及介面驗證完成且取得啟用授權後才改為 TRUE。adapter 會隱藏 inactive，屬預期行為。duration 留空，不把建議自動固化成停留時間。

## 導入前必做重驗

1. 取得對應 Sheet 新資源、公開 API 部署與資料寫入範圍的明確授權；部署／合併依另行核准執行。
2. 重新完整讀取 Itinerary、Places 及（若已存在）ItineraryOptions，備份原值和 schema。核對三表 ID 唯一性、表頭順序、欄位型別。
3. 比較 I069 的日期 2026-12-22、group=ours、place_id=P070，以及 P070/P071 的店名和分店。任何差異先停止，不按舊列號覆寫。
4. 檢查 IO001 是否已用；若同語意關聯已存在，不重複插入。若 ID 碰撞，經查核重新配置並同步 JSON/CSV/證據，不直接覆寫。另檢查 (itinerary_id,candidate_place_id,relation_type,choice_set) 語意重複。
5. 新表僅使用 schema 文件中的 11 欄，不攜帶 notes/預訂資訊。未完成項目留在 deferred，不建立假 Place ID，不更動既有 Itinerary/Places。
6. 授權導入後讀回逐欄比對，確認既有兩表完全不變；先 inactive，再在測試環境確認群組隔離、二擇一與缺資料降級。公開端應只回傳白名單欄位。
7. 真實手機／PWA 驗收後才另行啟用。回復可將本次關聯 active 設為 FALSE 並關閉 optionsResource；不要刪除或回退既有主行程。

## 本機驗證

`node --test tests/nearby-migration.test.cjs` 檢查檔案一致、ID/外鍵、來源欄位、inactive 策略與 preview ID 隔離。測試依據的是快照，不代表已驗證未來正式表狀態或餐廳營業。


## 程式與線上操作清單（尚未執行）

本分支的 `apps-script/traveler-public-api/Code.gs` 已準備 `itinerary_options` resource、11 欄白名單、父行程日期/group 過濾、外鍵及列值驗證，並在 `traveler_bootstrap` 追加選用欄位。缺表或可選表表頭不完整時回傳成功空陣列，不影響原 itinerary。既有 Itinerary.notes 不會公開。

尚須另行執行的線上操作，必須按序：

1. 比對 live 公開 Traveler Apps Script 與分支來源，保存目前部署版本；不要把這份程式部署到受保護 Admin 專案。
2. 在測試表／測試部署驗證新資源缺表降級及原有六類旅程資源、PlaceMemos 的回傳相容性。此分支沒有提供 Admin 的新表 CRUD。
3. 經授權才在正式表建立 ItineraryOptions 的 11 欄並匯入核實後的 inactive 提案；這一步不新增或覆寫主行程、Places、Reservations。
4. 經授權才將公開 API 更新到新的已驗證部署版本，保留原正式 URL 及存取設定。驗證 health、舊資源、itinerary_options、traveler_bootstrap 與敏感欄位排除。inactive 資料應仍回傳 []。
5. 在測試前端加入 `window.TRAVEL_PLANNER_OPTIONS_CONFIG = { optionsResource: 'itinerary_options' };`，放在首次 render 前，並且不要載入 `preview/fixtures.js`。正式入口目前**未加入此開關**。
6. 完成真資料／手機／PWA 驗收、確認顯示受眾及要啟用的具體列後，才另行啟用列與正式前端開關、合併部署。缺失地點仍留 deferred，不因 API 已支援就推測其 ID。

關閉前端開關（或將關聯 active 改 FALSE）是低影響的停用方式；如 API 發生回歸，還原已保存的部署版本。以上是執行計畫，不是已執行結果。
