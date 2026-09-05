# Travel Planner — Current Project Status

Last synchronized: 2026-09-05

This document is the current project source-of-truth. When old branches, PRs, or chat history conflict with this file, verify against GitHub `main` and the two live Apps Script projects.

## 1. Production architecture

There are two separate Google Apps Script Web Apps.

### A. `Travel Planner P9 Auth PoC`

Purpose: protected Admin authentication and writes.

Responsibilities:
- Google OAuth / P9 authentication
- signed Travel Planner session
- session check / logout / revoke
- Members authorization and admin re-check
- P10 protected Admin API
- CRUD for itinerary, reservations, hotels, flights, transport, places
- P14 PlaceMemos Admin CRUD

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

Traveler stores this endpoint in:
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

`place_memos` is now deployed in production and confirmed visible in Traveler.

## 2. GitHub canonical Apps Script source

Canonical source map:
`docs/APPS_SCRIPT_SOURCE_MAP.md`

Current source layout:

- `apps-script/admin-backend/`
  - corresponds to `Travel Planner P9 Auth PoC`
  - `Router.gs`
  - `Validators.gs`
  - `Gate.gs`
  - `PlaceMemos.gs`
  - `Code.branch-base.gs` is retained only as a branch-base snapshot because it is older than the current live P9 entry-point routing

- `apps-script/traveler-public-api/`
  - corresponds to `Travel Planner`
  - `Code.gs` is the canonical current public API source
  - `Code.current-production.gs` is synchronized with the P14.3 PlaceMemos public-read implementation

- `apps-script/admin/`
  - legacy rollback only
  - not the current Admin backend

Feature branches are historical/change branches only. They must not be treated as production source-of-truth.

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

Important current frontend files:
- `index.html`
- `app.js`
- `p7today.js`
- `p7map.js`
- `p14-place-memos-traveler.js`
- `admin.html`
- `admin-p11.html`
- `p14-place-memos-admin.js`
- `sw.js`

## 5. Migration status

- P9 Authentication: PASS
- P10 protected Admin CRUD: PASS
- P11 Admin UI: PASS
- P12 Traveler → Admin edit mode: PASS
- P13.1 clean-storage login / endpoint recovery: PASS
- P13.2 Traveler ↔ Admin navigation/session reuse: PASS
- Safari: PASS
- installed PWA: PASS

Important auth rules:
- do not restore pre-login forced endpoint writes in `admin.html`
- `p9-auth-poc.html` remains the OAuth callback

## 6. P14 status

### P14.1 — PlaceMemo Data Model
Status: **PASS**

Completed:
- `PlaceMemos` Sheet created
- `_Schema` updated
- validation applied
- documented in `docs/P14_PLACE_MEMOS.md`

### P14.2 — Admin Place Memo Editing
Status: **PASS**

Completed:
- protected PlaceMemo CRUD deployed in `Travel Planner P9 Auth PoC`
- Place editor has child memo section
- no seventh top-level Admin tab
- create / reopen / edit / reopen / delete smoke test PASS
- Place deletion has memo dependency protection in P14 backend design

Frontend implementation:
`p14-place-memos-admin.js`

### P14.3 — Traveler Memo Rendering
Status: **PASS**

Completed:
- Traveler public API `place_memos` deployed in `Travel Planner`
- production Traveler successfully displays newly created memo
- public read uses `config.apiBase`, not the Admin endpoint
- active memos are publicly readable
- inactive memos are filtered out by public API logic
- `sort_order` is normalized numerically and used for memo ordering
- Traveler displays memo beneath/in the corresponding Place
- memo creates no map pin
- frontend remains fail-soft if memo API becomes unavailable

Traveler memo icons:
- food: 🍴
- shopping: 🛍
- note: 📝
- reservation: ⏰

Canonical public API source:
`apps-script/traveler-public-api/Code.gs`

Traveler rendering module:
`p14-place-memos-traveler.js`

## 7. Important branch / PR history

- PR #1: old rollback path, closed/not merged
- PR #3: P14.2 Admin PlaceMemos UI, merged to main
- PR #4: P14.3 Traveler PlaceMemo rendering, merged to main
- `p10-admin-api`: historical backend development branch
- `p14-place-memos-backend`: historical P14 backend branch

Do not infer production state solely from those branches.

## 8. Technical debt intentionally deferred

Do not mix these into P14 completion:
- consolidate `admin.html` and `admin-p11.html`
- split large JS/CSS files
- replace framework/stack
- move to React/Firebase/Supabase
- change OAuth callback URI
- delete `p9-auth-poc.html`
- delete legacy rollback files
- modify Members/session format without a dedicated migration

## 9. Current milestone

**P14 is complete through P14.3.**

The next product step can now move beyond infrastructure validation, including adding the normalized wishlist Place/Memo data and later cleanup/refactoring as a separate phase.
