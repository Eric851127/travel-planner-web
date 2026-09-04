# P10 Admin API Layer — historical / diagnostics

Status: **P10 COMPLETE**. This document is retained for recovery, audit, and regression diagnostics.

The active product no longer uses this page as a normal workflow. Production Admin is served from GitHub Pages and calls the protected Apps Script Admin API.

## Important safety boundary

`gate_roundtrip` and `p10RunSelfTests()` are **TEST-ONLY** diagnostics.

- `gate_roundtrip` creates temporary `P10-GATE-*` rows across the six Admin entities.
- It performs create/update/readback/delete and best-effort cleanup.
- Do not call it from normal Admin UI or user flows.
- Run it only when intentionally validating the P10 API after backend changes.

## Historical isolated install

P10 was installed into the same isolated Apps Script project that passed P9.4/P9.5. The production legacy Apps Script Admin project was intentionally left untouched during P10.

Files:

- `Router.gs`
- `Validators.gs`
- `Gate.gs`

The P9 `Code.gs` remained the authentication/session authority and routed:

```js
if (mode === 'admin_api') return p10AdminApi_(e);
```

## Final verified self-test

The final P10 self-test expectation after place-category alignment was:

```json
{
  "phase": "P10-admin-api",
  "ok": true,
  "passed": 9,
  "total": 9
}
```

## Final live gate

Diagnostics page:

`https://eric851127.github.io/travel-planner-web/p10-admin-api.html`

The final CRUD roundtrip passed all six entities and completed cleanup successfully.

## Current architecture

Production path:

```text
GitHub Pages Traveler / Admin UI
        ↓
Apps Script protected Admin API
        ↓
Google Sheets
```

Identity is established through Google OAuth/OpenID Connect. Authorization is re-derived from `Members.active` and `Members.admin_access` on protected session checks.

## Historical boundaries

P10 intentionally did not modify the production legacy Apps Script Admin UI. That legacy UI is now deprecated but retained as a fallback during post-migration stabilization.
