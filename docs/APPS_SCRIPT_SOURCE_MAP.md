# Apps Script Source Map

This file defines which Apps Script source in GitHub `main` corresponds to each live Google Apps Script project.

## 1. Admin backend — `Travel Planner P9 Auth PoC`

Live role:
- Google OAuth / P9 auth
- signed session
- session check / logout
- Members authorization
- protected P10 Admin API
- PlaceMemos Admin CRUD

Canonical GitHub location:

`apps-script/admin-backend/`

Files:
- `README.md`
- `Code.branch-base.gs`
- `Router.gs`
- `Validators.gs`
- `Gate.gs`
- `PlaceMemos.gs`

Important known delta:

The historical branch copy of the P9 `Code.gs` is missing this production route inside `doPost(e)`:

```js
if (mode === 'admin_api') return p10AdminApi_(e);
```

Therefore it is deliberately stored as `Code.branch-base.gs`, not as canonical `Code.gs`. Do not paste it over the live project as-is. The live production `Travel Planner P9 Auth PoC` project remains authoritative for the P9 root file until the full production file is committed verbatim.

The P10/P14 files in this directory are the source snapshot used for the deployed Admin CRUD behavior:
- `Router.gs` owns protected routing/bootstrap
- `Validators.gs` owns CRUD validation/helpers
- `Gate.gs` owns P10 test gate
- `PlaceMemos.gs` owns P14 PlaceMemo validation

Do not add Traveler anonymous reads here.

## 2. Traveler public read API — `Travel Planner`

Live role:
- anonymous GET
- JSON / JSONP
- read-only Sheet access
- resource allowlist
- filter / sort
- public field whitelist

Canonical GitHub location:

`apps-script/traveler-public-api/`

Files:
- `README.md`
- `Code.current-production.gs`

`Code.current-production.gs` is the live `Travel Planner` public API source supplied on 2026-09-05 before the P14.3 public memo change. It currently exposes:
- itinerary
- hotels
- flights
- transport
- reservations
- places
- members

It does **not** yet expose `place_memos`.

P14.3 requires adding `place_memos` to:
- `CONFIG.RESOURCES`
- `PUBLIC_FIELDS`
- allowed filters
- sorting
- numeric normalization for `sort_order`
- default `active === true` filtering

After the updated public API is deployed and validated, the updated file should become `apps-script/traveler-public-api/Code.gs` and `Code.current-production.gs` should be retired or renamed as a dated snapshot.

## 3. Source-of-truth rule

From now on:

1. GitHub `main` is the canonical archive and architecture map.
2. Before changing Apps Script production, update the matching source under `apps-script/` in `main` whenever the exact production source is available.
3. After manual Apps Script deployment, update `docs/CURRENT_PROJECT_STATUS.md`.
4. Feature branches are historical/change branches only; never infer production state from a branch alone.
5. When a GitHub source snapshot differs from a live Apps Script project, the difference must be explicitly documented here or in that directory's README.
6. `apps-script/admin/` is legacy rollback code and is NOT the current Admin backend.

## 4. Explicit exclusions

Do not copy `apps-script/p10-admin-api/PublicRead.gs` from old feature branches into the canonical Admin source set. That file came from an incorrect intermediate design that attempted to expose Traveler memo reads from the Admin P9/P10 endpoint.

The correct architecture is:

```text
Traveler GitHub Pages
  -> Travel Planner (public read-only Apps Script)
  -> Google Sheets

Admin GitHub Pages
  -> Travel Planner P9 Auth PoC (P9 auth + P10 protected writes)
  -> Google Sheets
```
