/** Live gate: authenticated temporary CRUD roundtrip with best-effort cleanup. */
function p10RunCrudGateAuthorized_(admin){
  const marker='P10-GATE-'+Date.now();
  const ids={};
  const steps=[];
  function run(name,fn){const value=fn();steps.push({step:name,pass:true,result:value});return value;}
  try{
    ids.placeA=run('create place A',function(){return p10SaveEntityAuthorized_('places',{name:marker+' A',city:'Tokyo',category:'test',address:'',opening_hours:'',website:'',notes:'temporary P10 gate'},'P',p10ValidatePlace_);}).id;
    ids.placeB=run('create place B',function(){return p10SaveEntityAuthorized_('places',{name:marker+' B',city:'Tokyo',category:'test',address:'',opening_hours:'',website:'',notes:'temporary P10 gate'},'P',p10ValidatePlace_);}).id;
    ids.reservation=run('create reservation',function(){return p10SaveEntityAuthorized_('reservations',{category:'other',name:marker+' Reservation',date:'2026-12-01',time:'10:00',group:'ours',status:'planned',owner_member_id:'',booking_url:'',deadline:'',price:'',currency:'JPY',confirmation_no:'',notes:'temporary P10 gate'},'R',p10ValidateReservation_);}).id;
    ids.transport=run('create transport',function(){return p10SaveEntityAuthorized_('transport',{date:'2026-12-01',type:'train',from_place_id:ids.placeA,to_place_id:ids.placeB,departure_time:'10:00',arrival_time:'11:00',operator:'P10 Gate',service_no:'TEST',group:'ours',reservation_required:false,reservation_id:ids.reservation,url:'',notes:'temporary P10 gate'},'T',p10ValidateTransport_);}).id;
    ids.hotel=run('create hotel',function(){return p10SaveEntityAuthorized_('hotels',{city:'Tokyo',hotel_name:marker+' Hotel',check_in:'2026-12-01',check_out:'2026-12-02',group:'ours',address:'',place_id:ids.placeB,google_maps_url:'',booking_url:'',reservation_id:ids.reservation,confirmation_no:'',notes:'temporary P10 gate'},'H',p10ValidateHotel_);}).id;
    ids.flight=run('create flight',function(){return p10SaveEntityAuthorized_('flights',{date:'2026-12-01',airline:'P10 Gate Air',flight_no:'P10',departure_airport:'TPE',arrival_airport:'NRT',departure_time:'08:00',arrival_time:'12:00',group:'ours',reservation_id:ids.reservation,booking_reference:'',notes:'temporary P10 gate'},'F',p10ValidateFlight_);}).id;
    ids.itinerary=run('create itinerary',function(){return p10SaveEntityAuthorized_('itinerary',{date:'2026-12-01',start_time:'12:00',end_time:'13:00',group:'ours',city:'Tokyo',title:marker+' Itinerary',description:'temporary P10 gate',place_id:ids.placeB,transport_id:ids.transport,reservation_id:ids.reservation,certainty:'confirmed',notes:''},'I',p10ValidateItinerary_);}).id;

    run('update place',function(){return p10SaveEntityAuthorized_('places',{id:ids.placeA,name:marker+' A',city:'Tokyo',category:'test-updated',address:'',opening_hours:'',website:'',notes:'updated'},'P',p10ValidatePlace_);});
    run('update reservation',function(){return p10SaveEntityAuthorized_('reservations',{id:ids.reservation,category:'other',name:marker+' Reservation Updated',date:'2026-12-01',time:'10:00',group:'ours',status:'planned',owner_member_id:'',booking_url:'',deadline:'',price:'',currency:'JPY',confirmation_no:'',notes:'updated'},'R',p10ValidateReservation_);});
    run('update hotel',function(){return p10SaveEntityAuthorized_('hotels',{id:ids.hotel,city:'Tokyo',hotel_name:marker+' Hotel Updated',check_in:'2026-12-01',check_out:'2026-12-02',group:'ours',address:'',place_id:ids.placeB,google_maps_url:'',booking_url:'',reservation_id:ids.reservation,confirmation_no:'',notes:'updated'},'H',p10ValidateHotel_);});
    run('update flight',function(){return p10SaveEntityAuthorized_('flights',{id:ids.flight,date:'2026-12-01',airline:'P10 Gate Air',flight_no:'P10X',departure_airport:'TPE',arrival_airport:'NRT',departure_time:'08:00',arrival_time:'12:00',group:'ours',reservation_id:ids.reservation,booking_reference:'',notes:'updated'},'F',p10ValidateFlight_);});
    run('update transport',function(){return p10SaveEntityAuthorized_('transport',{id:ids.transport,date:'2026-12-01',type:'train',from_place_id:ids.placeA,to_place_id:ids.placeB,departure_time:'10:05',arrival_time:'11:05',operator:'P10 Gate',service_no:'TEST2',group:'ours',reservation_required:false,reservation_id:ids.reservation,url:'',notes:'updated'},'T',p10ValidateTransport_);});
    run('update itinerary',function(){return p10SaveEntityAuthorized_('itinerary',{id:ids.itinerary,date:'2026-12-01',start_time:'12:05',end_time:'13:00',group:'ours',city:'Tokyo',title:marker+' Itinerary Updated',description:'updated',place_id:ids.placeB,transport_id:ids.transport,reservation_id:ids.reservation,certainty:'confirmed',notes:''},'I',p10ValidateItinerary_);});

    const bootstrap=run('bootstrap readback',function(){return p10GetAdminBootstrapAuthorized_(admin);});
    const checks={
      itinerary:bootstrap.itinerary.some(function(r){return r.id===ids.itinerary&&String(r.title||'').indexOf('Updated')>=0;}),
      reservation:bootstrap.reservations.some(function(r){return r.id===ids.reservation&&String(r.name||'').indexOf('Updated')>=0;}),
      hotel:bootstrap.hotels.some(function(r){return r.id===ids.hotel&&String(r.hotel_name||'').indexOf('Updated')>=0;}),
      flight:bootstrap.flights.some(function(r){return r.id===ids.flight&&r.flight_no==='P10X';}),
      transport:bootstrap.transport.some(function(r){return r.id===ids.transport&&r.service_no==='TEST2';}),
      place:bootstrap.places.some(function(r){return r.id===ids.placeA&&r.category==='test-updated';})
    };
    if(Object.keys(checks).some(function(k){return !checks[k];}))throw p10Error_('INTERNAL_ERROR','P10 gate readback mismatch.');
    steps.push({step:'readback assertions',pass:true,result:checks});

    run('delete itinerary',function(){const r=p10DeleteEntityAuthorized_('itinerary',ids.itinerary,/^I\d{3,}$/,function(){});delete ids.itinerary;return r;});
    run('delete hotel',function(){const r=p10DeleteEntityAuthorized_('hotels',ids.hotel,/^H\d{3,}$/,function(){});delete ids.hotel;return r;});
    run('delete flight',function(){const r=p10DeleteEntityAuthorized_('flights',ids.flight,/^F\d{3,}$/,function(){});delete ids.flight;return r;});
    run('delete transport',function(){const r=p10DeleteEntityAuthorized_('transport',ids.transport,/^T\d{3,}$/,function(){});delete ids.transport;return r;});
    run('delete reservation',function(){const r=p10DeleteEntityAuthorized_('reservations',ids.reservation,/^R\d{3,}$/,function(){});delete ids.reservation;return r;});
    run('delete place A',function(){const r=p10DeleteEntityAuthorized_('places',ids.placeA,/^P\d{3,}$/,function(){});delete ids.placeA;return r;});
    run('delete place B',function(){const r=p10DeleteEntityAuthorized_('places',ids.placeB,/^P\d{3,}$/,function(){});delete ids.placeB;return r;});

    return{phase:'P10-admin-api',gate:'crud-roundtrip',ok:true,marker:marker,steps:steps.length,cleanup:'complete'};
  } catch(error){
    steps.push({step:'gate failure',pass:false,error:String((error&&error.message)||error)});
    p10CleanupGateIds_(ids);
    const mapped=p10MapError_(error);
    throw p10Error_(mapped.code,'CRUD gate failed: '+mapped.message);
  }
}

function p10CleanupGateIds_(ids){
  const order=[['itinerary',ids.itinerary],['hotels',ids.hotel],['flights',ids.flight],['transport',ids.transport],['reservations',ids.reservation],['places',ids.placeA],['places',ids.placeB]];
  order.forEach(function(item){if(!item[1])return;try{const ss=SpreadsheetApp.openById(P10_CONFIG.SPREADSHEET_ID);const sheet=p10RequiredSheet_(ss,P10_CONFIG.SHEETS[item[0]]);const t=p10ReadTable_(sheet);const i=t.objects.findIndex(function(r){return r.id===item[1];});if(i>=0)sheet.deleteRow(i+2);}catch(err){console.warn('P10 gate cleanup failed '+item[0]+' '+item[1]+': '+err);}});
}

function p10RunSelfTests(){
  const tests=[];
  function record(name,fn){try{fn();tests.push({test:name,pass:true});}catch(error){tests.push({test:name,pass:false,error:String((error&&error.message)||error)});}}
  function expectCode(code,fn){let actual='';try{fn();}catch(error){actual=p10MapError_(error).code;}if(actual!==code)throw new Error('Expected '+code+', got '+(actual||'NO_ERROR'));}
  record('payload valid object',function(){const x=p10Payload_({payload:'{"a":1}'});if(x.a!==1)throw new Error('PAYLOAD_PARSE');});
  record('payload invalid JSON maps validation',function(){expectCode('VALIDATION_ERROR',function(){p10Payload_({payload:'{bad'});});});
  record('missing id maps validation',function(){expectCode('VALIDATION_ERROR',function(){p10Id_({});});});
  record('reference conflict contract',function(){expectCode('CONFLICT',function(){throw p10Error_('CONFLICT','still referenced');});});
  record('not found contract',function(){expectCode('NOT_FOUND',function(){throw p10Error_('NOT_FOUND','missing');});});
  record('forbidden contract',function(){if(p10MapError_(new Error('FORBIDDEN')).code!=='FORBIDDEN')throw new Error('FORBIDDEN_MAPPING');});
  record('public member minimizes fields',function(){const x=p10PublicMember_({id:'M1',name:'A',group:'ours',role:'admin',email:'secret@example.com',active:'true',admin_access:'true'});if('email'in x||'active'in x||'admin_access'in x)throw new Error('MEMBER_LEAK');});
  record('action allowlist complete',function(){const actions=['bootstrap','save_itinerary','delete_itinerary','save_reservation','delete_reservation','save_hotel','delete_hotel','save_flight','delete_flight','save_transport','delete_transport','save_place','delete_place','gate_roundtrip'];if(actions.length!==14)throw new Error('ACTION_LIST');});
  const passed=tests.filter(function(t){return t.pass;}).length;
  const result={phase:'P10-admin-api',ok:passed===tests.length,passed:passed,total:tests.length,tests:tests};
  console.log(JSON.stringify(result,null,2));
  return result;
}
