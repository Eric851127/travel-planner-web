/* P16.3.1 Admin itinerary mobility detail decorator. Shared bootstrap only. */
(function(){'use strict';
  const STYLE_ID='p163AdminMobilityDetailStyle';
  let scheduled=false;

  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}

  function addStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;
    s.textContent='.p163-admin-mobility{margin-top:8px;padding:8px 10px;border-radius:9px;background:#f7f8f9;font-size:13px;color:#4a4d52}.p163-admin-mobility strong{color:#303134}@media(max-width:650px){.p163-admin-mobility{font-size:14px;padding:10px 11px}}';
    document.head.appendChild(s);
  }

  function label(type){return({train:'火車',bus:'巴士',ferry:'渡輪',rental_car:'租車',airport_transfer:'機場接送',other:'其他交通'}[type]||type||'交通')}

  function decorate(){
    scheduled=false;
    const title=document.getElementById('pageTitle');
    if(!title||title.textContent.trim()!=='行程管理')return;
    const list=document.getElementById('list');if(!list)return;
    const data=window.TRAVEL_PLANNER_ADMIN_BOOTSTRAP;
    if(!data)return;
    const itinerary=Array.isArray(data.itinerary)?data.itinerary:[];
    const transports=Array.isArray(data.transport)?data.transport:[];
    const places=Array.isArray(data.places)?data.places:[];
    const itineraryById=new Map(itinerary.map(x=>[String(x.id),x]));
    const transportById=new Map(transports.map(x=>[String(x.id),x]));
    const placeById=new Map(places.map(x=>[String(x.id),x]));

    list.querySelectorAll('[data-edit]').forEach(button=>{
      const card=button.closest('.card.item');if(!card||card.querySelector('.p163-admin-mobility'))return;
      const item=itineraryById.get(String(button.dataset.edit||''));
      if(!item||!item.transport_id)return;
      const t=transportById.get(String(item.transport_id));if(!t)return;
      const from=placeById.get(String(t.from_place_id||'')),to=placeById.get(String(t.to_place_id||''));
      const route=(from&&from.name||t.from_place_id||'—')+' → '+(to&&to.name||t.to_place_id||'—');
      const time=[t.departure_time,t.arrival_time].filter(Boolean).join(' → ');
      const name=[label(t.type),t.operator,t.service_no].filter(Boolean).join(' · ');
      const node=document.createElement('div');node.className='p163-admin-mobility';
      node.innerHTML='<strong>'+esc(name||'交通')+'</strong><div>'+esc(route)+(time?' · '+esc(time):'')+'</div>';
      const content=card.firstElementChild;if(content)content.appendChild(node);
    });
  }

  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(decorate)}
  addStyles();
  window.addEventListener('travel-planner-admin-bootstrap',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  schedule();
  window.TRAVEL_PLANNER_ADMIN_MOBILITY_DETAIL=Object.freeze({version:'P16.3.1',dataSource:'shared-bootstrap'});
})();