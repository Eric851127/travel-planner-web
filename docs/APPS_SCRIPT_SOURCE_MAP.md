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

Canonical GitHub source in `main`:

- `apps-script/p9-auth-poc/Code.gs`
- `apps-script/p10-admin-api/Router.gs`
- `apps-script/p10-admin-api/Validators.gs`
- `apps-script/p10-admin-api/Gate.gs`
- `apps-script/p10-admin-api/PlaceMemos.gs`
- `apps-script/p10-admin-api/INSTALL.md`

Important:
- these files belong to the SAME live Apps Script project
- `Code.gs` owns P9 auth/session entry points
- `Router.gs` owns P10 action routing/bootstrap
- `Validators.gs` owns CRUD validation/helpers
- `Gate.gs` owns P10 test gate
- `PlaceMemos.gs` owns P14 memo validation
- do not add Traveler anonymous read responsibilities here

## 2. Traveler public read API — `Travel Planner`

Live role:
- anonymous GET
- JSON / JSONP
- read-only Sheet access
- resource allowlist
- filter / sort
- public field whitelist

Canonical GitHub source location:

- `apps-script/traveler-public-api/Code.gs`

At the time this map was created, the live production `Travel Planner` code had been supplied in chat and did NOT yet include `place_memos`.

P14.3 requires the public `Travel Planner` `Code.gs` to add `place_memos` to:
- `CONFIG.RESOURCES`
- `PUBLIC_FIELDS`
- allowed filters
- sorting
- numeric normalization for `sort_order`
- default `active === true` filtering

## 3. Source-of-truth rule

From now on:

1. GitHub `main` is the canonical code archive.
2. Before changing Apps Script production, update the matching source under `apps-script/` in `main`.
3. After manual Apps Script deployment, record the deployment status in `docs/CURRENT_PROJECT_STATUS.md`.
4. Feature branches are historical/change branches only; they must not be treated as current production by themselves.
5. `apps-script/admin/` remains legacy rollback code and is NOT the current Admin backend.

## 4. Explicit exclusions

Do not copy `apps-script/p10-admin-api/PublicRead.gs` into the canonical Admin source set. That file came from an incorrect intermediate design that tried to expose Traveler memo reads from the Admin P9/P10 endpoint. The correct Traveler read path is the separate `Travel Planner` public read-only Apps Script.
