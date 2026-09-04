const ADMIN_CONFIG = {
  SPREADSHEET_ID: '1wk_rVY8cgJbmS1PJBIP95Z_CGnz2a-QQjTVA1xqLIh8',
  SHEETS: {
    itinerary:'Itinerary',
    reservations:'Reservations',
    hotels:'Hotels',
    flights:'Flights',
    transport:'Transport',
    places:'Places',
    members:'Members'
  },
  GROUPS: ['ours','friends','all'],
  CERTAINTIES: ['confirmed','tentative','optional'],
  RESERVATION_CATEGORIES: [
    'hotel','flight','train','restaurant',
    'activity','ticket','rental_car','other'
  ],
  RESERVATION_STATUSES: [
    'not_required','planned','need_booking',
    'booked','paid','cancelled'
  ],
  TRANSPORT_TYPES: [
    'train','bus','ferry','rental_car',
    'airport_transfer','other'
  ]
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Admin').setTitle('Travel Planner Admin').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function getAdminIdentity_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!email) throw new Error('無法取得目前登入的 Google 帳戶。請確認 Admin Web App 設為「以存取 Web App 的使用者身分執行」，並重新授權。');
  return email;
}
function isTruthyAdminValue_(value) { const v=String(value==null?'':value).trim().toLowerCase(); return value===true||v==='true'||v==='1'||v==='yes'; }
function getAuthorizedAdmin_() {
  const email=getAdminIdentity_(), ss=SpreadsheetApp.openById(ADMIN_CONFIG.SPREADSHEET_ID), members=readSheetObjects_(requiredSheet_(ss,ADMIN_CONFIG.SHEETS.members));
  const member=members.find(function(row){return String(row.email||'').trim().toLowerCase()===email;});
  if(!member) throw new Error('此 Google 帳戶尚未加入 Admin 授權名單：'+email);
  if(!isTruthyAdminValue_(member.active)) throw new Error('此成員目前已停用，無法使用 Admin。');
  if(!isTruthyAdminValue_(member.admin_access)) throw new Error('此帳戶沒有 Admin 管理權限。');
  return {id:member.id||'',name:member.name||email,email:email,group:member.group||'',role:member.role||''};
}
function assertAdminAuthorized_(){return getAuthorizedAdmin_();}
function getAdminBootstrap(){
  const currentAdmin=assertAdminAuthorized_(),ss=SpreadsheetApp.openById(ADMIN_CONFIG.SPREADSHEET_ID),s=ADMIN_CONFIG.SHEETS;
  return {itinerary:readSheetObjects_(requiredSheet_(ss,s.itinerary)),reservations:readSheetObjects_(requiredSheet_(ss,s.reservations)),hotels:readSheetObjects_(requiredSheet_(ss,s.hotels)),flights:readSheetObjects_(requiredSheet_(ss,s.flights)),transport:readSheetObjects_(requiredSheet_(ss,s.transport)),places:readSheetObjects_(requiredSheet_(ss,s.places)),members:readSheetObjects_(requiredSheet_(ss,s.members)),current_admin:currentAdmin,enums:{group:ADMIN_CONFIG.GROUPS,certainty:ADMIN_CONFIG.CERTAINTIES,reservation_category:ADMIN_CONFIG.RESERVATION_CATEGORIES,reservation_status:ADMIN_CONFIG.RESERVATION_STATUSES,transport_type:ADMIN_CONFIG.TRANSPORT_TYPES}};
}
function saveItinerary(input){return saveEntity_('itinerary',input,'I',validateItinerary_);}
function saveReservation(input){return saveEntity_('reservations',input,'R',validateReservation_);}
function saveHotel(input){return saveEntity_('hotels',input,'H',validateHotel_);}
function saveFlight(input){return saveEntity_('flights',input,'F',validateFlight_);}
function saveTransport(input){return saveEntity_('transport',input,'T',validateTransport_);}
function savePlace(input){return saveEntity_('places',input,'P',validatePlace_);}
function deleteItinerary(id){return deleteEntity_('itinerary',id,/^I\d{3,}$/,function(){});}
function deleteHotel(id){return deleteEntity_('hotels',id,/^H\d{3,}$/,function(){});}
function deleteFlight(id){return deleteEntity_('flights',id,/^F\d{3,}$/,function(){});}
function deleteTransport(id){return deleteEntity_('transport',id,/^T\d{3,}$/,function(ss,cleanId){assertNotReferenced_(ss,cleanId,[{sheet:'itinerary',field:'transport_id',label:'Itinerary'}]);});}
function deleteReservation(id){return deleteEntity_('reservations',id,/^R\d{3,}$/,function(ss,cleanId){assertNotReferenced_(ss,cleanId,[{sheet:'itinerary',field:'reservation_id',label:'Itinerary'},{sheet:'hotels',field:'reservation_id',label:'Hotels'},{sheet:'flights',field:'reservation_id',label:'Flights'},{sheet:'transport',field:'reservation_id',label:'Transport'}]);});}
function deletePlace(id){return deleteEntity_('places',id,/^P\d{3,}$/,function(ss,cleanId){assertNotReferenced_(ss,cleanId,[{sheet:'itinerary',field:'place_id',label:'Itinerary'},{sheet:'hotels',field:'place_id',label:'Hotels'},{sheet:'transport',field:'from_place_id',label:'Transport 出發地'},{sheet:'transport',field:'to_place_id',label:'Transport 目的地'}]);});}
function saveEntity_(sheetKey,input,prefix,validator){
  assertAdminAuthorized_(); return withWriteLock_(function(){
    const ss=SpreadsheetApp.openById(ADMIN_CONFIG.SPREADSHEET_ID),sheet=requiredSheet_(ss,ADMIN_CONFIG.SHEETS[sheetKey]),table=readTable_(sheet),clean=validator(input||{},table.objects,ss),existingIndex=clean.id?table.objects.findIndex(function(r){return r.id===clean.id;}):-1;
    if(existingIndex>=0){const merged=Object.assign({},table.objects[existingIndex],clean);writeObjectRow_(sheet,existingIndex+2,table.headers,merged);return {success:true,action:'updated',id:merged.id};}
    const id=nextId_(table.objects.map(function(r){return r.id;}),prefix,3),created=Object.assign({},clean,{id:id});
    if(sheetKey==='itinerary'){created.day=computeDay_(clean.date,table.objects);created.order=nextItineraryOrder_(clean.date,table.objects);}
    appendObjectRow_(sheet,table.headers,created); return {success:true,action:'created',id:id};
  });
}
function appendObjectRow_(sheet,headers,obj){
  const lastRow=sheet.getLastRow(),newRow=lastRow+1;if(newRow>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),1);
  if(lastRow>=2){const source=sheet.getRange(lastRow,1,1,headers.length),target=sheet.getRange(newRow,1,1,headers.length);source.copyTo(target,SpreadsheetApp.CopyPasteType.PASTE_FORMAT,false);source.copyTo(target,SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION,false);}
  sheet.getRange(newRow,1,1,headers.length).setValues([headers.map(function(h){return valueForSheet_(obj[h]);})]);
}
function nextItineraryOrder_(date,rows){const orders=rows.filter(function(r){return r.date===date;}).map(function(r){return Number(r.order||0);}).filter(function(n){return Number.isFinite(n);});return orders.length?Math.max.apply(null,orders)+10:10;}
function deleteEntity_(sheetKey,id,pattern,preDelete){assertAdminAuthorized_();const cleanId=String(id||'').trim();if(!pattern.test(cleanId))throw new Error('ID 格式無效');return withWriteLock_(function(){const ss=SpreadsheetApp.openById(ADMIN_CONFIG.SPREADSHEET_ID);preDelete(ss,cleanId);deleteById_(requiredSheet_(ss,ADMIN_CONFIG.SHEETS[sheetKey]),cleanId);return {success:true,action:'deleted',id:cleanId};});}
function validateItinerary_(input,rows,ss){const o=validateExistingId_(input.id,rows,/^I\d{3,}$/,'行程');o.date=requiredDate_(input.date,'日期');o.start_time=optionalTime_(input.start_time,'開始時間');o.end_time=optionalTime_(input.end_time,'結束時間');o.group=enumValue_(input.group,ADMIN_CONFIG.GROUPS,'group');o.city=text_(input.city,100);o.title=requiredText_(input.title,'標題',120);o.description=text_(input.description,1000);o.place_id=optionalForeignId_(ss,'places',input.place_id,'place_id');o.transport_id=optionalForeignId_(ss,'transport',input.transport_id,'transport_id');o.reservation_id=optionalForeignId_(ss,'reservations',input.reservation_id,'reservation_id');o.certainty=enumValue_(input.certainty,ADMIN_CONFIG.CERTAINTIES,'certainty');if(input.id){const existing=rows.find(function(r){return r.id===input.id;});o.order=existing?Number(existing.order||10):10;}o.notes=text_(input.notes,1000);return o;}
function validateReservation_(input,rows,ss){const o=validateExistingId_(input.id,rows,/^R\d{3,}$/,'預訂');o.category=enumValue_(input.category,ADMIN_CONFIG.RESERVATION_CATEGORIES,'category');o.name=requiredText_(input.name,'名稱',160);o.date=optionalDate_(input.date,'日期');o.time=optionalTime_(input.time,'時間');o.group=enumValue_(input.group,ADMIN_CONFIG.GROUPS,'group');o.status=enumValue_(input.status,ADMIN_CONFIG.RESERVATION_STATUSES,'status');o.owner_member_id=optionalForeignId_(ss,'members',input.owner_member_id,'owner_member_id');o.booking_url=optionalHttpsUrl_(input.booking_url,'booking_url');o.deadline=optionalDate_(input.deadline,'deadline');o.price=optionalNumber_(input.price,'price');o.currency=text_(input.currency,8).toUpperCase();o.confirmation_no=text_(input.confirmation_no,120);o.notes=text_(input.notes,1000);return o;}
function validateHotel_(input,rows,ss){const o=validateExistingId_(input.id,rows,/^H\d{3,}$/,'住宿');o.city=requiredText_(input.city,'城市',100);o.hotel_name=requiredText_(input.hotel_name,'住宿名稱',160);o.check_in=requiredDate_(input.check_in,'入住日期');o.check_out=requiredDate_(input.check_out,'退房日期');if(o.check_out<=o.check_in)throw new Error('退房日期必須晚於入住日期');o.group=enumValue_(input.group,ADMIN_CONFIG.GROUPS,'group');o.address=text_(input.address,300);o.place_id=optionalForeignId_(ss,'places',input.place_id,'place_id');o.google_maps_url=optionalHttpsUrl_(input.google_maps_url,'google_maps_url');o.booking_url=optionalHttpsUrl_(input.booking_url,'booking_url');o.reservation_id=optionalForeignId_(ss,'reservations',input.reservation_id,'reservation_id');o.confirmation_no=text_(input.confirmation_no,120);o.notes=text_(input.notes,1000);return o;}
function validateFlight_(input,rows,ss){const o=validateExistingId_(input.id,rows,/^F\d{3,}$/,'航班');o.date=requiredDate_(input.date,'日期');o.airline=requiredText_(input.airline,'航空公司',120);o.flight_no=requiredText_(input.flight_no,'航班號',40);o.departure_airport=requiredText_(input.departure_airport,'出發機場',80);o.arrival_airport=requiredText_(input.arrival_airport,'抵達機場',80);o.departure_time=optionalTime_(input.departure_time,'起飛時間');o.arrival_time=optionalTime_(input.arrival_time,'抵達時間');o.group=enumValue_(input.group,ADMIN_CONFIG.GROUPS,'group');o.reservation_id=optionalForeignId_(ss,'reservations',input.reservation_id,'reservation_id');o.booking_reference=text_(input.booking_reference,120);o.notes=text_(input.notes,1000);return o;}
function validateTransport_(input,rows,ss){const o=validateExistingId_(input.id,rows,/^T\d{3,}$/,'交通');o.date=requiredDate_(input.date,'日期');o.type=enumValue_(input.type,ADMIN_CONFIG.TRANSPORT_TYPES,'type');o.from_place_id=requiredForeignId_(ss,'places',input.from_place_id,'出發地');o.to_place_id=requiredForeignId_(ss,'places',input.to_place_id,'目的地');if(o.from_place_id===o.to_place_id)throw new Error('出發地與目的地不可相同');o.departure_time=optionalTime_(input.departure_time,'出發時間');o.arrival_time=optionalTime_(input.arrival_time,'抵達時間');o.operator=text_(input.operator,120);o.service_no=text_(input.service_no,80);o.group=enumValue_(input.group,ADMIN_CONFIG.GROUPS,'group');o.reservation_required=booleanValue_(input.reservation_required,'reservation_required');o.reservation_id=optionalForeignId_(ss,'reservations',input.reservation_id,'reservation_id');o.url=optionalHttpsUrl_(input.url,'url');o.notes=text_(input.notes,1000);return o;}
function validatePlace_(input,rows,ss){const o=validateExistingId_(input.id,rows,/^P\d{3,}$/,'地點');o.name=requiredText_(input.name,'地點名稱',160);o.city=text_(input.city,100);o.category=text_(input.category,80);o.address=text_(input.address,300);o.google_maps_url=optionalHttpsUrl_(input.google_maps_url,'google_maps_url');o.latitude=optionalCoordinate_(input.latitude,'latitude',-90,90);o.longitude=optionalCoordinate_(input.longitude,'longitude',-180,180);o.opening_hours=text_(input.opening_hours,500);o.website=optionalHttpsUrl_(input.website,'website');o.notes=text_(input.notes,1000);return o;}
function assertNotReferenced_(ss,id,refs){refs.forEach(function(ref){const rows=readSheetObjects_(requiredSheet_(ss,ADMIN_CONFIG.SHEETS[ref.sheet]));if(rows.some(function(r){return r[ref.field]===id;}))throw new Error('此資料仍被 '+ref.label+' 引用，請先解除 '+ref.field+' 關聯');});}
function requiredForeignId_(ss,key,value,label){const v=String(value||'').trim();if(!v)throw new Error(label+'不可空白');return existingForeignId_(ss,key,v,label);}
function optionalForeignId_(ss,key,value,label){const v=String(value||'').trim();return v?existingForeignId_(ss,key,v,label):'';}
function existingForeignId_(ss,key,v,label){const exists=readSheetObjects_(requiredSheet_(ss,ADMIN_CONFIG.SHEETS[key])).some(function(r){return r.id===v;});if(!exists)throw new Error(label+' 不存在');return v;}
function validateExistingId_(idValue,rows,pattern,label){const o={},id=String(idValue||'').trim();if(!id)return o;if(!pattern.test(id))throw new Error(label+' id 格式錯誤');if(!rows.some(function(r){return r.id===id;}))throw new Error('找不到要修改的'+label);o.id=id;return o;}
function readTable_(sheet){const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0],rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getDisplayValues():[];return {headers:headers,objects:rows.filter(function(r){return r.some(function(v){return String(v).trim()!=='';});}).map(function(r){return objectFromRow_(headers,r);})};}
function readSheetObjects_(sheet){return readTable_(sheet).objects;}
function objectFromRow_(headers,row){const o={};headers.forEach(function(h,i){o[h]=row[i]===''?null:row[i];});return o;}
function writeObjectRow_(sheet,rowIndex,headers,obj){sheet.getRange(rowIndex,1,1,headers.length).setValues([headers.map(function(h){return valueForSheet_(obj[h]);})]);}
function deleteById_(sheet,id){const t=readTable_(sheet),i=t.objects.findIndex(function(r){return r.id===id;});if(i<0)throw new Error('找不到指定資料');sheet.deleteRow(i+2);}
function requiredSheet_(ss,name){const sh=ss.getSheetByName(name);if(!sh)throw new Error('找不到 '+name+' 工作表');return sh;}
function withWriteLock_(fn){const lock=LockService.getScriptLock();lock.waitLock(10000);try{return fn();}finally{lock.releaseLock();}}
function nextId_(ids,prefix,width){const max=ids.reduce(function(m,id){const x=String(id||'').match(new RegExp('^'+prefix+'(\\d+)$'));return x?Math.max(m,Number(x[1])):m;},0);return prefix+String(max+1).padStart(width,'0');}
function computeDay_(date,rows){const dates=rows.map(function(r){return r.date;}).filter(Boolean).sort(),first=dates[0]||date;return Math.round((new Date(date+'T00:00:00Z')-new Date(first+'T00:00:00Z'))/86400000)+1;}
function requiredDate_(v,l){v=String(v||'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(v))throw new Error(l+'格式必須為 YYYY-MM-DD');return v;}
function optionalDate_(v,l){v=String(v||'').trim();return v?requiredDate_(v,l):'';}
function optionalTime_(v,l){v=String(v||'').trim();if(v&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))throw new Error(l+'格式必須為 HH:mm');return v;}
function enumValue_(v,a,l){v=String(v||'').trim();if(!a.includes(v))throw new Error(l+' 值無效');return v;}
function requiredText_(v,l,max){v=String(v||'').trim();if(!v)throw new Error(l+'不可空白');if(v.length>max)throw new Error(l+'過長');return v;}
function text_(v,max){return String(v||'').trim().slice(0,max);}
function positiveNumber_(v,l){const n=Number(v);if(!Number.isFinite(n)||n<0)throw new Error(l+' 必須是 0 以上數字');return n;}
function optionalNumber_(v,l){v=String(v==null?'':v).trim();return v?positiveNumber_(v,l):'';}
function booleanValue_(v,l){if(v===true||String(v).toLowerCase()==='true')return true;if(v===false||String(v).toLowerCase()==='false')return false;throw new Error(l+' 必須是 true/false');}
function optionalHttpsUrl_(v,l){v=String(v||'').trim();if(v&&!/^https:\/\//i.test(v))throw new Error(l+' 必須使用 https://');return v.slice(0,1000);}
function optionalCoordinate_(value,label,min,max){const raw=String(value==null?'':value).trim();if(!raw)return '';const n=Number(raw);if(!Number.isFinite(n)||n<min||n>max)throw new Error(label+' 數值無效');return n;}
function valueForSheet_(v){return v===null||v===undefined?'':v;}
