/* Traveler Bookings + legacy More renderers. Runtime core ownership lives in p16-runtime-core.js. */

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
      <h3>資料來源</h3>
      <div class="meta">已在此裝置設定。完整 API URL 不顯示於頁面，也不預先寫入 GitHub。</div>
      <button id="changeDataSourceBtn" class="retry-button" type="button" style="margin-top:12px">更換資料來源</button>
    </div>
    <div class="card">
      <h3>P5 狀態</h3>
      <div class="meta">真實行程資料導入中 · 私有資料來源模式已啟用</div>
    </div>
  </div>`;

  const changeButton = document.getElementById('changeDataSourceBtn');
  if (changeButton) changeButton.onclick = () => {
    const storageKey = config.storageKey || 'travelPlanner.apiBase.v1';
    localStorage.removeItem(storageKey);
    state.cache.clear();
    location.reload();
  };
};