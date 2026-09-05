/* P12 production Admin cutover + Maps settings */
(function () {
  const ADMIN_PATH = 'admin.html';
  let installPrompt = null;

  function readMapSettings() { return window.TRAVEL_PLANNER_MAPS.readSettings(); }
  function standalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
  function isIos() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }

  function moreHtml() {
    const maps = readMapSettings();
    const mapsReady = !!(maps.apiKey && maps.mapId);
    const installed = standalone();
    return `<div class="stack p8-more">
      <div class="card p8-app-card"><div class="p8-app-icon">✈</div><div><h2>Travel Planner</h2><div class="meta">P12 · GitHub Admin Cutover</div></div></div>
      <div class="card"><div class="p8-setting-head"><div><div class="summary-kicker">管理</div><h3>編輯旅程</h3></div><span class="badge confirmed">已連接</span></div><div class="meta p8-setting-copy">管理端已整合到 Travel Planner PWA。進入編輯模式後仍維持在 GitHub Pages／PWA 範圍內，並透過受保護的 Admin API 存取資料。</div><button class="p8-primary-action" id="openAdminBtn" type="button">⚙️ 進入編輯模式</button></div>
      <div class="card"><div class="p8-setting-head"><div><div class="summary-kicker">地圖</div><h3>Google Maps</h3></div><span class="badge ${mapsReady?'confirmed':'tentative'}">${mapsReady?'已設定':'尚未設定'}</span></div><div class="meta p8-setting-copy">Maps 設定只儲存在這台裝置；第一次使用時設定一次即可。</div><div class="p8-url-setup"><label><strong>Maps API Key</strong><input id="p8MapApiKey" type="text" autocomplete="off" spellcheck="false" placeholder="AIza…" value="${esc(maps.apiKey)}"></label><label><strong>Map ID</strong><input id="p8MapId" type="text" autocomplete="off" spellcheck="false" placeholder="JavaScript Map ID" value="${esc(maps.mapId)}"></label><button class="p8-primary-action" id="saveMapsBtn" type="button">${mapsReady?'更新 Google Maps 設定':'儲存 Google Maps 設定'}</button>${mapsReady?'<button class="p8-text-action" id="clearMapsBtn" type="button">清除地圖設定</button>':''}<div id="mapsStatus" class="meta"></div></div></div>
      <div class="card"><div class="p8-setting-head"><div><div class="summary-kicker">手機</div><h3>加入主畫面</h3></div><span class="badge ${installed?'confirmed':''}">${installed?'App 模式':'PWA'}</span></div><div class="meta p8-setting-copy">${installed?'目前已經以獨立 App 視窗開啟。':isIos()?'iPhone：Safari 分享 → 加入主畫面。':'支援的瀏覽器可將 Travel Planner 安裝到主畫面。'}</div>${!installed&&!isIos()?'<button class="p8-primary-action" id="installAppBtn" type="button">＋ 安裝 Travel Planner</button>':''}</div>
      <div class="card"><div class="summary-kicker">資料</div><h3>目前 API</h3><div class="meta p8-api-url">${esc(config.apiBase)}</div></div></div>`;
  }

  function bindMore() {
    const open = document.getElementById('openAdminBtn');
    if (open) open.onclick = () => { window.location.href = ADMIN_PATH; };
    const saveMaps=document.getElementById('saveMapsBtn');
    if(saveMaps)saveMaps.onclick=()=>{const apiKey=String(document.getElementById('p8MapApiKey').value||'').trim(),mapId=String(document.getElementById('p8MapId').value||'').trim(),status=document.getElementById('mapsStatus');if(!apiKey||!mapId){status.textContent='API Key 與 Map ID 都需要填寫。';return;}window.TRAVEL_PLANNER_MAPS.saveSettings(apiKey,mapId);status.textContent='已儲存。回到「今日」後地圖會自動載入。';setTimeout(renderMore,500);};
    const clearMaps=document.getElementById('clearMapsBtn');if(clearMaps)clearMaps.onclick=()=>{if(window.confirm('要清除這台裝置的 Google Maps 設定嗎？')){window.TRAVEL_PLANNER_MAPS.clearSettings();renderMore();}};
    const install=document.getElementById('installAppBtn');if(install)install.onclick=async()=>{if(!installPrompt){install.textContent='請使用瀏覽器的「安裝 App／加入主畫面」';return;}installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;renderMore();};
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(state.view==='more')renderMore();});
  window.addEventListener('appinstalled',()=>{installPrompt=null;if(state.view==='more')renderMore();});
  try{renderMore=function(){pageTitle.textContent='更多';app.innerHTML=moreHtml();bindMore();};}catch(error){console.error('P12 patch failed',error);}
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('PWA service worker failed',error)));
})();