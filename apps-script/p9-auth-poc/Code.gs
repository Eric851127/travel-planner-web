const P9_CONFIG = {
  SPREADSHEET_ID: '1wk_rVY8cgJbmS1PJBIP95Z_CGnz2a-QQjTVA1xqLIh8',
  MEMBERS_SHEET: 'Members',
  STATE_TTL_SECONDS: 600,
  TOKEN_URL: 'https://oauth2.googleapis.com/token',
  AUTH_URL: 'https://accounts.google.com/o/oauth2/v2/auth',
  JWKS_URL: 'https://www.googleapis.com/oauth2/v3/certs',
  JWKS_CACHE_KEY: 'p9.google.jwks.v1',
  JWKS_CACHE_MAX_SECONDS: 21600,
  CLOCK_SKEW_SECONDS: 60
};

function doGet(e) {
  const mode = String((e && e.parameter && e.parameter.mode) || '').trim();
  if (mode === 'probe') return p9Json_({ ok:true, phase:'P9.2', transport:'GET', at:new Date().toISOString() });
  if (mode === 'config') return p9PublicConfig_();
  if (mode === 'auth_start') return p9AuthStart_(e);
  return p9Json_({ ok:false, error:'UNKNOWN_ACTION' });
}

function doPost(e) {
  const mode = String((e && e.parameter && e.parameter.mode) || '').trim();
  if (mode === 'probe') {
    return p9Json_({
      ok:true,
      phase:'P9.2',
      transport:'POST',
      echo:String((e && e.parameter && e.parameter.echo) || '').slice(0,120),
      at:new Date().toISOString()
    });
  }
  if (mode === 'auth_finish') return p9AuthFinish_(e);
  return p9Json_({ ok:false, error:'UNKNOWN_ACTION' });
}

function p9AuthStart_(e) {
  try {
    const props = p9Properties_();
    const requestedReturn = String((e && e.parameter && e.parameter.return_url) || '').trim();
    const returnUrl = p9ValidateReturnUrl_(requestedReturn, props.returnUrl);

    const state = p9RandomToken_();
    const verifier = p9PkceVerifier_();
    const challenge = p9PkceChallenge_(verifier);
    const now = Date.now();

    CacheService.getScriptCache().put(
      p9StateKey_(state),
      JSON.stringify({
        returnUrl:returnUrl,
        verifier:verifier,
        createdAt:now
      }),
      P9_CONFIG.STATE_TTL_SECONDS
    );

    const authUrl = P9_CONFIG.AUTH_URL + '?' + p9Query_({
      client_id:props.clientId,
      redirect_uri:returnUrl,
      response_type:'code',
      scope:'openid email profile',
      state:state,
      code_challenge:challenge,
      code_challenge_method:'S256',
      prompt:'select_account',
      access_type:'online',
      include_granted_scopes:'false'
    });

    return p9Json_({
      ok:true,
      auth_url:authUrl,
      state_ttl_seconds:P9_CONFIG.STATE_TTL_SECONDS,
      pkce:'S256'
    });
  } catch (error) {
    console.error('P9 auth_start failed', error);
    return p9Json_({ ok:false, error:p9ErrorCode_(error, 'AUTH_START_FAILED') });
  }
}

function p9AuthFinish_(e) {
  try {
    const props = p9Properties_();
    const state = String((e && e.parameter && e.parameter.state) || '').trim();
    const transaction = p9ConsumeState_(state);
    const returnUrl = p9ValidateReturnUrl_(transaction.returnUrl, props.returnUrl);

    const oauthError = String((e && e.parameter && e.parameter.oauth_error) || '').trim();
    if (oauthError) {
      return p9AuthResult_(false, {
        error: oauthError === 'access_denied' ? 'OAUTH_ACCESS_DENIED' : 'OAUTH_' + oauthError.toUpperCase().replace(/[^A-Z0-9]+/g, '_')
      });
    }

    const code = String((e && e.parameter && e.parameter.code) || '').trim();
    if (!code) throw new Error('MISSING_AUTHORIZATION_CODE');

    const tokenBody = p9ExchangeCode_(code, transaction.verifier, returnUrl, props);
    const claims = p9VerifyGoogleIdToken_(tokenBody.id_token, props.clientId);

    const email = String(claims.email || '').trim().toLowerCase();
    const member = p9FindMember_(email);
    const active = !!member && p9Truthy_(member.active);
    const admin = active && p9Truthy_(member.admin_access);

    return p9Json_({
      authenticated:true,
      email:email,
      sub:String(claims.sub || ''),
      active:active,
      admin:admin,
      member_found:!!member,
      token_exp:Number(claims.exp || 0)
    });
  } catch (error) {
    console.error('P9 auth_finish failed', error);
    return p9AuthResult_(false, { error:p9ErrorCode_(error, 'AUTH_FAILED') });
  }
}

function p9ExchangeCode_(code, verifier, redirectUri, props) {
  const tokenResponse = UrlFetchApp.fetch(P9_CONFIG.TOKEN_URL, {
    method:'post',
    contentType:'application/x-www-form-urlencoded',
    payload:{
      code:code,
      client_id:props.clientId,
      client_secret:props.clientSecret,
      redirect_uri:redirectUri,
      grant_type:'authorization_code',
      code_verifier:verifier
    },
    muteHttpExceptions:true
  });

  if (tokenResponse.getResponseCode() !== 200) {
    console.error('P9 token exchange failed. HTTP ' + tokenResponse.getResponseCode());
    throw new Error('TOKEN_EXCHANGE_FAILED');
  }

  let body;
  try {
    body = JSON.parse(tokenResponse.getContentText());
  } catch (_) {
    throw new Error('TOKEN_EXCHANGE_INVALID_RESPONSE');
  }
  if (!body || !body.id_token) throw new Error('MISSING_ID_TOKEN');
  return body;
}

/**
 * Production-grade Google ID token verification:
 * - parses JWT locally
 * - requires RS256 + kid
 * - fetches Google's rotating JWKS and caches it
 * - verifies PKCS#1 v1.5 SHA-256 signature locally
 * - validates issuer, audience, time, verified email, sub and email
 *
 * No call to oauth2.googleapis.com/tokeninfo is used.
 */
function p9VerifyGoogleIdToken_(idToken, expectedClientId) {
  p9AssertCryptoRuntime_();

  const token = String(idToken || '').trim();
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) throw new Error('ID_TOKEN_INVALID');

  let header, claims;
  try {
    header = JSON.parse(p9Base64UrlUtf8_(parts[0]));
    claims = JSON.parse(p9Base64UrlUtf8_(parts[1]));
  } catch (_) {
    throw new Error('ID_TOKEN_INVALID');
  }

  if (!header || header.alg !== 'RS256') throw new Error('ID_TOKEN_INVALID');
  const kid = String(header.kid || '').trim();
  if (!kid) throw new Error('ID_TOKEN_INVALID');

  let jwk = p9FindGoogleJwk_(kid, false);
  if (!jwk) jwk = p9FindGoogleJwk_(kid, true);
  if (!jwk || jwk.kty !== 'RSA' || !jwk.n || !jwk.e) throw new Error('ID_TOKEN_INVALID');

  const signingInput = parts[0] + '.' + parts[1];
  if (!p9VerifyRs256_(signingInput, parts[2], jwk)) throw new Error('ID_TOKEN_INVALID');

  p9ValidateClaims_(claims, expectedClientId);
  return claims;
}

function p9FindGoogleJwk_(kid, forceRefresh) {
  const set = p9GoogleJwks_(!!forceRefresh);
  const keys = Array.isArray(set.keys) ? set.keys : [];
  for (let i=0;i<keys.length;i++) {
    if (String(keys[i].kid || '') === kid) return keys[i];
  }
  return null;
}

function p9GoogleJwks_(forceRefresh) {
  const cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    const cached = cache.get(P9_CONFIG.JWKS_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.keys)) return parsed;
      } catch (_) {}
    }
  }

  const response = UrlFetchApp.fetch(P9_CONFIG.JWKS_URL, { muteHttpExceptions:true });
  if (response.getResponseCode() !== 200) throw new Error('SIGNING_KEYS_UNAVAILABLE');

  let set;
  try {
    set = JSON.parse(response.getContentText());
  } catch (_) {
    throw new Error('SIGNING_KEYS_UNAVAILABLE');
  }
  if (!set || !Array.isArray(set.keys) || !set.keys.length) throw new Error('SIGNING_KEYS_UNAVAILABLE');

  const ttl = p9JwksCacheTtl_(response.getAllHeaders());
  cache.put(P9_CONFIG.JWKS_CACHE_KEY, JSON.stringify(set), ttl);
  return set;
}

function p9JwksCacheTtl_(headers) {
  let value = '';
  Object.keys(headers || {}).some(function(key){
    if (String(key).toLowerCase() === 'cache-control') {
      value = Array.isArray(headers[key]) ? String(headers[key][0] || '') : String(headers[key] || '');
      return true;
    }
    return false;
  });
  const match = value.match(/max-age\s*=\s*(\d+)/i);
  const fromHeader = match ? Number(match[1]) : 3600;
  return Math.max(300, Math.min(P9_CONFIG.JWKS_CACHE_MAX_SECONDS, fromHeader || 3600));
}

function p9ValidateClaims_(claims, expectedClientId) {
  const iss = String(claims && claims.iss || '');
  if (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') throw new Error('INVALID_ISSUER');

  const aud = claims && claims.aud;
  const audienceOk = Array.isArray(aud)
    ? aud.map(String).indexOf(String(expectedClientId)) >= 0
    : String(aud || '') === String(expectedClientId);
  if (!audienceOk) throw new Error('INVALID_AUDIENCE');

  const now = Math.floor(Date.now()/1000);
  const skew = P9_CONFIG.CLOCK_SKEW_SECONDS;
  if (!Number(claims.exp) || Number(claims.exp) < now - skew) throw new Error('TOKEN_EXPIRED');
  if (claims.nbf != null && Number(claims.nbf) > now + skew) throw new Error('TOKEN_NOT_YET_VALID');
  if (claims.iat != null && Number(claims.iat) > now + skew) throw new Error('TOKEN_ISSUED_IN_FUTURE');

  const verified = claims.email_verified === true || String(claims.email_verified || '').toLowerCase() === 'true';
  if (!verified) throw new Error('EMAIL_NOT_VERIFIED');
  if (!String(claims.sub || '').trim()) throw new Error('MISSING_SUB');
  if (!String(claims.email || '').trim()) throw new Error('MISSING_EMAIL');
}

function p9VerifyRs256_(signingInput, signatureB64Url, jwk) {
  try {
    const modulusBytes = p9Base64UrlBytes_(String(jwk.n || ''));
    const exponentBytes = p9Base64UrlBytes_(String(jwk.e || ''));
    const signatureBytes = p9Base64UrlBytes_(String(signatureB64Url || ''));
    if (!modulusBytes.length || !exponentBytes.length || signatureBytes.length !== modulusBytes.length) return false;

    const n = p9BytesToBigInt_(modulusBytes);
    const e = p9BytesToBigInt_(exponentBytes);
    const s = p9BytesToBigInt_(signatureBytes);
    if (s <= 0n || s >= n) return false;

    const m = p9ModPow_(s, e, n);
    const em = p9BigIntToBytes_(m, modulusBytes.length);

    const digestSigned = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(signingInput),
      Utilities.Charset.UTF_8
    );
    const digest = digestSigned.map(function(b){ return b & 255; });
    const digestInfoPrefix = p9HexToBytes_('3031300d060960864801650304020105000420');
    const t = digestInfoPrefix.concat(digest);

    if (em.length < t.length + 11) return false;
    if (em[0] !== 0x00 || em[1] !== 0x01) return false;

    let i = 2;
    while (i < em.length && em[i] === 0xff) i++;
    if (i < 10 || em[i] !== 0x00) return false;
    i++;

    if (em.length - i !== t.length) return false;
    for (let j=0;j<t.length;j++) if (em[i+j] !== t[j]) return false;
    return true;
  } catch (_) {
    return false;
  }
}

function p9AssertCryptoRuntime_() {
  if (typeof BigInt !== 'function') throw new Error('CRYPTO_RUNTIME_UNSUPPORTED');
}

function p9ModPow_(base, exponent, modulus) {
  let result = 1n;
  let b = base % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    e >>= 1n;
    b = (b * b) % modulus;
  }
  return result;
}

function p9BytesToBigInt_(bytes) {
  if (!bytes.length) return 0n;
  return BigInt('0x' + bytes.map(function(b){ return ('0' + (b & 255).toString(16)).slice(-2); }).join(''));
}

function p9BigIntToBytes_(value, length) {
  let hex = value.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  while (hex.length < length * 2) hex = '00' + hex;
  if (hex.length > length * 2) return [];
  return p9HexToBytes_(hex);
}

function p9HexToBytes_(hex) {
  const out = [];
  for (let i=0;i<hex.length;i+=2) out.push(parseInt(hex.slice(i,i+2),16));
  return out;
}

function p9Base64UrlBytes_(value) {
  return Utilities.base64DecodeWebSafe(p9PadBase64_(String(value || ''))).map(function(b){ return b & 255; });
}

function p9Base64UrlUtf8_(value) {
  const bytes = Utilities.base64DecodeWebSafe(p9PadBase64_(String(value || '')));
  return Utilities.newBlob(bytes).getDataAsString('UTF-8');
}

function p9PadBase64_(value) {
  let v = String(value || '').replace(/=+$/,'');
  while (v.length % 4) v += '=';
  return v;
}

function p9ConsumeState_(state) {
  const clean = String(state || '').trim();
  if (!clean) throw new Error('INVALID_OR_EXPIRED_STATE');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('AUTH_BUSY');

  let cached;
  try {
    const cache = CacheService.getScriptCache();
    cached = cache.get(p9StateKey_(clean));
    if (!cached) throw new Error('INVALID_OR_EXPIRED_STATE');
    cache.remove(p9StateKey_(clean));
  } finally {
    lock.releaseLock();
  }

  let data;
  try {
    data = JSON.parse(cached);
  } catch (_) {
    throw new Error('INVALID_OR_EXPIRED_STATE');
  }

  if (!data || !data.verifier || !data.returnUrl || !Number(data.createdAt)) throw new Error('INVALID_OR_EXPIRED_STATE');
  if (Date.now() - Number(data.createdAt) > P9_CONFIG.STATE_TTL_SECONDS * 1000) throw new Error('INVALID_OR_EXPIRED_STATE');
  return data;
}

function p9StateKey_(state) {
  return 'p9state:' + state;
}

function p9PkceVerifier_() {
  return p9RandomToken_();
}

function p9PkceChallenge_(verifier) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(verifier),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/,'');
}

function p9FindMember_(email) {
  const ss = SpreadsheetApp.openById(P9_CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(P9_CONFIG.MEMBERS_SHEET);
  if (!sheet) throw new Error('MEMBERS_SHEET_NOT_FOUND');

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return null;

  const headers = values[0].map(function(v){ return String(v).trim(); });
  const emailIndex = headers.indexOf('email');
  if (emailIndex < 0) throw new Error('MEMBERS_EMAIL_COLUMN_NOT_FOUND');

  for (let i=1;i<values.length;i++) {
    if (String(values[i][emailIndex] || '').trim().toLowerCase() !== email) continue;
    const out = {};
    headers.forEach(function(h,index){ out[h] = values[i][index]; });
    return out;
  }
  return null;
}

function p9Properties_() {
  const p = PropertiesService.getScriptProperties();
  const result = {
    clientId:String(p.getProperty('P9_OAUTH_CLIENT_ID') || '').trim(),
    clientSecret:String(p.getProperty('P9_OAUTH_CLIENT_SECRET') || '').trim(),
    returnUrl:String(p.getProperty('P9_ALLOWED_RETURN_URL') || '').trim()
  };
  Object.keys(result).forEach(function(key){
    if (!result[key]) throw new Error('MISSING_SCRIPT_PROPERTY_' + key.toUpperCase());
  });
  p9ValidateReturnUrl_(result.returnUrl, result.returnUrl);
  return result;
}

function p9PublicConfig_() {
  try {
    const props = p9Properties_();
    return p9Json_({
      ok:true,
      phase:'P9.2',
      allowed_return_url:props.returnUrl,
      client_id_tail:props.clientId.slice(-18),
      state_ttl_seconds:P9_CONFIG.STATE_TTL_SECONDS,
      pkce:'S256',
      id_token_verification:'JWKS_RS256'
    });
  } catch (error) {
    return p9Json_({ ok:false, error:p9ErrorCode_(error, 'CONFIG_ERROR') });
  }
}

function p9ValidateReturnUrl_(requested, allowed) {
  const cleanRequested = String(requested || '').trim().split('#')[0];
  const cleanAllowed = String(allowed || '').trim().split('#')[0];
  if (!cleanAllowed || !/^https:\/\//i.test(cleanAllowed)) throw new Error('RETURN_URL_NOT_ALLOWED');
  if (!cleanRequested) return cleanAllowed;
  if (cleanRequested !== cleanAllowed) throw new Error('RETURN_URL_NOT_ALLOWED');
  return cleanAllowed;
}

function p9AuthResult_(authenticated, extra) {
  const result = {
    authenticated:!!authenticated,
    active:false,
    admin:false
  };
  Object.keys(extra || {}).forEach(function(key){ result[key] = extra[key]; });
  return p9Json_(result);
}

function p9ErrorCode_(error, fallback) {
  const code = String(error && error.message || error || fallback || 'INTERNAL_ERROR').trim();
  return /^[A-Z0-9_]+$/.test(code) ? code : (fallback || 'INTERNAL_ERROR');
}

function p9AuthorizeProject() {
  const props = p9Properties_();
  const ss = SpreadsheetApp.openById(P9_CONFIG.SPREADSHEET_ID);
  const members = ss.getSheetByName(P9_CONFIG.MEMBERS_SHEET);
  if (!members) throw new Error('MEMBERS_SHEET_NOT_FOUND');

  const response = UrlFetchApp.fetch(P9_CONFIG.JWKS_URL, { muteHttpExceptions:true });
  p9AssertCryptoRuntime_();

  return {
    ok:response.getResponseCode() === 200,
    spreadsheet:ss.getName(),
    members_rows:members.getLastRow(),
    oauth_client_tail:props.clientId.slice(-18),
    jwks_status:response.getResponseCode(),
    bigint:typeof BigInt === 'function',
    state_ttl_seconds:P9_CONFIG.STATE_TTL_SECONDS
  };
}

/**
 * Owner-only P9.2 deterministic security self-tests.
 * Run manually from the Apps Script editor after deploying this code.
 * This function is never exposed through doGet/doPost.
 */
function p9RunSecuritySelfTests() {
  const tests = [];
  function test(name, fn) {
    try {
      fn();
      tests.push({ test:name, pass:true });
    } catch (error) {
      tests.push({ test:name, pass:false, error:String(error && error.message || error) });
    }
  }
  function expectError(expected, fn) {
    let got = '';
    try { fn(); } catch (error) { got = String(error && error.message || error); }
    if (got !== expected) throw new Error('expected ' + expected + ', got ' + (got || 'NO_ERROR'));
  }

  const props = p9Properties_();
  const now = Math.floor(Date.now()/1000);
  const goodClaims = {
    iss:'https://accounts.google.com',
    aud:props.clientId,
    exp:now + 300,
    iat:now - 10,
    email_verified:true,
    sub:'self-test-sub',
    email:'self-test@example.com'
  };

  test('return_url exact allowlist', function(){
    if (p9ValidateReturnUrl_(props.returnUrl, props.returnUrl) !== props.returnUrl) throw new Error('ALLOWLIST_MISMATCH');
  });

  test('return_url rejects foreign origin/path', function(){
    expectError('RETURN_URL_NOT_ALLOWED', function(){
      p9ValidateReturnUrl_('https://example.com/evil', props.returnUrl);
    });
  });

  test('PKCE RFC7636 S256 vector', function(){
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    if (p9PkceChallenge_(verifier) !== expected) throw new Error('PKCE_VECTOR_FAILED');
  });

  test('state TTL <= 600 seconds', function(){
    if (P9_CONFIG.STATE_TTL_SECONDS > 600) throw new Error('STATE_TTL_TOO_LONG');
  });

  test('state single-use / replay rejected', function(){
    const state = 'selftest' + p9RandomToken_();
    CacheService.getScriptCache().put(
      p9StateKey_(state),
      JSON.stringify({ returnUrl:props.returnUrl, verifier:p9PkceVerifier_(), createdAt:Date.now() }),
      60
    );
    p9ConsumeState_(state);
    expectError('INVALID_OR_EXPIRED_STATE', function(){ p9ConsumeState_(state); });
  });

  test('expired state rejected even if cache entry exists', function(){
    const state = 'selftest' + p9RandomToken_();
    CacheService.getScriptCache().put(
      p9StateKey_(state),
      JSON.stringify({
        returnUrl:props.returnUrl,
        verifier:p9PkceVerifier_(),
        createdAt:Date.now() - (P9_CONFIG.STATE_TTL_SECONDS + 5) * 1000
      }),
      60
    );
    expectError('INVALID_OR_EXPIRED_STATE', function(){ p9ConsumeState_(state); });
  });

  test('valid claims accepted', function(){
    p9ValidateClaims_(goodClaims, props.clientId);
  });

  test('wrong audience rejected', function(){
    const c = Object.assign({}, goodClaims, { aud:'wrong-client.apps.googleusercontent.com' });
    expectError('INVALID_AUDIENCE', function(){ p9ValidateClaims_(c, props.clientId); });
  });

  test('expired token rejected', function(){
    const c = Object.assign({}, goodClaims, { exp:now - P9_CONFIG.CLOCK_SKEW_SECONDS - 5 });
    expectError('TOKEN_EXPIRED', function(){ p9ValidateClaims_(c, props.clientId); });
  });

  test('invalid issuer rejected', function(){
    const c = Object.assign({}, goodClaims, { iss:'https://example.com' });
    expectError('INVALID_ISSUER', function(){ p9ValidateClaims_(c, props.clientId); });
  });

  test('unverified email rejected', function(){
    const c = Object.assign({}, goodClaims, { email_verified:false });
    expectError('EMAIL_NOT_VERIFIED', function(){ p9ValidateClaims_(c, props.clientId); });
  });

  test('malformed/fake JWT rejected', function(){
    expectError('ID_TOKEN_INVALID', function(){ p9VerifyGoogleIdToken_('abc.def.ghi', props.clientId); });
  });

  test('BigInt RSA runtime available', function(){
    p9AssertCryptoRuntime_();
  });

  const passed = tests.filter(function(t){ return t.pass; }).length;
  return {
    phase:'P9.2',
    ok:passed === tests.length,
    passed:passed,
    total:tests.length,
    tests:tests
  };
}

function p9Json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function p9Query_(params) {
  return Object.keys(params).map(function(key){
    return encodeURIComponent(key) + '=' + encodeURIComponent(String(params[key]));
  }).join('&');
}

function p9RandomToken_() {
  return Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,'');
}

function p9Truthy_(value) {
  const v = String(value == null ? '' : value).trim().toLowerCase();
  return value === true || v === 'true' || v === '1' || v === 'yes';
}
