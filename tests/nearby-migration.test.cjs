const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'../migrations/nearby-options');
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const rows=read('proposed-rows.json'),evidence=read('source-evidence.json'),deferred=read('deferred.json');
const columns=['id','itinerary_id','candidate_place_id','relation_type','choice_set','reason','suggested_duration_min','detour_note','priority','active','sort_order'];
test('migration only proposes a unique inactive real-FK dinner alternative',()=>{
 assert.equal(rows.length,1);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
 assert.equal(new Set(rows.map(r=>[r.itinerary_id,r.candidate_place_id,r.relation_type,r.choice_set].join('|'))).size,rows.length);
 for(const r of rows){assert.deepEqual(Object.keys(r),columns);assert.match(r.id,/^IO\d{3,}$/);assert.equal(r.active,false);assert.equal(r.suggested_duration_min,'');
  const parent=evidence.itinerary.find(i=>i.id===r.itinerary_id),place=evidence.places.find(p=>p.id===r.candidate_place_id);
  assert.ok(parent&&place);assert.equal(parent.group,'ours');assert.equal(parent.date,'2026-12-22');assert.equal(parent.place_id,'P070');assert.equal(place.name,'USHIGORO 表參道');assert.equal(r.relation_type,'alternative');assert.match(r.reason,/二擇一/);assert.match(r.reason,/尚未訂位/);
 }
});
test('CSV and JSON agree without formula payloads',()=>{
 const lines=fs.readFileSync(path.join(dir,'proposed-rows.csv'),'utf8').trim().split(/\r?\n/);assert.equal(lines.length,2);assert.equal(lines[0],columns.join(','));
 // Current payload has no commas/quotes/newlines inside cells. Fail if that changes, requiring a proper CSV parser.
 const expected=columns.map(k=>rows[0][k]===false?'FALSE':String(rows[0][k]));for(const v of expected){assert.doesNotMatch(v,/[,"\r\n]/);assert.doesNotMatch(v,/^[=+@-]/);}assert.equal(lines[1],expected.join(','));
});
test('evidence is minimal, pinned to snapshot, and does not confuse P064 with coffee',()=>{
 assert.match(evidence.snapshot_sha256,/^[a-f0-9]{64}$/);assert.equal(evidence.snapshot_date,'2026-11-16');assert.equal(evidence.full_places_scan_count,71);
 assert.equal(evidence.places.find(p=>p.id==='P064').name,'原宿／表參道・Cat Street');
 for(const row of [...evidence.itinerary,...evidence.places]){assert.ok(!('notes'in row));assert.ok(!('reservation_id'in row));}
});
test('unmapped places and cross-date all-group dinner stay deferred, not fake IDs',()=>{
 assert.equal(deferred.length,4);assert.equal(deferred.filter(d=>d.candidate_place_id===null).length,3);
 assert.equal(deferred.find(d=>d.name==='LATTE ART MANIA TOKYO').candidate_place_id,null);
 assert.deepEqual(deferred.find(d=>d.candidate_place_id==='P047').parent_itinerary_ids,['I034','I040']);
 for(const r of rows)assert.ok(!['P064','P900','P901','P047'].includes(r.candidate_place_id));
 for(const id of ['I034','I040'])assert.equal(evidence.itinerary.find(i=>i.id===id).group,'all');
});
