# Traveler Runtime Execution Map

Functional regression baseline commit: `55fd670eb4a2baa33e3d09ee12affad6e56c58be`
Verified against current `main` during cleanup on 2026-09-05.

This document records the **actual runtime ownership after all Traveler scripts have loaded**. It exists because historical P-numbered scripts patch and replace shared globals in sequence. File names and phase numbers do not reliably indicate final ownership.

## 1. Loader contract

`index.html` dynamically loads scripts sequentially in this exact order:

```text
1. app.js
2. p7network.js
3. p15-bootstrap.js
4. p4.js
5. p7.js
6. p7maps-shared.js
7. p7map.js
8. p7today.js
9. p8.js
10. p14-place-memos-traveler.js
```

`p7maps-shared.js` is a pure shared Maps dependency inserted after `p7.js`. The relative order of the pre-existing production runtime files remains unchanged.

`index.html` sets:

```js
window.TRAVEL_PLANNER_DEFER_INITIAL_RENDER = true;
```

before loading them, then sets it back to `false` and calls:

```js
await renderCurrent(false);
```

after all runtime files load.

The sequence is therefore part of current production behavior.

## 2. Shared global ownership timeline

### `jsonp`

1. `app.js` defines the original JSONP transport.
2. `p7network.js` replaces it with resilient P7.7 JSONP.
3. No later script replaces it.

**Final owner: `p7network.js`.**

### `api`

1. `app.js` defines the original resource API using `config.apiBase + '/' + resource`.
2. `p7network.js` replaces it with retry + persistent-cache behavior.
3. `p15-bootstrap.js` captures the P7.7 implementation as `baseApi`, then replaces `api` with the P15 bootstrap adapter.
4. `p4.js` replaces `api` again with the query-resource implementation using:
   - `new URL(config.apiBase)`
   - `resource=<resource>`
   - group expansion to `<group>,all`
   - `_ts` cache busting

No later script replaces `api`.

**Final global owner: `p4.js`.**

Important consequence:

The P15.1 `api` adapter is **not** the final global `api` in the verified P15.3 load order.

The P15 closure still retains its captured `baseApi` and bootstrap helper functions internally, but ordinary later callers resolving global `api` use the P4 implementation.

### `ensureDates`

1. `app.js` defines the original itinerary-date loader.
2. `p15-bootstrap.js` replaces it with bootstrap-backed date loading.
3. `p7.js` replaces it again with smart-trip-date behavior and reads dates via the then-current global `api` at call time.

No later script replaces `ensureDates`.

**Final owner: `p7.js`.**

Important consequence:

The P15.1 bootstrap-backed `ensureDates` is **not** the final implementation in production.

### `TRAVEL_PLANNER_MAPS`

`p7maps-shared.js` is now the single shared owner for Traveler Google Maps helper behavior:

- storage key `travelPlanner.googleMaps.v1`
- settings read/save/clear
- Google Maps JavaScript API loader promise
- coordinate parsing/validation
- place search URL
- directions URL

Consumers:
- `p7map.js`
- `p7today.js`
- `p8.js`

It does **not** own map rendering or view state.

### `renderToday`

1. `app.js` defines the original Today renderer.
2. `p7today.js` replaces it with the itinerary-first P7.8 / P15.3 flight-card Today renderer.
3. `p14-place-memos-traveler.js` wraps the current `renderToday` to preload/decorate PlaceMemos.

**Final callable: P14 wrapper around `p7today.js` renderer.**

### `renderTrip`

1. `app.js` defines the base Trip renderer.
2. No intermediate script replaces it.
3. `p14-place-memos-traveler.js` wraps it to decorate PlaceMemos.

**Final callable: P14 wrapper around `app.js` Trip renderer.**

### `renderMap`

1. `app.js` defines the base list-style map renderer.
2. `p7map.js` replaces it with Google Maps JavaScript API rendering and shared Maps configuration/runtime helpers.
3. `p14-place-memos-traveler.js` wraps it to decorate PlaceMemos.

**Final callable: P14 wrapper around `p7map.js` renderer.**

### `renderBookings`

1. `app.js` defines the base Bookings renderer.
2. `p4.js` replaces it with member-name lookup and deadline behavior.

**Final owner: `p4.js`.**

### `renderMore`

1. `app.js` defines the original More renderer.
2. `p4.js` replaces it.
3. `p8.js` replaces it again with current P12 Admin cutover / Maps / PWA settings UI.

**Final owner: `p8.js`.**

### `renderCurrent`

1. `app.js` defines the base dispatcher.
2. `p4.js` replaces it with the current error/retry wrapper and dispatcher.
3. No later script replaces it.

Because it resolves renderer globals at call time, it dispatches to the later P7/P8/P14 replacements described above.

**Final owner: `p4.js`.**

### `bindDateControls`

1. `app.js` defines the base date-control binding.
2. `p7.js` wraps it and adds `state.__dateSelectedByUser` tracking.
3. No later script replaces it.

**Final callable: P7 wrapper around `app.js` binding.**

## 3. Effective production composition

After all files load, the important global composition is approximately:

```text
jsonp               -> p7network.js
api                  -> p4.js
ensureDates          -> p7.js
TRAVEL_PLANNER_MAPS  -> p7maps-shared.js
bindDateControls     -> p7.js wrapper(app.js)
renderCurrent        -> p4.js
renderToday          -> p14 wrapper(p7today.js)
renderTrip           -> p14 wrapper(app.js)
renderMap            -> p14 wrapper(p7map.js)
renderBookings       -> p4.js
renderMore           -> p8.js
```

This remains the verified P15.3 behavior boundary plus the Phase A shared-helper consolidation.

## 4. P15 bootstrap reality

`p15-bootstrap.js` is loaded and initializes its closure, snapshot caches, `TRAVEL_PLANNER_BOOTSTRAP`, and captured P7.7 `baseApi`.

However, later scripts replace both globals that P15.1 initially owns:

- `api` is replaced by `p4.js`
- `ensureDates` is replaced by `p7.js`

Therefore do **not** assume that moving P15 later in the load order is harmless. Doing so changes the final API composition and has already caused a production regression (`API 載入失敗`) during an earlier P16.1 attempt.

Any future bootstrap consolidation must be treated as an architecture migration with explicit smoke tests, not a script-order cleanup.

## 5. Google Maps external contract

`p7maps-shared.js` dynamically loads:

```text
https://maps.googleapis.com/maps/api/js
```

using the locally stored Maps API key, and consumers continue to use the same JavaScript Map ID.

Current storage key:

```text
travelPlanner.googleMaps.v1
```

Current code does not require an HTML callback URL for Google Maps.

### Cloud Console rule

Routine JS ownership consolidation does **not** require a Cloud Console change as long as all of these remain unchanged:

- GitHub Pages origin/domain
- Maps API key restrictions / allowed website referrers
- enabled Maps JavaScript API
- Map ID usage
- OAuth client and OAuth redirect path

If a future cleanup proposes any path/origin/callback/client change that could require Google Cloud Console or OAuth configuration changes, stop before implementation and inform the project owner first.

## 6. OAuth / Admin boundary

Traveler runtime cleanup must not casually modify:

- `p9-auth-poc.html`
- Admin OAuth callback path
- OAuth client ID behavior
- `travelPlanner.p9AuthEndpoint.v1`
- `travelPlanner.p9Session.v1`
- Admin Apps Script deployment URL

Those are external/auth contracts and require a separate migration decision.

## 7. Safe consolidation order

Before merging runtime files, use this order:

1. Preserve the current relative order of existing production scripts.
2. Consolidate pure helpers/display functions first.
3. Establish one API adapter only after reproducing the effective P4 request contract and P7.7 resilience behavior.
4. Establish one date-selection owner only after preserving P7 smart-date/user-selection semantics.
5. Consolidate renderers one surface at a time.
6. Keep P14 memo decoration behavior until memos are rendered natively by each final renderer.
7. Change the legacy script list only after the replacement runtime is behavior-equivalent.
8. Smoke-test Safari + installed PWA + Admin navigation before deleting historical runtime files.

Do not combine script consolidation with unrelated P16 UX changes.
