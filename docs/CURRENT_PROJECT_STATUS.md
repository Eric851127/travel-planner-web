# Travel Planner — Current Project Status

Last synchronized: 2026-09-05
GitHub `main` baseline at sync: `b589227e3f7e2522db753138261772ed2c2ce7f4`

This document is the current source-of-truth snapshot for continuing the project. When branch notes, old PRs, or prior chat assumptions conflict with this file, verify against GitHub `main` and the two live Apps Script projects before changing production.

## 1. Production architecture

There are **two separate Google Apps Script Web Apps**.

### A. `Travel Planner P9 Auth PoC`

Purpose: protected Admin authentication and writes.

Responsibilities:
- Google OAuth / P9 authentication
- signed Travel Planner session
- session check / logout / revoke behavior
- Members authorization and admin access re-check
- P10 protected Admin API
- Admin CRUD for itinerary, reservations, hotels, flights, transport, places
- P14 PlaceMemos Admin CRUD

This is the endpoint used by the Admin UI.

Do **not** use this endpoint as the Traveler public read API.

Production endpoint currently used by Admin:
`https://script.google.com/macros/s/AKfycbzpBT-CqGtHiFtY9mb_p_diNNs46GC4h7ks-gKCMKHG-bSE6xWE_Q5Vc0eAkET4kpsS/exec`

### B. `Travel Planner`

Purpose: anonymous/public read-only API for the Traveler UI.

Responsibilities:
- GET / JSON / JSONP reads
- resource allowlist
- filtering / sorting
- public field whitelist
- no write API

The Traveler UI stores this endpoint in:
`travelPlanner.apiBase.v1`

The current live `Travel Planner` Apps Script is a single `Code.gs` and currently exposes:
- itinerary
- hotels
- flights
- transport
- reservations
- places
- members

P14.3 requires adding `place_memos` here. This public API change is **pending deployment at the time of this sync**.

## 2. Google Sheet

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
- Place is the parent entity.
- Memo is attached to a concrete Place.
- Memo does not create a map pin.
- Do not invent broad city/area Places only to attach wishlist notes.

## 3. GitHub Pages / main

Repository:
`Eric851127/travel-planner-web`

Production Traveler:
`https://eric851127.github.io/travel-planner-web/`

Production Admin:
`https://eric851127.github.io/travel-planner-web/admin.html`

GitHub Pages publishes from `main`.

At this sync, `main` includes:
- `admin.html`
- `admin-p11.html`
- `p14-place-memos-admin.js`
- `p14-place-memos-traveler.js`
- `index.html`
- `app.js`
- `p7today.js`
- `p7map.js`
- `sw.js`
- `docs/P14_PLACE_MEMOS.md`

### Admin wrapper technical debt

`admin.html` still performs runtime fetch/patch of `admin-p11.html` and then injects additional behavior.

P14 Admin memo UI is loaded as an additional module.

Do not consolidate/refactor Admin while P14 is still being validated.

## 4. P9–P13 status

- P9 Authentication: PASS
- P10 Admin protected CRUD: PASS
- P11 Admin UI: PASS
- P12 Traveler → Admin edit mode: PASS
- P13.1 clean-storage login / endpoint recovery: PASS
- P13.2 Traveler ↔ Admin navigation and session reuse: PASS
- Safari: PASS
- installed PWA: PASS

Important auth rule:
- do not restore a pre-login forced endpoint write in `admin.html`
- `p9-auth-poc.html` remains the OAuth callback

## 5. P14 status

### P14.1 — PlaceMemo Data Model
Status: **PASS**

Completed:
- `PlaceMemos` Sheet created
- `_Schema` updated
- enum validation applied
- data model documented in `docs/P14_PLACE_MEMOS.md`

### P14.2 — Admin Place Memo Editing
Status: **PASS**

Completed:
- protected PlaceMemo CRUD is deployed in `Travel Planner P9 Auth PoC`
- Admin Place editor shows child memo section
- no seventh top-level Admin tab
- create / reopen / edit / reopen / delete smoke test: PASS
- Place deletion is designed to be blocked while memos still reference it

Traveler/Pages Admin UI implementation in main:
- `p14-place-memos-admin.js`

### P14.3 — Traveler Memo Rendering
Status: **FRONTEND DEPLOYED / PUBLIC API PENDING**

GitHub Pages frontend is already in `main`:
- `p14-place-memos-traveler.js`
- `index.html` loads the module
- `sw.js` caches the module

Intended rendering:
- Today: memo under itinerary Place
- Trip: memo under Place
- Map: memo inside Place card
- icons: 🍴 food, 🛍 shopping, 📝 note, ⏰ reservation
- sort by `sort_order`
- no new map pin
- fail-soft: if memo API is unavailable, existing Traveler views continue without memo rows

Important correction:
- Traveler must read `place_memos` from the **public `Travel Planner` Apps Script** (`config.apiBase`).
- Traveler must **not** read public memos from `Travel Planner P9 Auth PoC`.

The main frontend was corrected for this architecture in commit:
`b589227e3f7e2522db753138261772ed2c2ce7f4`

## 6. Pending production task: public `place_memos` resource

Modify only the `Travel Planner` public read-only Apps Script `Code.gs`.

Required changes:

1. Add resource mapping:
```js
place_memos: 'PlaceMemos'
```

2. Add public fields:
```js
place_memos: [
  'id','place_id','type','title','note','priority','active','sort_order'
]
```

3. Add allowed filters:
```js
place_memos: ['id','place_id','type','priority','active']
```

4. Public reads must hide inactive rows by default:
```js
if (resource === 'place_memos') {
  rows = rows.filter(function(row) {
    return row.active === true;
  });
}
```

5. Sort memos by:
- `place_id`
- `sort_order`
- `title`
- `id`

6. Treat `sort_order` as numeric in `normalizeValue_()`.

After editing, create a new deployment version for the **Travel Planner** public API only.

Do not redeploy the Admin P9/P10 project for this step unless its code also changed.

## 7. P14.3 validation after public API deploy

First test the public API directly:

- `/exec/place_memos`
- fallback `/exec?resource=place_memos`

Expected:
- `success: true`
- active PlaceMemo rows returned
- `active=false` rows are not returned
- JSONP callback still works

Then test Traveler:
- Today shows memo under the correct Place
- Map Place card shows memo
- Trip view, when reachable in current UI, shows memo
- `sort_order` is respected
- no memo creates a new map marker
- refresh retrieves newest memo data
- Safari / installed PWA remain functional

Only after this passes should P14.3 be marked PASS.

## 8. Important branches / PR history

Relevant merged frontend PRs:
- PR #3: P14.2 Admin PlaceMemos UI → merged to main
- PR #4: P14.3 Traveler PlaceMemo rendering → merged to main

Relevant Apps Script source branch:
- `p10-admin-api`: historical/current P10 source baseline
- `p14-place-memos-backend`: P14 Admin backend source work

Important: these backend branch files are **not equivalent to GitHub main production source-of-truth** because Apps Script is currently manually synchronized/deployed. Always verify the live Apps Script project before backend edits.

## 9. Do not mix into P14 validation

Do not currently:
- consolidate `admin.html` and `admin-p11.html`
- split all JS/CSS
- replace framework/stack
- move to React/Firebase/Supabase
- change OAuth callback URI
- delete `p9-auth-poc.html`
- merge old rollback PR #1
- modify Members/session format unless required for a separate phase
- delete legacy Admin rollback files

Those are later cleanup tasks after P14 PASS.

## 10. Immediate next action

Current next action is exactly one thing:

**Update and redeploy the public `Travel Planner` Apps Script to expose active `place_memos`, then validate P14.3 on the production Traveler.**
