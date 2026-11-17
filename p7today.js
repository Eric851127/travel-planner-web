/* P7.8 itinerary-first Today experience + P16.3 mobility segments */
(function () {
  const GROUP_KEY = 'travelPlanner.group.v1';
  let todayMap = null;
  let todayInfo = null;

  function groupDisplayName(value) { return window.travelPlannerGroupLabel(value); }
  function currentGroup() {
    if (state.group === 'ours' || state.group === 'friends') return state.group;
    const saved = localStorage.getItem(GROUP_KEY);
    state.group = saved === 'friends' ? 'friends' : 'ours';
    return state.group;
  }
  function groupFilterValue() { return currentGroup() + ',all'; }
  function todayGroupFilters() {
    const group = currentGroup();
    return `<div class="filters today-group-filters"><button class="filter-btn ${group === 'ours' ? 'active' : ''}" data-today-group="ours">${esc(groupDisplayName('ours'))}</button><button class="filter-btn ${group === 'friends' ? 'active' : ''}" data-today-group="friends">${esc(groupDisplayName('friends'))}</button></div>`;
  }
  function bindTodayGroupFilters() {
    if (window.TRAVEL_PLANNER_INTERACTIONS) { window.TRAVEL_PLANNER_INTERACTIONS.bindTodayGroupFilters(); return; }
    document.querySelectorAll('[data-today-group]').forEach(button => {
      button.onclick = () => {
        const next = button.dataset.todayGroup;
        if (next !== 'ours' && next !== 'friends') return;
        state.group = next;localStorage.setItem(GROUP_KEY, next);renderToday(false).catch(failed);
      };
    });
  }

  function mapSettings() { return window.TRAVEL_PLANNER_MAPS.readSettings(); }
  function loadGoogleMaps(apiKey) { return window.TRAVEL_PLANNER_MAPS.load(apiKey); }
  function coord(place) { return window.TRAVEL_PLANNER_MAPS.coordinates(place); }
  function directionsUrl(from, to, mode = 'transit') { return window.TRAVEL_PLANNER_MAPS.directionsUrl(from, to, mode); }
  function memoHtml(placeId) { return window.TRAVEL_PLANNER_PLACE_MEMOS ? window.TRAVEL_PLANNER_PLACE_MEMOS.html(placeId) : ''; }
  function transportMode(type) { return type === 'rental_car' ? 'driving' : 'transit'; }
  function transportBetween(fromId, toId, transports) { return transports.find(t => t.from_place_id === fromId && t.to_place_id === toId) || null; }
  function itineraryStops(items, placeById) { return items.map((item, index) => ({ item, place: placeById.get(item.place_id) || null, number: index + 1 })); }
  function activeHotels(hotels, date) { return hotels.filter(h => h.check_in && h.check_out && h.check_in <= date && date < h.check_out); }

  function flightMobilityCard(flight) {
    const carrier = [flight.airline, flight.flight_no].filter(Boolean).join(' ') || '航班';
    const route = `${flight.departure_airport || '—'} → ${flight.arrival_airport || '—'}`;
    const time = [flight.departure_time, flight.arrival_time].filter(Boolean).join(' → ');
    return `<article class="summary-card today-flight-card"><div class="summary-icon">✈</div><div class="summary-body"><div class="summary-kicker">航班</div><strong>${esc(carrier)}</strong><div class="route"><span>${esc(route)}</span></div>${time ? `<div class="meta">${esc(time)}</div>` : ''}</div></article>`;
  }

  function transportMobilityCard(transport, placeById) {
    const from = placeById.get(transport.from_place_id);
    const to = placeById.get(transport.to_place_id);
    const label = [transportLabel(transport.type), transport.operator, transport.service_no].filter(Boolean).join(' · ') || '一般交通';
    const route = `${from?.name || transport.from_place_id || '—'} → ${to?.name || transport.to_place_id || '—'}`;
    const time = [transport.departure_time, transport.arrival_time].filter(Boolean).join(' → ');
    return `<article class="summary-card today-transport-card"><div class="summary-icon">↔</div><div class="summary-body"><div class="summary-kicker">${esc(transportLabel(transport.type))}</div><strong>${esc(label)}</strong><div class="route"><span>${esc(route)}</span></div>${time ? `<div class="meta">${esc(time)}</div>` : ''}</div></article>`;
  }

  function mobilityHtml(flights, transports, placeById) {
    const rows = [];
    flights.forEach(f => rows.push({ time: f.departure_time || '', html: flightMobilityCard(f) }));
    transports.forEach(t => rows.push({ time: t.departure_time || '', html: transportMobilityCard(t, placeById) }));
    rows.sort((a, b) => String(a.time).localeCompare(String(b.time)));
    if (!rows.length) return '';
    return `<section class="section"><h2>今日移動</h2><div class="summary-scroll">${rows.map(row => row.html).join('')}</div></section>`;
  }

  function infoHtml(place, label) {
    const maps = safeUrl(place?.google_maps_url);
    return `<div class="map-info-window"><strong>${esc(place?.name || '地點')}</strong>${label ? `<div>${esc(label)}</div>` : ''}${place?.address ? `<div>${esc(place.address)}</div>` : ''}${maps ? `<a href="${esc(maps)}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a>` : ''}</div>`;
  }

  function bindTodayMapInteraction() {
    const enter = document.getElementById('todayMapEnter');
    const done = document.getElementById('todayMapDone');
    if (!enter || !done || !todayMap) return;
    const setInteractive = interactive => {
      todayMap.setOptions({ gestureHandling: interactive ? 'greedy' : 'none' });
      enter.hidden = interactive;
      done.hidden = !interactive;
    };
    enter.onclick = () => setInteractive(true);
    done.onclick = () => setInteractive(false);
    setInteractive(false);
  }

  async function drawTodayMap(stops, hotels, placeById) {
    const node = document.getElementById('todayTravelMap');
    const details = document.getElementById('todayMapDetails');
    if (!node || !details || !details.open) return false;
    const request = Symbol('today-map');
    node.__mapRequest = request;
    const date = state.date, group = state.group;
    const isCurrent = () => node.__mapRequest === request && node.isConnected &&
      document.getElementById('todayTravelMap') === node && details.open &&
      state.view === 'today' && state.date === date && state.group === group;
    const enter = document.getElementById('todayMapEnter');
    const done = document.getElementById('todayMapDone');
    if (enter) enter.hidden = true;
    if (done) done.hidden = true;
    const settings = mapSettings();
    if (!settings.apiKey || !settings.mapId) {
      node.innerHTML = '<div class="today-map-message">內嵌地圖尚未設定。可繼續使用主線的地點與導航連結，或到「更多」設定地圖。</div>';
      return true;
    }
    node.innerHTML = '<div class="today-map-message">正在載入地圖…</div>';
    await loadGoogleMaps(settings.apiKey);
    if (!isCurrent()) return false;
    await window.TRAVEL_PLANNER_MAPS.importLibrary('maps');
    if (!isCurrent()) return false;
    const { AdvancedMarkerElement, PinElement } = await window.TRAVEL_PLANNER_MAPS.importLibrary('marker');
    if (!isCurrent()) return false;
    const markerSpecs = [], itineraryPlaceIds = new Set();
    stops.forEach(stop => { if (!stop.place) return; const position = coord(stop.place);if (!position || itineraryPlaceIds.has(stop.place.id)) return;itineraryPlaceIds.add(stop.place.id);markerSpecs.push({place:stop.place,position,glyph:String(stop.number),label:`今日行程 ${stop.number}`}); });
    hotels.forEach(hotel => { const place=placeById.get(hotel.place_id),position=coord(place);if(!place||!position||itineraryPlaceIds.has(place.id))return;markerSpecs.push({place,position,glyph:'🛏',label:'今晚住宿'}); });
    if (!markerSpecs.length) { node.innerHTML='<div class="today-map-message">今天的行程尚無可顯示座標。</div>';return true; }
    const map = new google.maps.Map(node,{center:{lat:36.2,lng:138.25},zoom:5,mapId:settings.mapId,mapTypeControl:false,streetViewControl:false,fullscreenControl:false,gestureHandling:'none'});
    const info = new google.maps.InfoWindow();
    todayMap = map; todayInfo = info;
    const bounds=new google.maps.LatLngBounds();markerSpecs.forEach(spec=>{const pin=new PinElement({glyph:spec.glyph,scale:1.08});const marker=new AdvancedMarkerElement({map,position:spec.position,title:spec.place.name||'地點',content:pin.element});marker.addListener('click',()=>{if(!isCurrent())return;info.setContent(infoHtml(spec.place,spec.label));info.open({map,anchor:marker});});bounds.extend(spec.position);});
    if(markerSpecs.length===1){map.setCenter(markerSpecs[0].position);map.setZoom(14);}else map.fitBounds(bounds,44);
    bindTodayMapInteraction();
    return true;
  }

  function plannedTransportHtml(transport, fromPlace, toPlace) {
    const url=directionsUrl(fromPlace,toPlace,transportMode(transport.type));
    const label=[transportLabel(transport.type),transport.operator,transport.service_no].filter(Boolean).join(' · ');
    const time=[transport.departure_time,transport.arrival_time].filter(Boolean).join(' → ');
    const route=[fromPlace?.name,toPlace?.name].filter(Boolean).join(' → ');
    return `<div class="today-transfer planned"><div><strong>${esc(label||'已規劃交通')}</strong>${route?`<div class="meta">${esc(route)}</div>`:''}${time?`<div class="meta">${esc(time)}</div>`:''}</div>${url?`<a class="today-directions" href="${esc(url)}" target="_blank" rel="noopener noreferrer">開啟導航 ↗</a>`:''}</div>`;
  }
  function suggestedTransportHtml(fromPlace,toPlace){const url=directionsUrl(fromPlace,toPlace,'transit');if(!url)return'';return `<div class="today-transfer suggested"><span>↓ 交通建議</span><a class="today-directions" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a></div>`;}
  function routeHtml(stops,transports,options){
    if(!stops.length)return'<div class="card empty">這一天尚未安排行程。</div>';
    return `<div class="card today-route-card">${stops.map((stop,index)=>{
      const next=stops[index+1];let transfer='';
      if(next && stop.place && next.place){
        const linked=stop.item.transport_id?transports.find(t=>t.id===stop.item.transport_id):null;
        const planned=linked||transportBetween(stop.place.id,next.place.id,transports);
        transfer=planned?plannedTransportHtml(planned,placeByIdSafe(planned.from_place_id),placeByIdSafe(planned.to_place_id)):suggestedTransportHtml(stop.place,next.place);
      }
      return `<div class="today-stop"><div class="today-stop-main"><span class="today-stop-number">${stop.number}</span><div class="today-stop-body"><div class="row"><strong>${esc(stop.item.title||stop.place?.name||'行程')}</strong>${window.TRAVEL_PLANNER_ITINERARY_UI.status(stop.item)}</div><div class="meta">${esc([stop.item.start_time,stop.item.end_time].filter(Boolean).join('–'))}${stop.item.city?` · ${esc(stop.item.city)}`:''}</div>${stop.item.description?`<div class="meta itinerary-description">${esc(stop.item.description)}</div>`:''}${stop.place?`<div>${window.TRAVEL_PLANNER_ITINERARY_UI.placeLink(stop.place)}</div>${memoHtml(stop.place.id)}`:'<div class="meta">區域行程，尚未指定單一地點</div>'}${window.TRAVEL_PLANNER_ITINERARY_UI.options(stop.item,options)}</div></div>${transfer}</div>`;
    }).join('')}</div>`;
  }
  let activePlaceById = new Map();
  function placeByIdSafe(id){return activePlaceById.get(id);}

  function hotelsHtml(hotels,placeById){if(!hotels.length)return'<div class="card empty">今晚尚未設定住宿。</div>';return `<div class="stack">${hotels.map(h=>{const place=placeById.get(h.place_id);const url=place?(safeUrl(place.google_maps_url)||directionsUrl(place,place,'transit')):safeUrl(h.google_maps_url);return `<article class="card tonight-hotel"><div class="tonight-hotel-icon">🛏</div><div><div class="summary-kicker">今晚住宿</div><strong>${esc(h.hotel_name||place?.name||'住宿')}</strong><div class="meta">${esc(h.city||'')} · ${esc(groupDisplayName(currentGroup()))}</div><div class="meta">入住 ${esc(h.check_in||'—')} · 退房 ${esc(h.check_out||'—')}</div>${h.address?`<div class="meta">${esc(h.address)}</div>`:''}${url?`<a class="map-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">導航到飯店 ↗</a>`:''}</div></article>`;}).join('')}</div>`;}

  try {
    renderToday = async function(force=false){
      pageTitle.textContent='今日';loading();currentGroup();await ensureDates(force);
      if(!state.dates.length){app.innerHTML='<div class="card empty">目前沒有行程日期。</div>';return;}
      const group=groupFilterValue();
      const [items,transports,hotels,places,flights]=await Promise.all([api('itinerary',{date:state.date,group},force),api('transport',{date:state.date,group},force),api('hotels',{group},force),api('places',{},force),api('flights',{date:state.date,group},force),window.TRAVEL_PLANNER_PLACE_MEMOS?window.TRAVEL_PLANNER_PLACE_MEMOS.load(force):Promise.resolve([]),window.TRAVEL_PLANNER_OPTIONS.load(force)]);
      const placeById=new Map(places.map(p=>[p.id,p]));activePlaceById=placeById;
      const options=window.TRAVEL_PLANNER_OPTIONS.resolve(items,places,state.group);
      const stops=itineraryStops(items,placeById),tonight=activeHotels(hotels,state.date);
      app.innerHTML=`<section class="section today-controls">${dateNav()}${todayGroupFilters()}</section>${mobilityHtml(flights,transports,placeById)}<section class="section"><h2>今日主線</h2>${routeHtml(stops,transports,options)}</section><details id="todayMapDetails" class="section map-section card"><summary>今日地圖 <span class="meta">展開查看位置</span></summary><div class="map-heading-row"><h2>今日地圖</h2><span class="badge">${esc(groupDisplayName(currentGroup()))}</span></div><div style="position:relative"><div id="todayTravelMap" class="travel-map today-travel-map" aria-label="今日行程地圖"></div><button id="todayMapEnter" type="button" style="position:absolute;left:50%;bottom:14px;z-index:5;transform:translateX(-50%);border:1px solid rgba(0,0,0,.08);border-radius:999px;background:rgba(255,255,255,.94);box-shadow:0 4px 16px rgba(20,24,35,.16);padding:10px 16px;color:#16181d;font-weight:800;white-space:nowrap">點一下操作地圖</button><button id="todayMapDone" type="button" hidden style="position:absolute;right:12px;top:12px;z-index:5;border:1px solid rgba(0,0,0,.08);border-radius:999px;background:rgba(255,255,255,.96);box-shadow:0 4px 16px rgba(20,24,35,.16);padding:9px 14px;color:#1f6feb;font-weight:800">完成</button></div></details><section class="section"><h2>今晚住宿</h2>${hotelsHtml(tonight,placeById)}</section>`;
      bindDateControls();bindTodayGroupFilters();
      const mapDetails=document.getElementById('todayMapDetails');
      const mapNode=document.getElementById('todayTravelMap');
      let mapStarted=false, toggleVersion=0;
      mapDetails.addEventListener('toggle',async()=>{
        if(!mapDetails.open){mapNode.__mapRequest=null;mapStarted=false;++toggleVersion;return;}
        if(mapStarted||!mapNode.isConnected||document.getElementById('todayTravelMap')!==mapNode||state.view!=='today')return;
        mapStarted=true;
        const version=++toggleVersion;
        try {
          const complete=await drawTodayMap(stops,tonight,placeById);
          if(version===toggleVersion&&!complete)mapStarted=false;
        } catch(error) {
          if(version!==toggleVersion||!mapNode.isConnected||document.getElementById('todayTravelMap')!==mapNode||!mapDetails.open||state.view!=='today')return;
          console.warn('Today map unavailable; navigation links remain usable.',error);
          mapStarted=false;
          mapNode.innerHTML=`<div class="today-map-message">地圖載入失敗：${esc(error?.message||'未知錯誤')}。主線導航仍可使用；收合後再展開可重試。</div>`;
        }
      });
    };
    state.group=localStorage.getItem(GROUP_KEY)==='friends'?'friends':'ours';state.view='today';document.querySelectorAll('.nav-item').forEach(item=>item.classList.toggle('active',item.dataset.view==='today'));if(!window.TRAVEL_PLANNER_DEFER_INITIAL_RENDER)renderCurrent(false);
  }catch(error){console.error('P7.8 patch failed',error)}
})();