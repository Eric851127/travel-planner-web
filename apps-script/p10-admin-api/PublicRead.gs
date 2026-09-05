const P14_PUBLIC_MEMO_FIELDS = ['id','place_id','type','title','note','priority','sort_order'];

/**
 * P14.3 public read hook for Traveler.
 * Call this from the existing P9 doGet(e) before its default response:
 *   const publicResponse = p14TryPublicGet_(e);
 *   if (publicResponse) return publicResponse;
 */
function p14TryPublicGet_(e) {
  const params = (e && e.parameter) || {};
  const path = String((e && e.pathInfo) || '').replace(/^\/+|\/+$/g,'').trim();
  const resource = String(params.resource || path || '').trim();
  if (resource !== 'place_memos') return null;

  try {
    const ss = SpreadsheetApp.openById(P10_CONFIG.SPREADSHEET_ID);
    const sheet = p10RequiredSheet_(ss, P10_CONFIG.SHEETS.place_memos);
    const rows = p10ReadSheetObjects_(sheet)
      .filter(function(row){ return p9Truthy_(row.active); })
      .sort(function(a,b){
        return String(a.place_id||'').localeCompare(String(b.place_id||'')) ||
          Number(a.sort_order||0)-Number(b.sort_order||0) ||
          String(a.title||'').localeCompare(String(b.title||''));
      })
      .map(function(row){
        const output = {};
        P14_PUBLIC_MEMO_FIELDS.forEach(function(field){
          if (Object.prototype.hasOwnProperty.call(row,field)) output[field]=row[field];
        });
        return output;
      });
    return p14PublicJsonp_({success:true,data:rows}, params.callback);
  } catch (error) {
    console.error('P14 public place_memos failed', error);
    return p14PublicJsonp_({success:false,error:{code:'INTERNAL_ERROR',message:'Unable to load place memos.'}}, params.callback);
  }
}

function p14PublicJsonp_(value, callback) {
  const cb = String(callback || '').trim();
  if (!cb) return p9Json_(value);
  if (!/^[A-Za-z_$][0-9A-Za-z_$\.]{0,127}$/.test(cb)) {
    return p9Json_({success:false,error:{code:'VALIDATION_ERROR',message:'Invalid callback.'}});
  }
  return ContentService.createTextOutput(cb+'('+JSON.stringify(value)+');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
