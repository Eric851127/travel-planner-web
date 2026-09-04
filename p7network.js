/* P7.7 resilient traveler API loading */
(function () {
  const CACHE_PREFIX = 'travelPlanner.apiCache.v1.';
  const FRESH_MS = 5 * 60 * 1000;
  const STALE_MAX_MS = 7 * 24 * 60 * 60 * 1000;
  const REQUEST_TIMEOUT_MS = 20000;
  const RETRY_DELAY_MS = 800;
  const inFlight = new Map();
  let staleNoticeTimer = null;

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function storageKey(key) {
    try {
      return CACHE_PREFIX + btoa(unescape(encodeURIComponent(key))).replace(/=+$/g, '');
    } catch (_) {
      return CACHE_PREFIX + encodeURIComponent(key);
    }
  }

  function readPersistent(key) {
    try {
      const raw = localStorage.getItem(storageKey(key));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.data) || !Number.isFinite(parsed.savedAt)) return null;
      const age = Date.now() - parsed.savedAt;
      if (age > STALE_MAX_MS) {
        localStorage.removeItem(storageKey(key));
        return null;
      }
      return { data: parsed.data, savedAt: parsed.savedAt, age };
    } catch (_) {
      return null;
    }
  }

  function writePersistent(key, data) {
    try {
      localStorage.setItem(storageKey(key), JSON.stringify({ savedAt: Date.now(), data }));
    } catch (error) {
      console.warn('P7.7 cache write skipped', error);
    }
  }

  function showStaleNotice() {
    clearTimeout(staleNoticeTimer);
    staleNoticeTimer = setTimeout(() => {
      if (!app || document.getElementById('p77StaleNotice')) return;
      const notice = document.createElement('div');
      notice.id = 'p77StaleNotice';
      notice.className = 'card';
      notice.style.cssText = 'margin-bottom:12px;border-color:#f9ab00;background:#fff8e1;font-size:13px';
      notice.innerHTML = '<strong>目前顯示最近一次成功同步的資料</strong><div class="meta">Google 試算表連線暫時不穩定；可稍後按右上角 ↻ 再同步。</div>';
      app.prepend(notice);
    }, 0);
  }

  function resilientJsonp(url, timeoutMs = REQUEST_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const callbackName = '__travelPlannerP77_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      let settled = false;
      const timer = setTimeout(() => cleanup(new Error('API 請求逾時')), timeoutMs);

      function cleanup(error, data) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
        script.remove();
        error ? reject(error) : resolve(data);
      }

      window[callbackName] = data => cleanup(null, data);
      const requestUrl = new URL(url.toString());
      requestUrl.searchParams.set('callback', callbackName);
      requestUrl.searchParams.set('_p77', Date.now().toString());
      script.src = requestUrl.toString();
      script.async = true;
      script.onerror = () => cleanup(new Error('API 載入失敗'));
      document.head.appendChild(script);
    });
  }

  async function fetchFresh(url, key) {
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt) await delay(RETRY_DELAY_MS);
      try {
        const json = await resilientJsonp(url);
        if (!json || !json.success) throw new Error(json?.error?.message || 'API 發生錯誤');
        state.cache.set(key, json.data);
        writePersistent(key, json.data);
        return json.data;
      } catch (error) {
        lastError = error;
        console.warn('P7.7 API attempt failed', { attempt: attempt + 1, key, error });
      }
    }
    throw lastError || new Error('API 載入失敗');
  }

  async function backgroundRefresh(url, key) {
    if (inFlight.has(key)) return inFlight.get(key);
    const request = fetchFresh(url, key)
      .catch(error => {
        console.warn('P7.7 background refresh failed', error);
        return null;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, request);
    return request;
  }

  try {
    jsonp = resilientJsonp;

    api = async function (resource, params = {}, force = false) {
      const url = new URL(config.apiBase + '/' + resource);
      Object.entries(params).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, v);
      });
      const key = url.toString();

      if (!force && state.cache.has(key)) return state.cache.get(key);

      const persisted = readPersistent(key);
      if (!force && persisted && persisted.age <= FRESH_MS) {
        state.cache.set(key, persisted.data);
        backgroundRefresh(url, key);
        return persisted.data;
      }

      if (inFlight.has(key)) return inFlight.get(key);

      const request = fetchFresh(url, key)
        .catch(error => {
          if (persisted) {
            state.cache.set(key, persisted.data);
            showStaleNotice();
            return persisted.data;
          }
          throw error;
        })
        .finally(() => inFlight.delete(key));

      inFlight.set(key, request);
      return request;
    };

    window.TRAVEL_PLANNER_NETWORK = {
      version: 'P7.7',
      freshMs: FRESH_MS,
      timeoutMs: REQUEST_TIMEOUT_MS,
      retries: 1
    };
  } catch (error) {
    console.error('P7.7 network patch failed', error);
  }
})();
