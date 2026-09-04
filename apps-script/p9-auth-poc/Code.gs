const P9_CONFIG = {
  SPREADSHEET_ID: '1wk_rVY8cgJbmS1PJBIP95Z_CGnz2a-QQjTVA1xqLIh8',
  MEMBERS_SHEET: 'Members',

  STATE_TTL_SECONDS: 600,

  AUTH_URL: 'https://accounts.google.com/o/oauth2/v2/auth',
  TOKEN_URL: 'https://oauth2.googleapis.com/token',
  TOKENINFO_URL: 'https://oauth2.googleapis.com/tokeninfo'
};


/**
 * =========================
 * Web App GET
 * =========================
 *
 * mode=probe
 * mode=config
 * mode=auth_start
 */
function doGet(e) {
  const mode = String(
    (e && e.parameter && e.parameter.mode) || ''
  ).trim();

  if (mode === 'probe') {
    return p9Json_({
      ok: true,
      phase: 'P9.2-compat',
      transport: 'GET',
      at: new Date().toISOString()
    });
  }

  if (mode === 'config') {
    return p9PublicConfig_();
  }

  if (mode === 'auth_start') {
    return p9AuthStart_(e);
  }

  return p9Json_({
    ok: true,
    phase: 'P9.2-compat',
    message: 'Isolated authentication API. No Admin CRUD is exposed.'
  });
}


/**
 * =========================
 * Web App POST
 * =========================
 *
 * mode=probe
 * mode=auth_finish
 */
function doPost(e) {
  const mode = String(
    (e && e.parameter && e.parameter.mode) || ''
  ).trim();

  if (mode === 'probe') {
    return p9Json_({
      ok: true,
      phase: 'P9.2-compat',
      transport: 'POST',
      echo: String(
        (e && e.parameter && e.parameter.echo) || ''
      ).slice(0, 120),
      at: new Date().toISOString()
    });
  }

  if (mode === 'auth_finish') {
    return p9AuthFinish_(e);
  }

  return p9Json_({
    ok: false,
    error: 'UNKNOWN_ACTION'
  });
}


/**
 * =========================
 * Step 1:
 * GitHub asks Apps Script to begin OAuth
 * =========================
 *
 * Browser:
 * GitHub Pages
 *    ↓ fetch
 * Apps Script ?mode=auth_start
 *
 * Apps Script generates:
 * - state
 * - PKCE verifier
 * - PKCE challenge
 *
 * Then returns the Google authorization URL.
 */
function p9AuthStart_(e) {
  try {
    const props = p9Properties_();

    const requestedReturn = String(
      (e && e.parameter && e.parameter.return_url) || ''
    ).trim();

    const returnUrl = p9ValidateReturnUrl_(
      requestedReturn,
      props.returnUrl
    );

    const state = p9RandomToken_();

    // PKCE
    const codeVerifier = p9PkceVerifier_();
    const codeChallenge = p9PkceChallenge_(codeVerifier);

    CacheService
      .getScriptCache()
      .put(
        'p9state:' + state,
        JSON.stringify({
          returnUrl: returnUrl,
          codeVerifier: codeVerifier,
          createdAt: Date.now()
        }),
        P9_CONFIG.STATE_TTL_SECONDS
      );

    const authUrl =
      P9_CONFIG.AUTH_URL +
      '?' +
      p9Query_({
        client_id: props.clientId,

        // IMPORTANT:
        // Google returns directly to GitHub Pages.
        redirect_uri: returnUrl,

        response_type: 'code',

        scope: 'openid email profile',

        state: state,

        prompt: 'select_account',

        access_type: 'online',

        include_granted_scopes: 'false',

        // PKCE
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      });

    return p9Json_({
      ok: true,
      phase: 'P9.2-compat',

      auth_url: authUrl,

      redirect_uri: returnUrl,

      state_ttl_seconds:
        P9_CONFIG.STATE_TTL_SECONDS,

      client_id_tail:
        props.clientId.slice(-18)
    });

  } catch (error) {
    console.error(
      'P9 auth start failed',
      error
    );

    return p9Json_({
      ok: false,
      error: String(
        (error && error.message) ||
        error ||
        'AUTH_START_FAILED'
      )
    });
  }
}


/**
 * =========================
 * Step 2:
 * GitHub receives:
 *
 * ?code=...
 * &state=...
 *
 * GitHub then POSTs:
 *
 * mode=auth_finish
 * code=...
 * state=...
 *
 * to Apps Script.
 * =========================
 */
function p9AuthFinish_(e) {
  const props = p9Properties_();

  const state = String(
    (e && e.parameter && e.parameter.state) || ''
  ).trim();

  const code = String(
    (e && e.parameter && e.parameter.code) || ''
  ).trim();

  const oauthError = String(
    (e &&
      e.parameter &&
      e.parameter.oauth_error) ||
    ''
  ).trim();


  /*
   * Verify + consume state atomically.
   * Lock prevents two simultaneous auth_finish requests
   * from both accepting the same state.
   */
  let stateData;

  try {
    stateData = p9ConsumeState_(state);
  } catch (error) {
    return p9Json_({
      authenticated: false,
      active: false,
      admin: false,
      error: String(
        (error && error.message) ||
        error ||
        'INVALID_OR_EXPIRED_STATE'
      )
    });
  }

  const returnUrl =
    p9ValidateReturnUrl_(
      stateData.returnUrl,
      props.returnUrl
    );


  if (oauthError) {
    return p9Json_({
      authenticated: false,
      active: false,
      admin: false,
      error:
        oauthError === 'access_denied'
          ? 'OAUTH_ACCESS_DENIED'
          : 'OAUTH_' +
            oauthError
              .toUpperCase()
              .replace(/[^A-Z0-9]+/g, '_')
    });
  }


  try {
    if (!code) {
      throw new Error(
        'MISSING_AUTHORIZATION_CODE'
      );
    }

    const codeVerifier =
      String(
        stateData.codeVerifier || ''
      ).trim();

    if (!codeVerifier) {
      throw new Error(
        'MISSING_PKCE_VERIFIER'
      );
    }


    /*
     * =========================
     * Exchange authorization code
     * for Google tokens
     * =========================
     */
    const tokenResponse =
      UrlFetchApp.fetch(
        P9_CONFIG.TOKEN_URL,
        {
          method: 'post',

          contentType:
            'application/x-www-form-urlencoded',

          payload: {
            code: code,

            client_id:
              props.clientId,

            client_secret:
              props.clientSecret,

            redirect_uri:
              returnUrl,

            grant_type:
              'authorization_code',

            code_verifier:
              codeVerifier
          },

          muteHttpExceptions:
            true
        }
      );


    const tokenStatus =
      tokenResponse.getResponseCode();

    const tokenText =
      tokenResponse.getContentText();


    if (tokenStatus !== 200) {
      console.error(
        'P9 token exchange failed',
        tokenStatus,
        tokenText
      );

      throw new Error(
        'TOKEN_EXCHANGE_FAILED_' +
        tokenStatus
      );
    }


    const tokenBody =
      JSON.parse(tokenText);


    if (!tokenBody.id_token) {
      throw new Error(
        'MISSING_ID_TOKEN'
      );
    }


    /*
     * =========================
     * Compatibility verifier.
     *
     * This keeps the already-working
     * Google tokeninfo validation path.
     *
     * P9.2 gate remains open until
     * production JWT signature verification
     * is solved without relying on unsupported
     * Apps Script crypto APIs.
     * =========================
     */
    const claimsResponse =
      UrlFetchApp.fetch(
        P9_CONFIG.TOKENINFO_URL +
          '?id_token=' +
          encodeURIComponent(
            tokenBody.id_token
          ),
        {
          muteHttpExceptions:
            true
        }
      );


    if (
      claimsResponse.getResponseCode()
      !== 200
    ) {
      throw new Error(
        'ID_TOKEN_INVALID'
      );
    }


    const claims =
      JSON.parse(
        claimsResponse.getContentText()
      );


    p9ValidateClaims_(
      claims,
      props.clientId
    );


    /*
     * =========================
     * Identity
     * =========================
     */
    const email =
      String(
        claims.email || ''
      )
        .trim()
        .toLowerCase();


    /*
     * =========================
     * Authorization
     * Members sheet remains
     * the source of truth.
     * =========================
     */
    const member =
      p9FindMember_(email);


    const active =
      !!member &&
      p9Truthy_(
        member.active
      );


    const admin =
      active &&
      p9Truthy_(
        member.admin_access
      );


    return p9Json_({
      authenticated: true,

      email: email,

      sub:
        String(
          claims.sub || ''
        ),

      active: active,

      admin: admin,

      member_found:
        !!member,

      token_exp:
        Number(
          claims.exp || 0
        )
    });

  } catch (error) {

    console.error(
      'P9 auth finish failed',
      error
    );

    return p9Json_({
      authenticated: false,
      active: false,
      admin: false,

      error: String(
        (error && error.message) ||
        error ||
        'AUTH_FAILED'
      )
    });
  }
}


/**
 * =========================
 * Manual owner authorization
 *
 * This name intentionally
 * DOES NOT end with "_"
 * so Apps Script shows it
 * in the Run dropdown.
 * =========================
 */
function p9AuthorizeProject() {
  const props =
    p9Properties_();

  const ss =
    SpreadsheetApp.openById(
      P9_CONFIG.SPREADSHEET_ID
    );

  const members =
    ss.getSheetByName(
      P9_CONFIG.MEMBERS_SHEET
    );

  if (!members) {
    throw new Error(
      'MEMBERS_SHEET_NOT_FOUND'
    );
  }


  const response =
    UrlFetchApp.fetch(
      'https://www.googleapis.com/oauth2/v3/certs',
      {
        muteHttpExceptions:
          true
      }
    );


  const result = {
    ok:
      response.getResponseCode()
      === 200,

    spreadsheet:
      ss.getName(),

    members_rows:
      members.getLastRow(),

    oauth_client_tail:
      props.clientId.slice(-18),

    urlfetch_status:
      response.getResponseCode()
  };


  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;
}


/**
 * =========================
 * Google ID token checks
 * =========================
 */
function p9ValidateClaims_(
  claims,
  expectedClientId
) {

  const iss =
    String(
      claims.iss || ''
    );


  if (
    iss !== 'accounts.google.com' &&
    iss !==
      'https://accounts.google.com'
  ) {
    throw new Error(
      'INVALID_ISSUER'
    );
  }


  if (
    String(
      claims.aud || ''
    ) !==
    expectedClientId
  ) {
    throw new Error(
      'INVALID_AUDIENCE'
    );
  }


  if (
    Number(
      claims.exp || 0
    ) <=
    Math.floor(
      Date.now() / 1000
    )
  ) {
    throw new Error(
      'TOKEN_EXPIRED'
    );
  }


  if (
    String(
      claims.email_verified || ''
    ).toLowerCase()
    !== 'true'
  ) {
    throw new Error(
      'EMAIL_NOT_VERIFIED'
    );
  }


  if (
    !String(
      claims.sub || ''
    ).trim()
  ) {
    throw new Error(
      'MISSING_SUB'
    );
  }


  if (
    !String(
      claims.email || ''
    ).trim()
  ) {
    throw new Error(
      'MISSING_EMAIL'
    );
  }
}


/**
 * =========================
 * Members authorization
 * =========================
 */
function p9FindMember_(email) {

  const ss =
    SpreadsheetApp.openById(
      P9_CONFIG.SPREADSHEET_ID
    );


  const sheet =
    ss.getSheetByName(
      P9_CONFIG.MEMBERS_SHEET
    );


  if (!sheet) {
    throw new Error(
      'MEMBERS_SHEET_NOT_FOUND'
    );
  }


  const values =
    sheet
      .getDataRange()
      .getDisplayValues();


  if (
    values.length < 2
  ) {
    return null;
  }


  const headers =
    values[0].map(
      function (value) {
        return String(
          value
        ).trim();
      }
    );


  const emailIndex =
    headers.indexOf(
      'email'
    );


  if (
    emailIndex < 0
  ) {
    throw new Error(
      'MEMBERS_EMAIL_COLUMN_NOT_FOUND'
    );
  }


  for (
    let rowIndex = 1;
    rowIndex <
      values.length;
    rowIndex++
  ) {

    const rowEmail =
      String(
        values[rowIndex][
          emailIndex
        ] || ''
      )
        .trim()
        .toLowerCase();


    if (
      rowEmail !== email
    ) {
      continue;
    }


    const member = {};


    headers.forEach(
      function (
        header,
        columnIndex
      ) {
        member[header] =
          values[rowIndex][
            columnIndex
          ];
      }
    );


    return member;
  }


  return null;
}


/**
 * =========================
 * Script Properties
 *
 * Required:
 *
 * P9_OAUTH_CLIENT_ID
 * P9_OAUTH_CLIENT_SECRET
 * P9_ALLOWED_RETURN_URL
 * =========================
 */
function p9Properties_() {

  const properties =
    PropertiesService
      .getScriptProperties();


  const result = {

    clientId:
      String(
        properties.getProperty(
          'P9_OAUTH_CLIENT_ID'
        ) || ''
      ).trim(),

    clientSecret:
      String(
        properties.getProperty(
          'P9_OAUTH_CLIENT_SECRET'
        ) || ''
      ).trim(),

    returnUrl:
      String(
        properties.getProperty(
          'P9_ALLOWED_RETURN_URL'
        ) || ''
      ).trim()
  };


  Object.keys(
    result
  ).forEach(
    function (key) {

      if (
        !result[key]
      ) {
        throw new Error(
          'Missing Script Property: ' +
          key
        );
      }

    }
  );


  return result;
}


/**
 * =========================
 * Public diagnostic config
 * =========================
 */
function p9PublicConfig_() {

  const props =
    p9Properties_();


  return p9Json_({

    ok: true,

    phase:
      'P9.2-compat',

    redirect_uri:
      props.returnUrl,

    allowed_return_url:
      props.returnUrl,

    client_id_tail:
      props.clientId.slice(-18)

  });
}


/**
 * =========================
 * Exact callback allowlist
 * =========================
 */
function p9ValidateReturnUrl_(
  requested,
  allowed
) {

  const cleanAllowed =
    String(
      allowed || ''
    )
      .trim()
      .split('#')[0];


  const cleanRequested =
    String(
      requested || ''
    )
      .trim()
      .split('#')[0];


  if (
    !cleanAllowed ||
    !/^https:\/\//i.test(
      cleanAllowed
    )
  ) {
    throw new Error(
      'RETURN_URL_NOT_ALLOWED'
    );
  }


  if (
    !cleanRequested
  ) {
    return cleanAllowed;
  }


  if (
    cleanRequested !==
    cleanAllowed
  ) {
    throw new Error(
      'RETURN_URL_NOT_ALLOWED'
    );
  }


  return cleanAllowed;
}


/**
 * =========================
 * State consumption
 * =========================
 *
 * - short lived
 * - single use
 * - atomic under ScriptLock
 * - explicit age check in addition to Cache TTL
 */
function p9ConsumeState_(state) {

  const cleanState =
    String(
      state || ''
    ).trim();


  if (
    !cleanState
  ) {
    throw new Error(
      'INVALID_OR_EXPIRED_STATE'
    );
  }


  const lock =
    LockService.getScriptLock();


  if (
    !lock.tryLock(5000)
  ) {
    throw new Error(
      'AUTH_BUSY'
    );
  }


  let cached;


  try {

    const cache =
      CacheService.getScriptCache();


    const stateKey =
      'p9state:' +
      cleanState;


    cached =
      cache.get(
        stateKey
      );


    if (
      !cached
    ) {
      throw new Error(
        'INVALID_OR_EXPIRED_STATE'
      );
    }


    /*
     * Delete while still holding the lock.
     * This makes replay fail even if two requests arrive together.
     */
    cache.remove(
      stateKey
    );

  } finally {

    lock.releaseLock();

  }


  let stateData;


  try {

    stateData =
      JSON.parse(
        cached
      );

  } catch (_) {

    throw new Error(
      'INVALID_OR_EXPIRED_STATE'
    );

  }


  if (
    !stateData ||
    !String(
      stateData.returnUrl || ''
    ).trim() ||
    !String(
      stateData.codeVerifier || ''
    ).trim() ||
    !Number(
      stateData.createdAt
    )
  ) {
    throw new Error(
      'INVALID_OR_EXPIRED_STATE'
    );
  }


  if (
    Date.now() -
      Number(
        stateData.createdAt
      ) >
    P9_CONFIG.STATE_TTL_SECONDS *
      1000
  ) {
    throw new Error(
      'INVALID_OR_EXPIRED_STATE'
    );
  }


  return stateData;
}


/**
 * =========================
 * PKCE
 * =========================
 */
function p9PkceVerifier_() {

  // Roughly 86 URL-safe chars.
  return (
    p9RandomToken_() +
    p9RandomToken_()
  ).slice(
    0,
    96
  );
}


function p9PkceChallenge_(
  verifier
) {

  const digest =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      verifier,
      Utilities.Charset.UTF_8
    );


  return Utilities
    .base64EncodeWebSafe(
      digest
    )
    .replace(
      /=+$/,
      ''
    );
}


/**
 * =========================
 * P9.2 compatibility self-test
 *
 * Manual only; not exposed by doGet/doPost.
 * =========================
 */
function p9RunSecuritySelfTests() {

  const props =
    p9Properties_();


  const tests = [];


  function record(
    name,
    fn
  ) {

    try {

      fn();

      tests.push({
        test: name,
        pass: true
      });

    } catch (error) {

      tests.push({
        test: name,
        pass: false,
        error: String(
          (error &&
            error.message) ||
          error
        )
      });

    }

  }


  function expectError(
    expected,
    fn
  ) {

    let actual = '';


    try {

      fn();

    } catch (error) {

      actual =
        String(
          (error &&
            error.message) ||
          error
        );

    }


    if (
      actual !==
      expected
    ) {
      throw new Error(
        'Expected ' +
        expected +
        ', got ' +
        (
          actual ||
          'NO_ERROR'
        )
      );
    }

  }


  record(
    'return_url exact allowlist',
    function () {

      const result =
        p9ValidateReturnUrl_(
          props.returnUrl,
          props.returnUrl
        );


      if (
        result !==
        props.returnUrl
      ) {
        throw new Error(
          'ALLOWLIST_MISMATCH'
        );
      }

    }
  );


  record(
    'return_url rejects foreign URL',
    function () {

      expectError(
        'RETURN_URL_NOT_ALLOWED',
        function () {

          p9ValidateReturnUrl_(
            'https://example.com/evil',
            props.returnUrl
          );

        }
      );

    }
  );


  record(
    'PKCE RFC7636 S256 vector',
    function () {

      const verifier =
        'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';


      const expected =
        'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';


      if (
        p9PkceChallenge_(
          verifier
        ) !==
        expected
      ) {
        throw new Error(
          'PKCE_VECTOR_FAILED'
        );
      }

    }
  );


  record(
    'state TTL <= 600 seconds',
    function () {

      if (
        P9_CONFIG
          .STATE_TTL_SECONDS >
        600
      ) {
        throw new Error(
          'STATE_TTL_TOO_LONG'
        );
      }

    }
  );


  record(
    'state single-use replay rejected',
    function () {

      const state =
        'selftest-' +
        p9RandomToken_();


      CacheService
        .getScriptCache()
        .put(
          'p9state:' +
            state,
          JSON.stringify({
            returnUrl:
              props.returnUrl,
            codeVerifier:
              p9PkceVerifier_(),
            createdAt:
              Date.now()
          }),
          60
        );


      p9ConsumeState_(
        state
      );


      expectError(
        'INVALID_OR_EXPIRED_STATE',
        function () {

          p9ConsumeState_(
            state
          );

        }
      );

    }
  );


  record(
    'expired state rejected',
    function () {

      const state =
        'selftest-' +
        p9RandomToken_();


      CacheService
        .getScriptCache()
        .put(
          'p9state:' +
            state,
          JSON.stringify({
            returnUrl:
              props.returnUrl,
            codeVerifier:
              p9PkceVerifier_(),
            createdAt:
              Date.now() -
              (
                P9_CONFIG
                  .STATE_TTL_SECONDS +
                5
              ) *
              1000
          }),
          60
        );


      expectError(
        'INVALID_OR_EXPIRED_STATE',
        function () {

          p9ConsumeState_(
            state
          );

        }
      );

    }
  );


  const now =
    Math.floor(
      Date.now() / 1000
    );


  const goodClaims = {
    iss:
      'https://accounts.google.com',

    aud:
      props.clientId,

    exp:
      now + 300,

    email_verified:
      true,

    sub:
      'self-test-sub',

    email:
      'self-test@example.com'
  };


  record(
    'valid claims accepted',
    function () {

      p9ValidateClaims_(
        goodClaims,
        props.clientId
      );

    }
  );


  record(
    'wrong audience rejected',
    function () {

      const claims =
        Object.assign(
          {},
          goodClaims,
          {
            aud:
              'wrong-client.apps.googleusercontent.com'
          }
        );


      expectError(
        'INVALID_AUDIENCE',
        function () {

          p9ValidateClaims_(
            claims,
            props.clientId
          );

        }
      );

    }
  );


  record(
    'expired token rejected',
    function () {

      const claims =
        Object.assign(
          {},
          goodClaims,
          {
            exp:
              now - 5
          }
        );


      expectError(
        'TOKEN_EXPIRED',
        function () {

          p9ValidateClaims_(
            claims,
            props.clientId
          );

        }
      );

    }
  );


  const passed =
    tests.filter(
      function (item) {
        return item.pass;
      }
    ).length;


  const result = {
    phase:
      'P9.2-compat',

    ok:
      passed ===
      tests.length,

    passed:
      passed,

    total:
      tests.length,

    tests:
      tests
  };


  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;
}


/**
 * =========================
 * Utilities
 * =========================
 */
function p9Json_(value) {

  return ContentService
    .createTextOutput(
      JSON.stringify(
        value
      )
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}


function p9Query_(params) {

  return Object
    .keys(params)
    .map(
      function (key) {

        return (
          encodeURIComponent(
            key
          ) +
          '=' +
          encodeURIComponent(
            String(
              params[key]
            )
          )
        );

      }
    )
    .join('&');
}


function p9RandomToken_() {

  return (
    Utilities
      .getUuid()
      .replace(
        /-/g,
        ''
      ) +

    Utilities
      .getUuid()
      .replace(
        /-/g,
        ''
      )
  );
}


function p9Truthy_(value) {

  const normalized =
    String(
      value == null
        ? ''
        : value
    )
      .trim()
      .toLowerCase();


  return (
    value === true ||
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'yes'
  );
}
