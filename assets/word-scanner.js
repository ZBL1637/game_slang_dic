/* Pointer-driven word scanning, with no continuously running JavaScript animation. */
(() => {
  'use strict';
  window.WordScanner?.destroy?.();
  const instances = new Map();
  let nextId = 0;

  function createController(field) {
    const core = window.WordScannerCore;
    if (!core) throw new Error('Load word-scanner-core.js before word-scanner.js.');
    const doc = field.ownerDocument, win = doc.defaultView, board = field.parentElement;
    const fine = win.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
    const disposers = [], buttons = new Map();
    const originalHeight = field.style.height, id = `ws-detail-${++nextId}`;
    let options = {}, groups = [], pool = [], shown = [], layoutItems = [], signature = '';
    let scannedKey = null, pinnedKey = null, focusAfterPosition = null;
    let destroyed = false, suspended = false, visible = typeof win.IntersectionObserver !== 'function';
    let pointerInside = false, pointerSample = null, focusTargeted = false, lastWidth = -1, epoch = 0;
    let scanFrame = 0, layoutFrame = 0, detailFrame = 0, statusTimer = 0;

    const make = (tag, className, text) => {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const text = (zh, en) => options.lang === 'en' ? en : zh;
    const header = make('div', 'ws-header'), label = make('p', 'ws-label'), hint = make('p', 'ws-hint');
    const status = make('p', 'ws-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
    header.append(label, hint, status);
    const atmosphere = make('div', 'ws-atmosphere'), lens = make('div', 'ws-lens'), lock = make('div', 'ws-lock');
    for (const node of [atmosphere, lens, lock]) node.setAttribute('aria-hidden', 'true');
    atmosphere.style.pointerEvents = 'none';
    const holoBase = make('div', 'ws-holo-base'), holoReveal = make('div', 'ws-holo-reveal');
    const holoFlow = make('div', 'ws-holo-flow'), holoSparks = make('div', 'ws-holo-sparks');
    for (const [x, y, delay] of [[14, 28, -.4], [82, 19, -3.1], [31, 74, -1.8], [72, 66, -4.7], [52, 12, -2.4], [91, 82, -5.8]]) {
      const spark = make('span');
      spark.style.setProperty('--spark-x', `${x}%`); spark.style.setProperty('--spark-y', `${y}%`);
      spark.style.setProperty('--spark-delay', `${delay}s`); holoSparks.appendChild(spark);
    }
    atmosphere.append(holoBase, holoReveal, holoFlow, holoSparks);
    lens.hidden = true; lock.hidden = true;
    const detail = make('section', 'word-tooltip ws-detail'); detail.id = id; detail.hidden = true;
    detail.setAttribute('role', 'dialog'); detail.setAttribute('aria-modal', 'false');
    const detailHead = make('div', 'ws-detail-head'), detailTitle = make('h3', 'ws-detail-title'); detailTitle.id = `${id}-title`;
    detail.setAttribute('aria-labelledby', detailTitle.id);
    const closeButton = make('button', 'ws-detail-close', '×'); closeButton.type = 'button';
    const detailList = make('div', 'ws-detail-list'); detailHead.append(detailTitle, closeButton); detail.append(detailHead, detailList);
    board.classList.add('ws-board'); field.classList.add('ws-field');
    board.insertBefore(header, field); field.append(atmosphere, lens, lock); doc.body.appendChild(detail);

    function listen(target, type, handler, settings) {
      target.addEventListener(type, handler, settings);
      disposers.push(() => target.removeEventListener(type, handler, settings));
    }
    function termFor(key) { return groups.find(group => group.key === key)?.term || ''; }
    function buttonFor(target) {
      const node = target?.closest?.('.ws-word');
      return node && field.contains(node) ? node : null;
    }
    function writeStatus() {
      const next = pinnedKey
        ? text(`解析：${termFor(pinnedKey)} · 点击空白收起`, `Reading: ${termFor(pinnedKey)} · Click outside to close`)
        : scannedKey
          ? text(`锁定：${termFor(scannedKey)} · 点击解析`, `Locked: ${termFor(scannedKey)} · Click to read`)
          : text('等待扫描', 'Ready to scan');
      if (status.textContent !== next) status.textContent = next;
    }
    function announce(immediate = false) {
      win.clearTimeout(statusTimer); statusTimer = 0;
      if (immediate) { writeStatus(); return; }
      const version = epoch;
      statusTimer = win.setTimeout(() => {
        if (version !== epoch || destroyed || suspended) return;
        statusTimer = 0;
        writeStatus();
      }, 140);
    }
    function syncSelection() {
      const active = pinnedKey || scannedKey;
      const effectsVisible = !destroyed && !suspended && visible && !doc.hidden;
      for (const [key, button] of buttons) {
        button.classList.toggle('is-scanned', key === active);
        button.setAttribute('aria-expanded', String(key === pinnedKey));
      }
      const item = layoutItems.find(card => card.id === active);
      lock.hidden = !item;
      if (item) {
        lock.style.left = `${item.x - 8}px`; lock.style.top = `${item.y - 8}px`;
        lock.style.width = `${item.width + 16}px`; lock.style.height = `${item.height + 16}px`;
      }
      board.classList.toggle('ws-pinned', Boolean(pinnedKey));
      lens.hidden = !effectsVisible || !pointerInside || Boolean(pinnedKey) || !fine.matches || focusTargeted;
      board.classList.toggle('ws-pointer', !lens.hidden);
      const targeted = effectsVisible && Boolean(item) && (Boolean(pinnedKey) || focusTargeted || !fine.matches || !pointerInside);
      board.classList.toggle('ws-targeted', targeted);
      if (targeted) positionAtmosphere(item.x + item.width / 2, item.y + item.height / 2);
    }
    function positionAtmosphere(x, y) {
      atmosphere.style.setProperty('--scan-x', `${x}px`); atmosphere.style.setProperty('--scan-y', `${y}px`);
    }
    function scan(key, immediate = false) {
      if (pinnedKey || key === scannedKey) return;
      scannedKey = buttons.has(key) ? key : null;
      syncSelection(); announce(immediate);
    }
    function stopPointer() {
      pointerInside = false; pointerSample = null;
      win.cancelAnimationFrame(scanFrame); scanFrame = 0;
      if (!pinnedKey) scannedKey = buttonFor(doc.activeElement)?.dataset.key || null;
      syncSelection(); announce();
    }
    function scanPointer() {
      if (!pointerSample || !pointerInside || pinnedKey || !fine.matches || destroyed || suspended || doc.hidden || !visible) return;
      const rect = field.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.max(0, Math.min(field.clientWidth, (pointerSample.x - rect.left) * field.clientWidth / rect.width));
      const y = Math.max(0, Math.min(field.clientHeight, (pointerSample.y - rect.top) * field.clientHeight / rect.height));
      focusTargeted = false; positionAtmosphere(x, y);
      lens.style.transform = `translate3d(${x}px,${y}px,0)`;
      lens.hidden = false; board.classList.add('ws-pointer'); board.classList.remove('ws-targeted');
      scan(core.nearestCard({ x, y }, layoutItems, 68));
    }
    function queueScan(event) {
      if (!fine.matches || event.pointerType && event.pointerType !== 'mouse' || pinnedKey || destroyed || suspended || doc.hidden) return;
      pointerInside = true; pointerSample = { x: event.clientX, y: event.clientY };
      if (scanFrame) return;
      const version = epoch;
      scanFrame = win.requestAnimationFrame(() => {
        if (version !== epoch || destroyed) return;
        scanFrame = 0; scanPointer();
      });
    }
    function close(restoreFocus = false) {
      const source = buttons.get(pinnedKey);
      pinnedKey = null; focusAfterPosition = null; detail.hidden = true;
      scannedKey = source && source === doc.activeElement ? source.dataset.key : null;
      syncSelection(); announce(true);
      if (restoreFocus && source?.isConnected) source.focus({ preventScroll: true });
    }
    function gameLabel(entry, callback, fallback) {
      try { return String(callback?.(entry) || fallback || ''); } catch (_) { return String(fallback || ''); }
    }
    function renderDetail() {
      const group = groups.find(item => item.key === pinnedKey);
      if (!group) { close(); return; }
      detailTitle.textContent = group.term;
      detailList.replaceChildren(...group.entries.map(entry => {
        const item = make('article', 'ws-detail-entry');
        const definition = make('p', 'ws-definition', entry.definition || text('暂无释义', 'No definition yet'));
        const game = gameLabel(entry, options.getGame, entry.game || entry.gameKey);
        const category = gameLabel(entry, options.getCategory, '');
        item.append(definition, make('p', 'ws-source', [game, category].filter(Boolean).join(' · '))); return item;
      }));
      closeButton.setAttribute('aria-label', text('关闭释义', 'Close definition'));
      detail.hidden = false; detail.style.visibility = 'hidden'; queueDetail();
    }
    function open(key, keyboard = false) {
      if (!buttons.has(key) || destroyed || suspended || doc.hidden) return;
      pinnedKey = key; scannedKey = key; focusAfterPosition = keyboard ? key : null;
      renderDetail(); syncSelection(); announce(true);
    }
    function positionDetail() {
      if (!pinnedKey || destroyed || suspended || doc.hidden) return;
      const button = buttons.get(pinnedKey);
      if (!button?.isConnected) { close(); return; }
      const anchor = button.getBoundingClientRect(), width = win.innerWidth, height = win.innerHeight;
      if (anchor.bottom < 0 || anchor.top > height || anchor.right < 0 || anchor.left > width) {
        detail.hidden = true; focusAfterPosition = null; return;
      }
      detail.hidden = false; detail.style.maxWidth = `${Math.max(1, width - 24)}px`; detail.style.maxHeight = `${Math.max(1, height - 24)}px`;
      const box = detail.getBoundingClientRect();
      const placed = core.placePopover(anchor, { width: box.width, height: box.height }, { width, height, inset: 12 });
      detail.style.left = `${placed.x}px`; detail.style.top = `${placed.y}px`; detail.style.maxHeight = `${placed.maxHeight}px`; detail.style.visibility = '';
      if (focusAfterPosition === pinnedKey) { focusAfterPosition = null; closeButton.focus({ preventScroll: true }); }
    }
    function queueDetail() {
      if (detailFrame || !pinnedKey || destroyed || suspended) return;
      const version = epoch;
      detailFrame = win.requestAnimationFrame(() => {
        if (version !== epoch || destroyed) return;
        detailFrame = 0; positionDetail();
      });
    }
    function countFor(width) { return width < 600 ? 12 : 30; }
    function colorFor(group, index) {
      const colors = options.colors || {};
      const palette = Array.isArray(colors) ? colors : Object.values(colors);
      return (!Array.isArray(colors) && colors[group.entries[0]?.gameKey]) || palette[index % palette.length] || '#8B5CF6';
    }
    function renderWords(width) {
      const count = Math.min(groups.length, countFor(width));
      if (pool.length < count) pool.push(...core.sampleGroups(groups, count - pool.length, pool.map(item => item.key)));
      shown = pool.slice(0, count);
      if (pinnedKey && !shown.some(item => item.key === pinnedKey) && shown.length) {
        const fixed = pool.find(item => item.key === pinnedKey); if (fixed) shown[shown.length - 1] = fixed;
      }
      const wanted = new Set(shown.map(item => item.key));
      for (const [key, button] of buttons) if (!wanted.has(key)) { button.remove(); buttons.delete(key); }
      for (const [index, group] of shown.entries()) {
        let button = buttons.get(group.key);
        if (!button) {
          button = make('button', 'floating-word ws-word'); button.type = 'button'; button.dataset.key = group.key;
          button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', id); button.setAttribute('aria-expanded', 'false');
          button.appendChild(make('span', 'ws-word-face', group.term)); buttons.set(group.key, button);
        }
        button.style.setProperty('--word-color', colorFor(group, index));
        button.style.setProperty('--drift-scale', width < 600 ? '.5' : '1');
        button.style.setProperty('--drift-x', `${1.5 + (index % 4) * .5}px`);
        button.style.setProperty('--drift-y', `${5 + index % 4}px`);
        button.style.setProperty('--drift-direction', index % 2 ? 'reverse' : 'normal');
        button.style.setProperty('--drift-duration', `${9 + index % 6}s`);
        button.style.setProperty('--drift-delay', `${(-index * 1.73 - .4).toFixed(2)}s`);
        // Moving an existing focused DOM node can blur it, even within this field.
        if (button.parentElement !== field) field.appendChild(button);
      }
      field.querySelector('.ws-empty')?.remove();
      if (!shown.length) field.appendChild(make('p', 'ws-empty', text('当前分类暂时没有词条。', 'No terms in this category yet.')));
      if (pinnedKey && !buttons.has(pinnedKey)) close();
      if (scannedKey && !buttons.has(scannedKey)) scannedKey = null;
    }
    function layout() {
      if (destroyed || suspended || !field.clientWidth) return;
      const width = field.clientWidth, padding = width < 600 ? 16 : 32;
      lastWidth = width; renderWords(width);
      hint.textContent = width < 600 ? text('点击词条解析，点空白处收起', 'Tap a term to read. Tap outside to close.') : text('移动扫描，点击解析', 'Move to scan. Click to read.');
      const cards = shown.map(group => {
        const button = buttons.get(group.key); button.style.maxWidth = `${Math.max(1, width - padding * 2)}px`;
        return { id: group.key, width: button.offsetWidth, height: button.offsetHeight };
      });
      const cloud = core.layoutCloud(cards, width, { minHeight: width < 600 ? 500 : 560, padding, motion: width < 600 ? 6 : 8, gap: 8, seed: pool.map(item => item.key).join('|') });
      layoutItems = cloud.items;
      for (const item of layoutItems) { const button = buttons.get(item.id); button.style.left = `${item.x}px`; button.style.top = `${item.y}px`; }
      field.style.height = `${Math.max(120, cloud.height)}px`;
      syncSelection(); if (pinnedKey) positionDetail();
    }
    function queueLayout() {
      if (layoutFrame || destroyed || suspended) return;
      const version = epoch;
      layoutFrame = win.requestAnimationFrame(() => {
        if (version !== epoch || destroyed) return;
        layoutFrame = 0; layout();
      });
    }
    function cancelWork() {
      epoch += 1; focusAfterPosition = null;
      win.cancelAnimationFrame(scanFrame); win.cancelAnimationFrame(layoutFrame); win.cancelAnimationFrame(detailFrame);
      scanFrame = 0; layoutFrame = 0; detailFrame = 0;
      win.clearTimeout(statusTimer); statusTimer = 0;
    }
    function syncMotion() {
      board.classList.toggle('ws-paused', suspended || !visible || doc.hidden || reduced.matches);
      if (suspended || !visible || doc.hidden) {
        pointerInside = false; pointerSample = null; lens.hidden = true; board.classList.remove('ws-pointer');
        win.cancelAnimationFrame(scanFrame); scanFrame = 0;
        if (!pinnedKey) scannedKey = null;
        detail.hidden = true; syncSelection(); announce(true);
      } else { syncSelection(); queueDetail(); }
    }
    const resize = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(entries => {
      if (Math.abs(entries[0].contentRect.width - lastWidth) > .5) queueLayout();
    }) : null;
    const intersection = typeof win.IntersectionObserver === 'function' ? new win.IntersectionObserver(entries => {
      visible = entries[0].isIntersecting; syncMotion();
    }, { rootMargin: '80px' }) : null;
    function connect() { resize?.observe(field); intersection?.observe(board); }

    listen(field, 'pointermove', queueScan, { passive: true });
    listen(field, 'pointerleave', stopPointer, { passive: true });
    listen(field, 'focusin', event => {
      const button = buttonFor(event.target);
      if (button) {
        focusTargeted = true; pointerSample = null;
        win.cancelAnimationFrame(scanFrame); scanFrame = 0;
        if (pinnedKey || scannedKey === button.dataset.key) syncSelection();
        else scan(button.dataset.key, true);
      }
    });
    listen(field, 'focusout', event => {
      if (!pinnedKey && !pointerInside && !field.contains(event.relatedTarget)) scan(null, true);
    });
    listen(field, 'click', event => {
      const button = buttonFor(event.target);
      if (button) {
        if (pinnedKey === button.dataset.key) close(true);
        else open(button.dataset.key, event.detail === 0);
      } else if (pinnedKey) close(true);
      else if (pointerInside && scannedKey) open(scannedKey);
    });
    listen(closeButton, 'click', () => close(true));
    listen(doc, 'pointerdown', event => {
      if (pinnedKey && !field.contains(event.target) && !detail.contains(event.target)) close(true);
    }, { capture: true });
    listen(doc, 'keydown', event => { if (event.key === 'Escape' && pinnedKey) { event.preventDefault(); close(true); } });
    listen(win, 'resize', () => { queueLayout(); queueDetail(); }, { passive: true });
    listen(win, 'scroll', () => { if (pinnedKey) queueDetail(); else stopPointer(); }, { passive: true, capture: true });
    listen(doc, 'visibilitychange', syncMotion); listen(reduced, 'change', syncMotion);
    listen(fine, 'change', () => { if (!fine.matches) stopPointer(); });
    listen(win, 'pagehide', event => {
      if (!event.persisted) { destroy(); return; }
      suspended = true; cancelWork(); resize?.disconnect(); intersection?.disconnect(); syncMotion();
    });
    listen(win, 'pageshow', () => { if (!destroyed) { suspended = false; connect(); syncMotion(); queueLayout(); } });
    if (doc.fonts?.addEventListener) listen(doc.fonts, 'loadingdone', queueLayout);
    doc.fonts?.ready?.then(() => { if (!destroyed) queueLayout(); });

    function update(rows, nextOptions) {
      const nextGroups = core.groupRows(rows);
      const nextSignature = JSON.stringify([nextOptions.lang === 'en' ? 'en' : 'zh', nextGroups]);
      options = nextOptions; label.textContent = text('黑话扫描仪', 'Slang scanner');
      if (signature !== nextSignature) {
        close(); cancelWork(); pointerInside = false; pointerSample = null; focusTargeted = false; scannedKey = null;
        signature = nextSignature; groups = nextGroups; pool = core.sampleGroups(groups, countFor(field.clientWidth));
        for (const button of buttons.values()) button.remove(); buttons.clear(); layoutItems = [];
      } else if (pinnedKey) renderDetail();
      announce(true); queueLayout(); syncMotion();
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true; close(); cancelWork(); resize?.disconnect(); intersection?.disconnect(); disposers.forEach(dispose => dispose());
      header.remove(); detail.remove(); atmosphere.remove(); lens.remove(); lock.remove();
      for (const button of buttons.values()) button.remove(); buttons.clear(); field.querySelector('.ws-empty')?.remove();
      board.classList.remove('ws-board', 'ws-paused', 'ws-pointer', 'ws-targeted', 'ws-pinned'); field.classList.remove('ws-field'); field.style.height = originalHeight;
      instances.delete(field);
    }
    const api = { destroy, relayout: queueLayout, getState: () => ({ destroyed, suspended, scannedKey, pinnedKey,
      keys: shown.map(item => item.key), wordCount: buttons.size, pointerInside,
      pendingFrames: Number(Boolean(scanFrame)) + Number(Boolean(layoutFrame)) + Number(Boolean(detailFrame)) }) };
    connect(); syncMotion(); return { update, api };
  }
  window.WordScanner = {
    mount(container, rows, options = {}) {
      if (!container?.parentElement) return null;
      let instance = instances.get(container);
      if (!instance) { instance = createController(container); instances.set(container, instance); }
      instance.update(rows, options); return instance.api;
    },
    destroy(container) {
      if (container) instances.get(container)?.api.destroy();
      else [...instances.values()].forEach(instance => instance.api.destroy());
    }
  };
})();
