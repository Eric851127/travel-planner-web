const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('importLibrary times out a permanently pending Google module and consumes late rejection',async()=>{
 let timeout,cleared=false,reject;
 const window={google:{maps:{importLibrary:()=>new Promise((_,r)=>{reject=r;})}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../p7maps-shared.js'),'utf8'),{window,setTimeout:(fn,ms)=>{assert.equal(ms,15000);timeout=fn;return 1;},clearTimeout:()=>{cleared=true;}});
 const promise=window.TRAVEL_PLANNER_MAPS.importLibrary('maps');await Promise.resolve();
 timeout();await assert.rejects(promise,/模組載入逾時/);
 reject(Error('late rejection'));await Promise.resolve();await Promise.resolve();assert.ok(cleared);
});
