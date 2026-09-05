# Travel Planner

Current production line: **P16 complete**

Repository: `Eric851127/travel-planner-web`

Production:
- Traveler: `https://eric851127.github.io/travel-planner-web/`
- Admin: `https://eric851127.github.io/travel-planner-web/admin.html`

Functional regression baseline commit:
`55fd670eb4a2baa33e3d09ee12affad6e56c58be`

## Architecture

The project has three runtime surfaces:

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
- preserve the verified Traveler script load order unless a dedicated migration proves a new order safe
- do not use the protected Admin Apps Script endpoint as the Traveler public API
- do not change OAuth callback/session semantics as part of unrelated UI work
- `apps-script/admin/` is legacy rollback code, not the production Admin backend
- historical P* filenames may still be runtime dependencies; do not delete or reorder them based only on their names

## Current Traveler runtime

`index.html` loads the Traveler stack in this verified order:

```text
app.js
p7network.js
p4.js
p7.js
p7maps-shared.js
p7map.js
p7today.js
p8.js
p14-place-memos-traveler.js
p16-runtime-core.js
```

Final core ownership is consolidated under `p16-runtime-core.js`. Maps helpers are owned by `p7maps-shared.js`; PlaceMemo runtime / Trip rendering are owned by `p14-place-memos-traveler.js`.

`p15-bootstrap.js` was dormant and non-runtime after Phase C and was removed during P16.4 cleanup. Git history remains the archive if comparison is ever needed.

## Current Admin runtime

Production composition:
- `admin.html`
- `admin-p11.html`
- `p14-place-memos-admin.js`
- `p16-admin-places-ux.js`
- `p16-admin-mobility-detail.js`
- `p9-auth-poc.html`

P16.3.1 shares the existing Admin bootstrap snapshot with mobility detail rendering; the mobility module no longer issues its own duplicate bootstrap request.

## Security

The Traveler public API exposes only approved public fields. Sensitive booking references, private confirmation numbers, and protected Admin data must remain server-side.

Admin writes require a valid signed session and server-side Members authorization.

## Local test

```bash
python3 -m http.server 8080
```
