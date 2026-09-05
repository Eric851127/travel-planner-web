# Main Branch Map

Production line: P16 complete
Functional regression baseline commit: `55fd670eb4a2baa33e3d09ee12affad6e56c58be`

This document classifies the files in GitHub `main` by runtime responsibility. Use it before deleting, moving, renaming, or reordering production-looking files.

## 1. Traveler production entry

Primary entry:
- `index.html`

PWA/runtime shell:
- `manifest.webmanifest`
- `sw.js`
- `styles.css`
- `app-icon.svg`

Traveler JavaScript runtime:

```text
app.js
p7network.js
p4.js
p7.js
p7maps-shared.js
p7map.js
p7today.js
p8.js
p14-place-memos-traveler.js
p16-runtime-core.js
```

Current responsibility map:
- `app.js` — base state, DOM helpers, compatibility base definitions
- `p7network.js` — resilient JSONP transport
- `p4.js` — Bookings + legacy More fallback definitions
- `p7.js` — smart-date + group display helpers
- `p7maps-shared.js` — shared Maps settings/loader/URL helpers
- `p7map.js` — Map renderer
- `p7today.js` — Today renderer + mobility presentation
- `p8.js` — current More renderer + PWA/Admin navigation
- `p14-place-memos-traveler.js` — PlaceMemo runtime + Trip renderer + trip mobility presentation
- `p16-runtime-core.js` — final owner for `api`, date/group/nav interactions, refresh/retry, and `renderCurrent`

Detailed ownership/execution map:
- `docs/TRAVELER_RUNTIME_EXECUTION_MAP.md`

### Removed dormant runtime

`p15-bootstrap.js` was removed during P16.4 after verification that it was:
- not loaded by `index.html`
- not included in `sw.js`
- not consumed by production runtime

Git history is the archive if deliberate future comparison is required.

## 2. Admin production entry

Primary entry:
- `admin.html`

Current Admin body/fallback:
- `admin-p11.html`

Admin extension modules:
- `p14-place-memos-admin.js`
- `p16-admin-places-ux.js`
- `p16-admin-mobility-detail.js`

`admin.html` patches `admin-p11.html` at runtime. This is active production behavior and remains intentionally unchanged until a dedicated P17 Admin architecture migration.

P16.3.1 shared bootstrap contract:
- `admin-p11.html` performs the protected bootstrap through its existing flow
- `admin.html` patches successful bootstrap handling to expose `window.TRAVEL_PLANNER_ADMIN_BOOTSTRAP`
- `p16-admin-mobility-detail.js` reads that shared snapshot and does not issue another Apps Script bootstrap

## 3. Authentication / diagnostics pages

Detailed classification:
- `docs/DIAGNOSTICS.md`

### Production-required

- `p9-auth-poc.html`
  - current Admin login page and OAuth callback
  - included in the PWA app shell
  - must remain at its current path unless OAuth callback configuration and login flow are migrated together

Despite its historical `poc` filename, this is production runtime.

### Diagnostics-only

- `p9-auth-diagnostics.html`
  - P9 transport/session/protected-API diagnostics
  - not a production Admin entrypoint

- `p10-admin-api.html`
  - P10 bootstrap and protected CRUD diagnostics
  - includes a TEST-ONLY `gate_roundtrip` flow
  - not a production Admin entrypoint

Diagnostics remain at existing root URLs for compatibility.

## 4. Apps Script source directories

### `apps-script/traveler-public-api/`

Purpose: anonymous Traveler read-only API.

Canonical current source:
- `Code.gs`

Historical comparison snapshot:
- `snapshots/Code.pre-p15-bootstrap.gs`

### `apps-script/admin-backend/`

Purpose: protected Admin authentication and write backend.

Canonical current source set:
- `Code.gs`
- `Router.gs`
- `Validators.gs`
- `Gate.gs`
- `PlaceMemos.gs`

Historical snapshot:
- `snapshots/Code.branch-base.gs`

### `apps-script/admin/`

Legacy rollback-only Apps Script-hosted Admin.

Do not use for current production development.

## 5. Documentation

Documentation index:
- `docs/README.md`

Current authority documents:
- `README.md` — repository orientation and safety rules
- `docs/CURRENT_PROJECT_STATUS.md` — current milestone / production state
- `docs/APPS_SCRIPT_SOURCE_MAP.md` — backend source authority and deployment boundaries
- `docs/MAIN_BRANCH_MAP.md` — runtime file classification
- `docs/TRAVELER_RUNTIME_EXECUTION_MAP.md` — Traveler ownership/load-order contract
- `docs/DIAGNOSTICS.md` — support/diagnostic page classification

Historical milestone documents:
- `docs/history/`

Historical docs do not override current authority documents.

## 6. P16 completion state

- P16.1 Interaction Core / first-click stability: PASS
- P16.2 Admin Places / Itinerary UX: PASS
- P16.3 Mobility Integration: PASS
- P16.3.1 Admin Bootstrap Reliability: PASS
- P16.4 safe repository/runtime cleanup: COMPLETE

## 7. Known technical debt deferred to P17

### Traveler
- `app.js` still contains legacy base implementations overridden by final owners
- active renderer/helper modules retain historical P-numbered filenames
- lifecycle/API adapter formalization remains future architecture work

### Admin
- `admin.html` performs string-patch composition over `admin-p11.html`
- `admin-p11.html` remains a large single-file UI/runtime
- `session_check` followed by protected bootstrap retains some duplicated authorization/read work, intentionally unchanged while stable

### Backend / deployment
- manual Apps Script deployment can drift from GitHub source
- deeper Admin bootstrap caching/read optimization remains deferred

### Compatibility files retained intentionally
- production OAuth callback page
- diagnostics/support pages
- active Admin fallback body
- Apps Script historical snapshots

## 8. Safe cleanup policy

Before deleting, renaming, moving, or consolidating any production-looking file:

1. Check `index.html`, `admin.html`, `admin-p11.html`, and `sw.js` references.
2. Check current authority docs.
3. Confirm Apps Script deployment/source role for backend files.
4. Separate repository/layout cleanup from behavior changes.
5. Compare against functional baseline `55fd670eb4a2baa33e3d09ee12affad6e56c58be` if any regression appears.
6. If cleanup may require Google Cloud Console / OAuth / Maps external configuration changes, stop before implementation and inform the project owner first.
