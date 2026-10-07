/* Shared presentation for the original four charts. Source numbers stay in chart1–4. */
(function (global) {
  'use strict';
  const palette = ['#a881df', '#e282bb', '#678fda', '#59b4bb', '#c291e4', '#df6c99', '#6c75c8', '#89bedb', '#9064bd', '#bd77be'];
  const sentimentKeys = ['中性', '正面', '负面'];
  const sentimentColors = ['#a881df', '#59b4bb', '#ec7eb0'];
  const categoryKeys = ['交流/指挥类', '地图/副本类', '机制类', '物品/装备类', '玩家/群体标签', '社交类/梗类', '经济交易类', '职业类', '行为类', '跨游戏通用语'];
  const shortNames = {
    zh: ['交流/指挥', '地图/副本', '机制', '物品/装备', '玩家标签', '社交/梗', '经济交易', '职业', '行为', '跨游戏'],
    en: ['Team\ncomms', 'Maps /\ndungeons', 'Mechanics', 'Items /\ngear', 'Player\ntags', 'Social /\nmemes', 'Trading', 'Classes', 'Actions', 'Cross-game']
  };
  const selections = new Map(), factories = new Map(), mounted = new Map();
  let suspended = [];
  const locale = () => global.i18n?.getLang() === 'en' ? 'en' : 'zh';
  const tr = (zh, en) => locale() === 'en' ? en : zh;
  const game = value => global.i18n?.tGame(value) || value;
  const category = value => global.i18n?.tCategory(value === '物品类' ? '物品/装备类' : value) || value;
  const sentiment = value => ({ 中性: tr('中性', 'Neutral'), 正面: tr('正面', 'Positive'), 负面: tr('负面', 'Negative') })[value];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const percent = (value, scale = 1) => (Number(value) * scale).toLocaleString(locale() === 'en' ? 'en-US' : 'zh-CN', { maximumFractionDigits: 2 }) + '%';
  const compact = () => (global.innerWidth || 1200) < 700;
  const reduceMotion = () => Boolean(global.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const motion = () => ({ animation: !reduceMotion(), animationDuration: 280, animationDurationUpdate: 160, animationEasing: 'cubicOut' });
  function tooltip(formatter, trigger = 'item') {
    return { trigger, confine: true, backgroundColor: 'rgba(23,15,37,.98)', borderColor: '#765687', borderWidth: 1,
      padding: [10, 12], textStyle: { color: '#f4edf8', fontFamily: 'Inter, sans-serif', fontSize: 12 },
      extraCssText: 'max-width:min(320px,100%);box-sizing:border-box;white-space:normal;overflow-wrap:anywhere;box-shadow:0 8px 28px rgba(0,0,0,.35);', formatter };
  }
  function radarTooltip(params, labels) {
    const values = params?.value || params?.data?.value;
    if (!Array.isArray(values)) return '';
    return '<strong>' + escape(params.seriesName || params.name || params.data?.name || '') + '</strong><br>' +
      labels.map((label, index) => escape(label) + ': <b>' + escape(percent(values[index] ?? 0, 100)) + '</b>').join('<br>');
  }
  function radarGeometry(keys, width, height = 310, max = 1, radiusLimit = 155) {
    const numbered = width < 420;
    return {
      indicator: keys.map((key, index) => ({ name: numbered ? String(index + 1) : shortNames[locale()][categoryKeys.indexOf(key === '物品类' ? '物品/装备类' : key)] || category(key), max })),
      center: ['50%', '50%'], radius: Math.max(36, Math.min(numbered ? width / 2 - 30 : width / 2 - 92, height / 2 - 36, radiusLimit)),
      nameGap: numbered ? 8 : 10, axisName: { color: '#eae0f3', fontSize: numbered ? 12 : 11, lineHeight: 14 },
      startAngle: 90, splitNumber: 4, shape: 'polygon',
      splitLine: { lineStyle: { color: 'rgba(204,178,224,.24)', width: 1 } },
      splitArea: { areaStyle: { color: ['rgba(137,88,176,.04)', 'rgba(137,88,176,.09)'] } },
      axisLine: { lineStyle: { color: 'rgba(204,178,224,.23)' } }
    };
  }
  function radarOption(keys, series, width, height = 310, radiusLimit = 155) {
    const labels = keys.map(category);
    return { ...motion(), textStyle: { fontFamily: 'Inter, sans-serif' },
      aria: { enabled: true, description: tr('雷达图；完整百分比见下方数据明细。', 'Radar chart. Exact percentages are available in the data table below.') },
      tooltip: tooltip(params => radarTooltip(params, labels)), radar: radarGeometry(keys, width, height, 1, radiusLimit),
      series: series.map((row, index) => ({ name: row.name, type: 'radar', symbol: ['circle', 'diamond', 'rect'][index % 3], symbolSize: 4,
        data: [{ name: row.name, value: row.values.slice(), itemStyle: { color: row.color },
          lineStyle: { color: row.color, width: 2.5, type: ['solid', 'dashed', 'dotted'][index % 3] }, areaStyle: { color: row.color, opacity: .1 } }] })) };
  }
  function pieOption(row) {
    return { ...motion(), color: sentimentColors.slice(), textStyle: { fontFamily: 'Inter, sans-serif' },
      aria: { enabled: true, description: tr('圆环图；图下列出三类情感的原始百分比。', 'Donut chart. All three source percentages are listed below.') },
      tooltip: tooltip(params => escape(game(row.game)) + '<br>' + escape(params.name) + ': <b>' + escape(percent(params.value)) + '</b>'),
      series: [{ name: game(row.game), type: 'pie', radius: ['46%', '73%'], center: ['50%', '50%'],
        label: { show: false }, labelLine: { show: false },
        itemStyle: { borderColor: '#171020', borderWidth: 2 },
        emphasis: { scaleSize: 4 },
        data: sentimentKeys.map((key, index) => ({ name: sentiment(key), value: row[key], itemStyle: { color: sentimentColors[index] } })) }] };
  }
  function barOption(rows, small) {
    const keys = Object.keys(rows[0]).filter(key => key !== '游戏');
    return { ...motion(), color: palette.slice(), textStyle: { fontFamily: 'Inter, sans-serif' },
      aria: { enabled: true, description: tr('14款游戏的词条类别构成；使用下方明细查看准确百分比。', 'Term categories across 14 games. Use the data table below for exact percentages.') },
      tooltip: { ...tooltip(params => {
        if (!params?.length) return '';
        return '<strong>' + escape(game(params[0].axisValue)) + '</strong><br>' + params.map(p => escape(p.seriesName) + ': <b>' + escape(percent(p.value, 100)) + '</b>').join('<br>');
      }, 'axis'), axisPointer: { type: 'shadow' } },
      legend: { show: false },
      grid: { top: 18, right: 12, left: 8, bottom: small ? 82 : 58, containLabel: true },
      xAxis: { type: 'category', data: rows.map(row => row['游戏']), axisLabel: { interval: 0, hideOverlap: false, color: '#ded3eb', fontSize: small ? 10 : 11,
        rotate: small ? 0 : 28, formatter: raw => {
          const label = game(raw);
          return small && /[\u3400-\u9fff]/.test(label) && label.length > 4 ? label.slice(0, 3) + '\n' + label.slice(3) : label.replace(/ /g, '\n');
        } }, axisLine: { lineStyle: { color: '#816a96' } }, axisTick: { alignWithLabel: true } },
      yAxis: { type: 'value', min: 0, max: 1, interval: .25, axisLabel: { color: '#ded3eb', fontSize: 11, formatter: value => percent(value, 100) }, splitLine: { lineStyle: { color: 'rgba(193,159,219,.16)' } } },
      dataZoom: [{ id: 'games-slider', type: 'slider', show: small, xAxisIndex: 0, bottom: 6, height: 22, startValue: 0, endValue: small ? 3 : rows.length - 1,
        zoomLock: true, brushSelect: false, showDetail: false, borderColor: '#614d75', fillerColor: 'rgba(168,129,223,.23)', handleStyle: { color: '#ac87db' }, textStyle: { color: '#e7d9f4' } },
        { id: 'games-inside', type: 'inside', xAxisIndex: 0, disabled: !small, zoomOnMouseWheel: false, moveOnMouseWheel: false, moveOnMouseMove: true, preventDefaultMouseMove: false, startValue: 0, endValue: small ? 3 : rows.length - 1 }],
      series: keys.map((key, index) => ({ name: category(key), type: 'bar', stack: 'total', barMaxWidth: 54,
        data: rows.map(row => row[key]), itemStyle: { color: palette[index] }, emphasis: { focus: 'series' } })) };
  }
  function element(tag, className, text) {
    const node = global.document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function on(scope, target, type, callback) {
    target.addEventListener(type, callback);
    scope.cleanup(() => target.removeEventListener(type, callback));
  }
  function prepare(id, title, count) {
    const root = global.document.getElementById(id);
    if (!root || !global.GameChartLifecycle) return null;
    const scope = global.GameChartLifecycle.begin(id);
    const previous = global.echarts?.getInstanceByDom?.(root);
    if (previous && !previous.isDisposed?.()) previous.dispose();
    root.replaceChildren(); root.classList.add('lc-root'); root.style.height = 'auto'; root.style.minHeight = '0';
    root.setAttribute('role', 'group'); root.setAttribute('aria-label', title);
    const heading = element('h3', 'lc-title', title); root.appendChild(heading);
    if (count) root.appendChild(element('p', 'lc-scope', tr('本图覆盖 ' + count + ' 款游戏', 'This chart covers ' + count + ' games')));
    mounted.set(id, { root, scope });
    scope.cleanup(() => { if (mounted.get(id)?.scope === scope) mounted.delete(id); });
    scope.observe(root);
    return { root, scope };
  }
  function initChart(scope, node, option) {
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', tr('图表，准确数值见下方明细', 'Chart; exact values are available in the data below'));
    let chart;
    try {
      chart = scope.track(global.echarts.init(node, null, { renderer: 'canvas', devicePixelRatio: Math.min(global.devicePixelRatio || 1, 2) }));
      chart.setOption(option); return chart;
    } catch (_) {
      if (chart) scope.release(chart);
      node.replaceChildren(); node.classList.add('lc-unavailable'); node.style.height = 'auto';
      node.setAttribute('role', 'status');
      node.textContent = tr('图形暂不可用，可查看下方数值。', 'The chart is unavailable. Exact values remain available below.');
      return null;
    }
  }
  function addLegend(root, names, colors) {
    const list = element('ul', 'lc-legend');
    names.forEach((name, index) => {
      const item = element('li'); const dot = element('span', 'lc-swatch'); dot.style.backgroundColor = colors[index]; dot.setAttribute('aria-hidden', 'true');
      item.append(dot, element('span', '', name)); list.appendChild(item);
    }); root.appendChild(list); return list;
  }
  function axisKey(root, keys, width) {
    const list = element('ol', 'lc-axis-key');
    keys.forEach(key => list.appendChild(element('li', '', category(key))));
    list.hidden = width >= 420; root.appendChild(list); return list;
  }
  function makeTable(caption, columns, rows) {
    const box = element('div', 'lc-table-wrap'); box.tabIndex = 0; box.setAttribute('role', 'region'); box.setAttribute('aria-label', caption);
    const table = element('table', 'lc-table'); table.appendChild(element('caption', '', caption));
    const head = element('thead'), header = element('tr');
    columns.forEach(label => { const cell = element('th', '', label); cell.setAttribute('scope', 'col'); header.appendChild(cell); });
    head.appendChild(header); table.appendChild(head); const body = element('tbody');
    rows.forEach(row => { const line = element('tr'); row.forEach((value, index) => { const cell = element(index ? 'td' : 'th', '', value); if (!index) cell.setAttribute('scope', 'row'); line.appendChild(cell); }); body.appendChild(line); });
    table.appendChild(body); box.appendChild(table); return box;
  }
  function details(root, title) {
    const node = element('details', 'lc-details'); node.appendChild(element('summary', '', title || tr('查看数据明细', 'View exact values'))); root.appendChild(node); return node;
  }
  function gameSelect(scope, root, id, rows, value, callback, includeAll) {
    const control = element('div', 'lc-controls'), label = element('label', '', tr('选择游戏', 'Choose a game'));
    const select = element('select'); select.id = id; label.htmlFor = id;
    if (includeAll) { const option = element('option', '', tr('全部 ' + rows.length + ' 款游戏', 'All ' + rows.length + ' games')); option.value = 'all'; select.appendChild(option); }
    rows.forEach(row => { const key = row.game || row['游戏'], option = element('option', '', game(key)); option.value = key; select.appendChild(option); });
    select.value = value; control.append(label, select); root.appendChild(control);
    on(scope, select, 'change', () => callback(select.value)); return select;
  }
  function mountBar(id, rows) {
    const host = prepare(id, tr('游戏术语分类分布', 'Term categories by game'), rows.length); if (!host) return;
    const { root, scope } = host, keys = Object.keys(rows[0]).filter(key => key !== '游戏');
    addLegend(root, keys.map(category), palette);
    root.appendChild(element('p', 'lc-hint', tr('手机可拖动下方范围条浏览全部游戏；明细支持逐游戏查阅。', 'On a phone, drag the range control to browse every game. The table lets you inspect each game.')));
    const canvas = element('div', 'lc-canvas lc-bar'); root.appendChild(canvas);
    let small = compact(); const chart = initChart(scope, canvas, barOption(rows, small));
    const data = details(root), selected = selections.get(id) || rows[0]['游戏']; let table;
    function show(key) {
      selections.set(id, key); if (table) table.remove();
      const row = rows.find(item => item['游戏'] === key) || rows[0];
      table = makeTable(game(row['游戏']), [tr('词条类别', 'Category'), tr('占比', 'Share')], keys.map(categoryKey => [category(categoryKey), percent(row[categoryKey], 100)])); data.appendChild(table);
    }
    gameSelect(scope, data, id + '-data-game', rows, selected, show, false); show(selected);
    scope.beforeResize(() => {
      const next = compact(); if (next !== small) { small = next; chart?.setOption(barOption(rows, small), true); }
    }); return chart;
  }
  function mountSentiment(id, rows) {
    const host = prepare(id, tr('术语类别情感分布', 'Sentiment by term category')); if (!host) return;
    const { root, scope } = host, keys = rows.map(row => row['术语类别']);
    addLegend(root, sentimentKeys.map(sentiment), sentimentColors);
    const canvas = element('div', 'lc-canvas lc-radar'); root.appendChild(canvas);
    const width = canvas.clientWidth || root.clientWidth || 300;
    const height = width >= 700 ? 500 : 310, radiusLimit = width >= 700 ? 220 : 155;
    canvas.style.height = height + 'px';
    const series = sentimentKeys.map((key, index) => ({ name: sentiment(key), values: rows.map(row => row[key]), color: sentimentColors[index] }));
    const chart = initChart(scope, canvas, radarOption(keys, series, width, height, radiusLimit));
    const key = axisKey(root, keys, width);
    details(root).appendChild(makeTable(tr('各类别的情感占比', 'Sentiment shares within each category'), [tr('词条类别', 'Category'), ...sentimentKeys.map(sentiment)],
      rows.map(row => [category(row['术语类别']), ...sentimentKeys.map(s => percent(row[s], 100))])));
    scope.beforeResize(() => {
      const width = canvas.clientWidth || root.clientWidth || 300, height = width >= 700 ? 500 : 310;
      key.hidden = width >= 420;
      if (chart) { canvas.style.height = height + 'px'; chart.setOption({ radar: radarGeometry(keys, width, height, 1, width >= 700 ? 220 : 155) }); }
    }); return chart;
  }
  function mountGames(id, rows, kind) {
    const isPie = kind === 'pie', host = prepare(id, isPie ? tr('游戏情感分布', 'Sentiment by game') : tr('多游戏术语分类雷达图', 'Term categories across games'), rows.length); if (!host) return;
    const { root, scope } = host;
    let state = selections.get(id); if (!state || typeof state !== 'object') { state = { value: compact() ? (rows[0].game || rows[0]['游戏']) : 'all', automatic: true }; selections.set(id, state); }
    if (isPie) addLegend(root, sentimentKeys.map(sentiment), sentimentColors);
    const status = element('p', 'lc-scope'); status.setAttribute('role', 'status');
    const select = gameSelect(scope, root, id + '-game', rows, state.value, value => { state.value = value; state.automatic = false; draw(); }, true);
    root.appendChild(status);
    const grid = element('div', 'lc-game-grid'); root.appendChild(grid); let children = [], previousCompact = compact();
    function draw() {
      children.forEach(child => scope.release(child.chart)); children = []; grid.replaceChildren();
      const visible = state.value === 'all' ? rows : rows.filter(row => (row.game || row['游戏']) === state.value);
      grid.classList.toggle('lc-one', visible.length === 1);
      status.textContent = state.value === 'all' ? tr('显示全部 ' + rows.length + ' 款游戏', 'Showing all ' + rows.length + ' games') : tr('当前显示：', 'Showing: ') + game(state.value);
      visible.forEach(row => {
        const rawName = row.game || row['游戏'], card = element('section', 'lc-game-card'); card.appendChild(element('h4', '', game(rawName))); grid.appendChild(card);
        const canvas = element('div', 'lc-canvas ' + (isPie ? 'lc-donut' : 'lc-radar')); card.appendChild(canvas);
        const width = canvas.clientWidth || card.clientWidth || root.clientWidth || 300;
        if (isPie) {
          const chart = initChart(scope, canvas, pieOption(row)); children.push({ chart });
          const values = element('dl', 'lc-values'); sentimentKeys.forEach((key, index) => {
            const line = element('div'), label = element('dt', '', sentiment(key)); label.style.color = sentimentColors[index]; line.append(label, element('dd', '', percent(row[key]))); values.appendChild(line);
          }); card.appendChild(values);
        } else {
          const keys = Object.keys(row).filter(key => key !== '游戏'), values = keys.map(key => row[key]);
          const chart = initChart(scope, canvas, radarOption(keys, [{ name: game(rawName), values, color: '#b18ae1' }], width));
          const key = axisKey(card, keys, width); children.push({ chart, canvas, key, keys });
          details(card).appendChild(makeTable(game(rawName), [tr('词条类别', 'Category'), tr('占比', 'Share')], keys.map(key => [category(key), percent(row[key], 100)])));
        }
      });
    }
    draw();
    scope.beforeResize(() => {
      const next = compact();
      if (next !== previousCompact && state.automatic) { state.value = next ? (rows[0].game || rows[0]['游戏']) : 'all'; select.value = state.value; draw(); }
      previousCompact = next;
      children.forEach(child => { if (!child.canvas) return; const width = child.canvas.clientWidth || root.clientWidth || 300; child.key.hidden = width >= 420; child.chart?.setOption({ radar: radarGeometry(child.keys, width) }); });
    });
  }
  function register(id, factory) { factories.set(id, factory); }
  function redraw() { Array.from(mounted.keys()).forEach(id => factories.get(id)?.()); }
  function pagehide() { suspended = Array.from(mounted.keys()); Array.from(mounted.values()).forEach(({ scope }) => scope.dispose()); }
  function pageshow(event) { if (!event.persisted) return; const ids = suspended; suspended = []; ids.forEach(id => factories.get(id)?.()); }
  const api = { palette, sentimentColors, percent, radarTooltip, radarGeometry, radarOption, pieOption, barOption, mountBar, mountSentiment, mountGames, register };
  global.LegacyChartUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global.document) {
    global.addEventListener('languagechange', redraw); global.addEventListener('pagehide', pagehide); global.addEventListener('pageshow', pageshow);
    const media = global.matchMedia?.('(prefers-reduced-motion: reduce)'); media?.addEventListener?.('change', redraw);
  }
})(typeof window !== 'undefined' ? window : globalThis);
