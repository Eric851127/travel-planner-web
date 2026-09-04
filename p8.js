/* P8.1 single entry + P8.2 PWA */
(function () {
  const ADMIN_URL_KEY = 'travelPlanner.adminUrl.v1';
  let installPrompt = null;

  function readAdminUrl() {
    return String(localStorage.getItem(ADMIN_URL_KEY) || '').trim();
  }

  function normalizeAdminUrl(value) {
    const input = String(value || '').trim();
    const url = new URL(input);
    if (url.protocol !== 'https:') throw new Error('Admin 網址必須使用 HTTPS');
    if (url.hostname !== 'script.google.com') throw new Error('請輸入 Google Apps Script Web App 網址');
    if (!/^\/macros\/s\/[^/]+\/exec\/?$/.test(url.pathname)) throw new Error('請輸入以 /exec 結尾的 Admin Web App 網址');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  }

  function standalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function moreHtml() {
    const adminUrl = readAdminUrl();
    const installed = standalone();
    return `<div class="stack p8-more">
      <div class="card p8-app-card">
        <div class="p8-app-icon">✈</div>
        <div><h2>Travel Planner</h2><div class="meta">P8 · Mobile App Experience</div></div>
      </div>
      <div class="card">
        <div class="p8-setting-head"><div><div class="summary-kicker">管理</div><h3>編輯旅程</h3></div><span class="badge ${adminUrl ? 'confirmed' : 'tentative'}">${adminUrl ? '已連接' : '尚未設定'}</span></div>
        <div class="meta p8-setting-copy">${adminUrl ? '從這裡直接進入管理端，不必另外找第二個網址。' : '第一次貼上 Admin Apps Script Web App 網址；之後這台手機會記住。'}</div>
        ${adminUrl ? `<button class="p8-primary-action" id="openAdminBtn" type="button">⚙️ 進入編輯模式</button><button class="p8-text-action" id="changeAdminBtn" type="button">更換 Admin 網址</button>` : `<div class="p8-url-setup"><input id="adminUrlInput" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://script.google.com/macros/s/.../exec"><button class="p8-primary-action" id="saveAdminBtn" type="button">儲存 Admin 網址</button><div id="adminUrlStatus" class="meta"></div></div>`}
      </div>
      <div class="card">
        <div class="p8-setting-head"><div><div class="summary-kicker">手機</div><h3>加入主畫面</h3></div><span class="badge ${installed ? 'confirmed' : ''}">${installed ? 'App 模式' : 'PWA'}</span></div>
        <div class="meta p8-setting-copy">${installed ? '目前已經以獨立 App 視窗開啟。' : isIos() ? 'iPhone：Safari 分享 → 加入主畫面。之後直接點 Travel Planner 圖示。' : '支援的瀏覽器可將 Travel Planner 安裝到主畫面。'}</div>
        ${!installed && !isIos() ? '<button class="p8-primary-action" id="installAppBtn" type="button">＋ 安裝 Travel Planner</button>' : ''}
      </div>
      <div class="card"><div class="summary-kicker">資料</div><h3>目前 API</h3><div class="meta p8-api-url">${esc(config.apiBase)}</div></div>
    </div>`;
  }

  function bindMore() {
    const open = document.getElementById('openAdminBtn');
    if (open) open.onclick = () => window.open(readAdminUrl(), '_blank', 'noopener,noreferrer');

    const change = document.getElementById('changeAdminBtn');
    if (change) change.onclick = () => {
      localStorage.removeItem(ADMIN_URL_KEY);
      renderMore();
    };

    const save = document.getElementById('saveAdminBtn');
    if (save) save.onclick = () => {
      const status = document.getElementById('adminUrlStatus');
      try {
        const url = normalizeAdminUrl(document.getElementById('adminUrlInput').value);
        localStorage.setItem(ADMIN_URL_KEY, url);
        renderMore();
      } catch (error) {
        status.textContent = error.message || '網址格式不正確';
      }
    };

    const install = document.getElementById('installAppBtn');
    if (install) {
      install.onclick = async () => {
        if (!installPrompt) {
          install.textContent = '請使用瀏覽器的「安裝 App／加入主畫面」';
          return;
        }
        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        renderMore();
      };
    }
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    if (state.view === 'more') renderMore();
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    if (state.view === 'more') renderMore();
  });

  try {
    renderMore = function () {
      pageTitle.textContent = '更多';
      app.innerHTML = moreHtml();
      bindMore();
    };
  } catch (error) {
    console.error('P8 patch failed', error);
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(error => console.warn('PWA service worker failed', error)));
  }
})();
