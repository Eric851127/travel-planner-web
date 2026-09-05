/* Traveler runtime core: final owner for API, dates, date binding, and render dispatch. */
(function () {
  'use strict';

  const baseBindDateControls = bindDateControls;

  api = async function(resource, params = {}, force = false) {
    const url = new URL(config.apiBase);
    url.searchParams.set('resource', resource);

    const scopedParams = Object.assign({}, params);
    if (scopedParams.group && scopedParams.group !== 'all' && !String(scopedParams.group).includes(',')) {
      scopedParams.group = String(scopedParams.group) + ',all';
    }

    Object.entries(scopedParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        url.searchParams.set(key, value);
      }
    });

    url.searchParams.set('_ts', Date.now().toString());
    const cacheKey = resource + '?' + new URLSearchParams(scopedParams).toString();
    if (!force && state.cache.has(cacheKey)) return state.cache.get(cacheKey);

    const json = await jsonp(url, 18000);
    if (!json || !json.success) throw new Error(json?.error?.message || 'API 發生錯誤');
    state.cache.set(cacheKey, json.data);
    return json.data;
  };

  ensureDates = async function (force = false) {
    const items = await api('itinerary', {}, force);
    state.dates = [...new Set(items.map(i => i.date).filter(Boolean))].sort();
    if (!state.dates.length) return;
    if (state.__dateSelectedByUser && state.date && state.dates.includes(state.date)) return;
    state.date = window.travelPlannerSmartTripDate(state.dates);
  };

  bindDateControls = function () {
    baseBindDateControls();
    const select = document.getElementById('dateSelect');
    if (select) select.addEventListener('change', () => { state.__dateSelectedByUser = true; });
    document.querySelectorAll('[data-date]').forEach(button => button.addEventListener('click', () => {
      if (button.dataset.date) state.__dateSelectedByUser = true;
    }));
  };

  renderCurrent = async function(force = false) {
    try {
      if (state.view === 'today') return await renderToday(force);
      if (state.view === 'trip') return await renderTrip(force);
      if (state.view === 'bookings') return await renderBookings(force);
      if (state.view === 'map') return await renderMap(force);
      return renderMore();
    } catch (e) {
      app.innerHTML = `<div class="card error"><div>載入失敗：${esc(e.message)}</div><button id="retryBtn" class="retry-button" type="button">重新嘗試</button></div>`;
      const retry = document.getElementById('retryBtn');
      if (retry) retry.onclick = async () => {
        state.cache.clear();
        if (window.TRAVEL_PLANNER_PLACE_MEMOS) window.TRAVEL_PLANNER_PLACE_MEMOS.clear();
        await renderCurrent(true);
      };
    }
  };

  state.date = null;
  state.cache.clear();

  window.TRAVEL_PLANNER_RUNTIME_CORE = Object.freeze({
    version: 'Phase C 2026-09-05',
    apiContract: 'query-resource',
    dateStrategy: 'smart-trip-date',
    transport: 'jsonp'
  });

  if (!window.TRAVEL_PLANNER_DEFER_INITIAL_RENDER) renderCurrent(true);
})();