# P6 — Planner Admin

## Architecture

The traveler GitHub Pages app remains read-only. Planner writes use a separate Apps Script Admin deployment connected to the same Google Sheet.

Spreadsheet ID: `1wk_rVY8cgJbmS1PJBIP95Z_CGnz2a-QQjTVA1xqLIh8`

Admin source:
- `apps-script/admin/Code.gs`
- `apps-script/admin/Admin.html`

Do not merge the Admin `doGet()` into the anonymous public API deployment.

## Status

- P6.1 Admin shell: complete
- P6.2 Itinerary CRUD: complete
- P6.3 Reservations CRUD: complete
- P6.4 Hotels / Flights / Transport CRUD: implemented
- P6.5 validation / relationship safety: implemented
- P6.6 traveler synchronization: implemented by shared Sheet + traveler refresh flow

## P6.4

Admin tabs:
- 行程
- 預訂
- 住宿
- 航班
- 交通

Hotels supports place/reservation links and keeps booking URL, confirmation number, notes in Admin/Sheet only.

Flights supports reservation links and keeps booking reference/notes in Admin/Sheet only.

Transport supports Place → Place relationships, reservation requirement, reservation link, operator/service number, and private URL/notes.

## P6.5 validation and safety

Server-side Apps Script validates data again even if browser validation is bypassed:
- group enum
- certainty enum
- reservation category/status enum
- transport type enum
- YYYY-MM-DD dates
- HH:mm times
- non-negative numeric fields
- HTTPS URLs
- referenced member/place/reservation/transport IDs must exist
- hotel check-out must be later than check-in
- transport origin and destination must differ
- ScriptLock protects concurrent writes

Deletion protection:
- Reservation cannot be deleted while referenced by Itinerary, Hotels, Flights, or Transport.
- Transport cannot be deleted while referenced by Itinerary.

The public API remains a separate read-only deployment and must retain PUBLIC_FIELDS projection. Private booking URLs, confirmation numbers, booking references, notes, and Transport private URL are not made public by the Admin implementation.

## P6.6 synchronization

There is no duplicate database and no background sync job. Both Admin and traveler API read the same Google Sheet.

Flow:

`Admin save → Google Sheet → public read-only API → GitHub Pages`

The traveler frontend adds a cache-busting `_ts` parameter to API requests. During a single open browser session it also has an in-memory cache, so the user should use the existing refresh/retry action after Planner edits to force the newest Sheet data immediately.

## Deploy an Admin update

1. Replace Admin Apps Script `Code.gs` with the repository version.
2. Replace `Admin.html` with the repository version.
3. Deploy → Manage deployments → Edit → New version → Deploy.
4. Reopen/reload the Admin URL while signed in with the authorized Google account.
5. Confirm tabs: 行程 / 預訂 / 住宿 / 航班 / 交通.

## P6.4–P6.6 acceptance test

For each of 住宿 / 航班 / 交通:
1. Create a clearly named temporary test record.
2. Edit one field and save.
3. Confirm the Sheet changed.
4. Delete the temporary record.

Relationship tests:
1. Create a temporary Reservation.
2. Link it to a temporary Hotel/Flight/Transport or Itinerary.
3. Attempt to delete the Reservation; deletion must be blocked.
4. Remove the relationship and then delete the temporary records.
5. Link a temporary Transport to an Itinerary and confirm Transport deletion is blocked until the relationship is removed.

Synchronization test:
1. Edit one safe existing field in Admin.
2. Open traveler GitHub Pages.
3. Use refresh/retry.
4. Confirm the new Sheet value is displayed.
5. Restore the original value if the edit was only for testing.
