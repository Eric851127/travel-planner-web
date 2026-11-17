/* Date-scoped route map. Lists and external navigation remain usable without Maps. */
(function () {
  let mapInstance = null;
  let infoWindow = null;
  let markerByPlaceId = new Map();
  let mapDate = null;
  let mapLayer = 'route';
  let renderVersion = 0;

  function readMapSettings() { return window.TRAVEL_PLANNER_MAPS.readSettings(); }
  function saveMapSettings(apiKey, mapId) { return window.TRAVEL_PLANNER_MAPS.saveSettings(apiKey, mapId); }
  function clearMapSettings() { return window.TRAVEL_PLANNER_MAPS.clearSettings(); }
  function loadGoogleMaps(apiKey) { return window.TRAVEL_PLANNER_MAPS.load(apiKey); }
  function coordinates(place) { return window.TRAVEL_PLANNER_MAPS.coordinates(place); }
  function googleMapsUrl(place) { return window.TRAVEL_PLANNER_MAPS.placeSearchUrl(place); }
  function memoHtml(placeId) { return window.TRAVEL_PLANNER_PLACE_MEMOS ? window.TRAVEL_PLANNER_PLACE_MEMOS.html(placeId) : ''; }

  function mapSetupCard() {
    return `<details class="card"><summary>地圖設定（選用）</summary><section class="stack">
      <div class="card">
        <h2>啟用旅程地圖</h2>
        <div class="meta">不設定也能查看地點並開啟外部導航。若要使用內嵌地圖，請輸入已限制網站來源的 Maps JavaScript API Key 與 JavaScript Map ID；設定只會存在此瀏覽器。</div>
      </div>
      <div class="card map-setup-card">
        <label><strong>Maps API Key</strong><input id="mapApiKey" class="map-config-input" type="text" autocomplete="off" spellcheck="false" placeholder="AIza…"></label>
        <label><strong>Map ID</strong><input id="mapId" class="map-config-input" type="text" autocomplete="off" spellcheck="false" placeholder="JavaScript Map ID"></label>
        <button id="saveMapConfig" class="retry-button" type="button">儲存並載入地圖</button>
        <div id="mapConfigStatus" class="meta"></div>
      </div>
    </section></details>`;
  }

  function bindMapSetup() {
    const button = document.getElementById('saveMapConfig');
    if (!button) return;
    button.onclick = async () => {
      const apiKey = String(document.getElementById('mapApiKey').value || '').trim();
      const mapId = String(document.getElementById('mapId').value || '').trim();
      const status = document.getElementById('mapConfigStatus');
      if (!apiKey || !mapId) {
        status.textContent = 'API Key 與 Map ID 都需要填寫。';
        return;
      }
      button.disabled = true;
      status.textContent = '正在測試 Google Maps…';
      try {
        await loadGoogleMaps(apiKey);
        saveMapSettings(apiKey, mapId);
        renderMap(true);
      } catch (error) {
        status.textContent = '設定失敗：' + (error?.message || '未知錯誤');
        button.disabled = false;
      }
    };
  }

  function placeCard(place, usedIds, nearbyIds) {
    const point = coordinates(place);
    const external = googleMapsUrl(place);
    return `<article class="card place-card map-place-card ${point ? 'has-coordinate' : 'missing-coordinate'}" data-place-id="${esc(place.id || '')}">
      <div class="place-card-head">
        <div>
          <div class="summary-kicker">${esc(categoryLabel(place.category || ''))}</div>
          <h3>${esc(place.name || '未命名地點')}</h3>
        </div>
        ${usedIds.has(place.id) ? '<span class="badge confirmed">當日主線</span>' : nearbyIds.has(place.id) ? '<span class="badge">附近可選</span>' : ''}
      </div>
      <div class="meta">${esc(place.city || '')}${place.address ? ` · ${esc(place.address)}` : ''}</div>
      ${memoHtml(place.id)}
      <div class="map-place-actions">
        ${point ? `<button class="map-focus-button" type="button" disabled data-focus-place="${esc(place.id || '')}">在地圖查看</button>` : '<span class="map-missing-label">尚未設定座標</span>'}
        ${external ? `<a class="map-link" href="${esc(external)}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a>` : ''}
      </div>
    </article>`;
  }

  function infoContent(place) {
    const external = googleMapsUrl(place);
    return `<div class="map-info-window">
      <strong>${esc(place.name || '地點')}</strong>
      <div>${esc([place.city, categoryLabel(place.category || '')].filter(Boolean).join(' · '))}</div>
      ${place.address ? `<div>${esc(place.address)}</div>` : ''}
      ${external ? `<a href="${esc(external)}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a>` : ''}
    </div>`;
  }

  function bindPlaceFocus(placesById) {
    document.querySelectorAll('[data-focus-place]').forEach(button => {
      button.disabled = !markerByPlaceId.has(button.dataset.focusPlace);
      button.addEventListener('click', () => {
        const id = button.dataset.focusPlace;
        const entry = markerByPlaceId.get(id);
        const place = placesById.get(id);
        if (!entry || !place || !mapInstance) return;
        mapInstance.panTo(entry.position);
        mapInstance.setZoom(Math.max(mapInstance.getZoom() || 12, 15));
        infoWindow.setContent(infoContent(place));
        infoWindow.open({ map: mapInstance, anchor: entry.marker });
        document.getElementById('travelMap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  async function drawMap(places, usedIds, mapId, version) {
    await window.TRAVEL_PLANNER_MAPS.importLibrary('maps');
    if (version !== renderVersion || state.view !== 'map') return;
    const { AdvancedMarkerElement, PinElement } = await window.TRAVEL_PLANNER_MAPS.importLibrary('marker');
    if (version !== renderVersion || state.view !== 'map') return;
    const validPlaces = places.filter(p => coordinates(p));
    const mapNode = document.getElementById('travelMap');
    if (!mapNode) return;

    mapInstance = new google.maps.Map(mapNode, {
      center: { lat: 36.2, lng: 138.25 },
      zoom: 5,
      mapId,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    });

    infoWindow = new google.maps.InfoWindow();
    markerByPlaceId = new Map();

    if (!validPlaces.length) {
      mapNode.innerHTML = '<div class="today-map-message">這個篩選範圍尚無可顯示座標，仍可使用下方 Google Maps 連結。</div>';
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    validPlaces.forEach(place => {
      const position = coordinates(place);
      const marker = new AdvancedMarkerElement({
        map: mapInstance,
        position,
        title: place.name || '地點',
        content: new PinElement({background:usedIds.has(place.id)?'#2563eb':'#d97706',borderColor:'#fff',glyphColor:'#fff',glyph:usedIds.has(place.id)?'●':'◇'}).element,
        gmpClickable: true
      });
      marker.addEventListener('gmp-click', () => {
        infoWindow.setContent(infoContent(place));
        infoWindow.open({ map: mapInstance, anchor: marker });
      });
      markerByPlaceId.set(place.id, { marker, position });
      bounds.extend(position);
    });

    if (validPlaces.length === 1) {
      mapInstance.setCenter(coordinates(validPlaces[0]));
      mapInstance.setZoom(14);
    } else {
      mapInstance.fitBounds(bounds, 42);
    }
  }

  function schedule(action) {
    return window.TRAVEL_PLANNER_INTERACTIONS
      ? window.TRAVEL_PLANNER_INTERACTIONS.schedule(action) : action();
  }

  function bindMapControls() {
    bindFilters();
    bindMapSetup();
    document.getElementById('mapDateSelect')?.addEventListener('change', event => {
      const date = event.target.value;
      schedule(async () => { mapDate = date; await renderMap(false); });
    });
    document.querySelectorAll('[data-map-layer]').forEach(button => {
      button.onclick = () => {
        const layer = button.dataset.mapLayer;
        schedule(async () => { mapLayer = layer; await renderMap(false); });
      };
    });
    document.getElementById('resetMapConfig')?.addEventListener('click', () => {
      if (!window.confirm('要清除這台裝置的 Google Maps 設定嗎？')) return;
      schedule(async () => { clearMapSettings(); await renderMap(false); });
    });
  }

  try {
    renderMap = async function (force = false) {
      const version = ++renderVersion;
      pageTitle.textContent = '地圖與地點';
      loading();
      markerByPlaceId = new Map();
      mapInstance = null;
      const options = window.TRAVEL_PLANNER_OPTIONS;
      const [places, itinerary] = await Promise.all([
        api('places', {}, force),
        api('itinerary', { group: groupParam() }, force),
        window.TRAVEL_PLANNER_PLACE_MEMOS ? window.TRAVEL_PLANNER_PLACE_MEMOS.load(force) : Promise.resolve([]),
        options ? options.load(force) : Promise.resolve([])
      ]);
      if (version !== renderVersion || state.view !== 'map') return;
      const dates = [...new Set(itinerary.map(item => item.date).filter(Boolean))].sort();
      if (!dates.includes(mapDate)) mapDate = dates.includes(state.date) ? state.date : dates[0] || null;
      const dayItems = itinerary.filter(item => item.date === mapDate);
      const usedIds = new Set(dayItems.map(item => item.place_id).filter(Boolean));
      const resolvedOptions = options ? options.resolve(dayItems, places) : new Map();
      const nearbyIds = new Set(dayItems.flatMap(item => resolvedOptions.get(item.id) || []).map(row => row.candidate_place.id).filter(Boolean));
      const visible = places.filter(place => mapLayer === 'all' || (mapLayer === 'nearby' ? nearbyIds.has(place.id) : usedIds.has(place.id)));
      const order = new Map(dayItems.map((item, index) => [item.place_id, index]));
      const sorted = visible.slice().sort((a, b) =>
        (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity) ||
        String(a.city || '').localeCompare(String(b.city || ''), 'zh-Hant') ||
        String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant'));
      const coordinateCount = sorted.filter(place => coordinates(place)).length;
      const settings = readMapSettings();
      const configured = !!(settings.apiKey && settings.mapId);
      const labels = {route:'當日主線',nearby:'附近可選',all:'全部地點'};
      const empty = mapLayer === 'nearby' ? '這一天尚無已整理的附近選項。這不代表周邊沒有景點。' : '這個範圍尚無地點資料。沒有地點連結的行程仍可在今日查看。';
      app.innerHTML = `<section class="section">${filters()}
        <label for="mapDateSelect">日期</label><select id="mapDateSelect" class="map-config-input" ${dates.length ? '' : 'disabled'}>${dates.length ? dates.map(date => `<option value="${esc(date)}" ${date === mapDate ? 'selected' : ''}>${esc(formatDateLabel(date))}</option>`).join('') : '<option>尚無行程日期</option>'}</select>
        <div class="filters" aria-label="地點範圍">${Object.entries(labels).map(([key,label]) => `<button type="button" class="filter-btn ${mapLayer === key ? 'active' : ''}" aria-pressed="${mapLayer === key}" data-map-layer="${key}">${label}</button>`).join('')}</div>
        <p class="meta">${mapLayer === 'all' ? '全部地點包含本次主線以外的收藏，不代表已排入行程。' : '藍色為主線，橘色為附近可選；選項不會自動加入行程。'}</p>
      </section>
      <section class="section map-section">
        <div class="map-heading-row"><h2>${labels[mapLayer]}</h2><span class="badge">${coordinateCount} / ${sorted.length} 有座標</span></div>
        <div id="travelMap" class="${configured ? 'travel-map' : 'card'}" aria-label="Google Maps 旅程地圖"><div class="today-map-message">${configured ? '正在載入地圖…' : '內嵌地圖尚未設定。下方地點與 Google Maps 導航仍可使用。'}</div></div>
        ${mapSetupCard()}
        ${configured ? '<button id="resetMapConfig" class="map-settings-button" type="button">重設地圖設定</button>' : ''}
      </section>
      <section class="section"><div class="map-heading-row"><h2>地點清單</h2><span class="badge">${sorted.length}</span></div><div class="stack">${sorted.length ? sorted.map(place => placeCard(place, usedIds, nearbyIds)).join('') : `<div class="card empty">${empty}</div>`}</div></section>`;
      bindMapControls();
      if (!configured) return;
      // Rendering the optional map must never occupy the navigation queue.
      // Keep the original node as well as the version to reject leave/re-enter races.
      const mapNode = document.getElementById('travelMap');
      const current = () => version === renderVersion && state.view === 'map' && document.getElementById('travelMap') === mapNode;
      void (async () => {
      try {
        await loadGoogleMaps(settings.apiKey);
        if (!current()) return;
        await drawMap(sorted, usedIds, settings.mapId, version);
        if (!current()) return;
        bindPlaceFocus(new Map(sorted.map(place => [place.id, place])));
      } catch (error) {
        if (!current()) return;
        console.warn('Map unavailable; keeping place list.', error);
        const node = document.getElementById('travelMap');
        if (node) node.innerHTML = `<div class="today-map-message">內嵌地圖載入失敗：${esc(error?.message || '未知錯誤')}。地點清單與外部導航不受影響。</div>`;
      }
      })();
    };
  } catch (error) {
    console.error('Map renderer failed', error);
  }
})();
