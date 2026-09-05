/* P7.8 itinerary-first Today experience + P15.3 flight cards */
(function () {
  const GROUP_KEY = 'travelPlanner.group.v1';
  const MAP_SETTINGS_KEY = 'travelPlanner.googleMaps.v1';
  let mapsPromise = null;
  let todayMap = null;
  let todayInfo = null;

  function groupDisplayName(value) {
    return window.travelPlannerGroupLabel(value);
  }

  function currentGroup() {
    if (state.group === 'ours' || state.group === 'friends') return state.group;
    const saved = localStorage.getItem(GROUP_KEY);
    state.group = saved === 'friends' ? 'friends' : 'ours';
    return state.group;
  }

  function groupFilterValue() {
    return currentGroup() + ',all';
  }

  function todayGroupFilters() {
    const group = currentGroup();
    return `<div class="filters today-group-filters">
      <button class="filter-btn ${group === 'ours' ? 'active' : ''}" data-today-group="ours">${esc(groupDisplayName('ours'))}</button>
      <button class="filter-btn ${group === 'friends' ? 'active' : ''}" data-today-group="friends">${esc(groupDisplayName('friends'))}</button>
    </div>`;
  }

  function bindTodayGroupFilters() {
    document.querySelectorAll('[data-today-group]').forEach(button => {
      button.addEventListener('click', () => {
        const next = button.dataset.todayGroup;
        if (next !== 'ours' && next !== 'friends') return;
        state.group = next;
        localStorage.setItem(GROUP_KEY, next);
        renderToday(false).catch(failed);
      });
    });
  }

  function mapSettings() {
    const fixed = window.TRAVEL_PLANNER_MAP_CONFIG || {};
    if (fixed.apiKey && fixed.mapId) return fixed;
    try {
      const saved = JSON.parse(localStorage.getItem(MAP_SETTINGS_KEY) || '{}');
      return { apiKey: String(saved.apiKey || '').trim(), mapId: String(saved.mapId || '').trim() };
    } catch (_) {
      return { apiKey: '', mapId: '' };
    }
  }

  function loadGoogleMaps(apiKey) {
    if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
    if (mapsPromise) return mapsPromise;
    mapsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const url = new URL('https://maps.googleapis.com/maps/api/js');
      url.searchParams.set('key', apiKey);
      url.searchParams.set('v', 'weekly');
      url.searchParams.set('loading', 'async');
      script.src = url.toString();
      script.async = true;
      script.defer = true;
      script.onload = () => window.google?.maps ? resolve(window.google.maps) : reject(new Error('Google Maps 未初始化'));
      script.onerror = () => reject(new Error('Google Maps 載入失敗'));
      document.head.appendChild(script);
    }).catch(error => {
      mapsPromise = null;
      throw error;
    });
    return mapsPromise;
  }

  function coord(place) {
    const lat = Number(place?.latitude), lng = Number(place?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  }

  function directionsUrl(from, to, mode = 'transit') {
    const origin = coord(from) ? `${from.latitude},${from.longitude}` : [from?.name, from?.address, from?.city].filter(Boolean).join(' ');
    const destination = coord(to) ? `${to.latitude},${to.longitude}` : [to?.name, to?.address, to?.city].filter(Boolean).join(' ');
    if (!origin || !destination) return '';
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    url.searchParams.set('origin', origin);
    url.searchParams.set('destination', destination);
    url.searchParams.set('travelmode', mode);
    return url.toString();
  }

  function transportMode(type) {
    return type === 'rental_car' ? 'driving' : 'transit';
  }

  function transportBetween(fromId, toId, transports) {
    return transports.find(t => t.from_place_id === fromId && t.to_place_id === toId) || null;
  }

  function itineraryStops(items, placeById) {
    return items
      .filter(item => item.place_id && placeById.has(item.place_id))
      .map((item, index) => ({ item, place: placeById.get(item.place_id), number: index + 1 }));
  }

  function activeHotels(hotels, date) {
    return hotels.filter(h => h.check_in && h.check_out && h.check_in <= date && date < h.check_out);
  }

  function flightCardHtml(flight) {
    const carrier = [flight.airline, flight.flight_no].filter(Boolean).join(' ') || '航班';
    const route = `${flight.departure_airport || '—'} → ${flight.arrival_airport || '—'}`;
    const time = [flight.departure_time, flight.arrival_time].filter(Boolean).join(' → ');
    return `<article class="summary-card today-flight-card">
      <div class="summary-icon">✈</div>
      <div class="summary-body">
        <div class="summary-kicker">今日航班</div>
        <strong>${esc(carrier)}</strong>
        <div class="route"><span>${esc(route)}</span></div>
        ${time ? `<div class="meta">${esc(time)}</div>` : ''}
      </div>
    </article>`;
  }

  function flightsHtml(flights) {
    if (!flights.length) return '';
    return `<section class="section"><h2>今日航班</h2><div class="summary-scroll">${flights.map(flightCardHtml).join('')}</div></section>`;
  }

  function infoHtml(place, label) {
    const maps = safeUrl(place?.google_maps_url);
    return `<div class="map-info-window"><strong>${esc(place?.name || '地點')}</strong>${label ? `<div>${esc(label)}</div>` : ''}${place?.address ? `<div>${esc(place.address)}</div>` : ''}${maps ? `<a href="${esc(maps)}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a>` : ''}</div>`;
  }

  async function drawTodayMap(stops, hotels, placeById) {
    const node = document.getElementById('todayTravelMap');
    if (!node) return;
    const settings = mapSettings();
    if (!settings.apiKey || !settings.mapId) {
      node.innerHTML = '<div class="today-map-message">Google Maps 尚未設定。可先到「更多」中的舊地圖設定完成設定。</div>';
      return;
    }

    await loadGoogleMaps(settings.apiKey);
    await google.maps.importLibrary('maps');
    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary('marker');

    todayMap = new google.maps.Map(node, {
      center: { lat: 36.2, lng: 138.25 },
      zoom: 5,
      mapId: settings.mapId,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    });
    todayInfo = new google.maps.InfoWindow();

    const markerSpecs = [];
    const itineraryPlaceIds = new Set();
    stops.forEach(stop => {
      const position = coord(stop.place);
      if (!position || itineraryPlaceIds.has(stop.place.id)) return;
      itineraryPlaceIds.add(stop.place.id);
      markerSpecs.push({ place: stop.place, position, glyph: String(stop.number), label: `今日行程 ${stop.number}` });
    });

    hotels.forEach(hotel => {
      const place = placeById.get(hotel.place_id);
      const position = coord(place);
      if (!place || !position || itineraryPlaceIds.has(place.id)) return;
      markerSpecs.push({ place, position, glyph: '🛏', label: '今晚住宿' });
    });

    if (!markerSpecs.length) {
      node.innerHTML = '<div class="today-map-message">今天的行程尚無可顯示座標。</div>';
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    markerSpecs.forEach(spec => {
      const pin = new PinElement({ glyph: spec.glyph, scale: 1.08 });
      const marker = new AdvancedMarkerElement({ map: todayMap, position: spec.position, title: spec.place.name || '地點', content: pin.element });
      marker.addListener('click', () => {
        todayInfo.setContent(infoHtml(spec.place, spec.label));
        todayInfo.open({ map: todayMap, anchor: marker });
      });
      bounds.extend(spec.position);
    });

    if (markerSpecs.length === 1) {
      todayMap.setCenter(markerSpecs[0].position);
      todayMap.setZoom(14);
    } else {
      todayMap.fitBounds(bounds, 44);
    }
  }

  function plannedTransportHtml(transport, fromPlace, toPlace) {
    const url = directionsUrl(fromPlace, toPlace, transportMode(transport.type));
    const label = [transportLabel(transport.type), transport.operator, transport.service_no].filter(Boolean).join(' · ');
    const time = [transport.departure_time, transport.arrival_time].filter(Boolean).join(' → ');
    return `<div class="today-transfer planned"><div><strong>${esc(label || '已規劃交通')}</strong>${time ? `<div class="meta">${esc(time)}</div>` : ''}</div>${url ? `<a class="today-directions" href="${esc(url)}" target="_blank" rel="noopener noreferrer">開啟導航 ↗</a>` : ''}</div>`;
  }

  function suggestedTransportHtml(fromPlace, toPlace) {
    const url = directionsUrl(fromPlace, toPlace, 'transit');
    if (!url) return '';
    return `<div class="today-transfer suggested"><span>↓ 交通建議</span><a class="today-directions" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a></div>`;
  }

  function routeHtml(stops, transports) {
    if (!stops.length) return '<div class="card empty">這一天尚未安排有地點的行程。</div>';
    return `<div class="card today-route-card">${stops.map((stop, index) => {
      const next = stops[index + 1];
      let transfer = '';
      if (next) {
        const planned = transportBetween(stop.place.id, next.place.id, transports);
        transfer = planned ? plannedTransportHtml(planned, stop.place, next.place) : suggestedTransportHtml(stop.place, next.place);
      }
      return `<div class="today-stop"><div class="today-stop-main"><span class="today-stop-number">${stop.number}</span><div><strong>${esc(stop.item.title || stop.place.name)}</strong><div class="meta">${esc(stop.item.start_time || '')}${stop.item.city ? ` · ${esc(stop.item.city)}` : ''}</div>${stop.item.description ? `<div class="meta">${esc(stop.item.description)}</div>` : ''}</div></div>${transfer}</div>`;
    }).join('')}</div>`;
  }

  function hotelsHtml(hotels, placeById) {
    if (!hotels.length) return '<div class="card empty">今晚尚未設定住宿。</div>';
    return `<div class="stack">${hotels.map(h => {
      const place = placeById.get(h.place_id);
      const url = place ? (safeUrl(place.google_maps_url) || directionsUrl(place, place, 'transit')) : safeUrl(h.google_maps_url);
      return `<article class="card tonight-hotel"><div class="tonight-hotel-icon">🛏</div><div><div class="summary-kicker">今晚住宿</div><strong>${esc(h.hotel_name || place?.name || '住宿')}</strong><div class="meta">${esc(h.city || '')} · ${esc(groupDisplayName(currentGroup()))}</div><div class="meta">入住 ${esc(h.check_in || '—')} · 退房 ${esc(h.check_out || '—')}</div>${h.address ? `<div class="meta">${esc(h.address)}</div>` : ''}${url ? `<a class="map-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">導航到飯店 ↗</a>` : ''}</div></article>`;
    }).join('')}</div>`;
  }

  try {
    renderToday = async function (force = false) {
      pageTitle.textContent = '今日';
      loading();
      currentGroup();
      await ensureDates(force);
      if (!state.dates.length) {
        app.innerHTML = '<div class="card empty">目前沒有行程日期。</div>';
        return;
      }

      const group = groupFilterValue();
      const [items, transports, hotels, places, flights] = await Promise.all([
        api('itinerary', { date: state.date, group }, force),
        api('transport', { date: state.date, group }, force),
        api('hotels', { group }, force),
        api('places', {}, force),
        api('flights', { date: state.date, group }, force)
      ]);

      const placeById = new Map(places.map(p => [p.id, p]));
      const stops = itineraryStops(items, placeById);
      const tonight = activeHotels(hotels, state.date);

      app.innerHTML = `<section class="section today-controls">${dateNav()}${todayGroupFilters()}</section>
        ${flightsHtml(flights)}
        <section class="section map-section"><div class="map-heading-row"><h2>今日地圖</h2><span class="badge">${esc(groupDisplayName(currentGroup()))}</span></div><div id="todayTravelMap" class="travel-map today-travel-map" aria-label="今日行程地圖"></div></section>
        <section class="section"><h2>今日行程</h2>${routeHtml(stops, transports)}</section>
        <section class="section"><h2>今晚住宿</h2>${hotelsHtml(tonight, placeById)}</section>`;

      bindDateControls();
      bindTodayGroupFilters();
      drawTodayMap(stops, tonight, placeById).catch(error => {
        console.error('P7.8 today map failed', error);
        const node = document.getElementById('todayTravelMap');
        if (node) node.innerHTML = `<div class="today-map-message">地圖載入失敗：${esc(error?.message || '未知錯誤')}</div>`;
      });
    };

    state.group = localStorage.getItem(GROUP_KEY) === 'friends' ? 'friends' : 'ours';
    state.view = 'today';
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === 'today'));
    if (!window.TRAVEL_PLANNER_DEFER_INITIAL_RENDER) renderCurrent(false);
  } catch (error) {
    console.error('P7.8 patch failed', error);
  }
})();
