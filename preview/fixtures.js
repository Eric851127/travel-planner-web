/* Deliberately limited review fixtures. Not connected to Sheets or production APIs. */
window.TRAVEL_PLANNER_PREVIEW_DATA = {
 itinerary:[
  {id:'I048',date:'2026-12-22',start_time:'16:00',end_time:'18:30',group:'ours',city:'東京',title:'表參道、青山散步',description:'示意既有主線區段。附近咖啡為可選，不新增硬性時段。',place_id:'P064',certainty:'tentative',order:40},
  {id:'I069',date:'2026-12-22',start_time:'18:30',end_time:'20:00',group:'ours',city:'東京',title:'燒肉晚餐（二選一，尚未預訂）',place_id:'P070',certainty:'tentative',order:60},
  {id:'I080',date:'2026-12-22',start_time:'09:00',group:'friends',city:'鎌倉',title:'朋友組示意：鎌倉、江之島',certainty:'tentative'},
  {id:'I034',date:'2026-12-28',start_time:'18:00',group:'all',city:'札幌',title:'抵達札幌後自由活動',description:'示意，抵達時間不是已確認交通時刻。甜點、藥妝依體力選擇。',place_id:'P903',certainty:'tentative'},
  {id:'I038',date:'2026-12-30',start_time:'12:00',group:'ours',city:'小樽',title:'市場午餐、區域散步',description:'沒有單一 place_id 的行程也會保留在主線。',certainty:'optional'}
 ],
 places:[
  {id:'P064',name:'原宿／表參道・Cat Street',city:'東京',category:'shopping',latitude:'35.6699682',longitude:'139.709008'},
  {id:'P902',name:'LATTE ART MANIA',city:'東京',category:'cafe',address:'東京都港區北青山',opening_hours:null},
  {id:'P070',name:'青山まんぷく',city:'東京',category:'restaurant'},
  {id:'P071',name:'USHIGORO 表參道店',city:'東京',category:'restaurant'},
  {id:'P903',name:'札幌市中心（區域示意）',city:'札幌',category:'shopping',latitude:'43.058',longitude:'141.353'},
  {id:'P900',name:'KINOTOYA BAKE POLE TOWN',city:'札幌',category:'cafe'},
  {id:'P901',name:'鶴羽藥妝 狸小路5丁目店',city:'札幌',category:'shopping'}
 ],
 flights:[],transport:[],reservations:[],hotels:[],place_memos:[]
};
window.TRAVEL_PLANNER_OPTIONS_DATA = [
 {id:'IO001',itinerary_id:'I048',candidate_place_id:'P902',relation_type:'nearby',reason:'Japan 收藏中的咖啡選項。P902 僅為示意 ID；正式 Places 尚未建檔。12/22 星期二營業仍待確認。',suggested_duration_min:30,active:true,sort_order:10},
 {id:'IO002',itinerary_id:'I069',candidate_place_id:'P071',relation_type:'alternative',choice_set:'dinner-1222',reason:'與青山まんぷく二選一，不是第二場晚餐。此處為東京表參道分店，不是收藏中的大阪店。',active:true,sort_order:10},
 {id:'IO003',itinerary_id:'I034',candidate_place_id:'P900',relation_type:'nearby',reason:'抵達札幌後的甜點選項；此預覽使用示意地點 ID，不寫入正式資料。',active:true,sort_order:10},
 {id:'IO004',itinerary_id:'I034',candidate_place_id:'P901',relation_type:'nearby',reason:'藥妝採購備選，不必和甜點一起完成。此預覽使用示意地點 ID。',active:true,sort_order:20}
];
