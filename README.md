# Travel Planner

目前版本：P5

包含：
- Mobile-first HTML/CSS/Vanilla JS
- Apps Script read-only API
- Today / Trip / Bookings / Map / More
- All / Ours / Friends filter
- Public-field whitelist
- JSONP mobile-compatible API access

## Security

公開前端只讀取 Apps Script API 的公開欄位白名單。API endpoint 不在 README 或使用者介面直接展示；但前端網路請求本質上仍可被瀏覽器檢視，因此安全性以後端權限與欄位白名單為準，不依賴隱藏 URL。

不公開訂房確認碼、航班 booking reference、reservation booking URL 等私人欄位。正式公開前應同步移除 notes 與可能含私人票券連結的 Transport.url。

## Local test

```bash
python3 -m http.server 8080
```
