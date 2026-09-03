/* P4/P5 production acceptance fixes */

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

renderBookings = async function(force = false) {
  pageTitle.textContent = '預訂';
  loading();
  const [items, members] = await Promise.all([
    api('reservations', { group: groupParam() }, force),
    api('members', {}, force)
  ]);
  const memberById = new Map(members.map(m => [m.id, m]));
  const priority = { need_booking: 0, planned: 1, booked: 2, paid: 3, not_required: 4, cancelled: 5 };
  items.sort((a, b) =>
    (priority[a.status] ?? 99) - (priority[b.status] ?? 99) ||
    String(a.date || '').localeCompare(String(b.date || '')) ||
    String(a.time || '').localeCompare(String(b.time || ''))
  );
  const deadlineRelevant = status => status === 'need_booking' || status === 'planned';

  app.innerHTML = `<section class="section">${filters()}</section><section class="stack">${items.length ? items.map(i => {
    const owner = i.owner_member_id ? memberById.get(i.owner_member_id) : null;
    return `<div class="card booking-row"><div class="row"><h3>${esc(i.name)}</h3><span class="badge ${esc(i.status)}">${esc(statusLabel(i.status))}</span></div><div class="meta">${esc(categoryLabel(i.category || ''))} · ${esc(i.date || '')}${i.time ? ` ${esc(i.time)}` : ''}</div>${i.deadline && deadlineRelevant(i.status) ? `<div class="booking-deadline">預訂期限：${esc(i.deadline)}</div>` : ''}${i.owner_member_id ? `<div class="meta">負責人：${esc(owner?.name || i.owner_member_id)}</div>` : ''}</div>`;
  }).join('') : '<div class="card empty">目前沒有預訂資料。</div>'}</section>`;
  bindFilters();
};

renderMore = function() {
  pageTitle.textContent = '更多';
  const version = config.buildVersion || 'P5';
  app.innerHTML = `<div class="stack">
    <div class="card">
      <h2>旅遊行程規劃</h2>
      <div class="meta">旅客唯讀版 · API v1 · ${esc(version)}</div>
    </div>
    <div class="card">
      <h3>P5 狀態</h3>
      <div class="meta">真實行程資料導入中 · 手機 API 相容模式已啟用 · 公開欄位安全收斂中</div>
    </div>
  </div>`;
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
      await renderCurrent(true);
    };
  }
};
