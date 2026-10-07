/* The original homepage artwork and effects, with only small motion/lifecycle fixes. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let counterFrame = 0;
  window.addEventListener('dictionary-updated', event => {
    const target = document.getElementById('totalSlangs');
    if (!target || !Number.isFinite(event.detail?.count)) return;
    cancelAnimationFrame(counterFrame);
    const count = event.detail.count;
    const start = Number.parseInt(target.textContent, 10) || 0;
    const began = performance.now();
    const tick = now => {
      const p = reduced.matches ? 1 : Math.max(0, Math.min(1, (now - began) / 600));
      target.textContent = `${Math.round(start + (count - start) * (1 - (1 - p) ** 3))}`;
      if (p < 1) counterFrame = requestAnimationFrame(tick);
    };
    counterFrame = requestAnimationFrame(tick);
  });
  function initManagedCursor() {
    window.GameCursor?.destroy?.();
    const cursor = document.querySelector('.custom-cursor');
    if (!cursor) return;
    const mode = matchMedia('(hover: hover) and (pointer: fine)');
    const records = new Map(), controlDisposers = [];
    const interactiveSelector = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,label[for],[role="button"],[role="link"],[role="option"],[role="menuitem"],[role="tab"],[role="checkbox"],[role="radio"],[role="switch"],[role="slider"],[contenteditable="true"],[draggable="true"],[data-action],.slang-card,.dna-option,.rank-item';
    const managedStyle = '@media (hover:hover) and (pointer:fine){html.gc-cursor-managed,html.gc-cursor-managed *{cursor:none!important}html.gc-cursor-managed dialog[open],html.gc-cursor-managed dialog[open] *{cursor:auto!important}}';
    let active = false, disposed = false, suspended = false, frame = 0, revision = 0, pending = null, lastRecord = null;
    cursor.setAttribute('aria-hidden', 'true');
    function listen(target, type, handler, options, disposers) {
      target.addEventListener(type, handler, options);
      disposers.push(() => { try { target.removeEventListener(type, handler, options); } catch (_) {} });
    }
    function hide() {
      revision += 1;
      cancelAnimationFrame(frame); frame = 0; pending = null; lastRecord = null;
      cursor.classList.remove('gc-visible', 'hover');
    }
    function point(record, x, y) {
      while (record.parentFrame) {
        const element = record.parentFrame.element;
        const box = element.getBoundingClientRect();
        if (!element.offsetWidth || !element.offsetHeight || !box.width || !box.height) return null;
        const styles = record.parentFrame.owner.doc.defaultView.getComputedStyle(element);
        x = box.left + (element.clientLeft + (parseFloat(styles.paddingLeft) || 0) + x) * box.width / element.offsetWidth;
        y = box.top + (element.clientTop + (parseFloat(styles.paddingTop) || 0) + y) * box.height / element.offsetHeight;
        record = record.parentFrame.owner;
      }
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    }
    function update(record, event) {
      if (!active || disposed || suspended || document.hidden || !record.active) return;
      if (event.pointerType && event.pointerType !== 'mouse') { hide(); return; }
      let target = event.target?.nodeType === 3 ? event.target.parentElement : event.target;
      if (!target?.closest) { hide(); return; }
      // Native dialogs occupy the browser top layer above every parent fixed overlay.
      if (target.closest('dialog[open]')) { hide(); return; }
      const nested = target.closest('iframe');
      if (nested && !record.frames.get(nested)?.child) { hide(); return; }
      pending = { record, x: event.clientX, y: event.clientY, target };
      if (frame) return;
      const version = revision;
      frame = requestAnimationFrame(() => {
        if (version !== revision || !active || disposed || suspended) return;
        frame = 0;
        const sample = pending; pending = null;
        if (!sample?.record.active || document.hidden) { hide(); return; }
        let position;
        try { position = point(sample.record, sample.x, sample.y); } catch (_) { hide(); return; }
        if (!position) { hide(); return; }
        const control = sample.target.closest(interactiveSelector);
        const interactive = Boolean(control && !control.disabled && control.getAttribute('aria-disabled') !== 'true');
        cursor.style.left = `${position.x}px`;
        cursor.style.top = `${position.y}px`;
        lastRecord = sample.record;
        cursor.classList.toggle('hover', interactive);
        cursor.classList.add('gc-visible');
      });
    }
    function detach(record) {
      if (!record?.active) return;
      record.active = false;
      record.observer?.disconnect();
      for (const binding of [...record.frames.values()]) untrackFrame(binding);
      record.disposers.forEach(dispose => dispose());
      record.style?.remove();
      record.doc.documentElement.classList.remove('gc-cursor-managed');
      records.delete(record.doc);
      if (pending?.record === record || lastRecord === record) hide();
    }
    function untrackFrame(binding) {
      binding.element.removeEventListener('load', binding.load);
      detach(binding.child);
      binding.owner.frames.delete(binding.element);
    }
    function trackFrame(owner, element) {
      if (owner.frames.has(element)) return;
      const binding = { owner, element, child: null, load: null };
      binding.load = () => {
        detach(binding.child); binding.child = null;
        if (!active || disposed || !owner.active) return;
        try {
          const child = element.contentWindow, doc = element.contentDocument;
          if (!doc || !child || location.origin === 'null' || child.location.origin !== location.origin) return;
          binding.child = attach(doc, binding);
        } catch (_) { /* Cross-origin frames retain their native cursor. */ }
      };
      owner.frames.set(element, binding);
      element.addEventListener('load', binding.load);
      binding.load();
    }
    function scan(record, node) {
      if (node.matches?.('iframe')) trackFrame(record, node);
      node.querySelectorAll?.('iframe').forEach(element => trackFrame(record, element));
    }
    function attach(doc, parentFrame = null) {
      if (records.has(doc)) return records.get(doc);
      const record = { doc, parentFrame, active: true, frames: new Map(), disposers: [], observer: null, style: null };
      records.set(doc, record);
      if (parentFrame) {
        const style = doc.createElement('style');
        style.setAttribute('data-game-cursor-style', ''); style.textContent = managedStyle;
        (doc.head || doc.documentElement).appendChild(style); record.style = style;
      }
      doc.documentElement.classList.add('gc-cursor-managed');
      const move = event => update(record, event);
      // HTML drag and drop suppresses pointermove; observe dragover without changing drop behavior.
      for (const name of ['pointermove', 'pointerover', 'pointerdown', 'dragover']) listen(doc, name, move, { passive: true }, record.disposers);
      listen(doc, 'dragend', hide, { passive: true }, record.disposers);
      listen(doc, 'pointerout', event => { if (!event.relatedTarget) hide(); }, { passive: true }, record.disposers);
      if (typeof MutationObserver === 'function') {
        record.observer = new MutationObserver(changes => {
          if (!active || !record.active) return;
          for (const change of changes) for (const node of change.addedNodes) scan(record, node);
          for (const binding of [...record.frames.values()]) if (!binding.element.isConnected) untrackFrame(binding);
        });
        record.observer.observe(doc.documentElement, { childList: true, subtree: true });
      }
      scan(record, doc);
      return record;
    }
    function disable() {
      active = false; hide();
      for (const record of [...records.values()]) detach(record);
    }
    function refresh() {
      if (disposed || suspended) return;
      if (!mode.matches) { disable(); return; }
      if (!active) { active = true; attach(document); }
    }
    function destroy() {
      if (disposed) return;
      disposed = true; disable(); controlDisposers.forEach(dispose => dispose());
      controlDisposers.length = 0;
    }
    listen(mode, 'change', refresh, undefined, controlDisposers);
    listen(document, 'visibilitychange', () => { if (document.hidden) hide(); }, undefined, controlDisposers);
    listen(window, 'blur', () => { if (!document.hasFocus()) hide(); }, undefined, controlDisposers);
    listen(window, 'pagehide', event => { if (event.persisted) { suspended = true; disable(); } else destroy(); }, undefined, controlDisposers);
    listen(window, 'pageshow', () => { suspended = false; refresh(); }, undefined, controlDisposers);
    window.GameCursor = { destroy, refresh, getState: () => ({ active, documents: records.size, pendingFrame: Boolean(frame), visible: cursor.classList.contains('gc-visible') }) };
    refresh();
  }
  document.addEventListener('DOMContentLoaded', () => {
    createBinaryBackground();
    createParticles();
    const pause = () => document.body.classList.toggle('page-effects-paused', document.hidden);
    document.addEventListener('visibilitychange', pause);
    pause();
    initManagedCursor();
  }, { once: true });
})();
