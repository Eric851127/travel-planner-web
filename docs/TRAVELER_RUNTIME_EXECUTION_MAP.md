# Traveler Runtime Execution Map

Functional regression baseline commit: `55fd670eb4a2baa33e3d09ee12affad6e56c58be`
Phase A/B/C consolidation verified against `main` on 2026-09-05.

This document records the current Traveler runtime ownership after the cleanup consolidation.

## 1. Loader contract

`index.html` dynamically loads scripts sequentially in this order:

```text
1. app.js
2. p7network.js
3. p4.js
4. p7.js
5. p7maps-shared.js
6. p7map.js
7. p7today.js
8. p8.js
9. p14-place-memos-traveler.js
10. p16-runtime-core.js
```

`index.html` sets:

```js
window.TRAVEL_PLANNER_DEFER_INITIAL_RENDER = true;
```

before loading runtime files. After all files load it sets the flag to `false` and calls:

```js
await renderCurrent(false);
```

`p16-runtime-core.js` is intentionally loaded last so it is the explicit final owner of core runtime functions.

## 2. Core ownership after Phase C

### `jsonp`

Owner: `p7network.js`

Responsibility:
- resilient JSONP transport
- timeout handling
- callback cleanup
- cache-busting request marker

`p7network.js` no longer defines resource `api()`.

### `api`

Final owner: `p16-runtime-core.js`

Current production request contract remains the previously effective P4 contract:

```text
GET <Apps Script exec URL>?resource=<resource>&...
```

Behavior preserved:
- group values expand from `ours` / `friends` to `<group>,all`
- `_ts` request cache busting
- in-memory `state.cache`
- JSONP transport through the current global `jsonp`
- 18-second API-level JSONP timeout request

Phase C does not switch production back to the dormant P15 bootstrap adapter.

### `ensureDates`

Final owner: `p16-runtime-core.js`

Behavior preserved from the previously effective P7 implementation:
- read itinerary dates through current `api()`
- unique + sorted date list
- preserve a user-selected valid date
- otherwise select `travelPlannerSmartTripDate(state.dates)`

### `bindDateControls`

Final owner: `p16-runtime-core.js`

It uses the original `app.js` binding as its base and adds the existing P7 user-selection marker:

```text
state.__dateSelectedByUser = true
```

No wrapper chain remains.

### `renderCurrent`

Final owner: `p16-runtime-core.js`

It dispatches at call time to:
- `renderToday`
- `renderTrip`
- `renderBookings`
- `renderMap`
- `renderMore`

It retains the existing retry UI and clears `state.cache` before a forced retry. It also clears the PlaceMemo runtime cache when available.

## 3. Renderer ownership

```text
renderToday     -> p7today.js
renderTrip      -> p14-place-memos-traveler.js
renderBookings  -> p4.js
renderMap       -> p7map.js
renderMore      -> p8.js
renderCurrent   -> p16-runtime-core.js
```

PlaceMemo rendering is native to Today / Trip / Map renderers. The old P14 render-wrapper and post-render DOM decorator chain has been removed.

## 4. Shared helper ownership

### Smart date / display labels

`p7.js` now owns helpers only:
- `window.travelPlannerSmartTripDate`
- `window.travelPlannerGroupLabel`
- legacy text relabel observer

It no longer overrides `ensureDates` or `bindDateControls`.

### Google Maps

`p7maps-shared.js` owns:
- storage key `travelPlanner.googleMaps.v1`
- settings read/save/clear
- Google Maps JavaScript API loader
- coordinate parsing/validation
- place search URL
- directions URL

Consumers:
- `p7map.js`
- `p7today.js`
- `p8.js`

### PlaceMemo

`p14-place-memos-traveler.js` owns:
- `window.TRAVEL_PLANNER_PLACE_MEMOS`
- memo fetch/cache/sort/html helpers
- PlaceMemo styles
- native Trip renderer

## 5. P15 bootstrap status after Phase C

`p15-bootstrap.js` remains in the repository for historical comparison and future deliberate architecture work, but is no longer loaded by `index.html` and is no longer part of the PWA app shell.

Reason:
- before Phase C, its `api` and `ensureDates` overrides were themselves overwritten later by P4/P7
- `TRAVEL_PLANNER_BOOTSTRAP` had no production consumer
- reactivating it by moving load order previously caused an `API 載入失敗` regression

Therefore P15 bootstrap is **dormant / non-runtime**. Do not re-add it to the production loader as a cleanup-only change.

## 6. Effective production composition

```text
jsonp                      -> p7network.js
api                        -> p16-runtime-core.js
ensureDates                -> p16-runtime-core.js
bindDateControls           -> p16-runtime-core.js
renderCurrent              -> p16-runtime-core.js
travelPlannerSmartTripDate -> p7.js
travelPlannerGroupLabel    -> p7.js
TRAVEL_PLANNER_MAPS        -> p7maps-shared.js
TRAVEL_PLANNER_PLACE_MEMOS -> p14-place-memos-traveler.js
renderToday                -> p7today.js
renderTrip                 -> p14-place-memos-traveler.js
renderBookings             -> p4.js
renderMap                  -> p7map.js
renderMore                 -> p8.js
```

This replaces the old patch-on-patch core ownership contract.

## 7. Google Cloud / OAuth external contract

Phase C does not require Google Cloud Console changes.

Unchanged external contracts:
- GitHub Pages origin/domain
- Maps API key restrictions / website referrers
- enabled Maps JavaScript API
- Map ID
- OAuth client
- Admin OAuth callback path
- Admin Apps Script deployment URL
- Traveler public Apps Script deployment URL

If future frontend cleanup proposes changing an origin, callback path, OAuth client, Maps API restriction/referrer, Map ID, or Apps Script deployment contract, stop before implementation and inform the project owner first.

## 8. Regression policy

If any Traveler cleanup regression appears, compare behavior against:

`55fd670eb4a2baa33e3d09ee12affad6e56c58be`

Phase C must preserve the effective production behavior from that baseline even though ownership and file responsibilities are now cleaner.
