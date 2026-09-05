# Admin backend source snapshot

Live Apps Script project: `Travel Planner P9 Auth PoC`

This directory is the canonical GitHub location for the protected Admin backend.

Files:
- `Code.branch-base.gs`: P9 auth/session base recovered from the historical backend branch.
- `Router.gs`: P10 protected Admin API router, including PlaceMemos actions.
- `Validators.gs`: P10 validators and Sheet helpers.
- `Gate.gs`: P10 CRUD/self-test gate.
- `PlaceMemos.gs`: P14 PlaceMemo validator.

## Production delta that must not be lost

The live production P9 `Code.gs` supplied during P14 contains this extra route inside `doPost(e)`:

```js
if (mode === 'admin_api') return p10AdminApi_(e);
```

The historical branch copy does not contain that line. Therefore `Code.branch-base.gs` is intentionally NOT named `Code.gs` and must not be pasted over production as-is.

Until the full production `Code.gs` is committed verbatim, the production authority is:
1. the live `Travel Planner P9 Auth PoC` Apps Script project,
2. the previously supplied production Code.gs snapshot,
3. the files in this directory plus the routing delta above.

Do not add Traveler public GET resources to this project. Traveler reads belong to the separate `Travel Planner` public API.
