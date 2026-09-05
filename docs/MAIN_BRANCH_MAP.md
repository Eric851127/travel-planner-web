# Main Branch Map

Baseline: P15.3

This document classifies the files in GitHub `main` by runtime responsibility. The goal is to prevent cleanup work from accidentally deleting or reordering files that still participate in production.

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

The root also contains historical test and diagnostic pages from P9/P10/P13-era work.

Examples include:
- `p9-auth-poc.html`
- `p9-auth-diagnostics.html`
- `p10-admin-api.html`

Rules:
- `p9-auth-poc.html` remains part of the OAuth/login callback flow and is not safe to delete
- diagnostic/test pages should be treated as support tooling unless separately proven unused
- do not expose secrets or session tokens in these pages

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

Historical implementation documents may remain for migration context but do not override the four files above.

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
- historical P* filenames mix runtime and diagnostics
- historical docs may describe earlier phase state
- snapshot filenames can be confused with canonical production source

## 7. Safe cleanup policy

Before deleting, renaming, moving, or consolidating any production-looking file:

1. Check whether `index.html`, `admin.html`, `sw.js`, or another runtime file references it.
2. Check `docs/MAIN_BRANCH_MAP.md` and `docs/APPS_SCRIPT_SOURCE_MAP.md`.
3. Confirm the live Apps Script deployment/source role if backend-related.
4. Separate architecture cleanup from behavior fixes.
5. Preserve a known-good production baseline commit before runtime refactors.
