# Diagnostics and Support Pages

Functional baseline commit: `55fd670eb4a2baa33e3d09ee12affad6e56c58be`

This document classifies diagnostic/support pages that still live in the repository root. They are intentionally kept in place for now to avoid breaking known URLs or OAuth/session behavior during cleanup.

## Production-required

### `p9-auth-poc.html`

Role: **production login / OAuth callback page**.

This file is not a PoC in practice anymore despite its historical filename.

It is used by the current Admin login flow and must remain at its current path unless a dedicated OAuth callback migration is performed.

Additional reason to keep it stable:
- `sw.js` includes it in the PWA app shell
- Admin login/return flow expects this route
- OAuth redirect URI/path semantics must not change as part of repository cleanup

Do not move, rename, or delete this file during ordinary cleanup.

## Diagnostics-only

### `p9-auth-diagnostics.html`

Role: engineering diagnostics for:
- P9 Apps Script transport
- session lifecycle
- protected API probe
- auth/session troubleshooting

Not a production Admin entrypoint.

It is not currently part of the PWA app shell.

### `p10-admin-api.html`

Role: engineering diagnostics for:
- protected Admin API bootstrap
- existing session inspection
- TEST-ONLY CRUD gate / roundtrip

Not a production Admin entrypoint.

It is not currently part of the PWA app shell.

The CRUD gate may temporarily create and clean up `P10-GATE-*` rows, so it must not be treated as a normal user-facing tool.

## Cleanup policy

For the current cleanup phase:

- keep all three files at their existing root paths
- classify them clearly instead of moving them
- do not add diagnostics pages to production navigation
- do not change their endpoint/session storage semantics

A future repository-layout migration may move diagnostics-only pages into `diagnostics/`, but only after one of these is in place:

1. compatibility redirects/stubs at the old paths, or
2. confirmation that no external bookmarks/workflows rely on those URLs.

The production-required `p9-auth-poc.html` should remain at its current callback path unless the Google OAuth redirect configuration and Admin login flow are migrated together.
