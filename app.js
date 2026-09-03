const config=window.TRAVEL_PLANNER_CONFIG;
const state={view:"today",group:config.defaultGroup||"all",date:config.defaultDate,dates:[],cache:new Map()};
const app=document.getElementById("app"),pageTitle=document.getElementById("pageTitle"),refreshBtn=document.getElementById("refreshBtn");

const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const statusLabel=v=>({confirmed:"已確認",tentative:"暫定",optional:"可選",need_booking:"待預訂",booked:"已預訂",paid:"已付款",planned:"規劃中",not_required:"無需預訂",cancelled:"已取消"}[v]||v||"");
const groupLabel=v=>({all:"全部",ours:"我們",friends:"朋友"}[v]||v||"");
const categoryLabel=v=>({hotel:"住宿",flight:"航班",train:"火車",restaurant:"餐廳",activity:"活動",ticket:"票券",rental_car:"租車",other:"其他",station:"車站",airport:"機場",attraction:"景點",shop:"商店"}[v]||v||"");
const transportLabel=v=>({train:"火車",bus:"巴士",ferry:"渡輪",rental_car:"租車",airport_transfer:"機場接送",other:"其他交通"}[v]||v||"交通");
const formatDateLabel=value=>{if(!value)return"";const d=new Date(value+"T00:00:00");if(Number.isNaN(d.getTime()))return value;return new Intl.DateTimeFormat("zh-TW",{month:"short",day:"numeric",weekday:"short"}).format(d)};
const safeUrl=value=>{try{const u=new URL(value);return /^https?:$/.test(u.protocol)?u.toString():""}catch{return""}};

function jsonp(url,timeoutMs=12000){
  return new Promise((resolve,reject)=>{
    const callbackName="__travelPlannerJsonp_"+Date.now()+"_"+Math.random().toString(36).slice(2);
    const script=document.createElement("script");
    const timer=setTimeout(()=>cleanup(new Error("API 請求逾時")),timeoutMs);
    function cleanup(error,data){clearTimeout(timer);delete window[callbackName];script.remove();error?reject(error):resolve(data)}
    window[callbackName]=data=>cleanup(null,data);
    url.searchParams.set("callback",callbackName);
    script.src=url.toString();script.async=true;
    script.onerror=()=>cleanup(new Error("API 載入失敗"));
    document.head.appendChild(script);
  });
}

async function api(resource,params={},force=false){
  const url=new URL(config.apiBase+"/"+resource);
  Object.entries(params).forEach(([k,v])=>{if(v!==null&&v!==undefined&&v!=="")url.searchParams.set(k,v)});
  const key=url.toString();
  if(!force&&state.cache.has(key))return state.cache.get(key);
  const json=await jsonp(url);
  if(!json||!json.success)throw new Error(json?.error?.message||"API 發生錯誤");
  state.cache.set(key,json.data);return json.data;
}

const groupParam=()=>state.group==="all"?null:state.group;
const loading=()=>app.innerHTML='<div class="loading">載入中…</div>';
const failed=e=>app.innerHTML=`<div class="card error">載入失敗：${esc(e.message)}</div>`;
const filters=()=>`<div class="filters">${[["all","全部"],["ours","我們"],["friends","朋友"]].map(([v,l])=>`<button class="filter-btn ${state.group===v?"active":""}" data-group="${v}">${l}</button>`).join("")}</div>`;
const mapLink=(place,label="開啟 Google Maps")=>{const url=safeUrl(place?.google_maps_url);return url?`<a class="map-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">⌖ ${esc(label)}</a>`:""};

async function ensureDates(force=false){
  const items=await api("itinerary",{},force);
  state.dates=[...new Set(items.map(i=>i.date).filter(Boolean))].sort();
  if(!state.dates.length)return;
  if(!state.date||!state.dates.includes(state.date)){
    const configured=config.defaultDate;
    state.date=state.dates.includes(configured)?configured:state.dates[0];
  }
}

function dateNav(){
  const idx=state.dates.indexOf(state.date);
  const prev=idx>0?state.dates[idx-1]:null;
  const next=idx>=0&&idx<state.dates.length-1?state.dates[idx+1]:null;
  return `<div class="date-nav"><button class="date-arrow" data-date="${esc(prev||"")}" ${prev?"":"disabled"} aria-label="前一天">‹</button><label class="date-picker-wrap"><span class="muted small">選擇日期</span><select id="dateSelect" class="date-select">${state.dates.map(d=>`<option value="${esc(d)}" ${d===state.date?"selected":""}>${esc(formatDateLabel(d))}</option>`).join("")}</select></label><button class="date-arrow" data-date="${esc(next||"")}" ${next?"":"disabled"} aria-label="後一天">›</button></div>`;
}

function reservationBadge(reservation){if(!reservation)return"";return `<div class="reservation-line"><span class="reservation-label">預訂狀態</span><span class="badge ${esc(reservation.status||"")}">${esc(statusLabel(reservation.status))}</span></div>`}

function flightCard(f){
  return `<article class="summary-card"><div class="summary-icon">✈</div><div class="summary-body"><div class="summary-kicker">航班</div><strong>${esc([f.airline,f.flight_no].filter(Boolean).join(" ")||"航班")}</strong><div class="route"><span>${esc(f.departure_airport||"—")}</span><b>→</b><span>${esc(f.arrival_airport||"—")}</span></div><div class="meta">${esc(f.departure_time||"—")} – ${esc(f.arrival_time||"—")} · ${esc(groupLabel(f.group))}</div></div></article>`;
}

function transportCard(t,places){
  const from=places.get(t.from_place_id),to=places.get(t.to_place_id);
  return `<article class="summary-card"><div class="summary-icon">↔</div><div class="summary-body"><div class="summary-kicker">${esc(transportLabel(t.type))}</div><strong>${esc([t.operator,t.service_no].filter(Boolean).join(" ")||transportLabel(t.type))}</strong><div class="route"><span>${esc(from?.name||t.from_place_id||"—")}</span><b>→</b><span>${esc(to?.name||t.to_place_id||"—")}</span></div><div class="meta">${esc(t.departure_time||"—")} – ${esc(t.arrival_time||"—")}</div>${mapLink(to,"查看目的地")}</div></article>`;
}

function hotelCard(h,places){
  const place=places.get(h.place_id);
  return `<article class="summary-card"><div class="summary-icon">⌂</div><div class="summary-body"><div class="summary-kicker">住宿</div><strong>${esc(h.hotel_name||"住宿")}</strong><div class="meta">${esc(h.city||"")} · ${esc(groupLabel(h.group))}</div><div class="meta">入住 ${esc(h.check_in||"—")} · 退房 ${esc(h.check_out||"—")}</div>${h.address?`<div class="meta">${esc(h.address)}</div>`:""}${mapLink(place||{google_maps_url:h.google_maps_url},"開啟飯店地圖")}</div></article>`;
}

function overviewSection(flights,transports,hotels,places){
  const cards=[...flights.map(flightCard),...transports.map(t=>transportCard(t,places)),...hotels.map(h=>hotelCard(h,places))];
  if(!cards.length)return"";
  return `<section class="section"><h2>當日重點</h2><div class="summary-scroll">${cards.join("")}</div></section>`;
}

async function renderToday(force=false){
  pageTitle.textContent="今日";loading();
  await ensureDates(force);
  if(!state.dates.length){app.innerHTML='<div class="card empty">目前沒有行程日期。</div>';return}
  const [items,reservations,flights,transports,hotels,places]=await Promise.all([
    api("itinerary",{date:state.date,group:groupParam()},force),api("reservations",{group:groupParam()},force),api("flights",{date:state.date,group:groupParam()},force),api("transport",{date:state.date,group:groupParam()},force),api("hotels",{group:groupParam()},force),api("places",{},force)
  ]);
  const reservationById=new Map(reservations.map(r=>[r.id,r])),placeById=new Map(places.map(p=>[p.id,p]));
  const activeHotels=hotels.filter(h=>h.check_in&&h.check_out&&h.check_in<=state.date&&state.date<h.check_out);
  app.innerHTML=`<section class="section">${dateNav()}${filters()}</section>${overviewSection(flights,transports,activeHotels,placeById)}<section class="section"><h2>今日行程</h2><div class="card">${items.length?items.map(i=>{const r=i.reservation_id?reservationById.get(i.reservation_id):null,p=i.place_id?placeById.get(i.place_id):null,t=i.transport_id?transports.find(x=>x.id===i.transport_id):null;return `<div class="timeline-item"><div class="time">${esc(i.start_time||"—")}</div><div class="timeline-body"><div class="row"><h3>${esc(i.title)}</h3><span class="badge ${esc(i.certainty)}">${esc(statusLabel(i.certainty))}</span></div>${i.description?`<div class="meta">${esc(i.description)}</div>`:""}<div class="meta">${esc(i.city||"")}${i.group?` · ${esc(groupLabel(i.group))}`:""}</div>${p?`<div class="place-line"><span>⌖ ${esc(p.name)}</span>${mapLink(p)}</div>`:""}${t?`<div class="transport-line">${esc(transportLabel(t.type))} · ${esc(t.departure_time||"")} ${esc(placeById.get(t.from_place_id)?.name||"")} → ${esc(placeById.get(t.to_place_id)?.name||"")}</div>`:""}${reservationBadge(r)}</div></div>`}).join(""):'<div class="empty">這一天沒有行程。</div>'}</div></section>`;
  bindFilters();bindDateControls();
}

async function renderTrip(force=false){
  pageTitle.textContent="行程";loading();
  const [items,reservations,places]=await Promise.all([api("itinerary",{group:groupParam()},force),api("reservations",{group:groupParam()},force),api("places",{},force)]);
  const reservationById=new Map(reservations.map(r=>[r.id,r])),placeById=new Map(places.map(p=>[p.id,p]));
  const grouped=items.reduce((a,i)=>((a[i.date]??=[]).push(i),a),{});
  app.innerHTML=`<section class="section">${filters()}</section><section class="stack">${Object.keys(grouped).length?Object.entries(grouped).map(([d,x])=>`<div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">${esc(formatDateLabel(d))}</h2><span class="badge">${x.length} 個行程</span></div><div class="stack">${x.map(i=>{const r=i.reservation_id?reservationById.get(i.reservation_id):null,p=i.place_id?placeById.get(i.place_id):null;return `<div class="trip-row"><div><strong>${esc(i.start_time||"—")} · ${esc(i.title)}</strong><div class="meta">${esc(i.city||"")} · ${esc(groupLabel(i.group||""))}</div>${p?`<div class="trip-place">⌖ ${esc(p.name)} ${mapLink(p,"地圖")}</div>`:""}</div>${r?`<span class="badge ${esc(r.status||"")}">${esc(statusLabel(r.status))}</span>`:""}</div>`}).join("")}</div></div>`).join(""):'<div class="card empty">目前沒有行程資料。</div>'}</section>`;
  bindFilters();
}

async function renderBookings(force=false){
  pageTitle.textContent="預訂";loading();
  const items=await api("reservations",{group:groupParam()},force);
  const p={need_booking:0,planned:1,booked:2,paid:3,not_required:4,cancelled:5};items.sort((a,b)=>(p[a.status]??99)-(p[b.status]??99));
  app.innerHTML=`<section class="section">${filters()}</section><section class="stack">${items.length?items.map(i=>`<div class="card booking-row"><div class="row"><h3>${esc(i.name)}</h3><span class="badge ${esc(i.status)}">${esc(statusLabel(i.status))}</span></div><div class="meta">${esc(categoryLabel(i.category||""))} · ${esc(i.date||"")}${i.time?` ${esc(i.time)}`:""}</div>${i.deadline?`<div class="booking-deadline">預訂期限：${esc(i.deadline)}</div>`:""}${i.owner_member_id?`<div class="meta">負責人：${esc(i.owner_member_id)}</div>`:""}</div>`).join(""):'<div class="card empty">目前沒有預訂資料。</div>'}</section>`;
  bindFilters();
}

async function renderMap(force=false){
  pageTitle.textContent="地圖";loading();
  const [places,itinerary]=await Promise.all([api("places",{},force),api("itinerary",{group:groupParam()},force)]);
  const usedIds=new Set(itinerary.map(i=>i.place_id).filter(Boolean));
  const sorted=[...places].sort((a,b)=>(usedIds.has(b.id)?1:0)-(usedIds.has(a.id)?1:0)||String(a.city||"").localeCompare(String(b.city||""))||String(a.name||"").localeCompare(String(b.name||"")));
  app.innerHTML=`<section class="section">${filters()}</section><section class="section"><h2>旅程地點</h2><div class="stack">${sorted.length?sorted.map(p=>`<article class="card place-card"><div class="place-card-head"><div><div class="summary-kicker">${esc(categoryLabel(p.category||""))}</div><h3>${esc(p.name)}</h3></div>${usedIds.has(p.id)?'<span class="badge confirmed">行程使用</span>':""}</div><div class="meta">${esc(p.city||"")}${p.address?` · ${esc(p.address)}`:""}</div>${p.opening_hours?`<div class="meta">營業時間：${esc(p.opening_hours)}</div>`:""}${mapLink(p)}</article>`).join(""):'<div class="card empty">目前沒有地點資料。</div>'}</div></section>`;
  bindFilters();
}

function renderMore(){pageTitle.textContent="更多";app.innerHTML=`<div class="stack"><div class="card"><h2>旅遊行程規劃</h2><div class="meta">旅客唯讀版 · API v1 · P3.3</div></div><div class="card"><h3>目前使用的 API</h3><div class="meta" style="word-break:break-all">${esc(config.apiBase)}</div></div></div>`}
function bindFilters(){document.querySelectorAll("[data-group]").forEach(b=>b.onclick=async()=>{state.group=b.dataset.group;await renderCurrent()})}
function bindDateControls(){document.querySelectorAll("[data-date]").forEach(b=>b.onclick=async()=>{if(!b.dataset.date)return;state.date=b.dataset.date;await renderToday()});const select=document.getElementById("dateSelect");if(select)select.onchange=async()=>{state.date=select.value;await renderToday()}}
async function renderCurrent(force=false){try{if(state.view==="today")return await renderToday(force);if(state.view==="trip")return await renderTrip(force);if(state.view==="bookings")return await renderBookings(force);if(state.view==="map")return await renderMap(force);return renderMore()}catch(e){failed(e)}}
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=async()=>{document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.view=b.dataset.view;await renderCurrent()});
refreshBtn.onclick=async()=>{state.cache.clear();await renderCurrent(true)};
renderCurrent();
