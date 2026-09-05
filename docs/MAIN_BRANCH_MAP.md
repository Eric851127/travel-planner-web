# Main Branch Map

Baseline: P15.3
Functional regression baseline commit: `55fd670eb4a2baa33e3d09ee12affad6e56c58be`

This document classifies the files in GitHub `main` by runtime responsibility. The goal is to prevent cleanup work from accidentally deleting, moving, renaming, or reordering files that still participate in production.

## 1. Traveler production entry

Primary entry:
- `index.html`

PWA/runtime shell:
- `manifest.webmanifest`
- `sw.js`
- `styles.css`
- `app-icon.svg`

Traveler JavaScript runtime, loaded in verified P15.3 order:

```text
app.js
p7network.js
p15-bootstrap.js
p4.js
p7.js
p7map.js
p7today.js
p8.js
p14-place-memos-traveler.js
```

### Important

The P-numbered filenames are historical, but several are still active production runtime dependencies.

Do not:
- rename them casually
- reorder them casually
- delete them because an older phase number appears obsolete
- merge them during a small bug fix

Their current global override behavior is technical debt to be handled in a dedicated architecture phase.

## 2. Admin production entry

Primary entry:
- `admin.html`

Current Admin UI body:
- `admin-p11.html`

P14 Admin extension:
- `p14-place-memos-admin.js`

`admin.html` currently patches `admin-p11.html` at runtime to add production navigation and the PlaceMemo module. This is active production behavior and should not be consolidated during unrelated work.

## 3. Authentication / diagnostics pages

Detailed classification:
- `docs/DIAGNOSTICS.md`

### Production-required

- `p9-auth-poc.html`
  - current Admin login page and OAuth callback
  - included in the PWA app shell by `sw.js`
  - must remain at its current path unless OAuth callback configuration and login flow are migrated together

Despite its historical `poc` filename, this is production runtime.

### Diagnostics-only

- `p9-auth-diagnostics.html`
  - P9 transport/session/protected-API diagnostics
  - not a production Admin entrypoint
  - not part of the current PWA app shell

- `p10-admin-api.html`
  - P10 bootstrap and protected CRUD diagnostics
  - includes a TEST-ONLY `gate_roundtrip` flow
  - not a production Admin entrypoint
  - not part of the current PWA app shell

For the current cleanup phase, diagnostics-only files remain at their existing root URLs. Classification is safer than moving them before compatibility is established.

## 4. Apps Script source directories

### `apps-script/traveler-public-api/`

Purpose: anonymous Traveler read-only API.

Canonical current source:
- `Code.gs`

Historical comparison snapshot:
- `Code.current-production.gs`

Documentation:
- `README.md`

### `apps-script/admin-backend/`

Purpose: protected Admin auth/write backend source snapshots.

Canonical deployed modules:
- `Router.gs`
- `Validators.gs`
- `Gate.gs`
- `PlaceMemos.gs`

Historical/incomplete root snapshot:
- `Code.branch-base.gs`

The full live production root P9 `Code.gs` is not yet committed verbatim.

### `apps-script/admin/`

Legacy rollback-only Apps Script-hosted Admin.

Do not use for current production development.

## 5. Documentation

Current authority documents:
- `README.md` — repository orientation and safety rules
- `docs/CURRENT_PROJECT_STATUS.md` — current milestone / production state
- `docs/APPS_SCRIPT_SOURCE_MAP.md` — backend source authority and deployment boundaries
- `docs/MAIN_BRANCH_MAP.md` — runtime file classification
- `docs/DIAGNOSTICS.md` — root support/diagnostic page classification

Historical implementation documents may remain for migration context but do not override the authority documents above.

## 6. Known technical debt

### Traveler
- patch-on-patch global overrides
- runtime behavior depends on script load order
- more than one layer defines `api`, `ensureDates`, or render functions
- async render lifecycle has no single owner
- P15 bootstrap intent and actual final global API composition need dedicated verification before refactoring

### Admin
- `admin.html` performs string-patch composition over `admin-p11.html`
- large single-file Admin UI
- full production P9 root `Code.gs` is not committed verbatim

### Repository
- historical P* filenames mix production runtime and diagnostics
- `p9-auth-poc.html` has a misleading historical filename but is production-required
- diagnostics-only pages remain in root to preserve compatibility during cleanup
- historical docs may describe earlier phase state
- snapshot filenames can be confused with canonical production source

## 7. Safe cleanup policy

Before deleting, renaming, moving, or consolidating any production-looking file:

1. Check whether `index.html`, `admin.html`, `admin-p11.html`, `sw.js`, or another runtime file references it.
2. Check `docs/MAIN_BRANCH_MAP.md`, `docs/DIAGNOSTICS.md`, and `docs/APPS_SCRIPT_SOURCE_MAP.md`.
3. Confirm the live Apps Script deployment/source role if backend-related.
4. Separate repository/layout cleanup from behavior fixes.
5. Compare behavior against functional baseline commit `55fd670eb4a2baa33e3d09ee12affad6e56c58be` if any regression appears.
