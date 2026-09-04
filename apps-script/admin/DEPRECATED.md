# Legacy Apps Script Admin — DEPRECATED

Status: **deprecated fallback only**.

The Apps Script-hosted Admin UI in this directory is no longer the production Admin entrypoint after the P9–P12 migration.

## Current production Admin

`https://eric851127.github.io/travel-planner-web/admin.html`

Current path:

```text
Traveler PWA / GitHub Admin UI
        ↓
Protected Apps Script Admin API
        ↓
Google Sheets
```

## Why this legacy Admin remains

This implementation is intentionally retained as a rollback / recovery fallback during post-migration stabilization. Do not delete it or change its authorization semantics casually.

Its historical authorization path uses Apps Script active-user identity plus the `Members` sheet. The new production Admin uses Google OAuth/OpenID Connect, Travel Planner session verification, and `Members.active` + `Members.admin_access` authorization on protected calls.

## Rules

- Do not link the production Traveler Edit button back to this legacy Admin unless performing an explicit rollback.
- Do not remove the legacy Admin until a separate cleanup decision confirms the fallback is no longer required.
- Do not copy secrets or session tokens into GitHub.
- Preserve the legacy implementation as a known-good rollback baseline.

Deprecated as part of P12 production cutover and stabilization.
