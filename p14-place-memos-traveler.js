/* Traveler PlaceMemo runtime + P16.3 Trip mobility renderer. */
(function(){'use strict';
  const memoIcons={food:'🍴',shopping:'🛍',note:'📝',reservation:'⏰'};
  let memoCache=null,memoPromise=null;

  function addStyles(){
    if(document.getElementById('p14TravelerMemoStyle'))return;
    const s=document.createElement('style');s.id='p14TravelerMemoStyle';
    s.textContent='.place-memos{margin-top:8px;display:grid;gap:5px}.place-memo{display:flex;gap:7px;align-items:flex-start;font-size:13px;line-height:1.45;color:#444}.place-memo-icon{width:18px;flex:0 0 18px;text-align:center}.place-memo-main{min-width:0}.place-memo-title{font-weight:700;color:#303134}.place-memo-note{color:#666;margin-top:1px;white-space:pre-wrap}.place-memo.high .place-memo-title{font-weight:800}.trip-mobility{display:grid;gap:8px;margin:8px 0 14px}.trip-mobility-row{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:10px;background:#f7f8f9}.trip-mobility-icon{width:22px;flex:0 0 22px;text-align:center}.trip-mobility-main{min-width:0}.trip-mobility-main strong{display:block}.trip-linked-transport{margin-top:6px;padding:7px 9px;border-radius:8px;background:#f7f8f9;font-size:13px;color:#4a4d52}@media(max-width:650px){.place-memo{font-size:15px;gap:8px}.place-memo-icon{width:20px;flex-basis:20px}.trip-mobility-row{padding:12px}.trip-linked-transport{font-size:14px}}';
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
      }catch(error){console.warn('PlaceMemo read unavailable; Traveler continues without memos.',error);memoCache=[];}
      finally{memoPromise=null}
      return memoCache;
    })();
    return memoPromise;
  }

  function rowsFor(placeId){return (memoCache||[]).filter(m=>m.place_id===placeId)}
  function html(placeId){const rows=rowsFor(placeId);if(!rows.length)return'';return '<div class="place-memos">'+rows.map(m=>'<div class="place-memo '+esc(m.priority||'')+'"><span class="place-memo-icon">'+(memoIcons[m.type]||'📝')+'</span><div class="place-memo-main"><div class="place-memo-title">'+esc(m.title||'')+'</div>'+(m.note?'<div class="place-memo-note">'+esc(m.note)+'</div>':'')+'</div></div>').join('')+'</div>';}
  function clear(){memoCache=null;memoPromise=null}

  function flightMobilityRow(f){
    const name=[f.airline,f.flight_no].filter(Boolean).join(' ')||'航班';
    const route=(f.departure_airport||'—')+' → '+(f.arrival_airport||'—');
    const time=[f.departure_time,f.arrival_time].filter(Boolean).join(' → ');
    return '<div class="trip-mobility-row"><div class="trip-mobility-icon">✈</div><div class="trip-mobility-main"><strong>'+esc(name)+'</strong><div class="meta">'+esc(route)+'</div>'+(time?'<div class="meta">'+esc(time)+'</div>':'')+'</div></div>';
  }

  function transportMobilityRow(t,placeById){
    const from=placeById.get(t.from_place_id),to=placeById.get(t.to_place_id);
    const name=[transportLabel(t.type),t.operator,t.service_no].filter(Boolean).join(' · ')||'一般交通';
    const route=(from?.name||t.from_place_id||'—')+' → '+(to?.name||t.to_place_id||'—');
    const time=[t.departure_time,t.arrival_time].filter(Boolean).join(' → ');
    return '<div class="trip-mobility-row"><div class="trip-mobility-icon">↔</div><div class="trip-mobility-main"><strong>'+esc(name)+'</strong><div class="meta">'+esc(route)+'</div>'+(time?'<div class="meta">'+esc(time)+'</div>':'')+'</div></div>';
  }

  function mobilityForDate(date,flights,transports,placeById){
    const rows=[];
    flights.filter(f=>f.date===date).forEach(f=>rows.push({time:f.departure_time||'',html:flightMobilityRow(f)}));
    transports.filter(t=>t.date===date).forEach(t=>rows.push({time:t.departure_time||'',html:transportMobilityRow(t,placeById)}));
    rows.sort((a,b)=>String(a.time).localeCompare(String(b.time)));
    return rows.length?'<div class="trip-mobility">'+rows.map(r=>r.html).join('')+'</div>':'';
  }

  function linkedTransportHtml(id,transportById,placeById){
    if(!id)return'';
    const t=transportById.get(id);if(!t)return'';
    const from=placeById.get(t.from_place_id),to=placeById.get(t.to_place_id);
    const label=[transportLabel(t.type),t.operator,t.service_no].filter(Boolean).join(' · ');
    const route=(from?.name||t.from_place_id||'—')+' → '+(to?.name||t.to_place_id||'—');
    const time=[t.departure_time,t.arrival_time].filter(Boolean).join(' → ');
    return '<div class="trip-linked-transport">↔ '+esc(label||'交通')+' · '+esc(route)+(time?' · '+esc(time):'')+'</div>';
  }

  addStyles();
  window.TRAVEL_PLANNER_PLACE_MEMOS=Object.freeze({load,html,clear,rowsFor});

  try{
    renderTrip=async function(force=false){
      pageTitle.textContent='行程';loading();
      const [items,reservations,places,transports,flights]=await Promise.all([
        api('itinerary',{group:groupParam()},force),
        api('reservations',{group:groupParam()},force),
        api('places',{},force),
        api('transport',{group:groupParam()},force),
        api('flights',{group:groupParam()},force),
        load(force)
      ]);
      const reservationById=new Map(reservations.map(r=>[r.id,r])),placeById=new Map(places.map(p=>[p.id,p])),transportById=new Map(transports.map(t=>[t.id,t]));
      const grouped=items.reduce((a,i)=>((a[i.date]??=[]).push(i),a),{});
      const dates=new Set([...Object.keys(grouped),...flights.map(f=>f.date).filter(Boolean),...transports.map(t=>t.date).filter(Boolean)]);
      const sortedDates=Array.from(dates).sort();
      app.innerHTML=`<section class="section">${filters()}</section><section class="stack">${sortedDates.length?sortedDates.map(d=>{const x=grouped[d]||[];return `<div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">${esc(formatDateLabel(d))}</h2><span class="badge">${x.length} 個行程</span></div>${mobilityForDate(d,flights,transports,placeById)}<div class="stack">${x.length?x.map(i=>{const r=i.reservation_id?reservationById.get(i.reservation_id):null,p=i.place_id?placeById.get(i.place_id):null;return `<div class="trip-row"><div><strong>${esc(i.start_time||'—')} · ${esc(i.title)}</strong><div class="meta">${esc(i.city||'')} · ${esc(groupLabel(i.group||''))}</div>${p?`<div class="trip-place">⌖ ${esc(p.name)} ${mapLink(p,'地圖')}</div>${html(p.id)}`:''}${linkedTransportHtml(i.transport_id,transportById,placeById)}</div>${r?`<span class="badge ${esc(r.status||'')}">${esc(statusLabel(r.status))}</span>`:''}</div>`}).join(''):'<div class="empty">這一天沒有其他行程。</div>'}</div></div>`}).join(''):'<div class="card empty">目前沒有行程資料。</div>'}</section>`;
      bindFilters();
    };
  }catch(error){console.error('PlaceMemo native Trip renderer failed',error)}
})();