/* P4 production acceptance fixes */

const p4BaseApi = api;
api = async function(resource, params = {}, force = false) {
  const scopedParams = Object.assign({}, params);
  if (scopedParams.group && scopedParams.group !== 'all' && !String(scopedParams.group).includes(',')) {
    scopedParams.group = String(scopedParams.group) + ',all';
  }
  return p4BaseApi(resource, scopedParams, force);
};

renderMore = function() {
  pageTitle.textContent = '更多';
  const version = config.buildVersion || 'P4';
  app.innerHTML = `<div class="stack">
    <div class="card">
      <h2>旅遊行程規劃</h2>
      <div class="meta">旅客唯讀版 · API v1 · ${esc(version)}</div>
    </div>
    <div class="card">
      <h3>目前使用的 API</h3>
      <div class="meta" style="word-break:break-all">${esc(config.apiBase)}</div>
    </div>
    <div class="card">
      <h3>P4 上線狀態</h3>
      <div class="meta">公開欄位白名單已啟用 · JSONP 已啟用 · 群組共同活動已納入</div>
    </div>
  </div>`;
};
