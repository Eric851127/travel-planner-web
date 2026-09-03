const ADMIN_CONFIG = {
  SPREADSHEET_ID: '1wk_rVY8cgJbmS1PJBIP95Z_CGnz2a-QQjTVA1xqLIh8',
  ITINERARY_SHEET: 'Itinerary',
  RESERVATIONS_SHEET: 'Reservations',
  PLACES_SHEET: 'Places',
  MEMBERS_SHEET: 'Members',
  GROUPS: ['ours', 'friends', 'all'],
  CERTAINTIES: ['confirmed', 'tentative', 'optional'],
  RESERVATION_CATEGORIES: ['hotel', 'flight', 'train', 'restaurant', 'activity', 'ticket', 'rental_car', 'other'],
  RESERVATION_STATUSES: ['not_required', 'planned', 'need_booking', 'booked', 'paid', 'cancelled']
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Admin')
    .setTitle('Travel Planner Admin')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function getAdminBootstrap() {
  const ss = SpreadsheetApp.openById(ADMIN_CONFIG.SPREADSHEET_ID);
  return {
    itinerary: readSheetObjects_(ss.getSheetByName(ADMIN_CONFIG.ITINERARY_SHEET)),
    reservations: readSheetObjects_(ss.getSheetByName(ADMIN_CONFIG.RESERVATIONS_SHEET)),
    places: readSheetObjects_(ss.getSheetByName(ADMIN_CONFIG.PLACES_SHEET)),
    members: readSheetObjects_(ss.getSheetByName(ADMIN_CONFIG.MEMBERS_SHEET)),
    enums: {
      group: ADMIN_CONFIG.GROUPS,
      certainty: ADMIN_CONFIG.CERTAINTIES,
      reservation_category: ADMIN_CONFIG.RESERVATION_CATEGORIES,
      reservation_status: ADMIN_CONFIG.RESERVATION_STATUSES
    }
  };
}

function saveItinerary(input) {
  return withWriteLock_(function() {
    const ss = SpreadsheetApp.openById(ADMIN_CONFIG.SPREADSHEET_ID);
    const sheet = requiredSheet_(ss, ADMIN_CONFIG.ITINERARY_SHEET);
    const table = readTable_(sheet);
    const clean = validateItinerary_(input || {}, table.objects, ss);
    const existingIndex = clean.id ? table.objects.findIndex(r => r.id === clean.id) : -1;

    if (existingIndex >= 0) {
      const merged = Object.assign({}, table.objects[existingIndex], clean);
      sheet.getRange(existingIndex + 2, 1, 1, table.headers.length)
        .setValues([table.headers.map(h => valueForSheet_(merged[h]))]);
      return { success: true, action: 'updated', id: merged.id };
    }

    const id = nextId_(table.objects.map(r => r.id), 'I', 3);
    const created = Object.assign({
      id,
      day: computeDay_(clean.date, table.objects),
      transport_id: '',
      reservation_id: '',
      notes: ''
    }, clean, { id });
    sheet.appendRow(table.headers.map(h => valueForSheet_(created[h])));
    return { success: true, action: 'created', id };
  });
}

function deleteItinerary(id) {
  const cleanId = String(id || '').trim();
  if (!/^I\d{3,}$/.test(cleanId)) throw new Error('無效的 itinerary id');
  return withWriteLock_(function() {
    const ss = SpreadsheetApp.openById(ADMIN_CONFIG.SPREADSHEET_ID);
    const sheet = requiredSheet_(ss, ADMIN_CONFIG.ITINERARY_SHEET);
    deleteById_(sheet, cleanId);
    return { success: true, action: 'deleted', id: cleanId };
  });
}

function saveReservation(input) {
  return withWriteLock_(function() {
    const ss = SpreadsheetApp.openById(ADMIN_CONFIG.SPREADSHEET_ID);
    const sheet = requiredSheet_(ss, ADMIN_CONFIG.RESERVATIONS_SHEET);
    const table = readTable_(sheet);
    const clean = validateReservation_(input || {}, table.objects, ss);
    const existingIndex = clean.id ? table.objects.findIndex(r => r.id === clean.id) : -1;

    if (existingIndex >= 0) {
      const merged = Object.assign({}, table.objects[existingIndex], clean);
      sheet.getRange(existingIndex + 2, 1, 1, table.headers.length)
        .setValues([table.headers.map(h => valueForSheet_(merged[h]))]);
      return { success: true, action: 'updated', id: merged.id };
    }

    const id = nextId_(table.objects.map(r => r.id), 'R', 3);
    const created = Object.assign({ id }, clean, { id });
    sheet.appendRow(table.headers.map(h => valueForSheet_(created[h])));
    return { success: true, action: 'created', id };
  });
}

function deleteReservation(id) {
  const cleanId = String(id || '').trim();
  if (!/^R\d{3,}$/.test(cleanId)) throw new Error('無效的 reservation id');
  return withWriteLock_(function() {
    const ss = SpreadsheetApp.openById(ADMIN_CONFIG.SPREADSHEET_ID);
    const itinerary = readSheetObjects_(requiredSheet_(ss, ADMIN_CONFIG.ITINERARY_SHEET));
    if (itinerary.some(r => r.reservation_id === cleanId)) {
      throw new Error('此預訂仍被 Itinerary 引用，請先解除 reservation_id 關聯');
    }
    const sheet = requiredSheet_(ss, ADMIN_CONFIG.RESERVATIONS_SHEET);
    deleteById_(sheet, cleanId);
    return { success: true, action: 'deleted', id: cleanId };
  });
}

function validateItinerary_(input, existingRows, ss) {
  const out = validateExistingId_(input.id, existingRows, /^I\d{3,}$/, '行程');
  out.date = requiredDate_(input.date, '日期');
  out.start_time = optionalTime_(input.start_time, '開始時間');
  out.end_time = optionalTime_(input.end_time, '結束時間');
  out.group = enumValue_(input.group, ADMIN_CONFIG.GROUPS, 'group');
  out.city = String(input.city || '').trim().slice(0, 100);
  out.title = requiredText_(input.title, '標題', 120);
  out.description = String(input.description || '').trim().slice(0, 1000);
  out.place_id = String(input.place_id || '').trim();
  out.certainty = enumValue_(input.certainty, ADMIN_CONFIG.CERTAINTIES, 'certainty');
  out.order = positiveNumber_(input.order, 'order');
  out.notes = String(input.notes || '').trim().slice(0, 1000);

  if (out.place_id) {
    const places = readSheetObjects_(requiredSheet_(ss, ADMIN_CONFIG.PLACES_SHEET));
    if (!places.some(p => p.id === out.place_id)) throw new Error('place_id 不存在');
  }
  return out;
}

function validateReservation_(input, existingRows, ss) {
  const out = validateExistingId_(input.id, existingRows, /^R\d{3,}$/, '預訂');
  out.category = enumValue_(input.category, ADMIN_CONFIG.RESERVATION_CATEGORIES, 'category');
  out.name = requiredText_(input.name, '名稱', 160);
  out.date = optionalDate_(input.date, '日期');
  out.time = optionalTime_(input.time, '時間');
  out.group = enumValue_(input.group, ADMIN_CONFIG.GROUPS, 'group');
  out.status = enumValue_(input.status, ADMIN_CONFIG.RESERVATION_STATUSES, 'status');
  out.owner_member_id = String(input.owner_member_id || '').trim();
  out.booking_url = optionalHttpsUrl_(input.booking_url, 'booking_url');
  out.deadline = optionalDate_(input.deadline, 'deadline');
  out.price = optionalNumber_(input.price, 'price');
  out.currency = String(input.currency || '').trim().toUpperCase().slice(0, 8);
  out.confirmation_no = String(input.confirmation_no || '').trim().slice(0, 120);
  out.notes = String(input.notes || '').trim().slice(0, 1000);

  if (out.owner_member_id) {
    const members = readSheetObjects_(requiredSheet_(ss, ADMIN_CONFIG.MEMBERS_SHEET));
    if (!members.some(m => m.id === out.owner_member_id)) throw new Error('owner_member_id 不存在');
  }
  return out;
}

function validateExistingId_(idValue, rows, pattern, label) {
  const out = {};
  const id = String(idValue || '').trim();
  if (!id) return out;
  if (!pattern.test(id)) throw new Error(label + ' id 格式錯誤');
  if (!rows.some(r => r.id === id)) throw new Error('找不到要修改的' + label);
  out.id = id;
  return out;
}

function readTable_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const rows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getDisplayValues()
    : [];
  return { headers, objects: rows.map(row => objectFromRow_(headers, row)) };
}

function readSheetObjects_(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1)
    .filter(row => row.some(v => String(v).trim() !== ''))
    .map(row => objectFromRow_(headers, row));
}

function objectFromRow_(headers, row) {
  const out = {};
  headers.forEach((h, i) => out[h] = row[i] === '' ? null : row[i]);
  return out;
}

function deleteById_(sheet, id) {
  const table = readTable_(sheet);
  const idIndex = table.headers.indexOf('id');
  if (idIndex < 0) throw new Error(sheet.getName() + ' 缺少 id 欄位');
  const rowIndex = table.objects.findIndex(r => r.id === id);
  if (rowIndex < 0) throw new Error('找不到指定資料');
  sheet.deleteRow(rowIndex + 2);
}

function requiredSheet_(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('找不到 ' + name + ' 工作表');
  return sheet;
}

function withWriteLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function nextId_(ids, prefix, width) {
  const max = ids.reduce((m, id) => {
    const match = String(id || '').match(new RegExp('^' + prefix + '(\\d+)$'));
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  return prefix + String(max + 1).padStart(width, '0');
}

function computeDay_(date, rows) {
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  const first = dates[0] || date;
  const start = new Date(first + 'T00:00:00Z');
  const current = new Date(date + 'T00:00:00Z');
  return Math.round((current - start) / 86400000) + 1;
}

function requiredDate_(value, label) {
  const v = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(label + '格式必須為 YYYY-MM-DD');
  return v;
}

function optionalDate_(value, label) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(label + '格式必須為 YYYY-MM-DD');
  return v;
}

function optionalTime_(value, label) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new Error(label + '格式必須為 HH:mm');
  return v;
}

function enumValue_(value, allowed, label) {
  const v = String(value || '').trim();
  if (!allowed.includes(v)) throw new Error(label + ' 值無效');
  return v;
}

function requiredText_(value, label, max) {
  const v = String(value || '').trim();
  if (!v) throw new Error(label + '不可空白');
  if (v.length > max) throw new Error(label + '過長');
  return v;
}

function positiveNumber_(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(label + ' 必須是 0 以上數字');
  return n;
}

function optionalNumber_(value, label) {
  const v = String(value == null ? '' : value).trim();
  if (!v) return '';
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(label + ' 必須是 0 以上數字');
  return n;
}

function optionalHttpsUrl_(value, label) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (!/^https:\/\//i.test(v)) throw new Error(label + ' 必須使用 https://');
  return v.slice(0, 1000);
}

function valueForSheet_(value) {
  return value === null || value === undefined ? '' : value;
}
