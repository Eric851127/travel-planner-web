/* Production read-only overlay, verified 2026-11-17. Not a booking or Sheet write.
 * Exactly one reviewed alternative. Other Japan-list places are not imported.
 * Change through a reviewed commit; never load preview fixtures in production.
 */
window.TRAVEL_PLANNER_OPTIONS_BUNDLE = Object.freeze({
  version: '2026-11-17.1',
  verified_on: '2026-11-17',
  parents: { I069: {date:'2026-12-22',group:'ours',place_id:'P070'} },
  places: { P070:'青山まんぷく', P071:'USHIGORO 表參道' },
  rows: [{
    id:'IO001',itinerary_id:'I069',candidate_place_id:'P071',relation_type:'alternative',
    choice_set:'12月22日燒肉晚餐',
    reason:'與主行程的青山まんぷく二擇一，不是第二餐。尚未訂位或查空位；不新增或改動晚餐時間。',
    suggested_duration_min:null,
    detour_note:'表參道分店；營業時間與可訂時段須再確認。此備選於 2026/11/17 核對，主線資料變更後可能暫停顯示。',
    priority:'normal',active:true,sort_order:10
  }]
});
