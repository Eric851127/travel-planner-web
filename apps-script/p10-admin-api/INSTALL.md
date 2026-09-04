# P10 Admin API Layer — isolated install

Use the same isolated Apps Script project that already passed P9.4/P9.5.
Do not modify the production Apps Script Admin project yet.

## Add these script files

Create three files in the isolated Apps Script project and paste the matching repository contents:

- `Router.gs`
- `Validators.gs`
- `Gate.gs`

The existing P9 `Code.gs` remains the authentication/session authority.

## One-line P9 route patch

Inside the existing `doPost(e)`, add this line before the final UNKNOWN_ACTION return:

```js
if (mode === 'admin_api') return p10AdminApi_(e);
```

The resulting routing block should be:

```js
function doPost(e) {
  const mode = String((e && e.parameter && e.parameter.mode) || '').trim();
  if (mode === 'probe') return p9Json_({ok:true,phase:'P9.4-5-gate',transport:'POST',echo:String((e && e.parameter && e.parameter.echo)||'').slice(0,120),at:new Date().toISOString()});
  if (mode === 'auth_finish') return p9AuthFinish_(e);
  if (mode === 'session_check') return p9SessionCheck_(e);
  if (mode === 'session_logout') return p9SessionLogout_(e);
  if (mode === 'protected_probe') return p9ProtectedApiProbe_(e, 'POST');
  if (mode === 'admin_api') return p10AdminApi_(e);
  return p9Json_({ok:false,error:{code:'UNKNOWN_ACTION',message:'Unknown action.'}});
}
```

## Pre-deploy self-test

Run:

```text
p10RunSelfTests
```

Expected:

```json
{
  "phase": "P10-admin-api",
  "ok": true,
  "passed": 8,
  "total": 8
}
```

Then deploy a **New version** of the existing isolated Web App.

## Live gate

Open:

`https://eric851127.github.io/travel-planner-web/p10-admin-api.html`

The page reuses the P9 session stored on the same GitHub Pages origin.

Run in order:

1. Check existing Session
2. Bootstrap
3. CRUD Roundtrip

The CRUD gate creates temporary `P10-GATE-*` records for all six Admin entity types, updates and reads them back, then deletes them in dependency-safe order. On failure it attempts best-effort cleanup of only the IDs created by that gate run.

## P10 boundaries

P10 does not modify:

- production `apps-script/admin/Code.gs`
- `p8.js`
- Traveler UI
- production Edit button behavior
- legacy Apps Script Admin UI

P11 remains blocked until P10 live gate passes.
