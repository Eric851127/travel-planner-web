/* Traveler smart-date + group display helpers. Runtime core ownership lives in p16-runtime-core.js. */
(function () {
  function localIsoDate() {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  }

  function smartTripDate(dates) {
    const sorted = [...new Set((dates || []).filter(Boolean))].sort();
    if (!sorted.length) return '';
    const today = localIsoDate();
    if (today <= sorted[0]) return sorted[0];
    if (today >= sorted[sorted.length - 1]) return sorted[sorted.length - 1];
    if (sorted.includes(today)) return today;
    return sorted.find(d => d >= today) || sorted[sorted.length - 1];
  }

  window.travelPlannerSmartTripDate = smartTripDate;
  window.travelPlannerGroupLabel = value => ({all:'全部', ours:'郭小鼠組', friends:'阿香組'}[value] || value || '');

  function relabel(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      let text = node.nodeValue;
      text = text.replace(/我們/g, '郭小鼠組').replace(/朋友/g, '阿香組');
      if (text !== node.nodeValue) node.nodeValue = text;
    });
  }

  relabel(document.body);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) relabel(node.parentNode);
    else if (node.nodeType === Node.ELEMENT_NODE) relabel(node);
  }))).observe(document.body, {childList:true, subtree:true});
})();