/* Fixed, readable word layouts; motion never changes vocabulary or page content. */
(() => {
  'use strict';
  const ns = 'http://www.w3.org/2000/svg';
  // Labels come from the original artwork and the project's Chinese vocabulary.
  // Font size is editorial emphasis, not a newly calculated frequency metric.
  const clouds = [
    { selector: '.word-cloud-left', name: '三角洲行动', key: 'delta', words: [
      ['三角洲',180,34,19], ['绝密',180,73,34],
      ['机密',120,105,20], ['航天',245,107,22], ['预火',64,104,17], ['瞬狙',297,109,17],
      ['跑刀',108,151,42], ['撤离',247,152,38],
      ['封烟',62,195,18], ['大红',175,195,26], ['老鼠',277,196,23],
      ['架枪',47,231,21], ['预瞄',113,232,20], ['压枪',188,231,26], ['拉枪线',278,232,19],
      ['补枪',44,268,18], ['对枪',109,267,24], ['报点',182,269,21], ['听声辨位',279,269,18],
      ['探头',43,304,18], ['卡视角',112,304,20], ['交叉火力',209,304,18], ['开黑',302,303,20],
      ['静步',64,339,18], ['残血',137,339,21], ['卡角',210,339,18], ['Rush',285,338,20],
      ['一穿二',116,370,17], ['战术撤退',237,370,17],
      ['控图',19,191,16,-90], ['占点',337,220,16,90], ['爆头',325,156,16,90]
    ] },
    { selector: '.word-cloud-right', name: '英雄联盟', key: 'league', words: [
      ['英雄联盟',180,29,19], ['控视野',139,62,21], ['反蹲',230,64,18],
      ['ADC',60,101,26], ['游走',155,95,23], ['TP',242,103,22], ['QWER',311,106,16,6],
      ['Gank',107,142,38], ['开团',251,145,37],
      ['越塔',47,188,20], ['走A',124,190,26], ['控龙',224,192,28], ['反打',310,189,18],
      ['控线',38,227,19], ['拉扯',121,234,38], ['团战',246,232,31], ['R闪',323,230,19],
      ['带线',54,270,23], ['四保一',148,277,21], ['空大',229,277,23], ['神装',304,270,20],
      ['刮痧',72,307,21], ['我能反杀',178,316,25], ['暴毙',283,309,19],
      ['复活甲',83,343,18], ['经济差',179,352,18], ['上大分',274,343,20],
      ['一套带走',152,378,17], ['坐牢',245,377,17],
      ['肉装',15,151,16,-90], ['穿甲装',344,302,16,90], ['泉水挂机',301,66,15]
    ] }
  ];
  const make = (tag, attrs = {}, text) => {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text != null) node.textContent = text;
    return node;
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const records = [];
  const disposers = [];
  const on = (target, event, listener, options) => {
    target.addEventListener(event, listener, options);
    disposers.push(() => target.removeEventListener(event, listener, options));
  };
  const clear = record => {
    cancelAnimationFrame(record.frame);
    record.frame = 0;
    record.host.style.setProperty('--wc-x', '0px');
    record.host.style.setProperty('--wc-y', '0px');
    for (const word of record.words) word.classList.remove('wc-near');
  };
  for (const config of clouds) {
    const host = document.querySelector(config.selector);
    if (!host || host.classList.contains('wc-live')) continue;
    const svg = make('svg', { viewBox: '0 0 360 405', class: 'wc-art', role: 'img', 'aria-labelledby': `wc-${config.key}-title wc-${config.key}-desc` });
    svg.append(make('title', { id: `wc-${config.key}-title` }, `${config.name}游戏黑话词云`));
    svg.append(make('desc', { id: `wc-${config.key}-desc` }, config.words.map(word => word[0]).join('、')));
    const emblem = make('g', { class: 'wc-emblem', 'aria-hidden': 'true' });
    if (config.key === 'delta') {
      emblem.append(make('path', { d: 'M180 63 L326 322 H34 Z', class: 'wc-outline' }));
      emblem.append(make('path', { d: 'M180 116 L286 303 H74 Z', class: 'wc-outline wc-outline-inner' }));
      emblem.append(make('path', { d: 'M180 161 L219 230 H141 Z M180 185 L158 221 H202 Z', class: 'wc-mark', 'fill-rule': 'evenodd' }));
    } else {
      emblem.append(make('circle', { cx: 180, cy: 211, r: 139, class: 'wc-outline' }));
      emblem.append(make('circle', { cx: 180, cy: 211, r: 128, class: 'wc-outline wc-outline-inner', 'stroke-dasharray': '105 28 30 20' }));
      emblem.append(make('path', { d: 'M153 138 H180 V247 H230 L218 277 H143 L153 259 Z', class: 'wc-mark' }));
    }
    svg.append(emblem);
    const layers = [0, 1, 2].map(depth => {
      const layer = make('g', { class: `wc-depth wc-depth-${depth}` });
      const drift = make('g', { class: `wc-drift wc-drift-${depth}` });
      layer.append(drift); svg.append(layer);
      return drift;
    });
    const words = config.words.map(([label, x, y, size, angle = 0], index) => {
      const depth = size >= 30 ? 2 : size >= 21 ? 1 : 0;
      const anchor = make('g', { transform: `translate(${x} ${y}) rotate(${angle})` });
      const word = make('text', { class: `wc-word wc-tone-${index % 3}`, 'font-size': size, 'font-weight': size >= 30 ? 750 : size >= 21 ? 600 : 450, 'data-wc-x': x, 'data-wc-y': y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'aria-hidden': 'true' }, label);
      anchor.append(word); layers[depth].append(anchor);
      return word;
    });
    host.append(svg);
    host.classList.add('wc-live', `wc-${config.key}`);
    // Keep the original image as a no-JavaScript fallback without duplicate alt text.
    const fallback = host.querySelector('.word-cloud-img');
    if (fallback) fallback.setAttribute('aria-hidden', 'true');
    const record = { host, words, frame: 0 };
    records.push(record);
    on(host, 'pointermove', event => {
      if (reduced.matches || !finePointer.matches || record.frame || document.hidden) return;
      const rect = host.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      record.frame = requestAnimationFrame(() => {
        host.style.setProperty('--wc-x', `${(x * 9).toFixed(2)}px`);
        host.style.setProperty('--wc-y', `${(y * 7).toFixed(2)}px`);
        record.frame = 0;
      });
    }, { passive: true });
    on(host, 'pointerover', event => {
      const target = event.target.closest?.('.wc-word');
      if (!target || !finePointer.matches) return;
      for (const word of words) {
        const distance = Math.hypot(Number(word.dataset.wcX) - Number(target.dataset.wcX), Number(word.dataset.wcY) - Number(target.dataset.wcY));
        word.classList.toggle('wc-near', word !== target && distance < 80);
      }
    });
    on(host, 'pointerout', event => {
      if (event.target.matches?.('.wc-word')) for (const word of words) word.classList.remove('wc-near');
    });
    on(host, 'pointerleave', () => clear(record));
  }
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      entry.target.classList.toggle('wc-offscreen', !entry.isIntersecting);
      if (!entry.isIntersecting) clear(records.find(record => record.host === entry.target));
    }
  }) : null;
  for (const record of records) observer?.observe(record.host);
  on(document, 'visibilitychange', () => { if (document.hidden) records.forEach(clear); });
  on(reduced, 'change', () => records.forEach(clear));
  on(finePointer, 'change', () => records.forEach(clear));
  on(window, 'pagehide', event => {
    records.forEach(clear);
    if (event.persisted) return;
    observer?.disconnect();
    disposers.forEach(dispose => dispose());
  });
})();
