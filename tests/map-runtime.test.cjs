// Deterministic runtime tests with a minimal DOM/Maps seam, not browser visual QA.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mapSource = fs.readFileSync(path.join(__dirname, '..', 'p7map.js'), 'utf8');
const todaySource = fs.readFileSync(path.join(__dirname, '..', 'p7today.js'), 'utf8');
const drawStart = todaySource.indexOf('  async function drawTodayMap(');
const drawEnd = todaySource.indexOf('  function plannedTransportHtml', drawStart);
assert(drawStart >= 0 && drawEnd > drawStart, 'Today draw function must remain discoverable');
const drawSource = todaySource.slice(drawStart, drawEnd);
const tick = () => new Promise(resolve => setImmediate(resolve));
const quiet = {warn(){}, error(){}};
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mapHarness({configured = false, load = async () => {}, empty = false} = {}) {
  const places = empty ? [] : [
    {id:'P1', name:'東京主線', city:'東京', latitude:'35', longitude:'139'},
    {id:'P2', name:'附近咖啡', city:'東京'},
    {id:'P3', name:'大阪收藏', city:'大阪'},
    {id:'P4', name:'朋友主線', city:'東京'}
  ];
  const itinerary = empty ? [] : [
    {id:'I1', date:'2026-12-22', place_id:'P1', group:'ours'},
    {id:'I2', date:'2026-12-23', place_id:'P3', group:'ours'},
    {id:'I3', date:'2026-12-22', place_id:'P4', group:'friends'}
  ];
  const nodes = {travelMap:{innerHTML:''}, mapDateSelect:{addEventListener(type, fn){this[type]=fn;}}};
  const buttons = ['route','nearby','all'].map(layer => ({dataset:{mapLayer:layer}}));
  const app = {innerHTML:''};
  const state = {view:'map', date:'2026-12-22', group:'ours'};
  const calls = [];
  const context = {
    console:quiet, Map, Set, Promise, Infinity, state, app, pageTitle:{}, renderMap:null,
    loading(){}, esc:escape, categoryLabel:x=>x, formatDateLabel:x=>x, filters:()=>'', bindFilters(){},
    groupParam:()=>state.group+',all',
    document:{getElementById:id=>nodes[id]||null, querySelectorAll:selector=>selector==='[data-map-layer]'?buttons:[]},
    api:async (resource, params) => {calls.push({resource,params});return resource==='places'?places:itinerary.filter(i=>i.group===state.group || i.group==='all');},
    window:{
      TRAVEL_PLANNER_MAPS:{readSettings:()=>configured?{apiKey:'test',mapId:'test'}:{}, coordinates:p=>p.latitude?{lat:35,lng:139}:null, placeSearchUrl:p=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.name), load, clearSettings(){}, saveSettings(){}},
      TRAVEL_PLANNER_OPTIONS:{load:async()=>[],resolve:items=>new Map(items.filter(i=>i.id==='I1').map(i=>[i.id,[{candidate_place:places[1]}]]))}
    }
  };
  vm.createContext(context); vm.runInContext(mapSource, context);
  return {context, state, app, nodes, buttons, calls};
}
test('unconfigured Maps preserves dated main-line cards, links and collapsed setup', async () => {
  const h=mapHarness();await h.context.renderMap();
  assert.match(h.app.innerHTML,/東京主線/); assert.doesNotMatch(h.app.innerHTML,/大阪收藏|朋友主線|附近咖啡/);
  assert.match(h.app.innerHTML,/Google Maps ↗/); assert.match(h.app.innerHTML,/<details class="card"><summary>地圖設定/);
  assert.match(h.app.innerHTML,/內嵌地圖尚未設定/);assert.equal(h.calls.find(c=>c.resource==='itinerary').params.group,'ours,all');
});
test('nearby and all layers are explicit and nearby does not add unrelated wishlist places', async () => {
  const h=mapHarness();await h.context.renderMap();h.buttons[1].onclick();await tick();
  assert.match(h.app.innerHTML,/附近咖啡/);assert.doesNotMatch(h.app.innerHTML,/東京主線|大阪收藏|朋友主線/);
  assert.match(h.app.innerHTML,/尚未設定座標/);
  h.buttons[2].onclick();await tick();assert.match(h.app.innerHTML,/大阪收藏/);assert.match(h.app.innerHTML,/不代表已排入行程/);
});
test('date and group switches filter main-line and nearby relations', async () => {
  const h=mapHarness();await h.context.renderMap();h.nodes.mapDateSelect.change({target:{value:'2026-12-23'}});await tick();
  assert.match(h.app.innerHTML,/大阪收藏/);assert.doesNotMatch(h.app.innerHTML,/東京主線/);
  h.state.group='friends';await h.context.renderMap();assert.match(h.app.innerHTML,/朋友主線/);assert.doesNotMatch(h.app.innerHTML,/東京主線|大阪收藏/);
  h.buttons[1].onclick();await tick();assert.match(h.app.innerHTML,/尚無已整理的附近選項/);assert.doesNotMatch(h.app.innerHTML,/附近咖啡/);
});
test('Maps loader rejection leaves list and external navigation intact', async () => {
  const h=mapHarness({configured:true,load:async()=>{throw Error('test network failure');}});await h.context.renderMap();
  assert.match(h.app.innerHTML,/東京主線/);assert.match(h.app.innerHTML,/Google Maps ↗/);assert.match(h.nodes.travelMap.innerHTML,/外部導航不受影響/);
});
test('empty itinerary and places render a usable empty state', async () => {
  const h=mapHarness({empty:true});await h.context.renderMap();assert.match(h.app.innerHTML,/尚無行程日期/);assert.match(h.app.innerHTML,/這個範圍尚無地點資料/);
});
function todayHarness() {
  let release, created=0;
  const initialNode={isConnected:true,innerHTML:''};
  const nodes={todayTravelMap:initialNode,todayMapDetails:{open:true}};
  const state={date:'2026-12-21',group:'ours',view:'today'};
  const context={Symbol,Set,Map,console:quiet,state,document:{getElementById:id=>nodes[id]||null},mapSettings:()=>({apiKey:'test',mapId:'test'}),loadGoogleMaps:()=>new Promise(resolve=>{release=resolve;}),google:{maps:{importLibrary:async()=>({}),Map:function(){created++;}}},coord:()=>null};
  vm.createContext(context);vm.runInContext(drawSource,context);
  return {context,nodes,state,initialNode,release:()=>release(),created:()=>created};
}
test('Today late load cannot initialize or overwrite a different date/node', async () => {
  const h=todayHarness();const pending=h.context.drawTodayMap([],[],new Map());
  h.initialNode.isConnected=false;h.nodes.todayTravelMap={isConnected:true,innerHTML:'new date content'};h.state.date='2026-12-22';h.release();
  assert.equal(await pending,false);assert.equal(h.created(),0);assert.equal(h.nodes.todayTravelMap.innerHTML,'new date content');
});
for(const change of ['closed','group','view','cancelled'])test(`Today pending load stops when ${change}`,async()=>{
  const h=todayHarness();const pending=h.context.drawTodayMap([],[],new Map());
  if(change==='closed')h.nodes.todayMapDetails.open=false;
  if(change==='group')h.state.group='friends';
  if(change==='view')h.state.view='trip';
  if(change==='cancelled')h.initialNode.__mapRequest=null;
  h.release();assert.equal(await pending,false);assert.equal(h.created(),0);
});
