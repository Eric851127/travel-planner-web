/* Shared Traveler Google Maps runtime. Keeps the existing P7/P8 storage and loader contract. */
(function () {
  'use strict';

  const MAP_SETTINGS_KEY = 'travelPlanner.googleMaps.v1';
  let mapsPromise = null;

  function readSettings() {
    const fixed = window.TRAVEL_PLANNER_MAP_CONFIG || {};
    if (fixed.apiKey && fixed.mapId) {
      return {
        apiKey: String(fixed.apiKey || '').trim(),
        mapId: String(fixed.mapId || '').trim()
      };
    }
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

  function saveSettings(apiKey, mapId) {
    const next = {
      apiKey: String(apiKey || '').trim(),
      mapId: String(mapId || '').trim()
    };
    localStorage.setItem(MAP_SETTINGS_KEY, JSON.stringify(next));
    return next;
  }

  function clearSettings() {
    localStorage.removeItem(MAP_SETTINGS_KEY);
    mapsPromise = null;
  }

  function load(apiKey) {
    if (window.google && window.google.maps && window.google.maps.importLibrary) {
      return Promise.resolve(window.google.maps);
    }
    if (mapsPromise) return mapsPromise;

    mapsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const url = new URL('https://maps.googleapis.com/maps/api/js');
      url.searchParams.set('key', String(apiKey || '').trim());
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
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function coordinates(place) {
    const lat = numberOrNull(place && place.latitude);
    const lng = numberOrNull(place && place.longitude);
    if (lat === null || lng === null) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  }

  function placeSearchUrl(place) {
    const direct = typeof safeUrl === 'function' ? safeUrl(place && place.google_maps_url) : '';
    if (direct) return direct;
    const query = [place && place.name, place && place.address, place && place.city].filter(Boolean).join(' ');
    return query ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query) : '';
  }

  function directionsUrl(from, to, mode = 'transit') {
    const fromCoord = coordinates(from);
    const toCoord = coordinates(to);
    const origin = fromCoord
      ? `${fromCoord.lat},${fromCoord.lng}`
      : [from && from.name, from && from.address, from && from.city].filter(Boolean).join(' ');
    const destination = toCoord
      ? `${toCoord.lat},${toCoord.lng}`
      : [to && to.name, to && to.address, to && to.city].filter(Boolean).join(' ');
    if (!origin || !destination) return '';
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    url.searchParams.set('origin', origin);
    url.searchParams.set('destination', destination);
    url.searchParams.set('travelmode', mode);
    return url.toString();
  }

  window.TRAVEL_PLANNER_MAPS = Object.freeze({
    storageKey: MAP_SETTINGS_KEY,
    readSettings,
    saveSettings,
    clearSettings,
    load,
    coordinates,
    placeSearchUrl,
    directionsUrl
  });
})();