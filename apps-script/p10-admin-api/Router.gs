const P10_CONFIG = {
  SPREADSHEET_ID: '1wk_rVY8cgJbmS1PJBIP95Z_CGnz2a-QQjTVA1xqLIh8',
  SHEETS: { itinerary:'Itinerary', reservations:'Reservations', hotels:'Hotels', flights:'Flights', transport:'Transport', places:'Places', members:'Members' },
  GROUPS: ['ours','friends','all'],
  CERTAINTIES: ['confirmed','tentative','optional'],
  RESERVATION_CATEGORIES: ['hotel','flight','train','restaurant','activity','ticket','rental_car','other'],
  RESERVATION_STATUSES: ['not_required','planned','need_booking','booked','paid','cancelled'],
  TRANSPORT_TYPES: ['train','bus','ferry','rental_car','airport_transfer','other'],
  PLACE_CATEGORIES: ['station','airport','hotel','restaurant','attraction','shop','other']
};

/**
 * P10 Admin API layer.
 * Add this file to the SAME isolated Apps Script project that runs P9.
 * P9 remains the session authority. P10 never trusts browser email or role hints.
 */
function p10AdminApi_(e) {
  try {
    const params = (e && e.parameter) || {};
    const token = String(params.session_token || '').trim();
    const action = String(params.action || '').trim();
    const admin = p9RequireAdminSession_(token);
    return p10JsonSuccess_(p10RouteAuthorized_(action, params, admin));
  } catch (error) {
    return p10JsonError_(error);
  }
}

function p10RouteAuthorized_(action, params, admin) {
  switch (action) {
    case 'bootstrap': return p10GetAdminBootstrapAuthorized_(admin);
    case 'save_itinerary': return p10SaveEntityAuthorized_('itinerary', p10Payload_(params), 'I', p10ValidateItinerary_);
    case 'delete_itinerary': return p10DeleteEntityAuthorized_('itinerary', p10Id_(params), /^I\d{3,}$/, function(){});
    case 'save_reservation': return p10SaveEntityAuthorized_('reservations', p10Payload_(params), 'R', p10ValidateReservation_);
    case 'delete_reservation': return p10DeleteEntityAuthorized_('reservations', p10Id_(params), /^R\d{3,}$/, function(ss,id){p10AssertNotReferenced_(ss,id,[{sheet:'itinerary',field:'reservation_id',label:'Itinerary'},{sheet:'hotels',field:'reservation_id',label:'Hotels'},{sheet:'flights',field:'reservation_id',label:'Flights'},{sheet:'transport',field:'reservation_id',label:'Transport'}]);});
    case 'save_hotel': return p10SaveEntityAuthorized_('hotels', p10Payload_(params), 'H', p10ValidateHotel_);
    case 'delete_hotel': return p10DeleteEntityAuthorized_('hotels', p10Id_(params), /^H\d{3,}$/, function(){});
    case 'save_flight': return p10SaveEntityAuthorized_('flights', p10Payload_(params), 'F', p10ValidateFlight_);
    case 'delete_flight': return p10DeleteEntityAuthorized_('flights', p10Id_(params), /^F\d{3,}$/, function(){});
    case 'save_transport': return p10SaveEntityAuthorized_('transport', p10Payload_(params), 'T', p10ValidateTransport_);
    case 'delete_transport': return p10DeleteEntityAuthorized_('transport', p10Id_(params), /^T\d{3,}$/, function(ss,id){p10AssertNotReferenced_(ss,id,[{sheet:'itinerary',field:'transport_id',label:'Itinerary'}]);});
    case 'save_place': return p10SaveEntityAuthorized_('places', p10Payload_(params), 'P', p10ValidatePlace_);
    case 'delete_place': return p10DeleteEntityAuthorized_('places', p10Id_(params), /^P\d{3,}$/, function(ss,id){p10AssertNotReferenced_(ss,id,[{sheet:'itinerary',field:'place_id',label:'Itinerary'},{sheet:'hotels',field:'place_id',label:'Hotels'},{sheet:'transport',field:'from_place_id',label:'Transport 出發地'},{sheet:'transport',field:'to_place_id',label:'Transport 目的地'}]);});
    case 'gate_roundtrip': return p10RunCrudGateAuthorized_(admin);
    default: throw p10Error_('NOT_FOUND','Unknown Admin API action.');
  }
}

function p10GetAdminBootstrapAuthorized_(admin) {
  const ss = SpreadsheetApp.openById(P10_CONFIG.SPREADSHEET_ID);
  const s = P10_CONFIG.SHEETS;
  const members = p10ReadSheetObjects_(p10RequiredSheet_(ss,s.members));
  return {
    phase:'P10-admin-api',
    itinerary:p10ReadSheetObjects_(p10RequiredSheet_(ss,s.itinerary)),
    reservations:p10ReadSheetObjects_(p10RequiredSheet_(ss,s.reservations)),
    hotels:p10ReadSheetObjects_(p10RequiredSheet_(ss,s.hotels)),
    flights:p10ReadSheetObjects_(p10RequiredSheet_(ss,s.flights)),
    transport:p10ReadSheetObjects_(p10RequiredSheet_(ss,s.transport)),
    places:p10ReadSheetObjects_(p10RequiredSheet_(ss,s.places)),
    members:members.filter(function(row){return p9Truthy_(row.active);}).map(p10PublicMember_),
    current_admin:p10CurrentAdmin_(admin),
    enums:{
      group:P10_CONFIG.GROUPS,
      certainty:P10_CONFIG.CERTAINTIES,
      reservation_category:P10_CONFIG.RESERVATION_CATEGORIES,
      reservation_status:P10_CONFIG.RESERVATION_STATUSES,
      transport_type:P10_CONFIG.TRANSPORT_TYPES,
      place_category:P10_CONFIG.PLACE_CATEGORIES
    }
  };
}

function p10CurrentAdmin_(admin) {
  const m = (admin && admin.member) || {};
  return {id:m.id||'',name:m.name||admin.email,email:admin.email,group:m.group||'',role:m.role||''};
}
function p10PublicMember_(row) { return {id:row.id||'',name:row.name||'',group:row.group||'',role:row.role||''}; }

function p10SaveEntityAuthorized_(sheetKey,input,prefix,validator) {
  return p10WithWriteLock_(function(){
    const ss=SpreadsheetApp.openById(P10_CONFIG.SPREADSHEET_ID);
    const sheet=p10RequiredSheet_(ss,P10_CONFIG.SHEETS[sheetKey]);
    const table=p10ReadTable_(sheet);
    const clean=validator(input||{},table.objects,ss);
    const existingIndex=clean.id?table.objects.findIndex(function(r){return r.id===clean.id;}):-1;
    if(existingIndex>=0){
      const merged=Object.assign({},table.objects[existingIndex],clean);
      p10WriteObjectRow_(sheet,existingIndex+2,table.headers,merged);
      return{action:'updated',id:merged.id,location:sheetKey==='places'?p10PlaceLocationResult_(merged):null};
    }
    const id=p10NextId_(table.objects.map(function(r){return r.id;}),prefix,3);
    const created=Object.assign({},clean,{id:id});
    if(sheetKey==='itinerary'){
      created.day=p10ComputeDay_(clean.date,table.objects);
      created.order=p10NextItineraryOrder_(clean.date,table.objects);
    }
    p10AppendObjectRow_(sheet,table.headers,created);
    return{action:'created',id:id,location:sheetKey==='places'?p10PlaceLocationResult_(created):null};
  });
}

function p10DeleteEntityAuthorized_(sheetKey,id,pattern,preDelete) {
  const cleanId=String(id||'').trim();
  if(!pattern.test(cleanId))throw p10Error_('VALIDATION_ERROR','ID 格式無效');
  return p10WithWriteLock_(function(){
    const ss=SpreadsheetApp.openById(P10_CONFIG.SPREADSHEET_ID);
    preDelete(ss,cleanId);
    p10DeleteById_(p10RequiredSheet_(ss,P10_CONFIG.SHEETS[sheetKey]),cleanId);
    return{action:'deleted',id:cleanId};
  });
}

function p10Payload_(params) {
  const raw=String((params&&params.payload)||'').trim();
  if(!raw)throw p10Error_('VALIDATION_ERROR','payload is required.');
  let value;
  try{value=JSON.parse(raw);}catch(_){throw p10Error_('VALIDATION_ERROR','payload must be valid JSON.');}
  if(!value||Array.isArray(value)||typeof value!=='object')throw p10Error_('VALIDATION_ERROR','payload must be a JSON object.');
  return value;
}
function p10Id_(params){const id=String((params&&params.id)||'').trim();if(!id)throw p10Error_('VALIDATION_ERROR','id is required.');return id;}

function p10JsonSuccess_(data){return p9Json_({ok:true,data:data});}
function p10JsonError_(error){
  const mapped=p10MapError_(error);
  return p9Json_({ok:false,error:{code:mapped.code,message:mapped.message}});
}
function p10Error_(code,message){const e=new Error(String(message||code));e.p10Code=String(code||'INTERNAL_ERROR');return e;}
function p10MapError_(error){
  if(error&&error.p10Code)return{code:error.p10Code,message:String(error.message||error.p10Code)};
  const raw=String((error&&error.message)||error||'INTERNAL_ERROR').trim();
  const sessionCode=p9SessionErrorCode_(error);
  if(sessionCode==='UNAUTHENTICATED'||sessionCode==='SESSION_EXPIRED'||sessionCode==='SESSION_REVOKED')return{code:sessionCode,message:p9UserMessage_(sessionCode)};
  if(raw==='FORBIDDEN')return{code:'FORBIDDEN',message:p9UserMessage_('FORBIDDEN')};
  if(/仍被.+引用|請先解除/.test(raw))return{code:'CONFLICT',message:raw};
  if(/找不到|不存在/.test(raw))return{code:'NOT_FOUND',message:raw};
  if(/格式|不可空白|過長|值無效|必須|無效|晚於|不可相同/.test(raw))return{code:'VALIDATION_ERROR',message:raw};
  console.error('P10 internal error',error);
  return{code:'INTERNAL_ERROR',message:'An internal error occurred.'};
}
