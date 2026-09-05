/* Traveler resilient JSONP transport. Resource API ownership lives in p16-runtime-core.js. */
(function () {
  const REQUEST_TIMEOUT_MS = 20000;

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

  try {
    jsonp = resilientJsonp;
    window.TRAVEL_PLANNER_NETWORK = Object.freeze({
      version: 'Phase C 2026-09-05',
      timeoutMs: REQUEST_TIMEOUT_MS,
      transport: 'jsonp'
    });
  } catch (error) {
    console.error('Traveler network transport failed', error);
  }
})();