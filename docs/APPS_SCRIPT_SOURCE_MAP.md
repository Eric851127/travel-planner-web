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

Files:
- `Code.branch-base.gs`
- `Router.gs`
- `Validators.gs`
- `Gate.gs`
- `PlaceMemos.gs`
- `README.md`

### Important limitation

GitHub does **not** currently contain a verbatim full copy of the live production root `Code.gs` for this Apps Script project.

`Code.branch-base.gs` is an older branch-base snapshot and is missing the production `doPost(e)` route:

```js
if (mode === 'admin_api') return p10AdminApi_(e);
```

Therefore:
- do not rename `Code.branch-base.gs` to `Code.gs`
- do not paste it over production as-is
- for the root auth/session entry file, the live `Travel Planner P9 Auth PoC` project remains authoritative until a verbatim production snapshot is committed
- `Router.gs`, `Validators.gs`, `Gate.gs`, and `PlaceMemos.gs` are the canonical GitHub snapshots for the deployed P10/P14 protected Admin behavior

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

`README.md` inside this directory is descriptive documentation only; when it conflicts with this file or `docs/CURRENT_PROJECT_STATUS.md`, this source map plus current GitHub main wins.

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
3. For Admin P10/P14 modules, `apps-script/admin-backend/Router.gs`, `Validators.gs`, `Gate.gs`, and `PlaceMemos.gs` are canonical snapshots.
4. For the Admin root P9 auth/session `Code.gs`, the live Apps Script project remains authoritative until a verbatim copy is committed.
5. Historical feature branches, PRs, and files under `snapshots/` are not production source-of-truth.

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
