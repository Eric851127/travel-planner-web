const ADMIN_CONFIG = {
  SPREADSHEET_ID: '1wk_rVY8cgJbmS1PJBIP95Z_CGnz2a-QQjTVA1xqLIh8',
  ITINERARY_SHEET: 'Itinerary',
  PLACES_SHEET: 'Places',
  GROUPS: ['ours', 'friends', 'all'],
  CERTAINTIES: ['confirmed', 'tentative', 'optional']
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
    places: readSheetObjects_(ss.getSheetByName(ADMIN_CONFIG.PLACES_SHEET)),
    enums: {
      group: ADMIN_CONFIG.GROUPS,
      certainty: ADMIN_CONFIG.CERTAINTIES
    }
  };
}

function saveItinerary(input) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(ADMIN_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ADMIN_CONFIG.ITINERARY_SHEET);
    if (!sheet) throw new Error('找不到 Itinerary 工作表');

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const rows = sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getDisplayValues()
      : [];
    const objects = rows.map(row => objectFromRow_(headers, row));

    const clean = validateItinerary_(input || {}, objects);
    const existingIndex = clean.id ? objects.findIndex(r => r.id === clean.id) : -1;

    if (existingIndex >= 0) {
      const existing = objects[existingIndex];
      const merged = Object.assign({}, existing, clean);
      const rowValues = headers.map(h => valueForSheet_(merged[h]));
      sheet.getRange(existingIndex + 2, 1, 1, headers.length).setValues([rowValues]);
      return { success: true, action: 'updated', id: merged.id };
    }

    const id = nextId_(objects.map(r => r.id), 'I', 3);
    const day = clean.day || computeDay_(clean.date, objects);
    const created = Object.assign({
      id,
      day,
      transport_id: '',
      reservation_id: '',
      notes: ''
    }, clean, { id, day });
    const rowValues = headers.map(h => valueForSheet_(created[h]));
    sheet.appendRow(rowValues);
    return { success: true, action: 'created', id };
  } finally {
    lock.releaseLock();
  }
}

function deleteItinerary(id) {
  const cleanId = String(id || '').trim();
  if (!/^I\d{3,}$/.test(cleanId)) throw new Error('無效的 itinerary id');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(ADMIN_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ADMIN_CONFIG.ITINERARY_SHEET);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const idCol = headers.indexOf('id') + 1;
    if (!idCol) throw new Error('Itinerary 缺少 id 欄位');
    const ids = sheet.getLastRow() > 1
      ? sheet.getRange(2, idCol, sheet.getLastRow() - 1, 1).getDisplayValues().flat()
      : [];
    const index = ids.indexOf(cleanId);
    if (index < 0) throw new Error('找不到指定行程');
    sheet.deleteRow(index + 2);
    return { success: true, action: 'deleted', id: cleanId };
  } finally {
    lock.releaseLock();
  }
}

function validateItinerary_(input, existingRows) {
  const out = {};
  const id = String(input.id || '').trim();
  if (id) {
    if (!/^I\d{3,}$/.test(id)) throw new Error('id 格式錯誤');
    if (!existingRows.some(r => r.id === id)) throw new Error('找不到要修改的行程');
    out.id = id;
  }

  out.date = requiredDate_(input.date, '日期');
  out.start_time = optionalTime_(input.start_time, '開始時間');
  out.end_time = optionalTime_(input.end_time, '結束時間');
  out.group = enumValue_(input.group, ADMIN_CONFIG.GROUPS, 'group');
  out.city = String(input.city || '').trim();
  out.title = requiredText_(input.title, '標題', 120);
  out.description = String(input.description || '').trim().slice(0, 1000);
  out.place_id = String(input.place_id || '').trim();
  out.certainty = enumValue_(input.certainty, ADMIN_CONFIG.CERTAINTIES, 'certainty');
  out.order = positiveNumber_(input.order, 'order');
  out.notes = String(input.notes || '').trim().slice(0, 1000);

  if (out.place_id) {
    const ss = SpreadsheetApp.openById(ADMIN_CONFIG.SPREADSHEET_ID);
    const places = readSheetObjects_(ss.getSheetByName(ADMIN_CONFIG.PLACES_SHEET));
    if (!places.some(p => p.id === out.place_id)) throw new Error('place_id 不存在');
  }

  return out;
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
  return 'D' + (Math.round((current - start) / 86400000) + 1);
}

function requiredDate_(value, label) {
  const v = String(value || '').trim();
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

function valueForSheet_(value) {
  return value === null || value === undefined ? '' : value;
}
