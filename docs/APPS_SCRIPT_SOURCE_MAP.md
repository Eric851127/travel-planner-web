# Apps Script Source Map

Functional baseline commit: `55fd670eb4a2baa33e3d09ee12affad6e56c58be`

This file defines which source in GitHub `main` corresponds to each live Google Apps Script project.

## 1. Admin backend — `Travel Planner P9 Auth PoC`

Live role:
- Google OAuth / P9 authentication
- signed Travel Planner session
- session check / logout / revoke
- Members authorization and Admin re-check
- protected P10 Admin API
- P14 PlaceMemo Admin CRUD

Canonical GitHub directory:

`apps-script/admin-backend/`

Canonical files:
- `Code.gs`
- `Router.gs`
- `Validators.gs`
- `Gate.gs`
- `PlaceMemos.gs`
- `README.md`

### Root source status

`Code.gs` is now the verified live P9 root source supplied from the currently working `Travel Planner P9 Auth PoC` Apps Script project.

It includes the production Admin API route inside `doPost(e)`:

```js
if (mode === 'admin_api') return p10AdminApi_(e);
```

This closes the previous GitHub source-of-truth gap for the P9 auth/session root file.

Historical root snapshots are archived under:

`apps-script/admin-backend/snapshots/`

Current archived snapshot:
- `Code.branch-base.gs`

That snapshot predates the production `admin_api` route and must not be treated as current production source.

Traveler anonymous reads must not be added here.

## 2. Traveler public read API — `Travel Planner`

Live role:
- anonymous GET
- JSON / JSONP
- read-only Sheet access
- resource allowlist
- filtering / sorting
- public field whitelist
- P15.1 `traveler_bootstrap`

Canonical GitHub directory:

`apps-script/traveler-public-api/`

### Canonical source

`Code.gs` is the current canonical source for the Traveler public API in GitHub main.

It includes:
- itinerary
- hotels
- flights
- transport
- reservations
- places
- place_memos
- members
- `traveler_bootstrap`

### Snapshot archive

Historical snapshots live under:

`apps-script/traveler-public-api/snapshots/`

Current archived snapshot:

`Code.pre-p15-bootstrap.gs`

This is the exact historical blob previously named `Code.current-production.gs`. It contains public PlaceMemos support but predates P15.1 `traveler_bootstrap`.

It must **not** be treated as current production source.

## 3. Legacy Apps Script Admin — `apps-script/admin/`

Status: rollback-only legacy code.

It is not the production Admin backend after the P9–P12 migration.

Rules:
- do not route production Traveler/Admin traffic to it
- do not copy its auth model into the current Admin backend
- retain until a separate cleanup decision removes the rollback path
- treat `DEPRECATED.md` as the authority for this directory

## 4. Source-of-truth hierarchy

For normal development:

1. GitHub `main` is the production frontend source and canonical architecture/archive map.
2. For Traveler public Apps Script, `apps-script/traveler-public-api/Code.gs` is canonical.
3. For the protected Admin backend, the source set under `apps-script/admin-backend/` is canonical, including `Code.gs` plus `Router.gs`, `Validators.gs`, `Gate.gs`, and `PlaceMemos.gs`.
4. Files under `snapshots/`, historical feature branches, and historical docs are not production source-of-truth.
5. If a manual Apps Script production edit happens, synchronize GitHub immediately; until synchronization, live production behavior wins for incident recovery.

## 5. Deployment boundaries

Correct architecture:

```text
Traveler GitHub Pages
  -> Travel Planner (public read-only Apps Script)
  -> Google Sheets

Admin GitHub Pages
  -> Travel Planner P9 Auth PoC (P9 auth + P10/P14 protected writes)
  -> Google Sheets
```

Never expose Traveler public reads through the protected Admin endpoint, and never move Admin auth/write behavior into the Traveler public API.
