/* Traveler runtime core: final owner for API, dates, interactions, and render dispatch. */
(function () {
  'use strict';

  const TODAY_GROUP_KEY = 'travelPlanner.group.v1';
  let interactionQueue = Promise.resolve();

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

  renderCurrent = async function(force = false) {
    try {
      if (state.view === 'today') return await renderToday(force);
      if (state.view === 'trip') return await renderTrip(force);
      if (state.view === 'bookings') return await renderBookings(force);
      if (state.view === 'map') return await renderMap(force);
      return renderMore();
    } catch (e) {
      app.innerHTML = `<div class="card error"><div>載入失敗：${esc(e.message)}</div><button id="retryBtn" class="retry-button" type="button">重新嘗試</button></div>`;
    }
  };

  function clearRuntimeCaches() {
    state.cache.clear();
    if (window.TRAVEL_PLANNER_PLACE_MEMOS) window.TRAVEL_PLANNER_PLACE_MEMOS.clear();
  }

  function scheduleInteraction(action) {
    interactionQueue = interactionQueue
      .catch(() => {})
      .then(action)
      .catch(error => {
        console.error('Traveler interaction failed', error);
        failed(error);
      });
    return interactionQueue;
  }

  function setActiveNav(view) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === view);
    });
  }

  bindDateControls = function () {
    document.querySelectorAll('[data-date]').forEach(button => {
      button.onclick = () => {
        const nextDate = button.dataset.date;
        if (!nextDate) return;
        scheduleInteraction(async () => {
          state.__dateSelectedByUser = true;
          state.date = nextDate;
          await renderToday(false);
        });
      };
    });

    const select = document.getElementById('dateSelect');
    if (select) {
      select.onchange = () => {
        const nextDate = select.value;
        if (!nextDate) return;
        scheduleInteraction(async () => {
          state.__dateSelectedByUser = true;
          state.date = nextDate;
          await renderToday(false);
        });
      };
    }
  };

  bindFilters = function () {
    document.querySelectorAll('[data-group]').forEach(button => {
      button.onclick = () => {
        const nextGroup = button.dataset.group;
        if (!nextGroup) return;
        scheduleInteraction(async () => {
          state.group = nextGroup;
          await renderCurrent(false);
        });
      };
    });
  };

  function bindTodayGroupFilters() {
    document.querySelectorAll('[data-today-group]').forEach(button => {
      button.onclick = () => {
        const nextGroup = button.dataset.todayGroup;
        if (nextGroup !== 'ours' && nextGroup !== 'friends') return;
        scheduleInteraction(async () => {
          state.group = nextGroup;
          localStorage.setItem(TODAY_GROUP_KEY, nextGroup);
          await renderToday(false);
        });
      };
    });
  }

  function bindStaticControls() {
    document.querySelectorAll('.nav-item').forEach(button => {
      button.onclick = () => {
        const nextView = button.dataset.view;
        if (!nextView) return;
        scheduleInteraction(async () => {
          state.view = nextView;
          setActiveNav(nextView);
          await renderCurrent(false);
        });
      };
    });

    refreshBtn.onclick = () => {
      scheduleInteraction(async () => {
        clearRuntimeCaches();
        await renderCurrent(true);
      });
    };
  }

  document.addEventListener('click', event => {
    const retry = event.target.closest && event.target.closest('#retryBtn');
    if (!retry) return;
    scheduleInteraction(async () => {
      clearRuntimeCaches();
      await renderCurrent(true);
    });
  });

  state.date = null;
  state.cache.clear();
  bindStaticControls();

  window.TRAVEL_PLANNER_INTERACTIONS = Object.freeze({
    version: 'P16.1',
    schedule: scheduleInteraction,
    bindTodayGroupFilters
  });

  window.TRAVEL_PLANNER_RUNTIME_CORE = Object.freeze({
    version: 'Phase C + P16.1 2026-09-05',
    apiContract: 'query-resource',
    dateStrategy: 'smart-trip-date',
    transport: 'jsonp',
    interactionOwner: 'p16-runtime-core.js'
  });

  if (!window.TRAVEL_PLANNER_DEFER_INITIAL_RENDER) renderCurrent(true);
})();