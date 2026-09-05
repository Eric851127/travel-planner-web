# Admin backend

Live Apps Script project: `Travel Planner P9 Auth PoC`

Functional regression baseline commit: `55fd670eb4a2baa33e3d09ee12affad6e56c58be`

This directory is the canonical GitHub source location for the protected Admin backend.

## Canonical source

- `Code.gs` — verified live P9 auth/session root source supplied from the currently working Apps Script project
- `Router.gs` — protected P10 Admin API router/bootstrap, including PlaceMemos actions
- `Validators.gs` — CRUD validators and Sheet helpers
- `Gate.gs` — P10 diagnostic CRUD/self-test gate
- `PlaceMemos.gs` — P14 PlaceMemo validation

The current `Code.gs` includes the production Admin API bridge inside `doPost(e)`:

```js
if (mode === 'admin_api') return p10AdminApi_(e);
```

That route connects the P9 auth/session root to `Router.gs` while preserving server-side session and Members authorization checks.

## Historical snapshots

Historical root snapshots live under:

`apps-script/admin-backend/snapshots/`

Current archived snapshot:
- `Code.branch-base.gs`

It predates the production `admin_api` route and must not be deployed as the current root file.

## Source-of-truth rule

For normal development, the source set in this directory is the canonical GitHub representation of the protected Admin backend.

A manual Apps Script deployment can still drift from GitHub. Whenever production is changed directly in Apps Script, synchronize the matching GitHub source before or immediately after deployment and update `docs/CURRENT_PROJECT_STATUS.md` when behavior changes.

Do not add Traveler anonymous reads to this project. Traveler public reads belong to the separate `Travel Planner` public API under `apps-script/traveler-public-api/`.
