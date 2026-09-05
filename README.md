# Travel Planner

Current production baseline: **P15.3**

Repository: `Eric851127/travel-planner-web`

Production:
- Traveler: `https://eric851127.github.io/travel-planner-web/`
- Admin: `https://eric851127.github.io/travel-planner-web/admin.html`

## Architecture

The project has three separate runtime surfaces:

1. Traveler GitHub Pages / PWA
   - mobile-first Vanilla JS
   - anonymous read-only data access
   - public Google Apps Script API
2. Admin GitHub Pages UI
   - Google OAuth / signed Travel Planner session
   - protected Admin API
3. Google Sheets
   - canonical travel data store

Traveler and Admin use **different Apps Script projects**. Do not merge their endpoints or responsibilities.

## Main branch rules

`main` is the production frontend source and the canonical GitHub archive for backend source snapshots.

Before changing runtime behavior, read:
- `docs/MAIN_BRANCH_MAP.md`
- `docs/CURRENT_PROJECT_STATUS.md`
- `docs/APPS_SCRIPT_SOURCE_MAP.md`

Important rules:
- preserve the P15.3 Traveler script load order unless a dedicated migration proves a new order safe
- do not use the protected Admin Apps Script endpoint as the Traveler public API
- do not change OAuth callback/session semantics as part of unrelated UI work
- `apps-script/admin/` is legacy rollback code, not the production Admin backend
- historical P* files in the root may still be runtime dependencies; do not delete or reorder them based only on their names

## Current Traveler runtime

`index.html` loads the Traveler stack in this verified P15.3 order:

```text
app.js
p7network.js
p15-bootstrap.js
p4.js
p7.js
p7map.js
p7today.js
p8.js
p14-place-memos-traveler.js
```

This order is an existing production contract. Some files override global functions from earlier files, so architectural cleanup must be separated from behavior fixes.

## Security

The Traveler public API exposes only approved public fields. Sensitive booking references, private confirmation numbers, and protected Admin data must remain server-side.

Admin writes require a valid signed session and server-side Members authorization.

## Local test

```bash
python3 -m http.server 8080
```
