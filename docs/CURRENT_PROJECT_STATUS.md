# Travel Planner — Current Project Status

Last synchronized: 2026-09-05

Current production baseline: **P15.3**

This document is the current milestone/source-of-truth summary. When old branches, PRs, historical docs, or chat history conflict with this file, verify against GitHub `main`, `docs/APPS_SCRIPT_SOURCE_MAP.md`, and the two live Apps Script projects.

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
- P15.1 `traveler_bootstrap`

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

Current canonical deployed-module snapshots:
- `Router.gs`
- `Validators.gs`
- `Gate.gs`
- `PlaceMemos.gs`

`Code.branch-base.gs` is an incomplete historical root snapshot and is not safe to deploy over the live P9 root file.

The live `Travel Planner P9 Auth PoC` root `Code.gs` remains authoritative until a verbatim production copy is committed.

### Traveler public API

Directory:
`apps-script/traveler-public-api/`

Canonical current source:
- `Code.gs`

Historical comparison snapshot:
- `Code.current-production.gs`

`Code.current-production.gs` must not be treated as current production source.

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
- Do not invent broad city/area Places only to attach wishlist notes

## 4. GitHub Pages

Repository:
`Eric851127/travel-planner-web`

Traveler:
`https://eric851127.github.io/travel-planner-web/`

Admin:
`https://eric851127.github.io/travel-planner-web/admin.html`

GitHub Pages publishes from `main`.

### Traveler production runtime

Primary files:
- `index.html`
- `app.js`
- `p7network.js`
- `p15-bootstrap.js`
- `p4.js`
- `p7.js`
- `p7map.js`
- `p7today.js`
- `p8.js`
- `p14-place-memos-traveler.js`
- `styles.css`
- `sw.js`

Verified P15.3 script execution order:

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

This load order is currently part of production behavior and must not be changed as part of an unrelated bug fix.

### Admin production runtime

Primary files:
- `admin.html`
- `admin-p11.html`
- `p14-place-memos-admin.js`
- `p9-auth-poc.html`

`admin.html` currently patches `admin-p11.html` at runtime. This is active technical debt but production-stable and intentionally deferred.

## 5. Completed milestones

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

Important auth rules:
- do not change the OAuth callback URI casually
- `p9-auth-poc.html` remains part of the OAuth/login flow
- do not change Members/session schema during unrelated UI work
- do not use the Admin endpoint as Traveler public data API

## 6. P15 production behavior boundary

P15.3 is the known-good baseline.

Important warning:
- multiple Traveler scripts override shared globals such as `api`, `ensureDates`, and render functions
- the current script order may look architecturally inconsistent but is production-tested
- do not "fix" override order without a dedicated migration and explicit smoke testing

The exact P15 bootstrap/API composition should be treated as an architecture investigation item, not a small bug fix.

## 7. Technical debt backlog

### Safe documentation/source cleanup
- keep source-of-truth docs synchronized
- clearly label canonical vs historical Apps Script snapshots
- document runtime vs diagnostic root files

### P16 product/UX work
- render/date/group switching stability
- Admin Places/Itinerary place-selection UX
- Flights/Transport UI information architecture
- reduction of redundant UI/legacy entrypoints where proven safe

### P17 architecture consolidation
- remove Traveler patch-on-patch global ownership
- define one formal render lifecycle
- define one formal data/API adapter lifecycle
- consolidate Admin wrapper/base UI when safe
- commit a verbatim full production P9 root `Code.gs`

Do not mix P17 architecture cleanup into a small P16 behavior fix.

## 8. Main branch safety map

See:
`docs/MAIN_BRANCH_MAP.md`

This file classifies active runtime, diagnostics, Apps Script snapshots, legacy fallback, and known technical debt so old P-numbered filenames are not accidentally removed or reordered.
