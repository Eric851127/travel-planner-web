/* Traveler PlaceMemo runtime + native Trip renderer. */
(function(){'use strict';
  const memoIcons={food:'🍴',shopping:'🛍',note:'📝',reservation:'⏰'};
  let memoCache=null,memoPromise=null;

  function addStyles(){
    if(document.getElementById('p14TravelerMemoStyle'))return;
    const s=document.createElement('style');s.id='p14TravelerMemoStyle';
    s.textContent='.place-memos{margin-top:8px;display:grid;gap:5px}.place-memo{display:flex;gap:7px;align-items:flex-start;font-size:13px;line-height:1.45;color:#444}.place-memo-icon{width:18px;flex:0 0 18px;text-align:center}.place-memo-main{min-width:0}.place-memo-title{font-weight:700;color:#303134}.place-memo-note{color:#666;margin-top:1px;white-space:pre-wrap}.place-memo.high .place-memo-title{font-weight:800}@media(max-width:650px){.place-memo{font-size:15px;gap:8px}.place-memo-icon{width:20px;flex-basis:20px}}';
    document.head.appendChild(s);
  }

  async function load(force=false){
    if(!force&&memoCache)return memoCache;
    if(!force&&memoPromise)return memoPromise;
    memoPromise=(async()=>{
      try{
        const rows=await api('place_memos',{},force);
        if(!Array.isArray(rows))throw new Error('memo api unavailable');
        memoCache=rows.slice().sort((a,b)=>String(a.place_id||'').localeCompare(String(b.place_id||''))||Number(a.sort_order||0)-Number(b.sort_order||0)||String(a.title||'').localeCompare(String(b.title||'')));
      }catch(error){
        console.warn('PlaceMemo read unavailable; Traveler continues without memos.',error);
        memoCache=[];
      }finally{memoPromise=null}
      return memoCache;
    })();
    return memoPromise;
  }

  function rowsFor(placeId){return (memoCache||[]).filter(m=>m.place_id===placeId)}

  function html(placeId){
    const rows=rowsFor(placeId);if(!rows.length)return'';
    return '<div class="place-memos">'+rows.map(m=>'<div class="place-memo '+esc(m.priority||'')+'"><span class="place-memo-icon">'+(memoIcons[m.type]||'📝')+'</span><div class="place-memo-main"><div class="place-memo-title">'+esc(m.title||'')+'</div>'+(m.note?'<div class="place-memo-note">'+esc(m.note)+'</div>':'')+'</div></div>').join('')+'</div>';
  }

  function clear(){memoCache=null;memoPromise=null}

  addStyles();
  window.TRAVEL_PLANNER_PLACE_MEMOS=Object.freeze({load,html,clear,rowsFor});

  try{
    renderTrip=async function(force=false){
      pageTitle.textContent='行程';loading();
      const [items,reservations,places]=await Promise.all([
        api('itinerary',{group:groupParam()},force),
        api('reservations',{group:groupParam()},force),
        api('places',{},force),
        load(force)
      ]);
      const reservationById=new Map(reservations.map(r=>[r.id,r])),placeById=new Map(places.map(p=>[p.id,p]));
      const grouped=items.reduce((a,i)=>((a[i.date]??=[]).push(i),a),{});
      app.innerHTML=`<section class="section">${filters()}</section><section class="stack">${Object.keys(grouped).length?Object.entries(grouped).map(([d,x])=>`<div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">${esc(formatDateLabel(d))}</h2><span class="badge">${x.length} 個行程</span></div><div class="stack">${x.map(i=>{const r=i.reservation_id?reservationById.get(i.reservation_id):null,p=i.place_id?placeById.get(i.place_id):null;return `<div class="trip-row"><div><strong>${esc(i.start_time||'—')} · ${esc(i.title)}</strong><div class="meta">${esc(i.city||'')} · ${esc(groupLabel(i.group||''))}</div>${p?`<div class="trip-place">⌖ ${esc(p.name)} ${mapLink(p,'地圖')}</div>${html(p.id)}`:''}</div>${r?`<span class="badge ${esc(r.status||'')}">${esc(statusLabel(r.status))}</span>`:''}</div>`}).join('')}</div></div>`).join(''):'<div class="card empty">目前沒有行程資料。</div>'}</section>`;
      bindFilters();
    };
  }catch(error){console.error('PlaceMemo native Trip renderer failed',error)}
})();
