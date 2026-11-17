/* Production read-only overlay, verified 2026-11-17. Not a booking or Sheet write.
 * Four reviewed nearby/alternative relations. Not a complete Japan-list import.
 * Change through a reviewed commit; never load preview fixtures in production.
 */
window.TRAVEL_PLANNER_OPTIONS_BUNDLE = Object.freeze({
  version: '2026-11-17.2',
  verified_on: '2026-11-17',
  parents: { I069: {date:'2026-12-22',group:'ours',place_id:'P070'},
    I048: {date:'2026-12-22',group:'ours',place_id:'P064'},
    I040: {date:'2026-12-30',group:'all',place_id:'P035'} },
  audiences: { IO002:['ours'], IO003:['ours'], IO004:['ours'] },
  places: { P070:'青山まんぷく', P071:'USHIGORO 表參道',
    P064:'原宿／表參道・Cat Street', P035:'狸小路',
    P072:'LATTE ART MANIA TOKYO', P073:'KINOTOYA BAKE ポールタウン店', P074:'ツルハドラッグ 狸小路5丁目店' },
  rows: [{
    id:'IO001',itinerary_id:'I069',candidate_place_id:'P071',relation_type:'alternative',
    choice_set:'12月22日燒肉晚餐',
    reason:'與主行程的青山まんぷく二擇一，不是第二餐。尚未訂位或查空位；不新增或改動晚餐時間。',
    suggested_duration_min:null,
    detour_note:'表參道分店；營業時間與可訂時段須再確認。此備選於 2026/11/17 核對，主線資料變更後可能暫停顯示。',
    priority:'normal',active:true,sort_order:10
  },{
    id:'IO002',itinerary_id:'I048',candidate_place_id:'P072',relation_type:'nearby',choice_set:'',
    reason:'青山自由逛時的可選咖啡，往外苑前方向繞行；不是 Cat Street 店內，不新增固定時段。',
    suggested_duration_min:null,detour_note:'12/22 當日營業尚未確認；先查店家公告，保留步行、排隊與晚餐緩衝，來不及就略過。',
    priority:'normal',active:true,sort_order:10
  },{
    id:'IO003',itinerary_id:'I040',candidate_place_id:'P073',relation_type:'nearby',choice_set:'',
    reason:'12/30 回札幌後若仍逛狸小路，可順路到 Pole Town 地下街買甜點；不是另一餐，也不必為此壓縮小樽。',
    suggested_duration_min:null,detour_note:'僅郭小鼠組的可選項目；依返札幌時間與體力決定。年末營業與最後點餐時間出發前再確認。',
    priority:'normal',active:true,sort_order:10
  },{
    id:'IO004',itinerary_id:'I040',candidate_place_id:'P074',relation_type:'nearby',choice_set:'',
    reason:'狸小路5丁目店的可選日用品／藥妝補貨，與狸小路散步一起考慮，不新增必走行程。',
    suggested_duration_min:null,detour_note:'僅郭小鼠組；依購物需求與體力選擇。年末營業出發前再確認，沒有安排購買特定藥品。',
    priority:'normal',active:true,sort_order:20
  }]
});
