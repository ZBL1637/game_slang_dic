/* Bridges the three focused modules to the original static site. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let dictionaryReady = Promise.resolve();
  let loadRevision = 0;
  const cache = new Map();
  let featured = [];
  const featuredReady = fetch('assets/featured-terms.json').then(r => {
    if (!r.ok) throw new Error(`Featured terms HTTP ${r.status}`);
    return r.json();
  }).then(rows => { featured = rows; }).catch(error => console.warn('Featured term supplement:', error.message));
  window.getFeaturedSlangMatches = query => featured.filter(row =>
    row.term.toLowerCase() === String(query).trim().toLowerCase() && (currentGame === 'all' || row.game === currentGame)
  ).map(row => ({ slang: row.term, definition: row.definition[window.i18n?.getLang() || 'zh'], game: row.game, gameKey: row.game, color: gameDataConfig[row.game]?.color }));
  window.getDictionaryRows = function (lang) {
    if (!cache.has(lang)) cache.set(lang, fetch(lang === 'en' ? 'assets/data_en.json' : 'assets/combined_game_data.json').then(r => {
      if (!r.ok) throw new Error(`Dictionary HTTP ${r.status}`);
      return r.json();
    }).then(rows => rows.flatMap(row => {
      // Numeric slang such as 666/233 is valid when it has a definition.
      const term = typeof row.term === 'string' ? row.term.trim() : typeof row.term === 'number' && Number.isFinite(row.term) ? String(row.term) : '';
      return term && typeof row.definition === 'string' && row.definition.trim() ? [{ ...row, term, definition: row.definition.trim() }] : [];
    })).catch(error => { cache.delete(lang); throw error; }));
    return cache.get(lang);
  };
  window.dictionaryLoadVersion = () => ++loadRevision;
  window.dictionaryLoadIsCurrent = revision => revision === loadRevision;
  window.reloadFocusedDictionary = () => dictionaryReady = loadAllGameData();
  window.heroSearchTerm = async (term, game = 'all') => {
    // A language switch may replace the in-flight promise; wait for its newest load.
    let pending;
    do { pending = dictionaryReady; await pending; } while (pending !== dictionaryReady);
    await featuredReady;
    const aliases = { 'LOL': '英雄联盟', 'League of Legends': '英雄联盟' };
    const key = aliases[game] || game;
    currentGame = Object.hasOwn(allGameData, key) ? key : 'all';
    const selector = document.getElementById('game-select');
    if (selector) selector.value = currentGame;
    updateCurrentData();
    document.getElementById('search-section')?.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
    aiSearchTerm(term);
  };
  function bridgeQuiz() {
    const iframe = document.querySelector('.dna-test-module iframe');
    if (!iframe) return;
    let current = null, observer = null, heightFrame = 0, revision = 0, lastHeight = 0, disposed = false;
    const childDisposers = [];
    function releaseDocument() {
      revision += 1;
      cancelAnimationFrame(heightFrame);
      heightFrame = 0;
      observer?.disconnect();
      observer = null;
      childDisposers.splice(0).forEach(dispose => {
        try { dispose(); } catch (_) { /* A navigated WindowProxy may no longer be same-origin. */ }
      });
      current = null;
      lastHeight = 0;
    }
    function sameOriginDocument() {
      try {
        const child = iframe.contentWindow, doc = iframe.contentDocument;
        if (!child || !doc || location.origin === 'null' || child.location.origin !== location.origin) return null;
        const container = doc.getElementById('dnaContainer');
        return container ? { child, doc, container } : null;
      } catch (_) { return null; }
    }
    function requestHeight() {
      if (disposed || !current || heightFrame) return;
      const snapshot = current, version = revision;
      heightFrame = requestAnimationFrame(() => {
        if (disposed || current !== snapshot || version !== revision) return;
        heightFrame = 0;
        try {
          if (iframe.contentDocument !== snapshot.doc || snapshot.child.location.origin !== location.origin) return;
          // Container geometry can shrink after a result resets; document.scrollHeight cannot.
          const bottom = snapshot.container.getBoundingClientRect().bottom + snapshot.child.scrollY;
          const margin = parseFloat(snapshot.child.getComputedStyle(snapshot.container).marginBottom) || 0;
          const measured = Math.ceil(bottom + margin);
          if (!Number.isFinite(measured) || measured <= 0) return;
          const next = Math.max(360, Math.min(18000, measured));
          if (next !== lastHeight) { lastHeight = next; iframe.style.height = `${next}px`; }
        } catch (_) { /* The iframe may have navigated since this frame was queued. */ }
      });
    }
    function sendLanguage() {
      if (disposed || !current) return;
      try {
        if (current.child.location.origin !== location.origin || iframe.contentDocument !== current.doc) return;
        const lang = window.i18n?.getLang() === 'en' ? 'en' : 'zh';
        const childI18n = current.child.i18n;
        if (childI18n?.setLang && childI18n.getLang?.() !== lang) childI18n.setLang(lang);
      } catch (_) { /* Keep the exact original DNA files usable without a parent bridge. */ }
      requestHeight();
    }
    function attachDocument() {
      if (disposed) return;
      releaseDocument();
      current = sameOriginDocument();
      if (!current) return;
      const { child, doc, container } = current;
      const listenChild = (target, type, handler, options) => {
        target.addEventListener(type, handler, options);
        childDisposers.push(() => target.removeEventListener(type, handler, options));
      };
      // The original quiz uses its own i18n languagechange event, not postMessage.
      sendLanguage();
      if (typeof ResizeObserver === 'function') {
        observer = new ResizeObserver(requestHeight);
        observer.observe(container);
      }
      listenChild(child, 'languagechange', requestHeight);
      listenChild(doc, 'click', requestHeight, true);
      const version = revision;
      doc.fonts?.ready.then(() => { if (!disposed && version === revision) requestHeight(); });
      requestHeight();
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      releaseDocument();
      iframe.removeEventListener('load', attachDocument);
      window.removeEventListener('languagechange', sendLanguage);
      window.removeEventListener('resize', requestHeight);
      window.removeEventListener('pagehide', pagehide);
      window.removeEventListener('pageshow', attachDocument);
    }
    function pagehide(event) {
      if (event.persisted) releaseDocument();
      else dispose();
    }
    iframe.addEventListener('load', attachDocument);
    window.addEventListener('languagechange', sendLanguage);
    window.addEventListener('resize', requestHeight, { passive: true });
    window.addEventListener('pagehide', pagehide);
    window.addEventListener('pageshow', attachDocument);
    attachDocument();
  }
  function revealOriginalSections() {
    const targets = document.querySelectorAll('.chart-item,.timeline-title,.timeline-era,.timeline-event,.floating-words-section,.floating-container,.search-section,.search-interface,.search-container,.popular-words');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('animate-in'); observer.unobserve(entry.target); }
    }), { threshold: 0, rootMargin: '80px' });
    targets.forEach(target => observer.observe(target));
    document.querySelectorAll('.timeline-event').forEach(event => event.addEventListener('click', () => {
      document.querySelector('.timeline-event.active')?.classList.remove('active');
      event.classList.add('active');
    }));
  }
  document.addEventListener('DOMContentLoaded', () => {
    bridgeQuiz();
    revealOriginalSections();
    for (const name of ['createTermDistributionChart', 'createGameSentimentCharts', 'createTermSentimentRadarChart', 'createMultiGameRadarCharts']) {
      try { window[name]?.(); } catch (error) { console.error(name, error); }
    }
    document.querySelectorAll('.section-photo img').forEach(img => { img.loading = 'lazy'; img.decoding = 'async'; });
    dictionaryReady = Promise.all([loadAllGameData(), featuredReady]).then(() => { createFloatingWords(); initAISearchFunction(); });
    // The scanner owns its resize layout and preserves the selected term.
  });
})();
