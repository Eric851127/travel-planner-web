# P14 Place Memos

## Goal

Keep `Places` as real, schedulable locations while storing food, shopping, note and reservation reminders as child records.

## Data model

New Google Sheet: `PlaceMemos`

Columns:

- `id` — memo ID, planned format `PM###`
- `place_id` — required FK to `Places.id`
- `type` — `food | shopping | note | reservation`
- `title` — short traveler-facing label
- `note` — optional details
- `priority` — `high | normal | low`
- `active` — visibility flag
- `sort_order` — display order within the parent place

The existing `Places` schema is intentionally unchanged.

## Product contract

A Place is something that can reasonably answer: "When are we going there?"

A Place Memo answers: "Once we're there, what should we eat, buy, remember, or reserve?"

Examples:

- `函館朝市` -> Place
  - `現釣魷魚` -> food memo
- `六花亭` -> Place
  - `蘭姆酒葡萄夾心餅乾` -> shopping memo
- `新千歲機場` -> Place
  - `2F 北連物產` -> shopping memo
  - `Pasco 麵包` -> food memo

## Planned rollout

### P14.1 Data model

- Add `PlaceMemos` sheet.
- Add schema metadata and validation.
- Do not alter existing Place rows or API behavior.

### P14.2 Admin

- Load place memos in Admin bootstrap.
- Edit child memos from the Place editing experience rather than creating a separate top-level management domain.
- Add protected `save_place_memo` / `delete_place_memo` actions.
- Re-check `Places.id` on every write.

### P14.3 Traveler

- Add read-only `place_memos` resource.
- Render active memos below the parent Place in Today / Trip / Map surfaces where useful.
- Suggested labels: food, shopping, note, reservation.
- Keep map pins based on Places only; memos never create map pins by themselves.

## Safety / rollout constraint

The production signed-session Apps Script API source used by P9/P10 is not currently stored in this GitHub repository. The files under `apps-script/admin/` are legacy rollback code and must not be treated as the production API source.

Therefore P14.2/P14.3 must not be enabled in GitHub Pages until the production Apps Script API is updated and deployed with `PlaceMemos` support. This avoids shipping a Traveler/Admin build that calls a resource or action the deployed endpoint does not understand.
