# P6 — Planner Admin / Itinerary CRUD

## Architecture

Keep the existing public traveler deployment read-only.

Create a **separate Apps Script project/deployment** for Planner Admin. The admin project writes to the same spreadsheet but must not be deployed with anonymous public write access.

Spreadsheet ID:
`1wk_rVY8cgJbmS1PJBIP95Z_CGnz2a-QQjTVA1xqLIh8`

## Files

Copy these two repository files into the new Apps Script project:

- `apps-script/admin/Code.gs`
- `apps-script/admin/Admin.html`

Do not merge the admin `doGet()` into the existing public read-only API project because both projects use `doGet()` for different purposes.

## Deployment

1. Apps Script → New project.
2. Add `Code.gs` from `apps-script/admin/Code.gs`.
3. Add HTML file named exactly `Admin` and paste `apps-script/admin/Admin.html`.
4. Deploy → New deployment → Web app.
5. Execute as: Me.
6. Who has access: choose the most restrictive Google-account option that includes the Planner. Do **not** choose anonymous public access for this admin deployment.
7. Open the Admin deployment URL while signed in with the authorized Google account.

## P6.1 / P6.2 scope

Admin UI supports:

- list/filter Itinerary by date/group
- create Itinerary row
- edit existing Itinerary row
- delete Itinerary row
- Place dropdown from Places sheet
- group/certainty enum validation
- date/time validation
- automatic next `I###` ID
- automatic `D#` for newly created rows
- ScriptLock around writes

The public GitHub Pages traveler app remains read-only and continues using its separate public Apps Script API.

## Security boundary

The browser does not receive arbitrary Sheet write access. `google.script.run` can only invoke server functions defined by the Admin Apps Script project. `saveItinerary()` explicitly validates allowed fields and enum values before writing. `deleteItinerary()` only accepts an itinerary ID.

The public traveler API must remain read-only and must continue using PUBLIC_FIELDS projection.

## Acceptance test

1. Open Admin URL.
2. Confirm existing D1–D11 itinerary rows load.
3. Filter a date.
4. Edit one non-sensitive test row and save.
5. Verify the corresponding Itinerary row changed in Google Sheets.
6. Add a temporary test itinerary; confirm a new `I###` ID is generated.
7. Delete the temporary test row.
8. Refresh the public traveler GitHub Pages app and verify it reflects the saved Sheet data.
