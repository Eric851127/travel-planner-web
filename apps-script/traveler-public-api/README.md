# Traveler public API

Live Apps Script project: `Travel Planner`

Purpose: anonymous read-only JSON / JSONP API for the Traveler UI.

This project is intentionally separate from the protected Admin P9/P10 backend.

## Canonical source

Current canonical GitHub source:

`Code.gs`

It includes:
- itinerary
- hotels
- flights
- transport
- reservations
- places
- place_memos
- members
- P15.1 `traveler_bootstrap`

## Historical snapshot

`Code.current-production.gs` is retained only as an older comparison/rollback snapshot from before the current P14/P15 public API state.

Despite its filename, it is **not** the current source-of-truth.

Do not deploy it over the live project unless performing an explicit rollback with a known target version.

## Rules

- Traveler reads use this public API, not the protected Admin endpoint.
- Keep all operations read-only.
- Expose only approved public fields.
- `place_memos` must default-filter inactive rows.
- Do not move OAuth/session/Admin write code into this project.
- Before changing production, update `Code.gs` in GitHub main and document deployment state in `docs/CURRENT_PROJECT_STATUS.md`.
