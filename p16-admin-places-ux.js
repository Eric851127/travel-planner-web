/* P16.2 Admin Places UX: city grouping + searchable Place picker. */
(function () {
  'use strict';

  const PLACE_SEARCH_ID = 'p162PlaceSearch';
  const PICKER_CLASS = 'p162-place-picker';
  const STYLE_ID = 'p162AdminPlacesUxStyle';
  let applying = false;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
      .p162-city-section{margin-bottom:18px}
      .p162-city-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 2px 8px;font-size:14px;font-weight:800;color:#4a4d52}
      .p162-city-count{display:inline-flex;align-items:center;justify-content:center;min-width:28px;padding:3px 8px;border-radius:999px;background:#e9eaed;font-size:12px;color:#5f6368}
      .p162-place-picker{position:relative}
      .p162-place-picker select{display:none!important}
      .p162-picker-selected{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;border:1px solid #c9c9c9;border-radius:9px;background:#fff}
      .p162-picker-selected strong{display:block;font-size:14px}
      .p162-picker-selected .meta{margin-top:2px}
      .p162-picker-clear{border:0;background:transparent;font:inherit;color:#5f6368;padding:4px 6px;cursor:pointer}
      .p162-picker-search{width:100%;margin-top:8px;padding:10px 12px;border:1px solid #c9c9c9;border-radius:9px;font:inherit;background:#fff}
      .p162-picker-results{margin-top:8px;max-height:320px;overflow:auto;border:1px solid #e3e3e3;border-radius:10px;background:#fff}
      .p162-picker-city{padding:7px 10px;background:#f7f8f9;border-bottom:1px solid #ececec;font-size:12px;font-weight:800;color:#5f6368;position:sticky;top:0}
      .p162-picker-option{display:block;width:100%;border:0;border-bottom:1px solid #f0f0f0;background:#fff;text-align:left;padding:10px 12px;font:inherit;cursor:pointer}
      .p162-picker-option:last-child{border-bottom:0}
      .p162-picker-option:hover,.p162-picker-option:focus{background:#f6f8fa;outline:none}
      .p162-picker-option strong{display:block}
      .p162-picker-empty{padding:14px;text-align:center;color:#666}
      @media(max-width:650px){.p162-place-search,.p162-picker-search{min-height:50px;font-size:16px}.p162-picker-selected{min-height:52px;padding:12px 13px}.p162-picker-results{max-height:42vh}.p162-picker-option{padding:13px 12px}}
    `;
    document.head.appendChild(style);
  }

  function isPlacesMode() {
    const title = document.getElementById('pageTitle');
    return !!title && title.textContent.trim() === '地點管理';
  }

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

  function bindPlaceSearch(input) {
    input.oninput = function () {
      applyPlacesLayout(input.value);
    };
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
      filters.insertBefore(input, filters.firstChild);
      bindPlaceSearch(input);
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
      cards.forEach(card => { card.hidden = matched.indexOf(card) < 0; });

      if (!matched.length) {
        let empty = list.querySelector('.p162-search-empty');
        if (!empty) {
          empty = document.createElement('div');
          empty.className = 'card empty p162-search-empty';
          list.appendChild(empty);
        }
        empty.textContent = '找不到符合條件的地點。';
        return;
      }
      const oldEmpty = list.querySelector('.p162-search-empty');
      if (oldEmpty) oldEmpty.remove();

      const groups = new Map();
      matched.forEach(card => {
        const city = cardCity(card);
        if (!groups.has(city)) groups.set(city, []);
        groups.get(city).push(card);
      });

      Array.from(groups.keys()).sort(function (a, b) {
        if (a === '未分類') return 1;
        if (b === '未分類') return -1;
        return a.localeCompare(b, 'zh-Hant');
      }).forEach(city => {
        const section = document.createElement('section');
        section.className = 'p162-city-section';
        section.innerHTML = '<div class="p162-city-heading"><span>' + esc(city) + '</span><span class="p162-city-count">' + groups.get(city).length + '</span></div>';
        groups.get(city).forEach(card => section.appendChild(card));
        list.appendChild(section);
      });
    } finally {
      applying = false;
    }
  }

  function parseOption(option) {
    const text = String(option.textContent || '').trim();
    if (!option.value) return { id: '', city: '', name: text, search: text };
    const parts = text.split(' · ');
    const city = parts.length > 1 ? parts.shift().trim() : '';
    const name = parts.join(' · ').trim() || text;
    return { id: option.value, city: city || '未分類', name, search: [city, name, option.value].join(' ') };
  }

  function selectedHtml(item) {
    if (!item || !item.id) return '<div><strong>未指定地點</strong><div class="meta">可搜尋既有 Places</div></div>';
    return '<div><strong>' + esc(item.name) + '</strong><div class="meta">' + esc(item.city || '未分類') + '</div></div>';
  }

  function renderPickerResults(root, items, query) {
    const results = root.querySelector('.p162-picker-results');
    const needle = normalize(query);
    const filtered = items.filter(item => item.id && (!needle || normalize(item.search).includes(needle)));
    if (!filtered.length) {
      results.innerHTML = '<div class="p162-picker-empty">找不到符合條件的地點。</div>';
      return;
    }
    const groups = new Map();
    filtered.forEach(item => {
      if (!groups.has(item.city)) groups.set(item.city, []);
      groups.get(item.city).push(item);
    });
    let html = '';
    Array.from(groups.keys()).sort(function (a, b) {
      if (a === '未分類') return 1;
      if (b === '未分類') return -1;
      return a.localeCompare(b, 'zh-Hant');
    }).forEach(city => {
      html += '<div class="p162-picker-city">' + esc(city) + '</div>';
      groups.get(city).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')).forEach(item => {
        html += '<button type="button" class="p162-picker-option" data-place-id="' + esc(item.id) + '"><strong>' + esc(item.name) + '</strong><span class="meta">' + esc(item.city) + '</span></button>';
      });
    });
    results.innerHTML = html;
  }

  function enhanceItineraryPicker() {
    const formTitle = document.getElementById('formTitle');
    const select = document.getElementById('f_place_id');
    if (!formTitle || !select || !/行程$/.test(formTitle.textContent.trim())) return;
    if (select.closest('.' + PICKER_CLASS)) return;

    const field = select.closest('.field');
    if (!field) return;
    field.classList.add('full', PICKER_CLASS);

    const options = Array.from(select.options).map(parseOption);
    const current = options.find(item => item.id === select.value) || options[0];
    const shell = document.createElement('div');
    shell.className = 'p162-picker-ui';
    shell.innerHTML = '<div class="p162-picker-selected"><div class="p162-selected-copy">' + selectedHtml(current) + '</div><button type="button" class="p162-picker-clear" aria-label="清除地點">清除</button></div><input type="search" class="p162-picker-search" placeholder="搜尋地點、城市或名稱…" autocomplete="off"><div class="p162-picker-results"></div>';
    select.insertAdjacentElement('afterend', shell);

    const search = shell.querySelector('.p162-picker-search');
    const selectedCopy = shell.querySelector('.p162-selected-copy');
    const clear = shell.querySelector('.p162-picker-clear');
    renderPickerResults(shell, options, '');

    search.oninput = () => renderPickerResults(shell, options, search.value);
    shell.onclick = function (event) {
      const button = event.target.closest('[data-place-id]');
      if (!button) return;
      select.value = button.dataset.placeId;
      const chosen = options.find(item => item.id === select.value);
      selectedCopy.innerHTML = selectedHtml(chosen);
      search.value = '';
      renderPickerResults(shell, options, '');
    };
    clear.onclick = function () {
      select.value = '';
      selectedCopy.innerHTML = selectedHtml(options[0]);
      search.value = '';
      renderPickerResults(shell, options, '');
    };
  }

  function apply() {
    installStyles();
    const input = ensurePlaceSearch();
    if (input && placeCards().length) applyPlacesLayout(input.value);
    enhanceItineraryPicker();
  }

  const observer = new MutationObserver(function () {
    if (applying) return;
    requestAnimationFrame(apply);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  apply();

  window.TRAVEL_PLANNER_ADMIN_PLACE_UX = Object.freeze({ version: 'P16.2' });
})();