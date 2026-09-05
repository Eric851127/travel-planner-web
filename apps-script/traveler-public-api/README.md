# Traveler public API source snapshot

Live Apps Script project: `Travel Planner`

This project is separate from the Admin P9/P10 backend. It serves anonymous read-only JSON/JSONP to the Traveler UI.

At the 2026-09-05 sync, the live production project contains one `Code.gs` and does not yet expose `place_memos`.

Canonical snapshot file:
- `Code.current-production.gs`

Pending P14.3 change:
- add `PlaceMemos` as public resource
- expose only approved memo fields
- default-filter `active === true`
- sort by `place_id`, `sort_order`, `title`, `id`
- normalize `sort_order` numerically

After that change is deployed and validated, rename/promote the updated source to canonical `Code.gs` and update `docs/CURRENT_PROJECT_STATUS.md`.

Do not move auth/session/Admin write code into this project.
