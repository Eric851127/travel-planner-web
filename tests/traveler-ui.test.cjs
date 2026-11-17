const test=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
function setup(){
 const html=fs.readFileSync(path.join(root,'preview/index.html'),'utf8').split('<script>')[0];
 const dom=new JSDOM(html,{url:'http://localhost/preview/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,ctx=dom.getInternalVMContext();
 w.matchMedia=()=>({matches:false});
 w.TRAVEL_PLANNER_DEFER_INITIAL_RENDER=true;
 w.TRAVEL_PLANNER_CONFIG={apiBase:'https://example.invalid',defaultGroup:'ours',preview:true};
 for(const f of ['preview/fixtures.js','app.js','p7network.js','p4.js','p7.js','p7maps-shared.js','p7map.js','p7today.js','p8.js','p14-place-memos-traveler.js','nearby-options.js','itinerary-ui.js','p16-runtime-core.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
 vm.runInContext(`api=async function(resource,params={}){return (window.TRAVEL_PLANNER_PREVIEW_DATA[resource]||[]).filter(r=>(!params.date||r.date===params.date)&&(!params.group||params.group==='all'||[...String(params.group).split(','),'all'].includes(r.group)));};`,ctx);
 return {dom,w,ctx,run:(s)=>vm.runInContext(s,ctx),app:w.document.getElementById('app')};
}
const flush=()=>new Promise(r=>setTimeout(r,20));
test('Today displays main route and scoped optional cards without promoting them into stop numbers',async()=>{
 const x=setup();await x.run('renderCurrent()');
 assert.equal(x.app.querySelectorAll('.today-stop-number').length,2);
 assert.equal(x.app.querySelectorAll('.nearby-option').length,2);
 assert.match(x.app.textContent,/LATTE ART MANIA/);assert.match(x.app.textContent,/尚未預訂/);
 assert.ok(!x.app.querySelector('#todayMapDetails').open);
 assert.ok(x.app.querySelector('a[href^="https://www.google.com/maps"]'));
 assert.equal(x.w.document.querySelectorAll('.bottom-nav button').length,4);
 x.dom.window.close();
});
test('date/group transitions retain area-only activities and never leak another group options',async()=>{
 const x=setup();await x.run('renderCurrent()');
 x.app.querySelector('[data-today-group="friends"]').click();await flush();
 assert.match(x.app.textContent,/鎌倉/);assert.doesNotMatch(x.app.textContent,/LATTE ART MANIA/);
 x.app.querySelector('[data-today-group="ours"]').click();await flush();
 const select=x.app.querySelector('#dateSelect');select.value='2026-12-30';select.dispatchEvent(new x.w.Event('change'));await flush();
 assert.match(x.app.textContent,/市場午餐/);assert.match(x.app.textContent,/尚未指定單一地點/);
 x.dom.window.close();
});
test('Trip keeps description, certainty, day disclosures and existing booking badges',async()=>{
 const x=setup();x.w.TRAVEL_PLANNER_PREVIEW_DATA.reservations=[{id:'R001',status:'paid',group:'ours'}];x.w.TRAVEL_PLANNER_PREVIEW_DATA.itinerary[0].reservation_id='R001';
 await x.run("state.view='trip';renderCurrent()");
 assert.equal(x.app.querySelectorAll('.trip-day').length,3);assert.match(x.app.textContent,/示意既有主線區段/);assert.match(x.app.textContent,/已付款/);
 assert.match(x.app.textContent,/暫定/);assert.match(x.app.textContent,/附近與替代選項/);
 x.dom.window.close();
});
test('Map without credentials keeps links, scopes to date and nearby options, and handles empty days',async()=>{
 const x=setup();await x.run("state.view='map';renderCurrent()");
 assert.equal(x.app.querySelectorAll('.map-place-card').length,2);
 assert.match(x.app.textContent,/內嵌地圖尚未設定/);
 assert.ok(x.app.querySelector('a[href^="https://www.google.com/maps"]'));
 x.app.querySelector('[data-map-layer="nearby"]').click();await flush();
 assert.equal(x.app.querySelectorAll('.map-place-card').length,2);assert.match(x.app.textContent,/LATTE ART MANIA/);
 const select=x.app.querySelector('#mapDateSelect');select.value='2026-12-30';select.dispatchEvent(new x.w.Event('change'));await flush();
 assert.match(x.app.textContent,/尚無已整理的附近選項/);
 x.dom.window.close();
});
test('unsafe option text is escaped and unsafe place URLs do not become script links',async()=>{
 const x=setup();x.w.TRAVEL_PLANNER_OPTIONS_DATA[0].reason='<img src=x onerror=alert(1)>';
 x.w.TRAVEL_PLANNER_PREVIEW_DATA.places[1].google_maps_url='javascript:alert(1)';
 await x.run('renderCurrent()');
 assert.equal(x.app.querySelectorAll('img').length,0);assert.equal(x.app.querySelectorAll('a[href^="javascript:"]').length,0);
 assert.match(x.app.textContent,/<img src=x/);x.dom.window.close();
});
test('no options source and missing optional data preserve the original itinerary without network',async()=>{
 const x=setup();delete x.w.TRAVEL_PLANNER_OPTIONS_DATA;
 await x.run('renderCurrent()');assert.equal(x.app.querySelectorAll('.today-stop-number').length,2);assert.equal(x.app.querySelectorAll('.nearby-options').length,0);
 x.w.TRAVEL_PLANNER_PREVIEW_DATA.itinerary=[];
 await x.run('renderCurrent(true)');assert.match(x.app.textContent,/目前沒有行程日期/);x.dom.window.close();
});
test('repeated navigation, refresh and back to Today retain working controls',async()=>{
 const x=setup();await x.run('renderCurrent()');
 for(const view of ['trip','bookings','more','today','trip','today']){
  x.w.document.querySelector(`[data-view="${view}"]`).click();await flush();
  assert.doesNotMatch(x.app.textContent,/載入失敗/);
 }
 x.w.document.querySelector('#refreshBtn').click();await flush();
 assert.equal(x.app.querySelectorAll('.today-stop-number').length,2);
 x.w.document.querySelector('[data-view="more"]').click();await flush();
 x.app.querySelector('#openTripMap').click();await flush();
 assert.ok(x.app.querySelector('#mapDateSelect'));x.dom.window.close();
});
test('existing mobility and hotel data remain visible while optional choices stay distinct',async()=>{
 const x=setup();Object.assign(x.w.TRAVEL_PLANNER_PREVIEW_DATA,{
 flights:[{id:'F001',date:'2026-12-22',group:'ours',flight_no:'TEST123',departure_time:'07:00',departure_airport:'A',arrival_airport:'B'}],
 transport:[{id:'T001',date:'2026-12-22',group:'all',type:'train',from_place_id:'P064',to_place_id:'P070',service_no:'TEST45'}],
 hotels:[{id:'H001',group:'ours',check_in:'2026-12-22',check_out:'2026-12-23',hotel_name:'測試住宿',place_id:'P064'}]});
 await x.run('renderCurrent()');assert.match(x.app.textContent,/TEST123/);assert.match(x.app.textContent,/TEST45/);assert.match(x.app.textContent,/測試住宿/);
 x.dom.window.close();
});
test('pending map SDK never blocks queued date, group, or navigation interactions',async()=>{
 const x=setup();let release;
 x.w.TRAVEL_PLANNER_MAP_CONFIG={apiKey:'test',mapId:'test'};
 x.w.TRAVEL_PLANNER_MAPS={...x.w.TRAVEL_PLANNER_MAPS,load:()=>new Promise(r=>{release=r;})};
 await x.run("state.view='map';TRAVEL_PLANNER_INTERACTIONS.schedule(()=>renderCurrent())");
 const date=x.app.querySelector('#mapDateSelect');date.value='2026-12-28';date.dispatchEvent(new x.w.Event('change'));await flush();
 assert.match(x.app.textContent,/札幌市中心/);
 x.app.querySelector('[data-group="friends"]').click();await flush();
 assert.equal(x.run('state.group'),'friends');
 assert.ok(x.app.querySelector('[data-group="friends"]').classList.contains('active'));
 x.w.document.querySelector('[data-view="trip"]').click();await flush();
 assert.ok(x.app.querySelector('.trip-day'));
 release();await flush();assert.ok(x.app.querySelector('.trip-day'));
 x.dom.window.close();
});
test('pending Maps importLibrary never blocks leaving map and cannot overwrite the destination',async()=>{
 const x=setup();let release;
 x.w.TRAVEL_PLANNER_MAP_CONFIG={apiKey:'test',mapId:'test'};
 x.w.TRAVEL_PLANNER_MAPS={...x.w.TRAVEL_PLANNER_MAPS,load:async()=>{},importLibrary:()=>new Promise(r=>{release=r;})};
 await x.run("state.view='map';TRAVEL_PLANNER_INTERACTIONS.schedule(()=>renderCurrent())");await flush();
 x.w.document.querySelector('[data-view="today"]').click();await flush();
 assert.ok(x.app.querySelector('.today-route-card'));
 release({});await flush();assert.ok(x.app.querySelector('.today-route-card'));
 x.dom.window.close();
});
test('separate alternative groups under one itinerary have distinct escaped labels',async()=>{
 const x=setup();x.w.TRAVEL_PLANNER_OPTIONS_DATA.push({...x.w.TRAVEL_PLANNER_OPTIONS_DATA[1],id:'IO005',candidate_place_id:'P902',choice_set:'coffee <group>'});
 await x.run('renderCurrent()');
 assert.match(x.app.textContent,/選項組：dinner-1222/);assert.match(x.app.textContent,/選項組：coffee <group>/);assert.equal(x.app.querySelectorAll('group').length,0);
 x.dom.window.close();
});
test('shared-parent bundle choices remain ours-only in Today Trip and Map',async()=>{
 const x=setup();delete x.w.TRAVEL_PLANNER_OPTIONS_DATA;
 const parent={id:'I040',date:'2026-12-30',group:'all',place_id:'P035',title:'Shared shopping',city:'Sapporo'};
 const primary={id:'P035',name:'Shopping area'},candidate={id:'P073',name:'Scoped dessert'};
 x.w.TRAVEL_PLANNER_PREVIEW_DATA.itinerary=[parent];x.w.TRAVEL_PLANNER_PREVIEW_DATA.places=[primary,candidate];
 x.w.TRAVEL_PLANNER_OPTIONS_BUNDLE={parents:{I040:{date:parent.date,group:'all',place_id:'P035'}},places:{P035:primary.name,P073:candidate.name},audiences:{IO003:['ours']},rows:[{id:'IO003',itinerary_id:'I040',candidate_place_id:'P073',relation_type:'nearby',active:true}]};
 for(const view of ['today','trip','map']){
  await x.run(`state.date='2026-12-30';state.view='${view}';state.group='ours';renderCurrent()`);
  if(view==='map'){x.app.querySelector('[data-map-layer="nearby"]').click();await flush();}
  assert.match(x.app.textContent,/Scoped dessert/,view+' ours');
  await x.run(`state.group='friends';renderCurrent()`);
  assert.doesNotMatch(x.app.textContent,/Scoped dessert/,view+' friends');
  assert.match(x.app.textContent,view==='map'?/尚無已整理的附近選項/:/Shared shopping/);
 }
 x.dom.window.close();
});
