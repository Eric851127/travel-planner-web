# Travel Planner — Current Project Status

Last synchronized: 2026-09-05

Current production behavior baseline: **P15.3**
Functional regression baseline commit: `55fd670eb4a2baa33e3d09ee12affad6e56c58be`

Traveler runtime cleanup Phases A/B/C are now applied on top of the P15.3 behavior boundary. The cleanup changes ownership/structure, not the intended product behavior.

## 1. Production architecture

There are two separate Google Apps Script Web Apps.

### A. `Travel Planner P9 Auth PoC`

Purpose: protected Admin authentication and writes.

Responsibilities:
- Google OAuth / P9 authentication
- signed Travel Planner session
- session check / logout / revoke
- Members authorization and Admin re-check
- P10 protected Admin API
- CRUD for itinerary, reservations, hotels, flights, transport, places
- P14 PlaceMemo Admin CRUD

Admin production endpoint:
`https://script.google.com/macros/s/AKfycbzpBT-CqGtHiFtY9mb_p_diNNs46GC4h7ks-gKCMKHG-bSE6xWE_Q5Vc0eAkET4kpsS/exec`

This endpoint is not the Traveler public read API.

### B. `Travel Planner`

Purpose: anonymous/public read-only API for Traveler.

Responsibilities:
- GET / JSON / JSONP
- read-only Google Sheet access
- resource allowlist
- filtering / sorting
- public field whitelist
- `traveler_bootstrap` remains available server-side

Traveler stores this endpoint in localStorage under:
`travelPlanner.apiBase.v1`

Current public resources include:
- itinerary
- hotels
- flights
- transport
- reservations
- places
- place_memos
- members
- traveler_bootstrap

## 2. GitHub Apps Script source

Canonical source map:
`docs/APPS_SCRIPT_SOURCE_MAP.md`

### Admin backend

Directory:
`apps-script/admin-backend/`

Canonical current source set:
- `Code.gs` — verified live P9 OAuth/session root source
- `Router.gs`
- `Validators.gs`
- `Gate.gs`
- `PlaceMemos.gs`

Historical root snapshot:
- `snapshots/Code.branch-base.gs`

The verified `Code.gs` includes the production route:

```js
if (mode === 'admin_api') return p10AdminApi_(e);
```

### Traveler public API

Directory:
`apps-script/traveler-public-api/`

Canonical current source:
- `Code.gs`

Historical comparison snapshot:
- `snapshots/Code.pre-p15-bootstrap.gs`

### Legacy Admin

`apps-script/admin/` is rollback-only legacy code and is not the production Admin backend.

## 3. Google Sheet

Spreadsheet ID:
`1wk_rVY8cgJbmS1PJBIP95Z_CGnz2a-QQjTVA1xqLIh8`

Title:
`Travel Planner Schema v1`

Important sheets:
- `_Schema`
- `_Enums`
- `Itinerary`
- `Hotels`
- `Flights`
- `Transport`
- `Reservations`
- `Places`
- `Members`
- `P5_Import`
- `PlaceMemos`

### PlaceMemos schema

Columns:
- `id`
- `place_id`
- `type`
- `title`
- `note`
- `priority`
- `active`
- `sort_order`

Enums:
- type: `food`, `shopping`, `note`, `reservation`
- priority: `high`, `normal`, `low`
- active: TRUE/FALSE

Model rule:
- Place is the parent entity
- Memo attaches to a concrete Place
- Memo does not create a map pin

## 4. GitHub Pages

Repository:
`Eric851127/travel-planner-web`

Traveler:
`https://eric851127.github.io/travel-planner-web/`

Admin:
`https://eric851127.github.io/travel-planner-web/admin.html`

GitHub Pages publishes from `main`.

### Traveler production runtime after cleanup Phase C

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

Ownership:
- `jsonp` → `p7network.js`
- `api` → `p16-runtime-core.js`
- `ensureDates` → `p16-runtime-core.js`
- `bindDateControls` → `p16-runtime-core.js`
- `renderCurrent` → `p16-runtime-core.js`
- `renderToday` → `p7today.js`
- `renderTrip` → `p14-place-memos-traveler.js`
- `renderBookings` → `p4.js`
- `renderMap` → `p7map.js`
- `renderMore` → `p8.js`

Shared runtimes:
- Maps → `p7maps-shared.js`
- PlaceMemo → `p14-place-memos-traveler.js`

`p15-bootstrap.js` is retained in GitHub but is **dormant / non-runtime**. It is no longer loaded by `index.html` and no longer belongs to the service-worker app shell.

Detailed contract:
`docs/TRAVELER_RUNTIME_EXECUTION_MAP.md`

### Admin production runtime

Primary files:
- `admin.html`
- `admin-p11.html`
- `p14-place-memos-admin.js`
- `p9-auth-poc.html`

`admin.html` still patches `admin-p11.html` at runtime. This remains active technical debt but is production-stable.

## 5. Completed milestones / cleanup

Product milestones:
- P9 Authentication: PASS
- P10 protected Admin CRUD: PASS
- P11 Admin UI: PASS
- P12 Traveler → Admin edit mode: PASS
- P13.1 clean-storage login / endpoint recovery: PASS
- P13.2 Traveler ↔ Admin navigation/session reuse: PASS
- P14.1 PlaceMemo Data Model: PASS
- P14.2 Admin Place Memo Editing: PASS
- P14.3 Traveler Memo Rendering: PASS
- P15.1 Traveler bootstrap / reliability: PASS
- P15.2 refresh / initial render / parallel preload: PASS
- P15.3 Traveler Today flight cards: PASS
- Safari major flows: PASS
- installed PWA major flows: PASS

Cleanup phases:
- Phase A shared Maps helper consolidation: PASS
- Phase B renderer-native PlaceMemo consolidation: PASS
- Phase C Traveler core ownership consolidation: implementation complete; smoke test pending

## 6. Auth / Cloud safety rules

Do not casually change:
- OAuth callback URI
- `p9-auth-poc.html` path
- OAuth client behavior
- Members/session schema
- Admin Apps Script deployment URL
- Traveler public Apps Script deployment URL
- Maps API key website restrictions/referrers
- Map ID
- GitHub Pages origin/domain

If a frontend cleanup requires Google Cloud Console changes, stop before implementation and inform the project owner first.

## 7. Current technical debt backlog

### Traveler
- `app.js` still contains legacy base implementations that are overridden by final owners
- active runtime is cleaner but still split across historical P-numbered files
- render/date/group switching stability still needs product-level P16 validation/fix work

### Admin
- `admin.html` string-patches `admin-p11.html`
- large single-file Admin UI
- Places/Itinerary place-selection UX remains unintuitive
- Flights/Transport information architecture still needs product-level consolidation

### Repository / deployment
- manual Apps Script deployment can drift from GitHub if not synchronized
- diagnostics-only root pages remain in place for compatibility
- dormant `p15-bootstrap.js` remains for historical/architecture reference

## 8. Main branch safety map

See:
`docs/MAIN_BRANCH_MAP.md`

If any Traveler regression appears during cleanup, compare against functional baseline:
`55fd670eb4a2baa33e3d09ee12affad6e56c58be`
