/* Shared presentation only: optional places never mutate the canonical itinerary. */
(function () {
  'use strict';
  function status(item) {
    const labels = {confirmed:'已確認行程',tentative:'暫定',optional:'可選'};
    return `<span class="badge ${esc(item.certainty || '')}">${esc(labels[item.certainty] || '規劃中')}</span>`;
  }
  function placeLink(place,label='地點與導航') {
    const url=window.TRAVEL_PLANNER_MAPS.placeSearchUrl(place);
    return url?`<a class="map-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:'';
  }
  function options(item, resolved) {
    const rows = resolved.get(item.id) || [];
    if (!rows.length) return '';
    return `<details class="nearby-options"><summary>附近與替代選項 <span class="badge">${rows.length}</span></summary><p class="meta">以下不屬於必走主線，依時間、天氣與體力選擇。</p><div class="stack">${rows.map(row => {
      const p = row.candidate_place;
      const url = window.TRAVEL_PLANNER_MAPS.placeSearchUrl(p);
      return `<article class="nearby-option"><div class="row"><strong>${esc(p.name)}</strong><span class="badge">${row.relation_type === 'alternative' ? '替代選項' : '附近可選'}</span></div>${row.choice_set ? `<div class="meta">選項組：${esc(row.choice_set)} · 同組擇一，不需全部安排</div>` : ''}${row.reason ? `<p>${esc(row.reason)}</p>` : ''}${row.detour_note ? `<div class="meta">${esc(row.detour_note)}</div>` : ''}${row.suggested_duration_min ? `<div class="meta">建議停留 ${esc(row.suggested_duration_min)} 分鐘，不含交通</div>` : ''}<div class="meta">${p.opening_hours ? esc(p.opening_hours)+' · 出發前再確認' : '營業時間待確認'}</div>${url ? `<a class="map-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Google Maps ↗</a>` : ''}</article>`;
    }).join('')}</div></details>`;
  }
  window.TRAVEL_PLANNER_ITINERARY_UI = Object.freeze({status,options,placeLink});
})();
