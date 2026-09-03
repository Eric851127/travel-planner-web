/* P7.2 smart default date + P7.4 group display labels */

(function () {
  const GROUP_LABELS = {
    all: '全部',
    ours: '郭小鼠組',
    friends: '阿香組'
  };

  window.travelPlannerGroupLabel = value => GROUP_LABELS[value] || value || '';

  // app.js defines these bindings globally; replace UI helpers without changing enum values.
  try {
    groupLabel = value => GROUP_LABELS[value] || value || '';
    filters = () => `<div class="filters">${[
      ['all', '全部'],
      ['ours', '郭小鼠組'],
      ['friends', '阿香組']
    ].map(([v, l]) => `<button class="filter-btn ${state.group === v ? 'active' : ''}" data-group="${v}">${l}</button>`).join('')}</div>`;
  } catch (_) {}

  function localIsoDate() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function smartTripDate(dates) {
    const sorted = [...new Set((dates || []).filter(Boolean))].sort();
    if (!sorted.length) return '';
    const today = localIsoDate();
    if (today < sorted[0]) return sorted[0];
    if (today > sorted[sorted.length - 1]) return sorted[sorted.length - 1];
    if (sorted.includes(today)) return today;
    // In case the itinerary has a missing calendar day, choose the next available trip date.
    return sorted.find(d => d >= today) || sorted[sorted.length - 1];
  }

  window.travelPlannerSmartTripDate = smartTripDate;

  try {
    ensureDates = async function (force = false) {
      const items = await api('itinerary', {}, force);
      state.dates = [...new Set(items.map(i => i.date).filter(Boolean))].sort();
      if (!state.dates.length) return;

      // Keep an explicit user-selected date during the same session.
      if (state.date && state.dates.includes(state.date) && state.__dateSelectedByUser) return;
      state.date = smartTripDate(state.dates);
    };

    const previousBindDateControls = bindDateControls;
    bindDateControls = function () {
      previousBindDateControls();
      const select = document.getElementById('dateSelect');
      if (select) {
        const original = select.onchange;
        select.onchange = async e => {
          state.__dateSelectedByUser = true;
          if (original) return original(e);
          state.date = e.target.value;
          await renderCurrent();
        };
      }
      document.querySelectorAll('[data-date]').forEach(button => {
        if (!button.dataset.date) return;
        const old = button.onclick;
        button.onclick = async e => {
          state.__dateSelectedByUser = true;
          if (old) return old(e);
          state.date = button.dataset.date;
          await renderCurrent();
        };
      });
    };
  } catch (_) {}
})();
