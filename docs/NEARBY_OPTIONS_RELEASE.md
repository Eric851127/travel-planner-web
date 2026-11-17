# Main route + nearby choices: release verification (2026-11-17)

## Selected production path

This release does not need a Google Sheet write or an Apps Script deployment. Existing canonical itinerary, reservations, transport, flights, hotels and Places still come from the existing public API.

`nearby-options-data.js` contains **exactly one** reviewed alternative: I069 → P071 (USHIGORO 表參道 instead of 青山まんぷく). It neither books dinner nor adds another timed event. The live parent must still match date=2026-12-22, group=ours and primary place=P070; primary/candidate names must match their checked identities. A mismatch hides the overlay rather than silently reattaching it. The bundle never supplies fake Places or overrides API data.

The café, sweet shop, drugstore and cross-date crab-dinner choices are **not imported**. `preview/` remains isolated demo data and is not loaded by the production entry. The CSV migration remains inactive and has not been applied.

The Apps Script changes in this branch are prepared future support, not the deployed backend. Explicit API configuration takes priority over the bundle; API failure does not silently fall back to stale bundled choices. Future migration must remove/disable the bundle or enable the API source only after verifying the backend and real data.

## Verification before release

- 38 Node/VM/jsdom tests passed; JS and Apps Script syntax, whitespace checks passed.
- Managed preview browser successfully connected to the **real read-only API**. Dates 12/21–12/31, flights, hotels, all-trip days, booking entries, descriptions and certainty rendered.
- 12/22: 5 main stops remain 5; USHIGORO appears only in the optional alternative disclosure. Friends group has zero options for this dinner.
- Chrome 390px and 320px iframe viewports: actual screenshots inspected, disclosure content and long 12/24 itinerary wrap without horizontal overflow (document/client widths match).
- Missing-place itinerary remains visible; group/date changes and full-trip navigation tested. Existing booking statuses remain as returned, not rewritten to fit assumptions.
- Maps without configuration retains place lists and external links. Maps hangs/failures and navigation-race behavior additionally covered in automated tests.

Not tested: real Maps tiles/marker service (this browser has no configured key/Map ID), physical iOS/Safari, installed PWA offline mode, or Admin authentication. No Google Cloud restrictions were loosened. Admin/auth files are unchanged.

The earlier browser limitation was resolved by using the supported managed preview relay; standalone Chromium remains unavailable. Visual QA above uses the actual browser, not jsdom.

## Rollback

The pre-release production commit is `08316cfdf77397f415c1628b1f5ceffb2fce286b`. If release verification fails, revert the release merge via a new commit and republish GitHub Pages; do not force-delete history. Disable the bundled overlay independently by removing its script load (or setting its rows empty) and bump the frontend/service-worker version. No Sheet or backend rollback is needed because this release does not change them.

Existing Maps settings and API URL localStorage keys remain unchanged. The service-worker cache name is bumped so the new file is cached with the app shell. After any rollback, verify the production page and refresh/version behavior, not merely a successful Git merge.
