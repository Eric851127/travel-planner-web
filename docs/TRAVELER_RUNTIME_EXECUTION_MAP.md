# Traveler Runtime Execution Map

Functional regression baseline commit: `55fd670eb4a2baa33e3d09ee12affad6e56c58be`
P16 runtime consolidation verified on 2026-09-05.

This document records the current Traveler runtime ownership after P16 cleanup.

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

## 2. Core ownership

### `jsonp`

Owner: `p7network.js`

Responsibility:
- resilient JSONP transport
- timeout handling
- callback cleanup
- cache-busting request marker

`p7network.js` does not own resource `api()`.

### `api`

Final owner: `p16-runtime-core.js`

Production request contract:

```text
GET <Apps Script exec URL>?resource=<resource>&...
```

Behavior preserved:
- group values expand from `ours` / `friends` to `<group>,all`
- `_ts` request cache busting
- in-memory `state.cache`
- JSONP transport through current global `jsonp`
- API timeout contract remains unchanged

### `ensureDates`

Final owner: `p16-runtime-core.js`

Behavior:
- read itinerary dates through current `api()`
- unique + sorted date list
- preserve a user-selected valid date
- otherwise select `travelPlannerSmartTripDate(state.dates)`

### Interaction ownership

Final owner: `p16-runtime-core.js`

P16.1 consolidates:
- date arrows / date select
- general group filters
- Today group filters through delegation
- bottom navigation
- refresh
- retry
- interaction Promise scheduling

This removed the first-click / double-click interaction race that previously appeared after initial load or view switching.

### `renderCurrent`

Final owner: `p16-runtime-core.js`

It dispatches at call time to:
- `renderToday`
- `renderTrip`
- `renderBookings`
- `renderMap`
- `renderMore`

It retains retry UI and clears `state.cache` before a forced retry. It also clears the PlaceMemo runtime cache when available.

## 3. Renderer ownership

```text
renderToday     -> p7today.js
renderTrip      -> p14-place-memos-traveler.js
renderBookings  -> p4.js
renderMap       -> p7map.js
renderMore      -> p8.js
renderCurrent   -> p16-runtime-core.js
```

PlaceMemo rendering is native to Today / Trip / Map renderers.

P16.3 Mobility integration adds:
- Flight + Transport unified as Traveler mobility segments
- Today view `今日移動`
- Trip view per-day mobility sections
- explicit `transport_id` relation rendering when present
- Flight and Transport schemas remain separate

## 4. Shared helper ownership

### Smart date / display labels

`p7.js` owns helpers:
- `window.travelPlannerSmartTripDate`
- `window.travelPlannerGroupLabel`
- legacy text relabel observer

It does not override final core ownership.

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

## 5. Removed dormant P15 bootstrap

`p15-bootstrap.js` was removed from `main` during P16.4.

Before removal it was already:
- not loaded by `index.html`
- not part of the PWA app shell
- not consumed by production runtime

Git history remains the archive for comparison if needed.

Reason it must not be reintroduced casually:
- earlier attempts to reactivate its adapter by changing load order caused a Traveler `API 載入失敗` regression
- current production ownership is explicitly consolidated elsewhere

## 6. Effective production composition

```text
jsonp                      -> p7network.js
api                        -> p16-runtime-core.js
ensureDates                -> p16-runtime-core.js
bindDateControls           -> p16-runtime-core.js
bindFilters                -> p16-runtime-core.js
nav / refresh / retry      -> p16-runtime-core.js
Today group interaction    -> p16-runtime-core.js via p7today delegation
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

## 7. Google Cloud / OAuth external contract

P16 does not require Google Cloud Console changes.

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

P16 cleanup must preserve the effective production behavior from that baseline even though ownership and file responsibilities are now cleaner.
