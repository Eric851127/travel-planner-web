const config=window.TRAVEL_PLANNER_CONFIG;
const state={view:"today",group:config.defaultGroup||"all",date:config.defaultDate,dates:[],cache:new Map()};
const app=document.getElementById("app"),pageTitle=document.getElementById("pageTitle"),refreshBtn=document.getElementById("refreshBtn");

const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const statusLabel=v=>({confirmed:"Confirmed",tentative:"Tentative",optional:"Optional",need_booking:"Need booking",booked:"Booked",paid:"Paid",planned:"Planned",not_required:"Not required",cancelled:"Cancelled"}[v]||v||"");
const formatDateLabel=value=>{if(!value)return"";const d=new Date(value+"T00:00:00");if(Number.isNaN(d.getTime()))return value;return new Intl.DateTimeFormat("zh-TW",{month:"short",day:"numeric",weekday:"short"}).format(d)};

function jsonp(url,timeoutMs=12000){
  return new Promise((resolve,reject)=>{
    const callbackName="__travelPlannerJsonp_"+Date.now()+"_"+Math.random().toString(36).slice(2);
    const script=document.createElement("script");
    const timer=setTimeout(()=>cleanup(new Error("API request timed out")),timeoutMs);
    function cleanup(error,data){clearTimeout(timer);delete window[callbackName];script.remove();error?reject(error):resolve(data)}
    window[callbackName]=data=>cleanup(null,data);
    url.searchParams.set("callback",callbackName);
    script.src=url.toString();script.async=true;
    script.onerror=()=>cleanup(new Error("API script failed to load"));
    document.head.appendChild(script);
  });
}

async function api(resource,params={},force=false){
  const url=new URL(config.apiBase+"/"+resource);
  Object.entries(params).forEach(([k,v])=>{if(v!==null&&v!==undefined&&v!=="")url.searchParams.set(k,v)});
  const key=url.toString();
  if(!force&&state.cache.has(key))return state.cache.get(key);
  const json=await jsonp(url);
  if(!json||!json.success)throw new Error(json?.error?.message||"API error");
  state.cache.set(key,json.data);return json.data;
}

const groupParam=()=>state.group==="all"?null:state.group;
const loading=()=>app.innerHTML='<div class="loading">Loading…</div>';
const failed=e=>app.innerHTML=`<div class="card error">載入失敗：${esc(e.message)}</div>`;
const filters=()=>`<div class="filters">${[["all","All"],["ours","Ours"],["friends","Friends"]].map(([v,l])=>`<button class="filter-btn ${state.group===v?"active":""}" data-group="${v}">${l}</button>`).join("")}</div>`;

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
  return `<div class="date-nav"><button class="date-arrow" data-date="${esc(prev||"")}" ${prev?"":"disabled"} aria-label="前一天">‹</button><label class="date-picker-wrap"><span class="muted small">Selected day</span><select id="dateSelect" class="date-select">${state.dates.map(d=>`<option value="${esc(d)}" ${d===state.date?"selected":""}>${esc(formatDateLabel(d))}</option>`).join("")}</select></label><button class="date-arrow" data-date="${esc(next||"")}" ${next?"":"disabled"} aria-label="後一天">›</button></div>`;
}

function reservationBadge(reservation){
  if(!reservation)return"";
  return `<div class="reservation-line"><span class="reservation-label">Booking</span><span class="badge ${esc(reservation.status||"")}">${esc(statusLabel(reservation.status))}</span></div>`;
}

async function renderToday(force=false){
  pageTitle.textContent="Today";loading();
  await ensureDates(force);
  if(!state.dates.length){app.innerHTML='<div class="card empty">目前沒有行程日期。</div>';return}
  const [items,reservations]=await Promise.all([
    api("itinerary",{date:state.date,group:groupParam()},force),
    api("reservations",{group:groupParam()},force)
  ]);
  const reservationById=new Map(reservations.map(r=>[r.id,r]));
  app.innerHTML=`<section class="section">${dateNav()}${filters()}</section><section class="section"><h2>Timeline</h2><div class="card">${items.length?items.map(i=>{const r=i.reservation_id?reservationById.get(i.reservation_id):null;return `<div class="timeline-item"><div class="time">${esc(i.start_time||"—")}</div><div class="timeline-body"><div class="row"><h3>${esc(i.title)}</h3><span class="badge ${esc(i.certainty)}">${esc(statusLabel(i.certainty))}</span></div>${i.description?`<div class="meta">${esc(i.description)}</div>`:""}<div class="meta">${esc(i.city||"")}${i.group?` · ${esc(i.group)}`:""}</div>${reservationBadge(r)}</div></div>`}).join(""):'<div class="empty">這一天沒有行程。</div>'}</div></section>`;
  bindFilters();bindDateControls();
}

async function renderTrip(force=false){
  pageTitle.textContent="Trip";loading();
  const [items,reservations]=await Promise.all([api("itinerary",{group:groupParam()},force),api("reservations",{group:groupParam()},force)]);
  const reservationById=new Map(reservations.map(r=>[r.id,r]));
  const grouped=items.reduce((a,i)=>((a[i.date]??=[]).push(i),a),{});
  app.innerHTML=`<section class="section">${filters()}</section><section class="stack">${Object.keys(grouped).length?Object.entries(grouped).map(([d,x])=>`<div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">${esc(formatDateLabel(d))}</h2><span class="badge">${x.length} items</span></div><div class="stack">${x.map(i=>{const r=i.reservation_id?reservationById.get(i.reservation_id):null;return `<div class="trip-row"><div><strong>${esc(i.start_time||"—")} · ${esc(i.title)}</strong><div class="meta">${esc(i.city||"")} · ${esc(i.group||"")}</div></div>${r?`<span class="badge ${esc(r.status||"")}">${esc(statusLabel(r.status))}</span>`:""}</div>`}).join("")}</div></div>`).join(""):'<div class="card empty">目前沒有行程資料。</div>'}</section>`;
  bindFilters();
}

async function renderBookings(force=false){
  pageTitle.textContent="Bookings";loading();
  const items=await api("reservations",{group:groupParam()},force);
  const p={need_booking:0,planned:1,booked:2,paid:3,not_required:4,cancelled:5};items.sort((a,b)=>(p[a.status]??99)-(p[b.status]??99));
  app.innerHTML=`<section class="section">${filters()}</section><section class="stack">${items.length?items.map(i=>`<div class="card booking-row"><div class="row"><h3>${esc(i.name)}</h3><span class="badge ${esc(i.status)}">${esc(statusLabel(i.status))}</span></div><div class="meta">${esc(i.category||"")} · ${esc(i.date||"")}${i.time?` ${esc(i.time)}`:""}</div>${i.deadline?`<div class="booking-deadline">Deadline: ${esc(i.deadline)}</div>`:""}${i.owner_member_id?`<div class="meta">Owner: ${esc(i.owner_member_id)}</div>`:""}</div>`).join(""):'<div class="card empty">目前沒有 reservation。</div>'}</section>`;
  bindFilters();
}

function renderMap(){pageTitle.textContent="Map";app.innerHTML='<div class="card empty"><div class="placeholder-icon">⌖</div><strong>Map — V1 placeholder</strong><div class="meta">下一步使用 Places 的 Google Maps URL 做外部地圖連結，不先引入 Maps SDK。</div></div>'}
function renderMore(){pageTitle.textContent="More";app.innerHTML=`<div class="stack"><div class="card"><h2>Travel Planner</h2><div class="meta">Read-only traveler web app · API v1 · P3.1</div></div><div class="card"><h3>Current API</h3><div class="meta" style="word-break:break-all">${esc(config.apiBase)}</div></div></div>`}
function bindFilters(){document.querySelectorAll("[data-group]").forEach(b=>b.onclick=async()=>{state.group=b.dataset.group;await renderCurrent()})}
function bindDateControls(){
  document.querySelectorAll("[data-date]").forEach(b=>b.onclick=async()=>{if(!b.dataset.date)return;state.date=b.dataset.date;await renderToday()});
  const select=document.getElementById("dateSelect");if(select)select.onchange=async()=>{state.date=select.value;await renderToday()};
}
async function renderCurrent(force=false){try{if(state.view==="today")return await renderToday(force);if(state.view==="trip")return await renderTrip(force);if(state.view==="bookings")return await renderBookings(force);if(state.view==="map")return renderMap();return renderMore()}catch(e){failed(e)}}
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=async()=>{document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.view=b.dataset.view;await renderCurrent()});
refreshBtn.onclick=async()=>{state.cache.clear();await renderCurrent(true)};
renderCurrent();
