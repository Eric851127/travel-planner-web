# Travel Planner — Current Project Status

Last synchronized: 2026-09-05

Current production line: **P16 complete**
Functional regression baseline commit: `55fd670eb4a2baa33e3d09ee12affad6e56c58be`

## 1. Production architecture

There are two separate Google Apps Script Web Apps.

### A. Protected Admin Apps Script

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

### B. Traveler public Apps Script

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
- `Code.gs`
- `Router.gs`
- `Validators.gs`
- `Gate.gs`
- `PlaceMemos.gs`

Historical snapshot:
- `snapshots/Code.branch-base.gs`

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

PlaceMemos schema:
- `id`
- `place_id`
- `type`
- `title`
- `note`
- `priority`
- `active`
- `sort_order`

## 4. GitHub Pages

Repository:
`Eric851127/travel-planner-web`

Traveler:
`https://eric851127.github.io/travel-planner-web/`

Admin:
`https://eric851127.github.io/travel-planner-web/admin.html`

GitHub Pages publishes from `main`.

### Traveler production runtime

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
- date/group/nav/refresh/retry interactions → `p16-runtime-core.js`
- `renderCurrent` → `p16-runtime-core.js`
- `renderToday` → `p7today.js`
- `renderTrip` → `p14-place-memos-traveler.js`
- `renderBookings` → `p4.js`
- `renderMap` → `p7map.js`
- `renderMore` → `p8.js`

Shared runtimes:
- Maps → `p7maps-shared.js`
- PlaceMemo → `p14-place-memos-traveler.js`

`p15-bootstrap.js` was dormant / non-runtime and was removed in P16.4. Git history remains the archive.

Detailed contract:
`docs/TRAVELER_RUNTIME_EXECUTION_MAP.md`

### Admin production runtime

Primary composition:
- `admin.html`
- `admin-p11.html`
- `p14-place-memos-admin.js`
- `p16-admin-places-ux.js`
- `p16-admin-mobility-detail.js`
- `p9-auth-poc.html`

`admin.html` still patches `admin-p11.html` at runtime. This remains active technical debt but is production-stable.

P16.3.1 Admin reliability rule:
- base Admin performs the protected bootstrap once
- `admin.html` exposes the successful bootstrap payload as `window.TRAVEL_PLANNER_ADMIN_BOOTSTRAP`
- `p16-admin-mobility-detail.js` consumes that shared snapshot and does not issue a second bootstrap request

## 5. Completed milestones

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
- P15.3 Traveler flight cards: PASS
- Safari major flows: PASS
- installed PWA major flows: PASS

P16:
- P16.1 Interaction Core / first-click stability: PASS
- P16.2 Places grouping/search + searchable Place picker: PASS
- P16.3 Mobility Integration: PASS
- P16.3.1 Admin Bootstrap Reliability: PASS
- P16.4 safe cleanup / documentation synchronization: COMPLETE

Cleanup foundations:
- Phase A shared Maps helper consolidation: PASS
- Phase B renderer-native PlaceMemo consolidation: PASS
- Phase C Traveler core ownership consolidation: PASS

## 6. P16 product results

### Interaction stability

The final interaction owner is `p16-runtime-core.js`, removing the refresh/initial-load first-click race across date, group, nav, refresh, and retry controls.

### Admin Places / Itinerary UX

- Places grouped by city
- live search across place name / city / address / category
- searchable Place picker for Itinerary
- same Place picker pattern reused for Transport origin/destination

### Mobility

Admin UI:
- Flights + Transport exposed under one top-level `交通`
- inner views: `航班` / `一般交通`
- backend resources remain separate

Traveler UI:
- Flight + Transport treated as mobility segments
- Today view includes `今日移動`
- Trip view includes per-day mobility segments
- explicit `transport_id` relations render human-readable mobility detail

No schema migration or `flight_id` addition was required.

### Admin bootstrap reliability

P16.3 originally added a second heavy Admin bootstrap request from the mobility decorator. P16.3.1 removed it.

Current design:
- one protected Admin bootstrap per base load
- shared browser snapshot for dependent Admin decorators

This materially reduced observed `Apps Script 回應逾時` incidents during repeated Admin editing and navigation.

## 7. Auth / Cloud safety rules

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

## 8. Technical debt deferred to P17

### Traveler
- `app.js` still contains legacy base implementations that are overridden by final owners
- active renderer/helper modules still use historical P-numbered filenames
- broader runtime lifecycle/API adapter formalization is deferred

### Admin
- `admin.html` string-patches `admin-p11.html`
- large single-file Admin UI
- auth lifecycle still performs `session_check` before protected bootstrap; this is intentionally unchanged because current behavior is stable

### Backend / deployment
- Apps Script deployment can drift from GitHub if manually changed without synchronization
- Admin bootstrap still reads multiple sheets synchronously; deeper backend optimization is deferred while current latency is acceptable

### Compatibility files retained intentionally
- `p9-auth-poc.html` — production OAuth/login callback despite historical filename
- `p9-auth-diagnostics.html` — diagnostics/support
- `p10-admin-api.html` — diagnostics/support
- `admin-p11.html` — active Admin body/fallback
- Apps Script snapshots — audit/rollback context

## 9. Regression policy

Main branch safety map:
`docs/MAIN_BRANCH_MAP.md`

If any regression appears during future architecture work, compare behavior against:
`55fd670eb4a2baa33e3d09ee12affad6e56c58be`
