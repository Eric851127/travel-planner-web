const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../apps-script/traveler-public-api/Code.gs'),'utf8');
const headers=['id','itinerary_id','candidate_place_id','relation_type','choice_set','reason','suggested_duration_min','detour_note','priority','active','sort_order'];
const option=['IO001','I048','P064','nearby','','可選咖啡','30','','normal','TRUE','10'];
function harness(options){
 const data={Itinerary:[['id','date','group','notes'],['I048','2026-12-22','ours','private note'],['I049','2026-12-23','friends','private note']],Places:[['id','name'],['P064','Cafe']],Hotels:[['id']],Flights:[['id']],Transport:[['id']],Reservations:[['id']],PlaceMemos:[['id']]};
 if(options!==undefined)data.ItineraryOptions=options;
 const ss={getSheetByName:name=>data[name]?{getDataRange:()=>({getDisplayValues:()=>data[name]})}:null};
 const ctx={SpreadsheetApp:{openById:()=>ss},ContentService:{MimeType:{JSON:'json',JAVASCRIPT:'js'},createTextOutput:text=>({text,setMimeType(){return this;}})}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,data,get:params=>JSON.parse(ctx.doGet({parameter:params}).text)};
}
test('missing optional sheet returns successful empty resource and does not break bootstrap',()=>{
 const h=harness();assert.deepEqual(h.get({resource:'itinerary_options'}).data,[]);
 const b=h.get({resource:'traveler_bootstrap'});assert.equal(b.success,true);assert.deepEqual(b.data.itinerary_options,[]);assert.equal(b.data.itinerary[0].id,'I048');
});
test('new API exposes only approved option fields and derives date/group from parent',()=>{
 const h=harness([[...headers,'notes','confirmation_no','date','group'],[...option,'private','secret','2099-01-01','friends']]);
 const r=h.get({resource:'itinerary_options',date:'2026-12-22',group:'ours'});assert.equal(r.success,true);assert.equal(r.data.length,1);
 for(const key of ['notes','confirmation_no','date','group'])assert.equal(r.data[0][key],undefined);
 assert.equal(r.data[0].suggested_duration_min,30);assert.equal(h.get({resource:'itinerary_options',group:'friends'}).data.length,0);
 assert.equal(h.get({resource:'itinerary'}).data[0].notes,undefined);
});
test('invalid/inactive/orphan/duplicate options are omitted, without affecting legacy resources',()=>{
 const clone=(i,patch)=>{const r=[...option];r[0]=i;for(const [k,v] of Object.entries(patch))r[headers.indexOf(k)]=v;return r;};
 const h=harness([headers,option,option,clone('IO002',{active:'FALSE'}),clone('IO003',{itinerary_id:'I999'}),clone('IO004',{candidate_place_id:'P999'}),clone('IO005',{relation_type:'food'}),clone('IO006',{suggested_duration_min:'-1'})]);
 assert.equal(h.get({resource:'itinerary_options'}).data.length,1);assert.equal(h.get({resource:'itinerary'}).data.length,2);
});
test('malformed optional schema fails closed and selected bootstrap scopes by parent date/group',()=>{
 const h=harness([['id','notes'],['IO001','private']]);assert.deepEqual(h.get({resource:'itinerary_options'}).data,[]);
 h.data.ItineraryOptions=[headers,option,[...option.map((v,i)=>i===0?'IO002':i===1?'I049':v)]];
 assert.equal(h.get({resource:'traveler_bootstrap',date:'2026-12-22',group:'ours'}).data.itinerary_options.length,1);
 assert.equal(h.get({resource:'traveler_bootstrap',date:'2026-12-22',group:'friends'}).data.itinerary_options.length,0);
});
