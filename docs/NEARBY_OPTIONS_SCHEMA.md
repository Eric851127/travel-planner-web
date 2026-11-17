# Nearby options: backward-compatible data contract

This feature is read-only and **off by default**. It does not mutate, create, or migrate any Google Sheet, booking, or Apps Script deployment. Existing Itinerary, Places, and PlaceMemos data remains valid.

## Two different concepts

- `PlaceMemos` stays a general reminder attached to a Place, repeated wherever that Place appears.
- An itinerary option is attached to one **Itinerary ID**, not to a date, title, or region. It represents a possible nearby stop or alternative, never a confirmed reservation or a mandatory extra stop.

No code parses legacy free-text `notes` to infer structured options. A recommendation written in a note is not silently promoted to a selected destination.

## Optional resource prepared in this branch (not deployed)

`itinerary_options` (proposed Sheet name `ItineraryOptions`):

| Field | Meaning |
| --- | --- |
| id | Unique `IO` plus at least three digits |
| itinerary_id | Required existing `Itinerary.id`; inherits date and group |
| candidate_place_id | Required existing `Places.id`; names/address/maps are resolved from Places |
| relation_type | `nearby` or `alternative`; food/shop classification belongs to the candidate Place, not this relationship |
| choice_set | Optional label grouping mutually exclusive alternatives, max 80 chars |
| reason | Why it fits, max 1000 chars; plain text, never HTML |
| suggested_duration_min | Optional positive integer up to 1440; estimate, not a fixed time |
| detour_note | Plain-language walking/detour qualifier, max 300 chars; not an invented route duration |
| priority | `high`, `normal`, `low`; default normal |
| active | Explicit TRUE/1 enables; false/missing hides |
| sort_order | Integer 0–9999; default 10 |

The public API source in this branch includes the optional resource mapping, strict field allowlist, FK/enum checks, and additive bootstrap field. Missing or malformed optional sheets return an empty list. Production rollout still requires separately authorized Sheet creation/import and verified backend deployment **before** enabling the resource. The protected Admin UI/backend does not yet provide CRUD for this table; do not route writes through the public API. Public fields must exclude private booking/account data. Invalid rows are omitted and missing foreign keys never create phantom places. Duplicate IDs keep the first valid row deterministically.

## Source and runtime API

Load `nearby-options.js` before any renderer that uses it, while preserving relative ordering of the existing Traveler scripts.

1. `window.TRAVEL_PLANNER_OPTIONS_DATA` array, when explicitly supplied, is a local/offline preview fixture. It takes precedence; do not silently install demo data in production.
2. Otherwise, `window.TRAVEL_PLANNER_OPTIONS_CONFIG = { optionsResource: 'itinerary_options' }` opts into the already-deployed read-only API resource.
3. Without either, `load()` returns `[]` without a network call. No inference from API errors or other configuration enables the new resource.

`window.TRAVEL_PLANNER_OPTIONS` exposes:

- `load(force=false)`: Promise of normalized active rows. Shares pending reads, caches success/empty/failure, force reloads. Resource failure is non-fatal to the main itinerary.
- `clear()`: invalidates cache and in-flight results; call from the normal refresh path.
- `forItem(id)`: normalized cached rows for one parent, ordered by sort_order, priority, then ID.
- `resolve(items, places)`: Map of parent itinerary ID to valid resolved rows. Each adds `parent_item`, `candidate_place`, `date`, `group`. Pass **already filtered current-view items** to prevent choices leaking between groups/dates. Does not mutate either input.

Renderers must escape all text, use existing safe Maps URL helpers for links, and keep options separate from primary numbered route stops, map pins, bookings and travel-time totals. `choice_set` groups choices; it does not authorize selection. Empty/missing options should render no empty box. Old PlaceMemos rendering is independent and remains intact.

## Verification

`node --test tests/nearby-options.test.cjs` covers disabled/no-network defaults, invalid/inactive rows, duplicate IDs, FK and filtered-parent isolation, immutable input behavior, explicit resource/cache/refresh behavior, unsupported-resource failure, and stale asynchronous result invalidation. UI integration and production deployment are separate verification stages.
