# Travel Planner Admin Migration — COMPLETE

Date: 2026-09-04

Status: **P9–P12 COMPLETE**

## Final production architecture

```text
GitHub Pages PWA
├── Traveler UI
└── Admin UI (`admin.html`)
        ↓ POST application/x-www-form-urlencoded
Apps Script protected API
        ↓
Google Sheets
```

Authentication and authorization are intentionally separated:

- Google OAuth / OpenID Connect establishes identity.
- Travel Planner signed session establishes the short-lived application session.
- `Members.active` and `Members.admin_access` are re-checked for protected Admin authorization.

The browser does not assert its own email or Admin role.

## Production entrypoints

Traveler:

`https://eric851127.github.io/travel-planner-web/`

Admin:

`https://eric851127.github.io/travel-planner-web/admin.html`

`admin.html` is the stable production Admin entry. The validated P11 implementation file remains available behind that stable entry during stabilization.

## Authentication callback

OAuth currently returns to:

`p9-auth-poc.html`

The filename is historical because it is already registered as the OAuth redirect URI. It is now treated as an **authentication callback / diagnostics bridge**, not the normal user-facing Admin page.

When Admin initiates login:

```text
admin.html
→ p9-auth-poc.html
→ Google OAuth
→ p9-auth-poc.html
→ auth_finish
→ session_check
→ admin.html
```

Return-to-Admin is restricted to same-origin Admin paths before redirecting to the stable `admin.html` entry.

## Phase completion

### P9 — Authentication Foundation — COMPLETE

Verified:

- OAuth authorization-code + PKCE flow
- Google tokeninfo ID-token validation
- Members authorization lookup
- signed Travel Planner session
- session expiry / revocation / logout
- protected cross-origin POST transport
- no bearer session token in URL

### P10 — Admin API Layer — COMPLETE

Verified:

- protected Admin API router
- bootstrap
- six entity CRUD paths
- backend validation
- foreign-key validation
- reference protection
- Members authorization re-check
- stable JSON response contract
- live six-entity CRUD roundtrip with cleanup

`gate_roundtrip` and `p10RunSelfTests()` are **test-only diagnostics**.

Diagnostics page:

`p10-admin-api.html`

The page is retained for regression testing and is not a production Admin workflow.

### P11 — Admin UI Migration — COMPLETE

Verified:

- GitHub Pages Admin UI
- six data tabs
- filters
- create / copy / edit / delete
- mobile full-screen editor
- P10 enum integration
- validation and conflict UX
- session restore
- logout / login
- forbidden UX
- iPhone Safari
- installed iOS PWA

### P12 — Production Cutover / Stabilization — COMPLETE

Verified:

- Traveler Edit now enters GitHub Pages Admin
- same-origin Admin navigation
- PWA cache/version cutover
- no Apps Script Admin URL setup required in production UI
- stable `admin.html` entry
- OAuth login callback returns to Admin
- legacy Apps Script Admin retained as rollback fallback

## Legacy Apps Script Admin

Directory:

`apps-script/admin/`

Status: **DEPRECATED — fallback only**.

See `apps-script/admin/DEPRECATED.md`.

It remains intentionally untouched as a known-good rollback baseline. Production Traveler no longer links to it.

## Diagnostics and test-only surfaces

### `p9-auth-poc.html`

Purpose now:

- OAuth callback bridge
- session diagnostics
- transport diagnostics

Not the normal Admin entry.

### `p10-admin-api.html`

Purpose now:

- P10 bootstrap diagnostics
- explicit test-only CRUD roundtrip

`gate_roundtrip` creates temporary `P10-GATE-*` rows and should only be run intentionally for backend regression testing.

## Branch status

- `main` — production authority
- `p9-auth-poc` — historical P9 milestone; retained for audit/history
- `p10-admin-api` — historical P10 milestone and diagnostic source; retained for audit/history
- `p11-admin-ui` — completed; aligned to production completion state
- `p12-cutover` — completed; aligned to production completion state

The repository connector used during cleanup does not expose branch deletion, so historical branches are retained rather than destructively removed.

## Pull request status

PR #1, originally `P9.1 isolated Admin authentication PoC`, is closed without merge.

Reason:

- it represents an earlier isolated proof-of-concept state;
- the evolved P9–P12 implementation already exists on `main`;
- merging the historical branch would be incorrect.

## Rollback

Primary rollback principle:

- preserve the legacy Apps Script Admin as the known-good fallback;
- do not change Sheets schema merely to support rollback;
- restore Traveler Admin navigation only through an explicit rollback decision.

P9–P12 intentionally avoided destructive changes to the legacy Admin while the new architecture was being validated.

## Security invariants

- Never trust browser-supplied email as identity.
- Never trust browser-supplied Admin flags.
- Never put bearer session tokens in URLs.
- Never commit OAuth client secrets, refresh tokens, service-account keys, or fixed Admin secrets to GitHub.
- Re-check `Members.active` and `Members.admin_access` for protected Admin authorization.
- Keep production CRUD authorization server-side.

## Migration result

The original iPhone/PWA problem is resolved:

Before:

```text
Traveler PWA
→ Edit
→ Apps Script-hosted Admin page
→ leaves GitHub/PWA scope
```

After:

```text
Traveler PWA
→ Edit
→ GitHub Pages Admin
→ protected Apps Script API
→ Google Sheets
```

**Migration complete.**
