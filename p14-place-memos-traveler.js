/* P14.3 Traveler PlaceMemo rendering. Fail-soft: memo API failure never blocks existing views. */
(function(){'use strict';
  const PROD_AUTH_API='https://script.google.com/macros/s/AKfycbzpBT-CqGtHiFtY9mb_p_diNNs46GC4h7ks-gKCMKHG-bSE6xWE_Q5Vc0eAkET4kpsS/exec';
  const AUTH_ENDPOINT_KEY='travelPlanner.p9AuthEndpoint.v1';
  const memoIcons={food:'🍴',shopping:'🛍',note:'📝',reservation:'⏰'};
  let memoCache=null,memoPromise=null;

  function addStyles(){
    if(document.getElementById('p14TravelerMemoStyle'))return;
    const s=document.createElement('style');s.id='p14TravelerMemoStyle';
    s.textContent='.place-memos{margin-top:8px;display:grid;gap:5px}.place-memo{display:flex;gap:7px;align-items:flex-start;font-size:13px;line-height:1.45;color:#444}.place-memo-icon{width:18px;flex:0 0 18px;text-align:center}.place-memo-main{min-width:0}.place-memo-title{font-weight:700;color:#303134}.place-memo-note{color:#666;margin-top:1px;white-space:pre-wrap}.place-memo.high .place-memo-title{font-weight:800}@media(max-width:650px){.place-memo{font-size:15px;gap:8px}.place-memo-icon{width:20px;flex-basis:20px}}';
    document.head.appendChild(s);
  }

  function memoApiBase(){
    try{return String(localStorage.getItem(AUTH_ENDPOINT_KEY)||'').trim()||PROD_AUTH_API}catch(_){return PROD_AUTH_API}
  }

  function jsonp(url,timeoutMs=10000){
    return new Promise((resolve,reject)=>{
      const cb='__tpP14Memo_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const script=document.createElement('script');
      const timer=setTimeout(()=>done(new Error('memo timeout')),timeoutMs);
      function done(error,data){clearTimeout(timer);try{delete window[cb]}catch(_){}script.remove();error?reject(error):resolve(data)}
      window[cb]=data=>done(null,data);
      url.searchParams.set('callback',cb);
      script.src=url.toString();script.async=true;script.onerror=()=>done(new Error('memo load failed'));
      document.head.appendChild(script);
    });
  }

  async function loadMemos(force=false){
    if(!force&&memoCache)return memoCache;
    if(!force&&memoPromise)return memoPromise;
    memoPromise=(async()=>{
      try{
        const base=memoApiBase();
        let data;
        try{data=await jsonp(new URL(base+'/place_memos'));}
        catch(_){const u=new URL(base);u.searchParams.set('resource','place_memos');data=await jsonp(u)}
        if(!data||!data.success||!Array.isArray(data.data))throw new Error('memo api unavailable');
        memoCache=data.data.slice().sort((a,b)=>String(a.place_id||'').localeCompare(String(b.place_id||''))||Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.title||'').localeCompare(String(b.title||'')));
      }catch(error){console.warn('P14 memo read unavailable; Traveler continues without memos.',error);memoCache=[]}
      finally{memoPromise=null}
      return memoCache;
    })();
    return memoPromise;
  }

  function memosFor(placeId){return (memoCache||[]).filter(m=>m.place_id===placeId)}
  function memoHtml(placeId){
    const rows=memosFor(placeId);if(!rows.length)return'';
    return '<div class="place-memos">'+rows.map(m=>'<div class="place-memo '+esc(m.priority||'')+'"><span class="place-memo-icon">'+(memoIcons[m.type]||'📝')+'</span><div class="place-memo-main"><div class="place-memo-title">'+esc(m.title||'')+'</div>'+(m.note?'<div class="place-memo-note">'+esc(m.note)+'</div>':'')+'</div></div>').join('')+'</div>';
  }

  function patchToday(){
    if(typeof routeHtml!=='function'||routeHtml.__p14MemoWrapped)return;
    const original=routeHtml;
    routeHtml=function(stops,transports){
      if(!stops.length)return original(stops,transports);
      return `<div class="card today-route-card">${stops.map((stop,index)=>{const next=stops[index+1];let transfer='';if(next){const planned=transportBetween(stop.place.id,next.place.id,transports);transfer=planned?plannedTransportHtml(planned,stop.place,next.place):suggestedTransportHtml(stop.place,next.place)}return `<div class="today-stop"><div class="today-stop-main"><span class="today-stop-number">${stop.number}</span><div><strong>${esc(stop.item.title||stop.place.name)}</strong><div class="meta">${esc(stop.item.start_time||'')}${stop.item.city?` · ${esc(stop.item.city)}`:''}</div>${stop.item.description?`<div class="meta">${esc(stop.item.description)}</div>`:''}${memoHtml(stop.place.id)}</div></div>${transfer}</div>`}).join('')}</div>`;
    };
    routeHtml.__p14MemoWrapped=true;
  }

  function patchTrip(){
    if(typeof renderTrip!=='function'||renderTrip.__p14MemoWrapped)return;
    const original=renderTrip;
    renderTrip=async function(force=false){
      await loadMemos(force);
      await original(force);
      try{
        const places=await api('places',{},force);const byName=new Map(places.map(p=>[String(p.name||'').trim(),p]));
        document.querySelectorAll('.trip-place').forEach(node=>{
          const text=String(node.textContent||'').replace(/^⌖\s*/,'').trim();
          const name=[...byName.keys()].find(n=>text.startsWith(n));const p=name?byName.get(name):null;
          if(p&&!node.parentElement.querySelector('.place-memos'))node.insertAdjacentHTML('afterend',memoHtml(p.id));
        });
      }catch(error){console.warn('P14 trip memo decorate failed',error)}
    };
    renderTrip.__p14MemoWrapped=true;
  }

  function patchMap(){
    if(typeof renderMap!=='function'||renderMap.__p14MemoWrapped)return;
    const original=renderMap;
    renderMap=async function(force=false){
      await loadMemos(force);
      await original(force);
      try{document.querySelectorAll('[data-place-id]').forEach(card=>{if(card.querySelector('.place-memos'))return;const html=memoHtml(card.dataset.placeId);if(html){const actions=card.querySelector('.map-place-actions');actions?actions.insertAdjacentHTML('beforebegin',html):card.insertAdjacentHTML('beforeend',html)}})}catch(error){console.warn('P14 map memo decorate failed',error)}
    };
    renderMap.__p14MemoWrapped=true;
  }

  function patchTodayRender(){
    if(typeof renderToday!=='function'||renderToday.__p14MemoWrapped)return;
    const original=renderToday;
    renderToday=async function(force=false){await loadMemos(force);patchToday();return original(force)};
    renderToday.__p14MemoWrapped=true;
  }

  function attach(){addStyles();patchToday();patchTodayRender();patchTrip();patchMap();memoCache=null;try{state.cache.clear()}catch(_){}try{renderCurrent(true)}catch(error){console.warn('P14 initial render failed',error)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach);else attach();
})();
