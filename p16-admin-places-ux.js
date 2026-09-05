/* P16.2/P16.3 Admin UX: Places + searchable relations + Mobility IA. */
(function () {
  'use strict';

  const PLACE_SEARCH_ID = 'p162PlaceSearch';
  const STYLE_ID = 'p162AdminPlacesUxStyle';
  const MOBILITY_TAB_ID = 'p163MobilityTab';
  const MOBILITY_SUBNAV_ID = 'p163MobilitySubnav';
  let applying = false;
  let lastMobilityMode = 'flights';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function normalize(value) {
    return String(value || '').trim().toLocaleLowerCase('zh-Hant');
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .p162-place-search{flex:1 1 260px;min-width:220px;padding:10px 12px;border:1px solid #c9c9c9;border-radius:9px;background:#fff;font:inherit}
      .p162-city-section{margin-bottom:18px}.p162-city-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 2px 8px;font-size:14px;font-weight:800;color:#4a4d52}.p162-city-count{display:inline-flex;align-items:center;justify-content:center;min-width:28px;padding:3px 8px;border-radius:999px;background:#e9eaed;font-size:12px;color:#5f6368}
      .p162-relation-picker select{display:none!important}.p162-picker-selected{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;border:1px solid #c9c9c9;border-radius:9px;background:#fff}.p162-picker-selected strong{display:block;font-size:14px}.p162-picker-selected .meta{margin-top:2px}.p162-picker-clear{border:0;background:transparent;font:inherit;color:#5f6368;padding:4px 6px;cursor:pointer}.p162-picker-search{width:100%;margin-top:8px;padding:10px 12px;border:1px solid #c9c9c9;border-radius:9px;font:inherit;background:#fff}.p162-picker-results{margin-top:8px;max-height:320px;overflow:auto;border:1px solid #e3e3e3;border-radius:10px;background:#fff}.p162-picker-city{padding:7px 10px;background:#f7f8f9;border-bottom:1px solid #ececec;font-size:12px;font-weight:800;color:#5f6368;position:sticky;top:0}.p162-picker-option{display:block;width:100%;border:0;border-bottom:1px solid #f0f0f0;background:#fff;text-align:left;padding:10px 12px;font:inherit;cursor:pointer}.p162-picker-option:last-child{border-bottom:0}.p162-picker-option:hover,.p162-picker-option:focus{background:#f6f8fa;outline:none}.p162-picker-option strong{display:block}.p162-picker-empty{padding:14px;text-align:center;color:#666}
      .p163-mobility-subnav{display:flex;gap:6px;margin:0 0 12px;padding:4px;background:#eef0f2;border-radius:11px}.p163-mobility-subtab{flex:1;border:0;border-radius:8px;padding:9px 12px;background:transparent;font:inherit;font-weight:800;cursor:pointer}.p163-mobility-subtab.active{background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.08)}
      @media(max-width:650px){.p162-place-search,.p162-picker-search{min-height:50px;font-size:16px}.p162-picker-selected{min-height:52px;padding:12px 13px}.p162-picker-results{max-height:42vh}.p162-picker-option{padding:13px 12px}.p163-mobility-subtab{min-height:46px;font-size:16px}}
    `;
    document.head.appendChild(style);
  }

  function pageTitleText() {
    const title = document.getElementById('pageTitle');
    return title ? title.textContent.trim() : '';
  }

  function isPlacesMode() { return pageTitleText() === '地點管理'; }

  function placeCards() {
    const list = document.getElementById('list');
    if (!list) return [];
    return Array.from(list.querySelectorAll(':scope > .card.item'));
  }

  function cardCity(card) {
    const meta = card.querySelector('.meta');
    if (!meta) return '未分類';
    const city = String(meta.textContent || '').split(' · ')[0].trim();
    return city && city !== '未指定城市' ? city : '未分類';
  }

  function ensurePlaceSearch() {
    if (!isPlacesMode()) return null;
    const filters = document.getElementById('filters');
    if (!filters) return null;
    let input = document.getElementById(PLACE_SEARCH_ID);
    if (!input) {
      input = document.createElement('input');
      input.id = PLACE_SEARCH_ID;
      input.className = 'p162-place-search';
      input.type = 'search';
      input.placeholder = '搜尋地點、城市、地址或分類…';
      input.autocomplete = 'off';
      input.oninput = () => applyPlacesLayout(input.value);
      filters.insertBefore(input, filters.firstChild);
    }
    return input;
  }

  function restoreRawCards(list) {
    Array.from(list.querySelectorAll('.p162-city-section')).forEach(section => {
      Array.from(section.querySelectorAll('.card.item')).forEach(card => list.appendChild(card));
      section.remove();
    });
  }

  function applyPlacesLayout(query) {
    if (applying || !isPlacesMode()) return;
    const list = document.getElementById('list');
    if (!list) return;
    applying = true;
    try {
      restoreRawCards(list);
      const cards = placeCards();
      if (!cards.length) return;
      const needle = normalize(query);
      const matched = cards.filter(card => !needle || normalize(card.textContent).includes(needle));
      cards.forEach(card => { card.hidden = !matched.includes(card); });
      const oldEmpty = list.querySelector('.p162-search-empty');
      if (oldEmpty) oldEmpty.remove();
      if (!matched.length) {
        const empty = document.createElement('div');
        empty.className = 'card empty p162-search-empty';
        empty.textContent = '找不到符合條件的地點。';
        list.appendChild(empty);
        return;
      }
      const groups = new Map();
      matched.forEach(card => {
        const city = cardCity(card);
        if (!groups.has(city)) groups.set(city, []);
        groups.get(city).push(card);
      });
      Array.from(groups.keys()).sort(function (a, b) {
        if (a === '未分類') return 1;if (b === '未分類') return -1;return a.localeCompare(b, 'zh-Hant');
      }).forEach(city => {
        const section = document.createElement('section');
        section.className = 'p162-city-section';
        section.innerHTML = '<div class="p162-city-heading"><span>' + esc(city) + '</span><span class="p162-city-count">' + groups.get(city).length + '</span></div>';
        groups.get(city).forEach(card => section.appendChild(card));
        list.appendChild(section);
      });
    } finally { applying = false; }
  }

  function parsePlaceOption(option) {
    const text = String(option.textContent || '').trim();
    if (!option.value) return { id: '', group: '', title: '未指定地點', meta: '可搜尋既有 Places', search: text };
    const parts = text.split(' · ');
    const city = parts.length > 1 ? parts.shift().trim() : '未分類';
    const name = parts.join(' · ').trim() || text;
    return { id: option.value, group: city || '未分類', title: name, meta: city || '未分類', search: [city, name, option.value].join(' ') };
  }

  function parseTransportOption(option) {
    const text = String(option.textContent || '').trim();
    return { id: option.value, group: '', title: option.value ? text : '未指定交通', meta: option.value ? '已建立交通段' : '可搜尋既有交通', search: [text, option.value].join(' ') };
  }

  function selectedHtml(item) {
    return '<div><strong>' + esc(item && item.title || '未指定') + '</strong><div class="meta">' + esc(item && item.meta || '') + '</div></div>';
  }

  function renderPickerResults(root, items, query, grouped) {
    const results = root.querySelector('.p162-picker-results');
    const needle = normalize(query);
    const filtered = items.filter(item => item.id && (!needle || normalize(item.search).includes(needle)));
    if (!filtered.length) { results.innerHTML = '<div class="p162-picker-empty">找不到符合條件的項目。</div>'; return; }
    let html = '';
    if (grouped) {
      const groups = new Map();
      filtered.forEach(item => { if (!groups.has(item.group)) groups.set(item.group, []);groups.get(item.group).push(item); });
      Array.from(groups.keys()).sort(function (a, b) { if (a === '未分類') return 1;if (b === '未分類') return -1;return a.localeCompare(b, 'zh-Hant'); }).forEach(group => {
        html += '<div class="p162-picker-city">' + esc(group) + '</div>';
        groups.get(group).sort((a,b)=>a.title.localeCompare(b.title,'zh-Hant')).forEach(item => { html += pickerOptionHtml(item); });
      });
    } else {
      filtered.forEach(item => { html += pickerOptionHtml(item); });
    }
    results.innerHTML = html;
  }

  function pickerOptionHtml(item) {
    return '<button type="button" class="p162-picker-option" data-relation-id="' + esc(item.id) + '"><strong>' + esc(item.title) + '</strong><span class="meta">' + esc(item.meta || '') + '</span></button>';
  }

  function enhanceSelect(select, config) {
    if (!select || select.dataset.p162Enhanced === '1') return;
    const field = select.closest('.field');
    if (!field) return;
    select.dataset.p162Enhanced = '1';
    field.classList.add('full', 'p162-relation-picker');
    const items = Array.from(select.options).map(config.parser);
    const current = items.find(item => item.id === select.value) || items[0] || { id:'', title:'未指定', meta:'' };
    const shell = document.createElement('div');
    shell.className = 'p162-picker-ui';
    shell.innerHTML = '<div class="p162-picker-selected"><div class="p162-selected-copy">' + selectedHtml(current) + '</div><button type="button" class="p162-picker-clear">清除</button></div><input type="search" class="p162-picker-search" placeholder="' + esc(config.placeholder) + '" autocomplete="off"><div class="p162-picker-results"></div>';
    select.insertAdjacentElement('afterend', shell);
    const search = shell.querySelector('.p162-picker-search');
    const selectedCopy = shell.querySelector('.p162-selected-copy');
    renderPickerResults(shell, items, '', !!config.grouped);
    search.oninput = () => renderPickerResults(shell, items, search.value, !!config.grouped);
    shell.onclick = function (event) {
      const button = event.target.closest('[data-relation-id]');
      if (!button) return;
      select.value = button.dataset.relationId;
      const chosen = items.find(item => item.id === select.value);
      selectedCopy.innerHTML = selectedHtml(chosen);
      search.value = '';
      renderPickerResults(shell, items, '', !!config.grouped);
    };
    shell.querySelector('.p162-picker-clear').onclick = function () {
      select.value = '';
      const blank = items.find(item => !item.id) || { id:'', title:'未指定', meta:'' };
      selectedCopy.innerHTML = selectedHtml(blank);
      search.value = '';
      renderPickerResults(shell, items, '', !!config.grouped);
    };
  }

  function enhanceFormRelations() {
    const formTitle = document.getElementById('formTitle');
    if (!formTitle) return;
    const title = formTitle.textContent.trim();
    if (/行程$/.test(title)) {
      enhanceSelect(document.getElementById('f_place_id'), { parser: parsePlaceOption, grouped: true, placeholder: '搜尋地點、城市或名稱…' });
      enhanceSelect(document.getElementById('f_transport_id'), { parser: parseTransportOption, grouped: false, placeholder: '搜尋交通方式、起點或終點…' });
    }
    if (/交通$/.test(title)) {
      enhanceSelect(document.getElementById('f_from_place_id'), { parser: parsePlaceOption, grouped: true, placeholder: '搜尋出發地、城市或名稱…' });
      enhanceSelect(document.getElementById('f_to_place_id'), { parser: parsePlaceOption, grouped: true, placeholder: '搜尋目的地、城市或名稱…' });
    }
  }

  function currentMobilityMode(flightsTab, transportTab) {
    if (transportTab && transportTab.classList.contains('active')) return 'transport';
    if (flightsTab && flightsTab.classList.contains('active')) return 'flights';
    return '';
  }

  function ensureMobilityIa() {
    const tabs = document.getElementById('tabs');
    if (!tabs) return;
    const flightsTab = tabs.querySelector('[data-mode="flights"]');
    const transportTab = tabs.querySelector('[data-mode="transport"]');
    if (!flightsTab || !transportTab) return;
    const mode = currentMobilityMode(flightsTab, transportTab);
    if (mode) lastMobilityMode = mode;
    flightsTab.hidden = true;
    transportTab.hidden = true;

    let combined = document.getElementById(MOBILITY_TAB_ID);
    if (!combined) {
      combined = document.createElement('button');
      combined.id = MOBILITY_TAB_ID;
      combined.className = 'tab';
      combined.textContent = '交通';
      combined.onclick = function () {
        const target = tabs.querySelector('[data-mode="' + lastMobilityMode + '"]') || flightsTab;
        target.click();
      };
      tabs.insertBefore(combined, flightsTab);
    }
    combined.classList.toggle('active', !!mode);

    const panel = document.getElementById('adminPanel');
    const filters = document.getElementById('filters');
    if (!panel || !filters) return;
    let subnav = document.getElementById(MOBILITY_SUBNAV_ID);
    if (!mode) { if (subnav) subnav.remove(); return; }
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = '交通管理';
    if (!subnav) {
      subnav = document.createElement('div');
      subnav.id = MOBILITY_SUBNAV_ID;
      subnav.className = 'p163-mobility-subnav';
      subnav.innerHTML = '<button type="button" class="p163-mobility-subtab" data-p163-mode="flights">航班</button><button type="button" class="p163-mobility-subtab" data-p163-mode="transport">一般交通</button>';
      panel.insertBefore(subnav, filters);
      subnav.querySelectorAll('[data-p163-mode]').forEach(button => {
        button.onclick = function () {
          lastMobilityMode = button.dataset.p163Mode;
          const target = tabs.querySelector('[data-mode="' + lastMobilityMode + '"]');
          if (target) target.click();
        };
      });
    }
    subnav.querySelectorAll('[data-p163-mode]').forEach(button => button.classList.toggle('active', button.dataset.p163Mode === mode));
  }

  function apply() {
    installStyles();
    ensureMobilityIa();
    const input = ensurePlaceSearch();
    if (input && placeCards().length) applyPlacesLayout(input.value);
    enhanceFormRelations();
  }

  const observer = new MutationObserver(function () {
    if (applying) return;
    requestAnimationFrame(apply);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  apply();

  window.TRAVEL_PLANNER_ADMIN_PLACE_UX = Object.freeze({ version: 'P16.3', mobilityIa: true });
})();