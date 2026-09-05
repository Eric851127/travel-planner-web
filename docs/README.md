# Documentation Index

Functional regression baseline: `55fd670eb4a2baa33e3d09ee12affad6e56c58be`

## Current authority

Use these documents for the current production state:

- `CURRENT_PROJECT_STATUS.md` — current milestone and production status
- `MAIN_BRANCH_MAP.md` — frontend/runtime file classification and cleanup safety rules
- `APPS_SCRIPT_SOURCE_MAP.md` — Apps Script source-of-truth and deployment boundaries
- `DIAGNOSTICS.md` — diagnostic/support page classification

If a historical document conflicts with these files, the current authority documents plus GitHub `main` win.

## Historical milestone documents

Historical implementation notes are archived under `history/`:

- `history/MIGRATION-COMPLETE.md` — P9–P12 migration completion record
- `history/P3.4_APPS_SCRIPT_PATCH.md` — earlier public API whitelist/security implementation notes
- `history/P6_ADMIN_SETUP.md` — legacy Apps Script-hosted Admin implementation notes
- `history/P14_PLACE_MEMOS.md` — P14 PlaceMemo implementation record

These files are retained for audit, rollback context, and engineering history. They are **not** current architecture instructions.

## Documentation rule

Do not copy deployment steps, file roles, or architecture assumptions from `history/` into new work without first verifying the current authority documents and the actual files on `main`.
