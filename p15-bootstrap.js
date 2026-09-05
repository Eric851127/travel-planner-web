/* P15.1 Traveler bootstrap adapter: collapse Today resource reads into one public API request. */
(function () {
  'use strict';

  const BOOTSTRAP_RESOURCE = 'traveler_bootstrap';
  const CACHE_PREFIX = 'travelPlanner.bootstrap.v1.';
  const FRESH_MS = 5 * 60 * 1000;
  const STALE_MAX_MS = 7 * 24 * 60 * 60 * 1000;
  const FORCE_REUSE_MS = 3000;
  const snapshots = new Map();
  const snapshotSavedAt = new Map();
  const inFlight = new Map();
  const baseApi = api;

  function normalizedGroup() {
    if (state.group === 'ours' || state.group === 'friends') return state.group + ',all';
    return '';
  }

  function snapshotKey(date, group) {
    return String(date || '') + '|' + String(group || '');
  }

  function storageKey(key) {
    return CACHE_PREFIX + encodeURIComponent(key);
  }

  function rememberSnapshot(key, data) {
    snapshots.set(key, data);
    snapshotSavedAt.set(key, Date.now());
    if (data && data.selected_date) {
      const alias = snapshotKey(data.selected_date, key.split('|').slice(1).join('|'));
      snapshots.set(alias, data);
      snapshotSavedAt.set(alias, Date.now());
    }
  }

  function readStored(key) {
    try {
      const raw = localStorage.getItem(storageKey(key));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.data || !Number.isFinite(parsed.savedAt)) return null;
      const age = Date.now() - parsed.savedAt;
      if (age > STALE_MAX_MS) {
        localStorage.removeItem(storageKey(key));
        return null;
      }
      return { data: parsed.data, age, savedAt: parsed.savedAt };
    } catch (_) {
      return null;
    }
  }

  function writeStored(key, data) {
    try {
      localStorage.setItem(storageKey(key), JSON.stringify({ savedAt: Date.now(), data }));
    } catch (error) {
      console.warn('P15.1 bootstrap cache write skipped', error);
    }
  }

  async function fetchBootstrap(date, group, force) {
    const key = snapshotKey(date, group);
    const recentAt = snapshotSavedAt.get(key) || 0;
    if (snapshots.has(key) && (!force || Date.now() - recentAt <= FORCE_REUSE_MS)) return snapshots.get(key);

    const stored = readStored(key);
    if (!force && stored && stored.age <= FRESH_MS) {
      rememberSnapshot(key, stored.data);
      backgroundRefresh(date, group, key);
      return stored.data;
    }

    if (inFlight.has(key)) return inFlight.get(key);

    const request = (async () => {
      const url = new URL(config.apiBase + '/' + BOOTSTRAP_RESOURCE);
      if (date) url.searchParams.set('date', date);
      if (group) url.searchParams.set('group', group);
      try {
        const json = await jsonp(url, 20000);
        if (!json || !json.success || !json.data) throw new Error(json?.error?.message || 'Bootstrap API 發生錯誤');
        rememberSnapshot(key, json.data);
        writeStored(key, json.data);
        return json.data;
      } catch (error) {
        if (stored) {
          rememberSnapshot(key, stored.data);
          console.warn('P15.1 bootstrap using stale cache', error);
          return stored.data;
        }
        throw error;
      }
    })().finally(() => inFlight.delete(key));

    inFlight.set(key, request);
    return request;
  }

  function backgroundRefresh(date, group, key) {
    if (inFlight.has(key)) return;
    const url = new URL(config.apiBase + '/' + BOOTSTRAP_RESOURCE);
    if (date) url.searchParams.set('date', date);
    if (group) url.searchParams.set('group', group);
    const request = jsonp(url, 20000)
      .then(json => {
        if (!json || !json.success || !json.data) return null;
        rememberSnapshot(key, json.data);
        writeStored(key, json.data);
        return json.data;
      })
      .catch(error => {
        console.warn('P15.1 bootstrap background refresh failed', error);
        return null;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, request);
  }

  function supportedRequest(resource, params) {
    if (!['itinerary','transport','hotels','places','flights','place_memos'].includes(resource)) return false;
    const keys = Object.keys(params || {}).filter(key => params[key] !== null && params[key] !== undefined && params[key] !== '');
    const allowed = {
      itinerary: ['date','group'],
      transport: ['date','group'],
      hotels: ['group'],
      places: [],
      flights: ['date','group'],
      place_memos: []
    };
    return keys.every(key => allowed[resource].includes(key));
  }

  function rowsFromSnapshot(snapshot, resource, params) {
    if (!snapshot || !Array.isArray(snapshot[resource])) return null;
    if (resource === 'itinerary' || resource === 'transport' || resource === 'flights') {
      if (params.date && String(params.date) !== String(snapshot.selected_date || '')) return null;
    }
    return snapshot[resource];
  }

  ensureDates = async function (force = false) {
    const group = normalizedGroup();
    const snapshot = await fetchBootstrap(state.date, group, force);
    state.dates = Array.isArray(snapshot.dates) ? snapshot.dates.slice() : [];
    if (!state.dates.length) return;
    if (!state.date || !state.dates.includes(state.date)) {
      state.date = snapshot.selected_date && state.dates.includes(snapshot.selected_date)
        ? snapshot.selected_date
        : state.dates[0];
    }
    rememberSnapshot(snapshotKey(state.date, group), snapshot);
  };

  api = async function (resource, params = {}, force = false) {
    if (!supportedRequest(resource, params)) return baseApi(resource, params, force);

    const group = String(params.group || normalizedGroup() || '');
    const requestedDate = String(params.date || state.date || '');

    try {
      const snapshot = await fetchBootstrap(requestedDate, group, force);
      const rows = rowsFromSnapshot(snapshot, resource, params);
      if (rows !== null) return rows;
    } catch (error) {
      console.warn('P15.1 bootstrap unavailable; falling back to resource API', error);
    }

    return baseApi(resource, params, force);
  };

  window.TRAVEL_PLANNER_BOOTSTRAP = {
    version: 'P15.1',
    clear: function () {
      snapshots.clear();
      snapshotSavedAt.clear();
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.indexOf(CACHE_PREFIX) === 0) localStorage.removeItem(key);
        });
      } catch (_) {}
    }
  };
})();