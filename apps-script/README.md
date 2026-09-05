# Apps Script directory guide

Functional baseline commit: `55fd670eb4a2baa33e3d09ee12affad6e56c58be`

This directory contains source snapshots for multiple Google Apps Script projects. They must not be treated as one deployable project.

## `traveler-public-api/`

Live Apps Script project: `Travel Planner`

Role:
- anonymous Traveler reads
- JSON / JSONP
- read-only Google Sheets access
- public-field whitelist
- P15.1 `traveler_bootstrap`

Canonical source:
- `traveler-public-api/Code.gs`

Historical snapshots:
- `traveler-public-api/snapshots/`

Do not add Admin auth/session/write behavior here.

## `admin-backend/`

Live Apps Script project: `Travel Planner P9 Auth PoC`

Role:
- Google OAuth / session authority
- Members/Admin authorization
- protected P10/P14 CRUD

Canonical module snapshots:
- `Router.gs`
- `Validators.gs`
- `Gate.gs`
- `PlaceMemos.gs`

Important limitation:
- `Code.branch-base.gs` is an older/incomplete root snapshot
- the live production root P9 `Code.gs` remains authoritative until a verbatim copy is committed

Do not add Traveler anonymous reads here.

## `admin/`

Status: legacy rollback only.

This is the old Apps Script-hosted Admin implementation and is not the production Admin after P9–P12 migration.

Read `admin/DEPRECATED.md` before touching it.

## Development rules

1. Never combine the Traveler public API and protected Admin backend into one endpoint.
2. Never infer deployment authority from a filename containing `production`; check `docs/APPS_SCRIPT_SOURCE_MAP.md`.
3. Files under `snapshots/` are archive-only.
4. Do not paste `Code.branch-base.gs` over the live Admin project.
5. Any cleanup that changes behavior must be checked against functional baseline `55fd670eb4a2baa33e3d09ee12affad6e56c58be`.
