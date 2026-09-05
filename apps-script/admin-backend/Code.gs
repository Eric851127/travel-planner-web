const P9_CONFIG = {
  SPREADSHEET_ID: '1wk_rVY8cgJbmS1PJBIP95Z_CGnz2a-QQjTVA1xqLIh8',
  MEMBERS_SHEET: 'Members',
  STATE_TTL_SECONDS: 600,
  SESSION_TTL_SECONDS: 3600,
  AUTH_URL: 'https://accounts.google.com/o/oauth2/v2/auth',
  TOKEN_URL: 'https://oauth2.googleapis.com/token',
  TOKENINFO_URL: 'https://oauth2.googleapis.com/tokeninfo'
};

function doGet(e) {
  const mode = String((e && e.parameter && e.parameter.mode) || '').trim();
  if (mode === 'probe') return p9Json_({ok:true,phase:'P9.4-5-gate',transport:'GET',at:new Date().toISOString()});
  if (mode === 'config') return p9PublicConfig_();
  if (mode === 'auth_start') return p9AuthStart_(e);
  return p9Json_({ok:true,phase:'P9.4-5-gate',message:'Isolated auth/session/protected transport API. No Admin CRUD is exposed.'});
}

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

function p9AuthStart_(e) {
  try {
    const props = p9Properties_();
    const returnUrl = p9ValidateReturnUrl_(String((e && e.parameter && e.parameter.return_url)||'').trim(), props.returnUrl);
    const state = p9RandomToken_();
    const codeVerifier = p9PkceVerifier_();
    const codeChallenge = p9PkceChallenge_(codeVerifier);

    CacheService.getScriptCache().put(
      'p9state:' + state,
      JSON.stringify({returnUrl:returnUrl,codeVerifier:codeVerifier,createdAt:Date.now()}),
      P9_CONFIG.STATE_TTL_SECONDS
    );

    const authUrl = P9_CONFIG.AUTH_URL + '?' + p9Query_({
      client_id: props.clientId,
      redirect_uri: returnUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state: state,
      prompt: 'select_account',
      access_type: 'online',
      include_granted_scopes: 'false',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    return p9Json_({
      ok:true,
      phase:'P9.4-5-gate',
      auth_url:authUrl,
      redirect_uri:returnUrl,
      state_ttl_seconds:P9_CONFIG.STATE_TTL_SECONDS,
      session_ttl_seconds:P9_CONFIG.SESSION_TTL_SECONDS,
      client_id_tail:props.clientId.slice(-18)
    });
  } catch (error) {
    console.error('P9 auth start failed', error);
    return p9Json_({ok:false,error:p9Error_(error,'AUTH_START_FAILED')});
  }
}

function p9AuthFinish_(e) {
  try {
    const props = p9Properties_();
    const state = String((e && e.parameter && e.parameter.state)||'').trim();
    const code = String((e && e.parameter && e.parameter.code)||'').trim();
    const oauthError = String((e && e.parameter && e.parameter.oauth_error)||'').trim();
    const stateData = p9ConsumeState_(state);
    const returnUrl = p9ValidateReturnUrl_(stateData.returnUrl, props.returnUrl);

    if (oauthError) {
      return p9Json_({
        authenticated:false,active:false,admin:false,
        error:oauthError === 'access_denied' ? 'OAUTH_ACCESS_DENIED' : 'OAUTH_' + oauthError.toUpperCase().replace(/[^A-Z0-9]+/g,'_')
      });
    }
    if (!code) throw new Error('MISSING_AUTHORIZATION_CODE');

    const codeVerifier = String(stateData.codeVerifier || '').trim();
    if (!codeVerifier) throw new Error('MISSING_PKCE_VERIFIER');

    const tokenResponse = UrlFetchApp.fetch(P9_CONFIG.TOKEN_URL, {
      method:'post',
      contentType:'application/x-www-form-urlencoded',
      payload:{
        code:code,
        client_id:props.clientId,
        client_secret:props.clientSecret,
        redirect_uri:returnUrl,
        grant_type:'authorization_code',
        code_verifier:codeVerifier
      },
      muteHttpExceptions:true
    });

    const tokenStatus = tokenResponse.getResponseCode();
    if (tokenStatus !== 200) {
      console.error('P9 token exchange failed', tokenStatus, tokenResponse.getContentText());
      throw new Error('TOKEN_EXCHANGE_FAILED_' + tokenStatus);
    }

    const tokenBody = JSON.parse(tokenResponse.getContentText());
    if (!tokenBody.id_token) throw new Error('MISSING_ID_TOKEN');

    const claimsResponse = UrlFetchApp.fetch(
      P9_CONFIG.TOKENINFO_URL + '?id_token=' + encodeURIComponent(tokenBody.id_token),
      {muteHttpExceptions:true}
    );
    if (claimsResponse.getResponseCode() !== 200) throw new Error('ID_TOKEN_INVALID');

    const claims = JSON.parse(claimsResponse.getContentText());
    p9ValidateClaims_(claims, props.clientId);

    const email = String(claims.email || '').trim().toLowerCase();
    const member = p9FindMember_(email);
    const active = !!member && p9Truthy_(member.active);
    const admin = active && p9Truthy_(member.admin_access);

    const session = p9IssueSession_({sub:String(claims.sub || ''), email:email});

    return p9Json_({
      authenticated:true,
      email:email,
      sub:String(claims.sub || ''),
      active:active,
      admin:admin,
      member_found:!!member,
      token_exp:Number(claims.exp || 0),
      session_token:session.token,
      session_expires_at:session.exp
    });
  } catch (error) {
    console.error('P9 auth finish failed', error);
    return p9Json_({authenticated:false,active:false,admin:false,error:p9Error_(error,'AUTH_FAILED')});
  }
}

function p9SessionCheck_(e) {
  try {
    const token = String((e && e.parameter && e.parameter.session_token)||'').trim();
    const identity = p9VerifySessionToken_(token);
    const member = p9FindMember_(identity.email);
    const active = !!member && p9Truthy_(member.active);
    const admin = active && p9Truthy_(member.admin_access);

    return p9Json_({
      ok:true,
      authenticated:true,
      session_valid:true,
      email:identity.email,
      sub:identity.sub,
      session_exp:identity.exp,
      member_found:!!member,
      active:active,
      admin:admin,
      authorization:admin ? 'ADMIN' : 'FORBIDDEN'
    });
  } catch (error) {
    const code = p9SessionErrorCode_(error);
    return p9Json_({
      ok:false,
      authenticated:false,
      session_valid:false,
      active:false,
      admin:false,
      error:{code:code,message:p9UserMessage_(code)}
    });
  }
}

function p9SessionLogout_(e) {
  const token = String((e && e.parameter && e.parameter.session_token)||'').trim();
  if (!token) return p9Json_({ok:true,logged_out:true,already_logged_out:true});

  try {
    const identity = p9VerifySessionToken_(token);
    p9RevokeSession_(identity);
    return p9Json_({ok:true,logged_out:true});
  } catch (error) {
    const code = p9SessionErrorCode_(error);
    if (code === 'UNAUTHENTICATED' || code === 'SESSION_EXPIRED' || code === 'SESSION_REVOKED') {
      return p9Json_({ok:true,logged_out:true,already_logged_out:true});
    }
    return p9Json_({ok:false,error:{code:code,message:p9UserMessage_(code)}});
  }
}

function p9ProtectedApiProbe_(e, transport) {
  try {
    const token = String((e && e.parameter && e.parameter.session_token)||'').trim();
    const admin = p9RequireAdminSession_(token);
    return p9Json_({
      ok:true,
      data:{
        phase:'P9.5',
        protected:true,
        transport:String(transport || ''),
        email:admin.email,
        sub:admin.sub,
        session_exp:admin.session_exp,
        members_rechecked:true,
        at:new Date().toISOString()
      }
    });
  } catch (error) {
    const raw = p9Error_(error,'INTERNAL_ERROR');
    const code = raw === 'FORBIDDEN' ? 'FORBIDDEN' : p9SessionErrorCode_(error);
    return p9Json_({ok:false,error:{code:code,message:p9UserMessage_(code)}});
  }
}

function p9IssueSession_(identity) {
  const sub = String((identity && identity.sub)||'').trim();
  const email = String((identity && identity.email)||'').trim().toLowerCase();
  if (!sub || !email) throw new Error('SESSION_IDENTITY_INVALID');

  const now = Math.floor(Date.now()/1000);
  const payload = {v:1,sub:sub,email:email,iat:now,exp:now + P9_CONFIG.SESSION_TTL_SECONDS,nonce:p9RandomToken_()};
  const encoded = p9Base64UrlEncodeUtf8_(JSON.stringify(payload));
  const signingInput = 'tp1.' + encoded;
  return {token:signingInput + '.' + p9SessionSignature_(signingInput), exp:payload.exp};
}

function p9VerifySessionToken_(token) {
  const clean = String(token || '').trim();
  if (!clean) throw new Error('SESSION_MISSING');

  const parts = clean.split('.');
  if (parts.length !== 3 || parts[0] !== 'tp1' || !parts[1] || !parts[2]) throw new Error('SESSION_INVALID');

  const signingInput = parts[0] + '.' + parts[1];
  const expected = p9SessionSignature_(signingInput);
  if (!p9ConstantTimeEqual_(parts[2], expected)) throw new Error('SESSION_INVALID');

  let payload;
  try { payload = JSON.parse(p9Base64UrlDecodeUtf8_(parts[1])); }
  catch (_) { throw new Error('SESSION_INVALID'); }

  if (!payload || Number(payload.v) !== 1) throw new Error('SESSION_INVALID');

  const sub = String(payload.sub || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const iat = Number(payload.iat);
  const exp = Number(payload.exp);
  const nonce = String(payload.nonce || '').trim();
  if (!sub || !email || !iat || !exp || !nonce) throw new Error('SESSION_INVALID');

  const now = Math.floor(Date.now()/1000);
  if (iat > now + 60) throw new Error('SESSION_NOT_YET_VALID');
  if (exp <= now) throw new Error('SESSION_EXPIRED');
  if (exp <= iat || exp - iat > P9_CONFIG.SESSION_TTL_SECONDS + 60) throw new Error('SESSION_INVALID');
  if (p9IsSessionRevoked_(nonce)) throw new Error('SESSION_REVOKED');

  return {v:1,sub:sub,email:email,iat:iat,exp:exp,nonce:nonce};
}

function p9RequireAdminSession_(token) {
  const identity = p9VerifySessionToken_(token);
  const member = p9FindMember_(identity.email);
  const active = !!member && p9Truthy_(member.active);
  const admin = active && p9Truthy_(member.admin_access);
  if (!active || !admin) throw new Error('FORBIDDEN');
  return {sub:identity.sub,email:identity.email,session_exp:identity.exp,member:member};
}

function p9RevokeSession_(identity) {
  const nonce = String((identity && identity.nonce)||'').trim();
  const exp = Number(identity && identity.exp);
  if (!nonce || !exp) throw new Error('SESSION_INVALID');
  const now = Math.floor(Date.now()/1000);
  const ttl = Math.max(1, Math.min(P9_CONFIG.SESSION_TTL_SECONDS, exp - now));
  CacheService.getScriptCache().put('p9revoked:' + nonce, '1', ttl);
}

function p9IsSessionRevoked_(nonce) {
  const clean = String(nonce || '').trim();
  if (!clean) return true;
  return CacheService.getScriptCache().get('p9revoked:' + clean) === '1';
}

function p9SessionErrorCode_(error) {
  const raw = p9Error_(error,'SESSION_INVALID');
  if (raw === 'SESSION_EXPIRED') return 'SESSION_EXPIRED';
  if (raw === 'SESSION_REVOKED') return 'SESSION_REVOKED';
  if (raw === 'SESSION_NOT_YET_VALID') return 'UNAUTHENTICATED';
  if (raw === 'SESSION_MISSING' || raw === 'SESSION_INVALID') return 'UNAUTHENTICATED';
  return raw;
}

function p9UserMessage_(code) {
  const messages = {
    UNAUTHENTICATED:'Please sign in again.',
    SESSION_EXPIRED:'Your session has expired. Please sign in again.',
    SESSION_REVOKED:'This session has been signed out. Please sign in again.',
    FORBIDDEN:'Your account is signed in but does not have Admin access.',
    INTERNAL_ERROR:'An internal error occurred.'
  };
  return messages[String(code || '')] || String(code || 'INTERNAL_ERROR');
}

function p9SessionSignature_(signingInput) {
  const bytes = Utilities.computeHmacSha256Signature(String(signingInput),p9SessionSecret_(),Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,'');
}

function p9SessionSecret_() {
  const secret = String(PropertiesService.getScriptProperties().getProperty('P9_SESSION_SECRET') || '').trim();
  if (!secret) throw new Error('Missing Script Property: sessionSecret');
  return secret;
}

function p9SetupSessionSecret() {
  const properties = PropertiesService.getScriptProperties();
  const existing = String(properties.getProperty('P9_SESSION_SECRET') || '').trim();
  if (existing) {
    const result = {ok:true,created:false,message:'P9_SESSION_SECRET already exists.'};
    console.log(JSON.stringify(result,null,2));
    return result;
  }
  const secret = p9RandomToken_() + p9RandomToken_();
  properties.setProperty('P9_SESSION_SECRET', secret);
  const result = {ok:true,created:true,message:'P9_SESSION_SECRET created.'};
  console.log(JSON.stringify(result,null,2));
  return result;
}

function p9AuthorizeProject() {
  const props = p9Properties_();
  const ss = SpreadsheetApp.openById(P9_CONFIG.SPREADSHEET_ID);
  const members = ss.getSheetByName(P9_CONFIG.MEMBERS_SHEET);
  if (!members) throw new Error('MEMBERS_SHEET_NOT_FOUND');
  const response = UrlFetchApp.fetch('https://www.googleapis.com/oauth2/v3/certs',{muteHttpExceptions:true});
  const result = {
    ok:response.getResponseCode() === 200,
    spreadsheet:ss.getName(),
    members_rows:members.getLastRow(),
    oauth_client_tail:props.clientId.slice(-18),
    urlfetch_status:response.getResponseCode(),
    session_secret_ready:!!String(PropertiesService.getScriptProperties().getProperty('P9_SESSION_SECRET')||'').trim(),
    session_ttl_seconds:P9_CONFIG.SESSION_TTL_SECONDS
  };
  console.log(JSON.stringify(result,null,2));
  return result;
}

function p9ValidateClaims_(claims, expectedClientId) {
  const iss = String(claims.iss || '');
  if (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') throw new Error('INVALID_ISSUER');
  if (String(claims.aud || '') !== expectedClientId) throw new Error('INVALID_AUDIENCE');
  if (Number(claims.exp || 0) <= Math.floor(Date.now()/1000)) throw new Error('TOKEN_EXPIRED');
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
  const headers = values[0].map(function(v){return String(v).trim();});
  const emailIndex = headers.indexOf('email');
  if (emailIndex < 0) throw new Error('MEMBERS_EMAIL_COLUMN_NOT_FOUND');
  for (let rowIndex=1; rowIndex<values.length; rowIndex++) {
    const rowEmail = String(values[rowIndex][emailIndex] || '').trim().toLowerCase();
    if (rowEmail !== email) continue;
    const member = {};
    headers.forEach(function(header,columnIndex){member[header]=values[rowIndex][columnIndex];});
    return member;
  }
  return null;
}

function p9Properties_() {
  const properties = PropertiesService.getScriptProperties();
  const result = {
    clientId:String(properties.getProperty('P9_OAUTH_CLIENT_ID')||'').trim(),
    clientSecret:String(properties.getProperty('P9_OAUTH_CLIENT_SECRET')||'').trim(),
    returnUrl:String(properties.getProperty('P9_ALLOWED_RETURN_URL')||'').trim()
  };
  Object.keys(result).forEach(function(key){if (!result[key]) throw new Error('Missing Script Property: ' + key);});
  return result;
}

function p9PublicConfig_() {
  const props = p9Properties_();
  return p9Json_({
    ok:true,
    phase:'P9.4-5-gate',
    redirect_uri:props.returnUrl,
    allowed_return_url:props.returnUrl,
    client_id_tail:props.clientId.slice(-18),
    state_ttl_seconds:P9_CONFIG.STATE_TTL_SECONDS,
    session_ttl_seconds:P9_CONFIG.SESSION_TTL_SECONDS,
    session_format:'tp1-HMAC-SHA256',
    authorization_source:'Members',
    protected_probe_get:false,
    protected_probe_post:true,
    logout_revokes_session:true
  });
}

function p9ValidateReturnUrl_(requested, allowed) {
  const cleanAllowed = String(allowed || '').trim().split('#')[0];
  const cleanRequested = String(requested || '').trim().split('#')[0];
  if (!cleanAllowed || !/^https:\/\//i.test(cleanAllowed)) throw new Error('RETURN_URL_NOT_ALLOWED');
  if (!cleanRequested) return cleanAllowed;
  if (cleanRequested !== cleanAllowed) throw new Error('RETURN_URL_NOT_ALLOWED');
  return cleanAllowed;
}

function p9ConsumeState_(state) {
  const cleanState = String(state || '').trim();
  if (!cleanState) throw new Error('INVALID_OR_EXPIRED_STATE');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('AUTH_BUSY');
  let cached;
  try {
    const cache = CacheService.getScriptCache();
    const key = 'p9state:' + cleanState;
    cached = cache.get(key);
    if (!cached) throw new Error('INVALID_OR_EXPIRED_STATE');
    cache.remove(key);
  } finally {
    lock.releaseLock();
  }
  let stateData;
  try { stateData = JSON.parse(cached); }
  catch (_) { throw new Error('INVALID_OR_EXPIRED_STATE'); }
  if (!stateData || !String(stateData.returnUrl || '').trim() || !String(stateData.codeVerifier || '').trim() || !Number(stateData.createdAt)) throw new Error('INVALID_OR_EXPIRED_STATE');
  if (Date.now() - Number(stateData.createdAt) > P9_CONFIG.STATE_TTL_SECONDS * 1000) throw new Error('INVALID_OR_EXPIRED_STATE');
  return stateData;
}

function p9PkceVerifier_() { return (p9RandomToken_() + p9RandomToken_()).slice(0,96); }

function p9PkceChallenge_(verifier) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,verifier,Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/,'');
}

function p9Base64UrlEncodeUtf8_(text) {
  return Utilities.base64EncodeWebSafe(String(text),Utilities.Charset.UTF_8).replace(/=+$/,'');
}

function p9Base64UrlDecodeUtf8_(value) {
  let padded = String(value || '').replace(/-/g,'+').replace(/_/g,'/');
  while (padded.length % 4) padded += '=';
  return Utilities.newBlob(Utilities.base64Decode(padded)).getDataAsString('UTF-8');
}

function p9ConstantTimeEqual_(left,right) {
  const a=String(left||''), b=String(right||'');
  let diff=a.length ^ b.length;
  const max=Math.max(a.length,b.length);
  for (let i=0;i<max;i++) {
    const ac=i<a.length?a.charCodeAt(i):0;
    const bc=i<b.length?b.charCodeAt(i):0;
    diff |= ac ^ bc;
  }
  return diff === 0;
}

function p9RunSecuritySelfTests() {
  const props = p9Properties_();
  const tests = [];
  function record(name, fn) {
    try { fn(); tests.push({test:name,pass:true}); }
    catch (error) { tests.push({test:name,pass:false,error:p9Error_(error,'TEST_FAILED')}); }
  }
  function expectError(expected, fn) {
    let actual = '';
    try { fn(); } catch (error) { actual = p9Error_(error,''); }
    if (actual !== expected) throw new Error('Expected ' + expected + ', got ' + (actual || 'NO_ERROR'));
  }
  record('return_url exact allowlist', function(){if (p9ValidateReturnUrl_(props.returnUrl,props.returnUrl) !== props.returnUrl) throw new Error('ALLOWLIST_MISMATCH');});
  record('return_url rejects foreign URL', function(){expectError('RETURN_URL_NOT_ALLOWED',function(){p9ValidateReturnUrl_('https://example.com/evil',props.returnUrl);});});
  record('PKCE RFC7636 S256 vector', function(){
    const verifier='dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected='E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    if (p9PkceChallenge_(verifier) !== expected) throw new Error('PKCE_VECTOR_FAILED');
  });
  record('state TTL <= 600 seconds', function(){if (P9_CONFIG.STATE_TTL_SECONDS > 600) throw new Error('STATE_TTL_TOO_LONG');});
  record('state single-use replay rejected', function(){
    const state='selftest-'+p9RandomToken_();
    CacheService.getScriptCache().put('p9state:'+state,JSON.stringify({returnUrl:props.returnUrl,codeVerifier:p9PkceVerifier_(),createdAt:Date.now()}),60);
    p9ConsumeState_(state);
    expectError('INVALID_OR_EXPIRED_STATE',function(){p9ConsumeState_(state);});
  });
  record('expired state rejected', function(){
    const state='selftest-'+p9RandomToken_();
    CacheService.getScriptCache().put('p9state:'+state,JSON.stringify({returnUrl:props.returnUrl,codeVerifier:p9PkceVerifier_(),createdAt:Date.now()-(P9_CONFIG.STATE_TTL_SECONDS+5)*1000}),60);
    expectError('INVALID_OR_EXPIRED_STATE',function(){p9ConsumeState_(state);});
  });
  const now=Math.floor(Date.now()/1000);
  const goodClaims={iss:'https://accounts.google.com',aud:props.clientId,exp:now+300,email_verified:true,sub:'self-test-sub',email:'self-test@example.com'};
  record('valid claims accepted',function(){p9ValidateClaims_(goodClaims,props.clientId);});
  record('wrong audience rejected',function(){const c=Object.assign({},goodClaims,{aud:'wrong-client.apps.googleusercontent.com'});expectError('INVALID_AUDIENCE',function(){p9ValidateClaims_(c,props.clientId);});});
  record('expired token rejected',function(){const c=Object.assign({},goodClaims,{exp:now-5});expectError('TOKEN_EXPIRED',function(){p9ValidateClaims_(c,props.clientId);});});
  record('session secret exists',function(){p9SessionSecret_();});
  record('signed session accepted',function(){const session=p9IssueSession_({sub:'self-test-sub',email:'self-test@example.com'});const identity=p9VerifySessionToken_(session.token);if (identity.sub !== 'self-test-sub' || identity.email !== 'self-test@example.com') throw new Error('SESSION_IDENTITY_MISMATCH');});
  record('tampered session rejected',function(){const session=p9IssueSession_({sub:'self-test-sub',email:'self-test@example.com'});const parts=session.token.split('.');parts[1]=parts[1].slice(0,-1)+(parts[1].slice(-1)==='A'?'B':'A');expectError('SESSION_INVALID',function(){p9VerifySessionToken_(parts.join('.'));});});
  record('expired session rejected',function(){const payload={v:1,sub:'self-test-sub',email:'self-test@example.com',iat:now-P9_CONFIG.SESSION_TTL_SECONDS-10,exp:now-1,nonce:p9RandomToken_()};const encoded=p9Base64UrlEncodeUtf8_(JSON.stringify(payload));const input='tp1.'+encoded;const token=input+'.'+p9SessionSignature_(input);expectError('SESSION_EXPIRED',function(){p9VerifySessionToken_(token);});});
  record('future session rejected',function(){const payload={v:1,sub:'self-test-sub',email:'self-test@example.com',iat:now+120,exp:now+300,nonce:p9RandomToken_()};const encoded=p9Base64UrlEncodeUtf8_(JSON.stringify(payload));const input='tp1.'+encoded;const token=input+'.'+p9SessionSignature_(input);expectError('SESSION_NOT_YET_VALID',function(){p9VerifySessionToken_(token);});});
  record('logout revokes session server-side',function(){const session=p9IssueSession_({sub:'self-test-sub',email:'self-test@example.com'});const identity=p9VerifySessionToken_(session.token);p9RevokeSession_(identity);expectError('SESSION_REVOKED',function(){p9VerifySessionToken_(session.token);});});
  record('missing session maps to UNAUTHENTICATED',function(){try { p9VerifySessionToken_(''); } catch (error) {if (p9SessionErrorCode_(error) !== 'UNAUTHENTICATED') throw new Error('SESSION_ERROR_MAPPING_FAILED');return;}throw new Error('EXPECTED_ERROR');});
  record('forbidden is distinct from unauthenticated',function(){if (p9UserMessage_('FORBIDDEN') === p9UserMessage_('UNAUTHENTICATED')) throw new Error('ERROR_CONTRACT_COLLISION');});
  const passed=tests.filter(function(t){return t.pass;}).length;
  const result={phase:'P9.4-5-gate',ok:passed===tests.length,passed:passed,total:tests.length,tests:tests};
  console.log(JSON.stringify(result,null,2));
  return result;
}

function p9Json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function p9Query_(params) { return Object.keys(params).map(function(key){return encodeURIComponent(key)+'='+encodeURIComponent(String(params[key]));}).join('&'); }
function p9RandomToken_() { return Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,''); }
function p9Truthy_(value) { const normalized=String(value==null?'':value).trim().toLowerCase(); return value===true || normalized==='true' || normalized==='1' || normalized==='yes'; }
function p9Error_(error,fallback) { return String((error && error.message)||error||fallback||'INTERNAL_ERROR').trim(); }