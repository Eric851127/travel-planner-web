const CONFIG = {
  API_VERSION: 'v1',
  SPREADSHEET_ID: '1wk_rVY8cgJbmS1PJBIP95Z_CGnz2a-QQjTVA1xqLIh8',
  DEFAULT_RESOURCE: 'health',

  RESOURCES: {
    itinerary: 'Itinerary',
    hotels: 'Hotels',
    flights: 'Flights',
    transport: 'Transport',
    reservations: 'Reservations',
    places: 'Places',
    members: 'Members'
  }
};

/* =========================================================
 * P3.4 PUBLIC API FIELD WHITELIST
 * ========================================================= */

const PUBLIC_FIELDS = {
  itinerary: [
    'id','date','day','start_time','end_time','group','city','title','description',
    'place_id','transport_id','reservation_id','certainty','order'
  ],
  hotels: [
    'id','city','hotel_name','check_in','check_out','group','address','place_id',
    'google_maps_url','reservation_id'
  ],
  flights: [
    'id','date','airline','flight_no','departure_airport','arrival_airport',
    'departure_time','arrival_time','group','reservation_id'
  ],
  transport: [
    'id','date','type','from_place_id','to_place_id','departure_time','arrival_time',
    'operator','service_no','group','reservation_required','reservation_id'
  ],
  reservations: [
    'id','category','name','date','time','group','status','owner_member_id','deadline',
    'price','currency'
  ],
  places: [
    'id','name','city','category','address','google_maps_url','latitude','longitude',
    'opening_hours','website'
  ],
  members: [
    'id','name','group','role','active'
  ]
};

/* =========================================================
 * GET
 * ========================================================= */

function doGet(e) {
  const startedAt = Date.now();

  try {
    const request = normalizeRequest_(e);

    if (request.resource === 'health') {
      return jsonResponse_({
        success: true,
        data: {
          status: 'ok',
          api_version: CONFIG.API_VERSION
        },
        meta: buildMeta_(startedAt, 1, request)
      }, request);
    }

    if (!CONFIG.RESOURCES[request.resource]) {
      return errorResponse_(
        'INVALID_RESOURCE',
        'Unknown resource: ' + request.resource,
        startedAt,
        request
      );
    }

    const rows = readResource_(request.resource);

    const filtered = filterRows_(
      rows,
      request.resource,
      request.params
    );

    const sorted = sortRows_(
      filtered,
      request.resource
    );

    const publicRows = projectPublicFields_(
      request.resource,
      sorted
    );

    return jsonResponse_({
      success: true,
      data: publicRows,
      meta: buildMeta_(
        startedAt,
        publicRows.length,
        request
      )
    }, request);

  } catch (err) {
    return errorResponse_(
      'INTERNAL_ERROR',
      err && err.message
        ? err.message
        : String(err),
      startedAt,
      normalizeRequest_(e)
    );
  }
}

/* =========================================================
 * REQUEST
 * ========================================================= */

function normalizeRequest_(e) {
  const params = Object.assign(
    {},
    (e && e.parameter) || {}
  );

  const pathResource = String(
    (e && e.pathInfo) || ''
  )
    .replace(/^\/+|\/+$/g, '')
    .split('/')[0]
    .toLowerCase();

  const queryResource = String(
    params.resource || ''
  )
    .trim()
    .toLowerCase();

  const resource =
    pathResource ||
    queryResource ||
    CONFIG.DEFAULT_RESOURCE;

  const callback = String(
    params.callback || ''
  ).trim();

  delete params.resource;
  delete params.callback;

  Object.keys(params).forEach(function(key) {
    if (typeof params[key] === 'string') {
      params[key] = params[key].trim();
    }
  });

  return {
    resource: resource,
    params: params,
    callback: callback
  };
}

/* =========================================================
 * SHEET READER
 * ========================================================= */

function readResource_(resource) {
  const sheetName = CONFIG.RESOURCES[resource];

  if (!sheetName) {
    throw new Error(
      'Sheet mapping not found for resource: ' +
      resource
    );
  }

  const ss = SpreadsheetApp.openById(
    CONFIG.SPREADSHEET_ID
  );

  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(
      'Sheet not found: ' + sheetName
    );
  }

  const values = sheet
    .getDataRange()
    .getDisplayValues();

  if (!values.length) {
    return [];
  }

  const headers = values[0].map(function(header) {
    return String(header).trim();
  });

  validateHeaders_(headers, sheetName);

  if (values.length === 1) {
    return [];
  }

  return values
    .slice(1)
    .filter(function(row) {
      return row.some(function(value) {
        return String(value).trim() !== '';
      });
    })
    .map(function(row) {
      const item = {};

      headers.forEach(function(header, index) {
        item[header] = normalizeValue_(
          resource,
          header,
          row[index]
        );
      });

      return item;
    });
}

function validateHeaders_(headers, sheetName) {
  if (!headers.length || headers[0] !== 'id') {
    throw new Error(
      sheetName +
      ': first header must be "id".'
    );
  }

  const seen = {};

  headers.forEach(function(header) {
    if (!header) {
      throw new Error(
        sheetName +
        ': blank header detected.'
      );
    }

    if (seen[header]) {
      throw new Error(
        sheetName +
        ': duplicate header "' +
        header +
        '".'
      );
    }

    seen[header] = true;
  });
}

/* =========================================================
 * VALUE NORMALIZATION
 * ========================================================= */

function normalizeValue_(resource, field, value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {
    return null;
  }

  const raw = String(value).trim();

  if (
    field === 'day' ||
    field === 'order' ||
    field === 'price'
  ) {
    const numberValue = Number(
      raw.replace(/,/g, '')
    );

    return Number.isNaN(numberValue)
      ? raw
      : numberValue;
  }

  if (
    field === 'active' ||
    field === 'reservation_required'
  ) {
    return parseBoolean_(raw);
  }

  return raw;
}

function parseBoolean_(value) {
  const normalized = String(value)
    .trim()
    .toLowerCase();

  if (
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === '1'
  ) {
    return true;
  }

  if (
    normalized === 'false' ||
    normalized === 'no' ||
    normalized === '0'
  ) {
    return false;
  }

  return value;
}

/* =========================================================
 * FILTERS
 * ========================================================= */

function filterRows_(rows, resource, params) {
  const allowedFilters = {
    itinerary: [
      'id',
      'date',
      'group',
      'city',
      'certainty',
      'place_id',
      'transport_id',
      'reservation_id'
    ],

    hotels: [
      'id',
      'city',
      'group',
      'place_id',
      'reservation_id'
    ],

    flights: [
      'id',
      'date',
      'group',
      'airline',
      'flight_no',
      'reservation_id'
    ],

    transport: [
      'id',
      'date',
      'group',
      'type',
      'reservation_required',
      'reservation_id'
    ],

    reservations: [
      'id',
      'category',
      'date',
      'group',
      'status',
      'owner_member_id'
    ],

    places: [
      'id',
      'city',
      'category'
    ],

    members: [
      'id',
      'group',
      'role',
      'active'
    ]
  };

  const allowed =
    allowedFilters[resource] || [];

  const filterEntries = Object.keys(params)
    .filter(function(key) {
      return allowed.indexOf(key) !== -1;
    })
    .map(function(key) {
      return [
        key,
        String(params[key])
          .split(',')
          .map(function(value) {
            return value
              .trim()
              .toLowerCase();
          })
          .filter(Boolean)
      ];
    });

  if (!filterEntries.length) {
    return rows;
  }

  return rows.filter(function(row) {
    return filterEntries.every(function(entry) {
      const key = entry[0];
      const acceptedValues = entry[1];

      const rowValue = normalizeCompareValue_(
        row[key]
      );

      return acceptedValues.some(
        function(accepted) {
          return rowValue === accepted;
        }
      );
    });
  });
}

function normalizeCompareValue_(value) {
  if (value === true) return 'true';
  if (value === false) return 'false';

  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value)
    .trim()
    .toLowerCase();
}

/* =========================================================
 * SORTING
 * ========================================================= */

function sortRows_(rows, resource) {
  const output = rows.slice();

  output.sort(function(a, b) {
    if (resource === 'itinerary') {
      return compareValues_(a.date, b.date) ||
        compareValues_(a.order, b.order) ||
        compareValues_(a.start_time, b.start_time) ||
        compareValues_(a.id, b.id);
    }

    if (resource === 'hotels') {
      return compareValues_(a.check_in, b.check_in) ||
        compareValues_(a.city, b.city) ||
        compareValues_(a.id, b.id);
    }

    if (resource === 'flights') {
      return compareValues_(a.date, b.date) ||
        compareValues_(
          a.departure_time,
          b.departure_time
        ) ||
        compareValues_(a.id, b.id);
    }

    if (resource === 'transport') {
      return compareValues_(a.date, b.date) ||
        compareValues_(
          a.departure_time,
          b.departure_time
        ) ||
        compareValues_(a.id, b.id);
    }

    if (resource === 'reservations') {
      return compareValues_(a.date, b.date) ||
        compareValues_(a.time, b.time) ||
        compareValues_(a.id, b.id);
    }

    if (resource === 'places') {
      return compareValues_(a.city, b.city) ||
        compareValues_(a.name, b.name) ||
        compareValues_(a.id, b.id);
    }

    if (resource === 'members') {
      return compareValues_(a.group, b.group) ||
        compareValues_(a.name, b.name) ||
        compareValues_(a.id, b.id);
    }

    return 0;
  });

  return output;
}

function compareValues_(a, b) {
  if (a === b) return 0;

  if (
    a === null ||
    a === undefined ||
    a === ''
  ) {
    return 1;
  }

  if (
    b === null ||
    b === undefined ||
    b === ''
  ) {
    return -1;
  }

  if (
    typeof a === 'number' &&
    typeof b === 'number'
  ) {
    return a - b;
  }

  return String(a).localeCompare(
    String(b),
    'en',
    {
      numeric: true,
      sensitivity: 'base'
    }
  );
}

/* =========================================================
 * P3.4 PUBLIC PROJECTION
 * ========================================================= */

function projectPublicFields_(resource, rows) {
  const allowed = PUBLIC_FIELDS[resource];

  if (!allowed) {
    return rows;
  }

  return rows.map(function(row) {
    const output = {};

    allowed.forEach(function(field) {
      if (
        Object.prototype
          .hasOwnProperty
          .call(row, field)
      ) {
        output[field] = row[field];
      }
    });

    return output;
  });
}

/* =========================================================
 * RESPONSE
 * ========================================================= */

function buildMeta_(startedAt, count, request) {
  return {
    api_version: CONFIG.API_VERSION,
    count: count,
    generated_at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt
  };
}

function jsonResponse_(payload, request) {
  const json = JSON.stringify(payload);

  if (request && request.callback) {
    if (
      !/^[A-Za-z_$][0-9A-Za-z_$]*$/
        .test(request.callback)
    ) {
      return ContentService
        .createTextOutput(
          JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_CALLBACK',
              message: 'Invalid JSONP callback.'
            }
          })
        )
        .setMimeType(
          ContentService.MimeType.JSON
        );
    }

    return ContentService
      .createTextOutput(
        request.callback +
        '(' +
        json +
        ');'
      )
      .setMimeType(
        ContentService.MimeType.JAVASCRIPT
      );
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(
      ContentService.MimeType.JSON
    );
}

function errorResponse_(
  code,
  message,
  startedAt,
  request,
  extra
) {
  return jsonResponse_({
    success: false,

    error: Object.assign(
      {
        code: code,
        message: message
      },
      extra || {}
    ),

    meta: buildMeta_(
      startedAt,
      0,
      request
    )
  }, request);
}

/* =========================================================
 * SMOKE TESTS
 * ========================================================= */

function testApi_() {
  const itinerary = readResource_(
    'itinerary'
  );

  const ours = filterRows_(
    itinerary,
    'itinerary',
    {
      date: '2026-12-24',
      group: 'ours'
    }
  );

  Logger.log(
    'Itinerary 2026-12-24 ours:'
  );
  Logger.log(
    JSON.stringify(
      projectPublicFields_(
        'itinerary',
        sortRows_(
          ours,
          'itinerary'
        )
      ),
      null,
      2
    )
  );

  const reservations =
    readResource_('reservations');

  const needBooking =
    filterRows_(
      reservations,
      'reservations',
      {
        status: 'need_booking'
      }
    );

  Logger.log(
    'Reservations need_booking:'
  );

  Logger.log(
    JSON.stringify(
      projectPublicFields_(
        'reservations',
        sortRows_(
          needBooking,
          'reservations'
        )
      ),
      null,
      2
    )
  );

  testPublicFieldSecurity_();
}

function testPublicFieldSecurity_() {
  const hotels = projectPublicFields_(
    'hotels',
    readResource_('hotels')
  );

  const flights = projectPublicFields_(
    'flights',
    readResource_('flights')
  );

  const reservations =
    projectPublicFields_(
      'reservations',
      readResource_('reservations')
    );

  assertNoField_(
    hotels,
    'confirmation_no'
  );

  assertNoField_(
    hotels,
    'booking_url'
  );

  assertNoField_(
    flights,
    'booking_reference'
  );

  assertNoField_(
    reservations,
    'confirmation_no'
  );

  assertNoField_(
    reservations,
    'booking_url'
  );

  Logger.log(
    'P3.4 public field security tests: PASS'
  );
}

function assertNoField_(rows, field) {
  rows.forEach(function(row) {
    if (
      Object.prototype
        .hasOwnProperty
        .call(row, field)
    ) {
      throw new Error(
        'SECURITY TEST FAILED: ' +
        field +
        ' is publicly exposed.'
      );
    }
  });
}
