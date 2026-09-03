/* P7.2 smart default date + P7.4 group display labels */
(function () {
  function localIsoDate() {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  }

  function smartTripDate(dates) {
    const sorted = [...new Set((dates || []).filter(Boolean))].sort();
    if (!sorted.length) return '';
    const today = localIsoDate();
    if (today <= sorted[0]) return sorted[0];
    if (today >= sorted[sorted.length - 1]) return sorted[sorted.length - 1];
    if (sorted.includes(today)) return today;
    return sorted.find(d => d >= today) || sorted[sorted.length - 1];
  }

  window.travelPlannerSmartTripDate = smartTripDate;
  window.travelPlannerGroupLabel = value => ({all:'全部', ours:'郭小鼠組', friends:'阿香組'}[value] || value || '');

  // Keep internal enum values unchanged. P7.4 is display-only.
  function relabel(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      let text = node.nodeValue;
      text = text.replace(/我們/g, '郭小鼠組').replace(/朋友/g, '阿香組');
      if (text !== node.nodeValue) node.nodeValue = text;
    });
  }

  relabel(document.body);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) relabel(node.parentNode);
    else if (node.nodeType === Node.ELEMENT_NODE) relabel(node);
  }))).observe(document.body, {childList:true, subtree:true});

  // Replace the old hard-coded default-date behavior after app.js is loaded.
  try {
    ensureDates = async function (force = false) {
      const items = await api('itinerary', {}, force);
      state.dates = [...new Set(items.map(i => i.date).filter(Boolean))].sort();
      if (!state.dates.length) return;
      if (state.__dateSelectedByUser && state.date && state.dates.includes(state.date)) return;
      state.date = smartTripDate(state.dates);
    };

    const oldBindDateControls = bindDateControls;
    bindDateControls = function () {
      oldBindDateControls();
      const select = document.getElementById('dateSelect');
      if (select) select.addEventListener('change', () => { state.__dateSelectedByUser = true; });
      document.querySelectorAll('[data-date]').forEach(button => button.addEventListener('click', () => {
        if (button.dataset.date) state.__dateSelectedByUser = true;
      }));
    };

    // app.js may already have started its first render before this patch loaded.
    // Force one clean render so P7.2 takes effect immediately.
    state.date = null;
    state.cache.clear();
    renderCurrent(true);
  } catch (error) {
    console.error('P7 patch failed', error);
  }
})();
