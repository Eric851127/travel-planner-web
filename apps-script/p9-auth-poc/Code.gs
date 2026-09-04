const P9_CONFIG = {
  SPREADSHEET_ID: '1wk_rVY8cgJbmS1PJBIP95Z_CGnz2a-QQjTVA1xqLIh8',
  MEMBERS_SHEET: 'Members',
  STATE_TTL_SECONDS: 600,
  TOKENINFO_URL: 'https://oauth2.googleapis.com/tokeninfo',
  TOKEN_URL: 'https://oauth2.googleapis.com/token',
  AUTH_URL: 'https://accounts.google.com/o/oauth2/v2/auth'
};

/**
 * P9.1 Authentication PoC only.
 * Deploy this file as a SEPARATE Apps Script Web App.
 * It intentionally contains no Admin CRUD routes.
 */
function doGet(e) {
  const mode = String((e && e.parameter && e.parameter.mode) || '').trim();
  if (mode === 'start') return p9StartAuth_(e);
  if (mode === 'probe') return p9Json_({ ok: true, phase: 'P9.1', transport: 'GET', at: new Date().toISOString() });
  if (mode === 'config') return p9PublicConfig_();
  if (e && e.parameter && (e.parameter.code || e.parameter.error)) return p9HandleCallback_(e);
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Travel Planner P9.1</title><body style="font:16px system-ui;padding:24px">' +
    '<h1>Travel Planner P9.1 Auth PoC</h1><p>This is an isolated authentication endpoint. No Admin CRUD is exposed.</p></body>'
  );
}

function doPost(e) {
  const mode = String((e && e.parameter && e.parameter.mode) || '').trim();
  if (mode === 'probe') {
    return p9Json_({
      ok: true,
      phase: 'P9.1',
      transport: 'POST',
      echo: String(e.parameter.echo || '').slice(0, 120),
      at: new Date().toISOString()
    });
  }
  return p9Json_({ ok: false, error: 'UNKNOWN_ACTION' });
}

function p9StartAuth_(e) {
  const props = p9Properties_();
  const requestedReturn = String((e && e.parameter && e.parameter.return_url) || '').trim();
  const returnUrl = p9ValidateReturnUrl_(requestedReturn, props.returnUrl);
  const state = p9RandomToken_();
  CacheService.getScriptCache().put('p9state:' + state, JSON.stringify({ returnUrl: returnUrl }), P9_CONFIG.STATE_TTL_SECONDS);

  const authUrl = P9_CONFIG.AUTH_URL + '?' + p9Query_({
    client_id: props.clientId,
    redirect_uri: props.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: state,
    prompt: 'select_account',
    access_type: 'online',
    include_granted_scopes: 'false'
  });
  return p9RedirectHtml_(authUrl, 'Opening Google sign-in…');
}

function p9HandleCallback_(e) {
  const props = p9Properties_();
  const state = String(e.parameter.state || '').trim();
  const cache = CacheService.getScriptCache();
  const cached = state ? cache.get('p9state:' + state) : null;
  if (!cached) return p9ResultPage_(props.returnUrl, { authenticated: false, active: false, admin: false, error: 'INVALID_OR_EXPIRED_STATE' });
  cache.remove('p9state:' + state);

  let stateData;
  try { stateData = JSON.parse(cached); } catch (_) { stateData = { returnUrl: props.returnUrl }; }
  const returnUrl = p9ValidateReturnUrl_(stateData.returnUrl, props.returnUrl);
  if (e.parameter.error) {
    return p9ResultPage_(returnUrl, { authenticated: false, active: false, admin: false, error: String(e.parameter.error) });
  }

  try {
    const code = String(e.parameter.code || '').trim();
    if (!code) throw new Error('MISSING_AUTHORIZATION_CODE');
    const tokenResponse = UrlFetchApp.fetch(P9_CONFIG.TOKEN_URL, {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: {
        code: code,
        client_id: props.clientId,
        client_secret: props.clientSecret,
        redirect_uri: props.redirectUri,
        grant_type: 'authorization_code'
      },
      muteHttpExceptions: true
    });
    if (tokenResponse.getResponseCode() !== 200) throw new Error('TOKEN_EXCHANGE_FAILED');
    const tokenBody = JSON.parse(tokenResponse.getContentText());
    if (!tokenBody.id_token) throw new Error('MISSING_ID_TOKEN');

    // P9.1 only: tokeninfo is used to prove the chain. Production will replace this with local JWT verification.
    const claimsResponse = UrlFetchApp.fetch(P9_CONFIG.TOKENINFO_URL + '?id_token=' + encodeURIComponent(tokenBody.id_token), { muteHttpExceptions: true });
    if (claimsResponse.getResponseCode() !== 200) throw new Error('ID_TOKEN_INVALID');
    const claims = JSON.parse(claimsResponse.getContentText());
    p9ValidateClaims_(claims, props.clientId);

    const email = String(claims.email || '').trim().toLowerCase();
    const member = p9FindMember_(email);
    const active = !!member && p9Truthy_(member.active);
    const admin = active && p9Truthy_(member.admin_access);
    return p9ResultPage_(returnUrl, {
      authenticated: true,
      email: email,
      sub: String(claims.sub || ''),
      active: active,
      admin: admin,
      member_found: !!member,
      token_exp: Number(claims.exp || 0)
    });
  } catch (error) {
    console.error('P9 auth callback failed', error);
    return p9ResultPage_(returnUrl, {
      authenticated: false,
      active: false,
      admin: false,
      error: String(error && error.message || error || 'AUTH_FAILED')
    });
  }
}

function p9ValidateClaims_(claims, expectedClientId) {
  const iss = String(claims.iss || '');
  if (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') throw new Error('INVALID_ISSUER');
  if (String(claims.aud || '') !== expectedClientId) throw new Error('INVALID_AUDIENCE');
  if (Number(claims.exp || 0) <= Math.floor(Date.now() / 1000)) throw new Error('TOKEN_EXPIRED');
  if (String(claims.email_verified || '').toLowerCase() !== 'true') throw new Error('EMAIL_NOT_VERIFIED');
  if (!String(claims.sub || '').trim()) throw new Error('MISSING_SUB');
  if (!String(claims.email || '').trim()) throw new Error('MISSING_EMAIL');
}

function p9FindMember_(email) {
  const ss = SpreadsheetApp.openById(P9_CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(P9_CONFIG.MEMBERS_SHEET);
  if (!sheet) throw new Error('MEMBERS_SHEET_NOT_FOUND');
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return null;
  const headers = values[0].map(function (v) { return String(v).trim(); });
  const emailIndex = headers.indexOf('email');
  if (emailIndex < 0) throw new Error('MEMBERS_EMAIL_COLUMN_NOT_FOUND');
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][emailIndex] || '').trim().toLowerCase() !== email) continue;
    const out = {};
    headers.forEach(function (h, index) { out[h] = values[i][index]; });
    return out;
  }
  return null;
}

function p9Properties_() {
  const p = PropertiesService.getScriptProperties();
  const result = {
    clientId: String(p.getProperty('P9_OAUTH_CLIENT_ID') || '').trim(),
    clientSecret: String(p.getProperty('P9_OAUTH_CLIENT_SECRET') || '').trim(),
    redirectUri: String(p.getProperty('P9_REDIRECT_URI') || '').trim(),
    returnUrl: String(p.getProperty('P9_ALLOWED_RETURN_URL') || '').trim()
  };
  Object.keys(result).forEach(function (key) {
    if (!result[key]) throw new Error('Missing Script Property: ' + key);
  });
  return result;
}

function p9PublicConfig_() {
  const props = p9Properties_();
  return p9Json_({ ok: true, redirect_uri: props.redirectUri, allowed_return_url: props.returnUrl });
}

function p9ValidateReturnUrl_(requested, allowed) {
  const cleanRequested = String(requested || '').split('#')[0];
  const cleanAllowed = String(allowed || '').split('#')[0];
  if (!cleanRequested) return cleanAllowed;
  if (cleanRequested !== cleanAllowed) throw new Error('RETURN_URL_NOT_ALLOWED');
  return cleanAllowed;
}

function p9ResultPage_(returnUrl, result) {
  const json = JSON.stringify(result);
  const encoded = Utilities.base64EncodeWebSafe(json, Utilities.Charset.UTF_8).replace(/=+$/, '');
  return p9RedirectHtml_(returnUrl + '#p9_result=' + encodeURIComponent(encoded), result.authenticated ? 'Authentication complete…' : 'Authentication failed…');
}

function p9RedirectHtml_(url, message) {
  const safeUrl = JSON.stringify(String(url));
  const safeMessage = p9Html_(message);
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Travel Planner Authentication</title>' +
    '<body style="font:16px system-ui;padding:24px"><p>' + safeMessage + '</p>' +
    '<script>location.replace(' + safeUrl + ');<\/script></body>'
  );
}

function p9Json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function p9Query_(params) {
  return Object.keys(params).map(function (key) {
    return encodeURIComponent(key) + '=' + encodeURIComponent(String(params[key]));
  }).join('&');
}

function p9RandomToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function p9Truthy_(value) {
  const v = String(value == null ? '' : value).trim().toLowerCase();
  return value === true || v === 'true' || v === '1' || v === 'yes';
}

function p9Html_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
