/* P7.3 interactive Google Map */
(function () {
  const MAP_SETTINGS_KEY = 'travelPlanner.googleMaps.v1';
  let mapsPromise = null;
  let mapInstance = null;
  let infoWindow = null;
  let markerByPlaceId = new Map();

  function readMapSettings() {
    const fixed = window.TRAVEL_PLANNER_MAP_CONFIG || {};
    if (fixed.apiKey && fixed.mapId) return fixed;
    try {
      const saved = JSON.parse(localStorage.getItem(MAP_SETTINGS_KEY) || '{}');
      return {
        apiKey: String(saved.apiKey || '').trim(),
        mapId: String(saved.mapId || '').trim()
      };
    } catch (_) {
      return { apiKey: '', mapId: '' };
    }
  }

  function saveMapSettings(apiKey, mapId) {
    localStorage.setItem(MAP_SETTINGS_KEY, JSON.stringify({ apiKey, mapId }));
  }

  function clearMapSettings() {
    localStorage.removeItem(MAP_SETTINGS_KEY);
    mapsPromise = null;
  }

  function loadGoogleMaps(apiKey) {
    if (window.google && window.google.maps && window.google.maps.importLibrary) {
      return Promise.resolve(window.google.maps);
    }
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
      script.onload = () => {
        if (window.google && window.google.maps) resolve(window.google.maps);
        else reject(new Error('Google Maps 載入完成但 API 未初始化'));
      };
      script.onerror = () => reject(new Error('Google Maps JavaScript API 載入失敗'));
      document.head.appendChild(script);
    }).catch(error => {
      mapsPromise = null;
      throw error;
    });

    return mapsPromise;
  }

  function numberOrNull(value) {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function coordinates(place) {
    const lat = numberOrNull(place.latitude);
    const lng = numberOrNull(place.longitude);
    if (lat === null || lng === null) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  }

  function googleMapsUrl(place) {
    const direct = safeUrl(place.google_maps_url);
    if (direct) return direct;
    const query = [place.name, place.address, place.city].filter(Boolean).join(' ');
    return query ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query) : '';
  }

  function mapSetupCard() {
    return `<section class="stack">
      <div class="card">
        <h2>啟用旅程地圖</h2>
        <div class="meta">這台裝置尚未設定 Google Maps。請輸入已限制網站來源的 Maps JavaScript API Key 與 JavaScript Map ID；設定只會存在此瀏覽器。</div>
      </div>
      <div class="card map-setup-card">
        <label><strong>Maps API Key</strong><input id="mapApiKey" class="map-config-input" type="text" autocomplete="off" spellcheck="false" placeholder="AIza…"></label>
        <label><strong>Map ID</strong><input id="mapId" class="map-config-input" type="text" autocomplete="off" spellcheck="false" placeholder="JavaScript Map ID"></label>
        <button id="saveMapConfig" class="retry-button" type="button">儲存並載入地圖</button>
        <div id="mapConfigStatus" class="meta"></div>
      </div>
    </section>`;
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

  function placeCard(place, usedIds) {
    const point = coordinates(place);
    const external = googleMapsUrl(place);
    return `<article class="card place-card map-place-card ${point ? 'has-coordinate' : 'missing-coordinate'}" data-place-id="${esc(place.id || '')}">
      <div class="place-card-head">
        <div>
          <div class="summary-kicker">${esc(categoryLabel(place.category || ''))}</div>
          <h3>${esc(place.name || '未命名地點')}</h3>
        </div>
        ${usedIds.has(place.id) ? '<span class="badge confirmed">行程使用</span>' : ''}
      </div>
      <div class="meta">${esc(place.city || '')}${place.address ? ` · ${esc(place.address)}` : ''}</div>
      <div class="map-place-actions">
        ${point ? `<button class="map-focus-button" type="button" data-focus-place="${esc(place.id || '')}">在地圖查看</button>` : '<span class="map-missing-label">尚未設定座標</span>'}
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

  async function drawMap(places, usedIds, mapId) {
    await google.maps.importLibrary('maps');
    const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
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
      mapNode.classList.add('map-empty-canvas');
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    validPlaces.forEach(place => {
      const position = coordinates(place);
      const marker = new AdvancedMarkerElement({
        map: mapInstance,
        position,
        title: place.name || '地點',
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

  try {
    renderMap = async function (force = false) {
      pageTitle.textContent = '地圖';
      loading();

      const settings = readMapSettings();
      if (!settings.apiKey || !settings.mapId) {
        app.innerHTML = mapSetupCard();
        bindMapSetup();
        return;
      }

      try {
        const [places, itinerary] = await Promise.all([
          api('places', {}, force),
          api('itinerary', { group: groupParam() }, force)
        ]);
        const usedIds = new Set(itinerary.map(i => i.place_id).filter(Boolean));
        const sorted = [...places].sort((a, b) =>
          (usedIds.has(b.id) ? 1 : 0) - (usedIds.has(a.id) ? 1 : 0) ||
          String(a.city || '').localeCompare(String(b.city || ''), 'zh-Hant') ||
          String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant')
        );
        const coordinateCount = sorted.filter(p => coordinates(p)).length;
        const placesById = new Map(sorted.map(p => [p.id, p]));

        app.innerHTML = `<section class="section">${filters()}</section>
          <section class="section map-section">
            <div class="map-heading-row"><h2>旅程地圖</h2><span class="badge">${coordinateCount} / ${sorted.length} 有座標</span></div>
            <div id="travelMap" class="travel-map" aria-label="Google Maps 旅程地圖"></div>
            <div class="map-toolbar"><span class="meta">點地點卡片可快速定位</span><button id="resetMapConfig" class="map-settings-button" type="button">重設地圖設定</button></div>
          </section>
          <section class="section"><div class="map-heading-row"><h2>旅程地點</h2><span class="badge">${sorted.length}</span></div><div class="stack">${sorted.length ? sorted.map(p => placeCard(p, usedIds)).join('') : '<div class="card empty">目前沒有地點資料。</div>'}</div></section>`;

        bindFilters();
        document.getElementById('resetMapConfig')?.addEventListener('click', () => {
          if (!window.confirm('要清除這台裝置的 Google Maps 設定嗎？')) return;
          clearMapSettings();
          renderMap(false);
        });

        await loadGoogleMaps(settings.apiKey);
        await drawMap(sorted, usedIds, settings.mapId);
        bindPlaceFocus(placesById);
      } catch (error) {
        console.error('P7.3 map failed', error);
        app.innerHTML = `<div class="card error">地圖載入失敗：${esc(error?.message || '未知錯誤')}</div><div class="card"><button id="resetMapAfterError" class="retry-button" type="button">重新設定 Google Maps</button></div>`;
        document.getElementById('resetMapAfterError')?.addEventListener('click', () => {
          clearMapSettings();
          renderMap(false);
        });
      }
    };
  } catch (error) {
    console.error('P7.3 patch failed', error);
  }
})();
