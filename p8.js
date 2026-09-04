/* P8.3.1 desktop/mobile Admin switching + Maps settings */
(function () {
  const ADMIN_URL_KEY = 'travelPlanner.adminUrl.v1';
  const MAP_SETTINGS_KEY = 'travelPlanner.googleMaps.v1';
  let installPrompt = null;

  function readAdminUrl() { return String(localStorage.getItem(ADMIN_URL_KEY) || '').trim(); }
  function normalizeAdminUrl(value) {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:') throw new Error('Admin 網址必須使用 HTTPS');
    if (url.hostname !== 'script.google.com') throw new Error('請輸入 Google Apps Script Web App 網址');
    if (!/^\/macros\/s\/[^/]+\/exec\/?$/.test(url.pathname)) throw new Error('請輸入以 /exec 結尾的 Admin Web App 網址');
    url.search = ''; url.hash = '';
    return url.toString().replace(/\/$/, '');
  }
  function readMapSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(MAP_SETTINGS_KEY) || '{}');
      return { apiKey: String(saved.apiKey || '').trim(), mapId: String(saved.mapId || '').trim() };
    } catch (_) { return { apiKey: '', mapId: '' }; }
  }
  function standalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
  function isIos() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
  function isDesktop() { return window.matchMedia('(min-width:768px)').matches && !standalone(); }

  function moreHtml() {
    const adminUrl = readAdminUrl();
    const maps = readMapSettings();
    const mapsReady = !!(maps.apiKey && maps.mapId);
    const installed = standalone();
    return `<div class="stack p8-more">
      <div class="card p8-app-card"><div class="p8-app-icon">✈</div><div><h2>Travel Planner</h2><div class="meta">P8.3.1 · Mobile App Experience</div></div></div>
      <div class="card"><div class="p8-setting-head"><div><div class="summary-kicker">管理</div><h3>編輯旅程</h3></div><span class="badge ${adminUrl?'confirmed':'tentative'}">${adminUrl?'已連接':'尚未設定'}</span></div><div class="meta p8-setting-copy">${adminUrl?(isDesktop()?'桌機會在新分頁開啟 Admin，旅客端保留在原分頁，可直接來回切換。':'手機會在目前視窗開啟 Admin，完成後用上一頁回到 Travel Planner。'):'第一次貼上 Admin Apps Script Web App 網址；之後這台裝置會記住。'}</div>${adminUrl?`<button class="p8-primary-action" id="openAdminBtn" type="button">⚙️ 進入編輯模式</button><button class="p8-text-action" id="changeAdminBtn" type="button">更換 Admin 網址</button>`:`<div class="p8-url-setup"><input id="adminUrlInput" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://script.google.com/macros/s/.../exec"><button class="p8-primary-action" id="saveAdminBtn" type="button">儲存 Admin 網址</button><div id="adminUrlStatus" class="meta"></div></div>`}</div>
      <div class="card"><div class="p8-setting-head"><div><div class="summary-kicker">地圖</div><h3>Google Maps</h3></div><span class="badge ${mapsReady?'confirmed':'tentative'}">${mapsReady?'已設定':'尚未設定'}</span></div><div class="meta p8-setting-copy">Maps 設定只儲存在這台裝置；第一次使用時設定一次即可。</div><div class="p8-url-setup"><label><strong>Maps API Key</strong><input id="p8MapApiKey" type="text" autocomplete="off" spellcheck="false" placeholder="AIza…" value="${esc(maps.apiKey)}"></label><label><strong>Map ID</strong><input id="p8MapId" type="text" autocomplete="off" spellcheck="false" placeholder="JavaScript Map ID" value="${esc(maps.mapId)}"></label><button class="p8-primary-action" id="saveMapsBtn" type="button">${mapsReady?'更新 Google Maps 設定':'儲存 Google Maps 設定'}</button>${mapsReady?'<button class="p8-text-action" id="clearMapsBtn" type="button">清除地圖設定</button>':''}<div id="mapsStatus" class="meta"></div></div></div>
      <div class="card"><div class="p8-setting-head"><div><div class="summary-kicker">手機</div><h3>加入主畫面</h3></div><span class="badge ${installed?'confirmed':''}">${installed?'App 模式':'PWA'}</span></div><div class="meta p8-setting-copy">${installed?'目前已經以獨立 App 視窗開啟。':isIos()?'iPhone：Safari 分享 → 加入主畫面。':'支援的瀏覽器可將 Travel Planner 安裝到主畫面。'}</div>${!installed&&!isIos()?'<button class="p8-primary-action" id="installAppBtn" type="button">＋ 安裝 Travel Planner</button>':''}</div>
      <div class="card"><div class="summary-kicker">資料</div><h3>目前 API</h3><div class="meta p8-api-url">${esc(config.apiBase)}</div></div></div>`;
  }

  function bindMore() {
    const open = document.getElementById('openAdminBtn');
    if (open) open.onclick = () => {
      const url = readAdminUrl(); if (!url) return;
      if (isDesktop()) {
        const adminWindow = window.open(url, 'travelPlannerAdmin');
        if (adminWindow) adminWindow.focus(); else window.location.href = url;
      } else window.location.href = url;
    };
    const change = document.getElementById('changeAdminBtn');
    if (change) change.onclick = () => { localStorage.removeItem(ADMIN_URL_KEY); renderMore(); };
    const save = document.getElementById('saveAdminBtn');
    if (save) save.onclick = () => { const status=document.getElementById('adminUrlStatus'); try { localStorage.setItem(ADMIN_URL_KEY,normalizeAdminUrl(document.getElementById('adminUrlInput').value)); renderMore(); } catch(error) { status.textContent=error.message||'網址格式不正確'; } };
    const saveMaps=document.getElementById('saveMapsBtn');
    if(saveMaps)saveMaps.onclick=()=>{const apiKey=String(document.getElementById('p8MapApiKey').value||'').trim(),mapId=String(document.getElementById('p8MapId').value||'').trim(),status=document.getElementById('mapsStatus');if(!apiKey||!mapId){status.textContent='API Key 與 Map ID 都需要填寫。';return;}localStorage.setItem(MAP_SETTINGS_KEY,JSON.stringify({apiKey,mapId}));status.textContent='已儲存。回到「今日」後地圖會自動載入。';setTimeout(renderMore,500);};
    const clearMaps=document.getElementById('clearMapsBtn');if(clearMaps)clearMaps.onclick=()=>{if(window.confirm('要清除這台裝置的 Google Maps 設定嗎？')){localStorage.removeItem(MAP_SETTINGS_KEY);renderMore();}};
    const install=document.getElementById('installAppBtn');if(install)install.onclick=async()=>{if(!installPrompt){install.textContent='請使用瀏覽器的「安裝 App／加入主畫面」';return;}installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;renderMore();};
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(state.view==='more')renderMore();});
  window.addEventListener('appinstalled',()=>{installPrompt=null;if(state.view==='more')renderMore();});
  try{renderMore=function(){pageTitle.textContent='更多';app.innerHTML=moreHtml();bindMore();};}catch(error){console.error('P8 patch failed',error);}
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('PWA service worker failed',error)));
})();