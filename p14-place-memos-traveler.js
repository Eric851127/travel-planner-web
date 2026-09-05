/* P14.3 Traveler PlaceMemo rendering. Fail-soft: memo API failure never blocks existing views. */
(function(){'use strict';
  const memoIcons={food:'🍴',shopping:'🛍',note:'📝',reservation:'⏰'};
  let memoCache=null,memoPromise=null;

  function addStyles(){
    if(document.getElementById('p14TravelerMemoStyle'))return;
    const s=document.createElement('style');s.id='p14TravelerMemoStyle';
    s.textContent='.place-memos{margin-top:8px;display:grid;gap:5px}.place-memo{display:flex;gap:7px;align-items:flex-start;font-size:13px;line-height:1.45;color:#444}.place-memo-icon{width:18px;flex:0 0 18px;text-align:center}.place-memo-main{min-width:0}.place-memo-title{font-weight:700;color:#303134}.place-memo-note{color:#666;margin-top:1px;white-space:pre-wrap}.place-memo.high .place-memo-title{font-weight:800}@media(max-width:650px){.place-memo{font-size:15px;gap:8px}.place-memo-icon{width:20px;flex-basis:20px}}';
    document.head.appendChild(s);
  }

  function memoApiBase(){return String(config&&config.apiBase||'').trim()}

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
        if(!base)throw new Error('memo api base unavailable');
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

  function groupFilterValue(){return (state.group==='ours'||state.group==='friends')?state.group+',all':null}

  async function decorateToday(force){
    try{
      const [items,places]=await Promise.all([api('itinerary',{date:state.date,group:groupFilterValue()},force),api('places',{},force)]);
      const placeIds=new Set(places.map(p=>p.id));
      const stops=items.filter(item=>item.place_id&&placeIds.has(item.place_id));
      const nodes=[...document.querySelectorAll('.today-stop')];
      nodes.forEach((node,index)=>{
        const item=stops[index];if(!item||node.querySelector('.place-memos'))return;
        const html=memoHtml(item.place_id);if(!html)return;
        const target=node.querySelector('.today-stop-main > div');
        if(target)target.insertAdjacentHTML('beforeend',html);
      });
    }catch(error){console.warn('P14 today memo decorate failed',error)}
  }

  async function decorateTrip(force){
    try{
      const places=await api('places',{},force);
      const ordered=[...places].sort((a,b)=>String(b.name||'').length-String(a.name||'').length);
      document.querySelectorAll('.trip-place').forEach(node=>{
        if(node.parentElement&&node.parentElement.querySelector('.place-memos'))return;
        const text=String(node.textContent||'').replace(/^⌖\s*/,'').trim();
        const place=ordered.find(p=>text.startsWith(String(p.name||'').trim()));
        if(place){const html=memoHtml(place.id);if(html)node.insertAdjacentHTML('afterend',html)}
      });
    }catch(error){console.warn('P14 trip memo decorate failed',error)}
  }

  function decorateMap(){
    try{
      document.querySelectorAll('[data-place-id]').forEach(card=>{
        if(card.querySelector('.place-memos'))return;
        const html=memoHtml(card.dataset.placeId);if(!html)return;
        const actions=card.querySelector('.map-place-actions');
        actions?actions.insertAdjacentHTML('beforebegin',html):card.insertAdjacentHTML('beforeend',html);
      });
    }catch(error){console.warn('P14 map memo decorate failed',error)}
  }

  function patchToday(){
    if(typeof renderToday!=='function'||renderToday.__p14MemoWrapped)return;
    const original=renderToday;
    renderToday=async function(force=false){await loadMemos(force);await original(force);await decorateToday(force)};
    renderToday.__p14MemoWrapped=true;
  }

  function patchTrip(){
    if(typeof renderTrip!=='function'||renderTrip.__p14MemoWrapped)return;
    const original=renderTrip;
    renderTrip=async function(force=false){await loadMemos(force);await original(force);await decorateTrip(force)};
    renderTrip.__p14MemoWrapped=true;
  }

  function patchMap(){
    if(typeof renderMap!=='function'||renderMap.__p14MemoWrapped)return;
    const original=renderMap;
    renderMap=async function(force=false){await loadMemos(force);await original(force);decorateMap()};
    renderMap.__p14MemoWrapped=true;
  }

  function attach(){
    addStyles();patchToday();patchTrip();patchMap();memoCache=null;
    try{state.cache.clear()}catch(_){}
    try{renderCurrent(true)}catch(error){console.warn('P14 initial render failed',error)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach);else attach();
})();
