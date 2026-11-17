/* Optional itinerary-scoped nearby choices. Read-only and disabled by default. */
(function () {
  'use strict';
  const TYPES = new Set(['nearby', 'alternative']);
  const PRIORITIES = { high: 0, normal: 1, low: 2 };
  let cache = null, pending = null, generation = 0;
  const text = value => typeof value === 'string' ? value.trim() : '';
  const active = value => value === true || value === 1 || /^(true|1)$/i.test(String(value).trim());
  function normalize(rows) {
    if (!Array.isArray(rows)) return [];
    const seen = new Set();
    return rows.flatMap(row => {
      if (!row || typeof row !== 'object' || !active(row.active)) return [];
      const id = text(row.id), itineraryId = text(row.itinerary_id), placeId = text(row.candidate_place_id);
      const type = text(row.relation_type), priority = text(row.priority) || 'normal';
      const reason = text(row.reason), detour = text(row.detour_note), choice = text(row.choice_set);
      const durationRaw = row.suggested_duration_min;
      const duration = durationRaw === '' || durationRaw == null ? null : Number(durationRaw);
      const order = row.sort_order === '' || row.sort_order == null ? 10 : Number(row.sort_order);
      if (!/^IO\d{3,}$/.test(id) || !/^I\d{3,}$/.test(itineraryId) || !/^P\d{3,}$/.test(placeId)
        || seen.has(id) || !TYPES.has(type) || !Object.hasOwn(PRIORITIES, priority)
        || reason.length > 1000 || detour.length > 300 || choice.length > 80
        || !Number.isInteger(order) || order < 0 || order > 9999
        || (duration !== null && (!Number.isInteger(duration) || duration <= 0 || duration > 1440))) return [];
      seen.add(id);
      return [Object.freeze({ id, itinerary_id: itineraryId, candidate_place_id: placeId,
        relation_type: type, choice_set: choice, reason, suggested_duration_min: duration,
        detour_note: detour, priority, active: true, sort_order: order })];
    }).sort((a, b) => a.itinerary_id.localeCompare(b.itinerary_id)
      || a.sort_order - b.sort_order || PRIORITIES[a.priority] - PRIORITIES[b.priority]
      || a.id.localeCompare(b.id));
  }
  async function load(force = false) {
    if (!force && cache !== null) return cache.slice();
    if (!force && pending) return pending;
    const token = ++generation;
    const request = (async () => {
      let rows = [];
      try {
        if (Array.isArray(window.TRAVEL_PLANNER_OPTIONS_DATA)) {
          rows = window.TRAVEL_PLANNER_OPTIONS_DATA;
        } else if (window.TRAVEL_PLANNER_OPTIONS_CONFIG?.optionsResource === 'itinerary_options'
          && typeof api === 'function') {
          rows = await api('itinerary_options', {}, force);
        }
      } catch (error) {
        console.warn('Nearby choices unavailable; main itinerary is unchanged.', error);
      }
      const normalized = normalize(rows);
      if (token === generation) cache = normalized;
      return token === generation ? normalized.slice() : [];
    })();
    pending = request;
    try { return await request; }
    finally { if (pending === request) pending = null; }
  }
  function clear() { generation++; cache = null; pending = null; }
  function forItem(id) { return (cache || []).filter(row => row.itinerary_id === id); }
  function resolve(items, places) {
    const itemMap = new Map((Array.isArray(items) ? items : []).filter(Boolean).map(item => [item.id, item]));
    const placeMap = new Map((Array.isArray(places) ? places : []).filter(Boolean).map(place => [place.id, place]));
    const result = new Map();
    for (const row of cache || []) {
      const parent = itemMap.get(row.itinerary_id), candidate = placeMap.get(row.candidate_place_id);
      if (!parent || !candidate) continue;
      const resolved = Object.freeze({ ...row, parent_item: parent, candidate_place: candidate,
        date: parent.date, group: parent.group });
      if (!result.has(parent.id)) result.set(parent.id, []);
      result.get(parent.id).push(resolved);
    }
    return result;
  }
  window.TRAVEL_PLANNER_OPTIONS = Object.freeze({ load, clear, forItem, resolve });
})();
