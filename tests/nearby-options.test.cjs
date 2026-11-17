const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'nearby-options.js'), 'utf8');
const base = { id:'IO001', itinerary_id:'I048', candidate_place_id:'P072', relation_type:'nearby',
  choice_set:'coffee', reason:'順路休息', suggested_duration_min:30, detour_note:'步行待核實',
  priority:'normal', active:true, sort_order:10 };
function app(window = {}, api = () => { throw Error('Unexpected API call'); }) {
  const context = { window, api, console:{warn(){}} };
  vm.runInNewContext(source, context);
  return window.TRAVEL_PLANNER_OPTIONS;
}
test('disabled defaults make no network call and leave caller data untouched', async () => {
  const a=app(); assert.equal((await a.load()).length,0);
  const items=[{id:'I048',date:'2026-12-22',group:'ours'}];
  const before=JSON.stringify(items); assert.equal(a.resolve(items,[]).size,0);
  assert.equal(JSON.stringify(items),before);
});
test('fixture normalizes, removes unknown fields and invalid or inactive rows', async () => {
  const a=app({TRAVEL_PLANNER_OPTIONS_DATA:[base,{...base,id:'IO002',active:'FALSE'},
    {...base,id:'bad'}, {...base,id:'IO003',suggested_duration_min:-1},
    {...base,id:'IO004',sort_order:1.2}, {...base,id:'IO005',relation_type:'secret'},
    {...base,id:'IO006',active:'TRUE',date:'2099-01-01',group:'friends',confirmation_no:'private'}]});
  const rows=await a.load(); assert.equal(rows.length,2);
  assert.equal(rows[1].confirmation_no,undefined); assert.equal(rows[1].date,undefined);
  assert.equal(a.forItem('I048').length,2); assert.equal(a.forItem('I999').length,0);
});
test('relationships inherit parent date/group, reject orphaned rows and respect filtered items', async () => {
  const a=app({TRAVEL_PLANNER_OPTIONS_DATA:[base,{...base,id:'IO002',itinerary_id:'I999'},
    {...base,id:'IO003',candidate_place_id:'P999'}]}); await a.load();
  const items=[{id:'I048',date:'2026-12-22',group:'ours'}], places=[{id:'P072',name:'Cafe'}];
  const result=a.resolve(items,places); assert.equal(result.size,1);
  assert.equal(result.get('I048').length,1); assert.equal(result.get('I048')[0].date,'2026-12-22');
  assert.equal(result.get('I048')[0].group,'ours'); assert.equal(result.get('I048')[0].candidate_place,places[0]);
  assert.equal(a.resolve([],places).size,0);
});
test('deduplicates ids; sorts order then priority, leaving original rows unchanged', async () => {
  const rows=[{...base,id:'IO003',sort_order:20},base,{...base},
    {...base,id:'IO002',priority:'high'}], before=JSON.stringify(rows);
  const a=app({TRAVEL_PLANNER_OPTIONS_DATA:rows});
  assert.equal((await a.load()).map(x=>x.id).join(','),'IO002,IO001,IO003');
  assert.equal(JSON.stringify(rows),before);
});
test('explicit API opt-in supports cache, force, failure and unsupported configuration', async () => {
  let calls=0; const a=app({TRAVEL_PLANNER_OPTIONS_CONFIG:{optionsResource:'itinerary_options'}},
    async(resource,filters,force)=>{assert.equal(resource,'itinerary_options');calls++;return force?[{...base,id:'IO002'}]:[base];});
  await a.load(); await a.load(); assert.equal(calls,1);
  assert.equal((await a.load(true))[0].id,'IO002'); assert.equal(calls,2);
  const broken=app({TRAVEL_PLANNER_OPTIONS_CONFIG:{optionsResource:'itinerary_options'}},async()=>{throw Error('resource not deployed');});
  assert.equal((await broken.load()).length,0);
  assert.equal((await app({TRAVEL_PLANNER_OPTIONS_CONFIG:{optionsResource:'members'}}).load()).length,0);
});
test('clear invalidates stale in-flight results and does not overwrite newer data', async () => {
  let finish;const window={TRAVEL_PLANNER_OPTIONS_CONFIG:{optionsResource:'itinerary_options'}};
  const a=app(window,()=>new Promise(resolve=>{finish=resolve;}));const old=a.load();
  a.clear();window.TRAVEL_PLANNER_OPTIONS_DATA=[{...base,id:'IO002'}];await a.load();
  finish([base]);assert.equal((await old).length,0);assert.equal(a.forItem('I048')[0].id,'IO002');
});
test('production bundle is scoped to verified parent and actual primary/candidate place identities',async()=>{
 const window={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../nearby-options-data.js'),'utf8'),{window});
 const a=app(window);await a.load();
 const item={id:'I069',date:'2026-12-22',group:'ours',place_id:'P070'};
 const places=[{id:'P070',name:'青山まんぷく'},{id:'P071',name:'USHIGORO 表參道'}];
 assert.equal(a.resolve([item],places).get('I069').length,1);
 for(const patch of [{date:'2026-12-23'},{group:'friends'},{place_id:'P001'}])assert.equal(a.resolve([{...item,...patch}],places).size,0);
 assert.equal(a.resolve([item],[places[0],{...places[1],name:'Different branch'}]).size,0);
 assert.equal(a.resolve([item],[places[1]]).size,0);
 assert.equal(a.resolve([],places).size,0);
});
test('explicit API selection takes priority over bundled fallback, including API failure',async()=>{
 const window={TRAVEL_PLANNER_OPTIONS_CONFIG:{optionsResource:'itinerary_options'}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../nearby-options-data.js'),'utf8'),{window});
 assert.equal((await app(window,async()=>[]).load()).length,0);
 assert.equal((await app(window,async()=>{throw Error('offline')}).load()).length,0);
});
