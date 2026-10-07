/* Small page-level refinements; all original chapters keep their own behavior. */
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.header');
    const syncHeader = () => {
      if (header) document.documentElement.style.setProperty('--site-header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
    };
    syncHeader();
    const headerObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(syncHeader) : null;
    headerObserver?.observe(header);

    // The original large bitmaps are needed only if the live SVG enhancement fails.
    const desktop = matchMedia('(min-width: 1280px)');
    function restoreCloudFallback() {
      if (!desktop.matches) return;
      document.querySelectorAll('.word-cloud-container[data-fallback-src]').forEach(host => {
        if (host.classList.contains('wc-live') || host.querySelector('img')) return;
        const image = document.createElement('img');
        image.className = 'word-cloud-img'; image.alt = host.dataset.fallbackAlt;
        image.loading = 'lazy'; image.decoding = 'async'; image.src = host.dataset.fallbackSrc;
        host.append(image);
      });
    }
    restoreCloudFallback(); desktop.addEventListener('change', restoreCloudFallback);

    const embed = document.getElementById('timeChartEmbed');
    const status = document.getElementById('timeChartStatus');
    const link = document.getElementById('timeChartLink');
    let phase = 'pending', timeout = 0, disposed = false;
    const messages = {
      zh: { pending: '动态图将在进入视野后加载。', loading: '正在加载动态图…', failed: '动态图暂时无法加载，可以打开完整图表继续查看。', link: '打开完整动态图 ↗' },
      en: { pending: 'The animated chart loads when it comes into view.', loading: 'Loading the animated chart…', failed: 'The animated chart is unavailable here. Open the full chart to continue.', link: 'Open the full animated chart ↗' }
    };
    function translate() {
      const lang = window.i18n?.getLang() === 'en' ? 'en' : 'zh';
      if (status) { status.hidden = phase === 'ready'; status.textContent = messages[lang][phase] || ''; }
      if (link) link.textContent = messages[lang].link;
      const search = document.getElementById('searchInput');
      search?.setAttribute('aria-label', lang === 'en' ? 'Search gaming terms' : '查询黑话');
    }
    function finish(next) { if (disposed) return; clearTimeout(timeout); phase = next; translate(); }
    const frames = new WeakSet();
    function observeFrame() {
      const frame = embed?.querySelector('iframe');
      if (!frame || frames.has(frame)) return;
      frames.add(frame);
      frame.title = 'Gaming term categories · Flourish';
      frame.addEventListener('load', () => finish('ready'), { once: true });
      frame.addEventListener('error', () => finish('failed'), { once: true });
    }
    const frameObserver = embed ? new MutationObserver(observeFrame) : null;
    function loadEmbed() {
      if (!embed || phase !== 'pending' || disposed) return;
      phase = 'loading'; translate();
      frameObserver.observe(embed, { childList: true, subtree: true });
      timeout = setTimeout(() => finish('failed'), 15000);
      const script = document.createElement('script');
      script.src = 'https://public.flourish.studio/resources/embed.js'; script.async = true;
      script.addEventListener('error', () => finish('failed'), { once: true });
      embed.append(script);
    }
    const embedObserver = embed && typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { embedObserver.disconnect(); loadEmbed(); }
    }, { rootMargin: '300px' }) : null;
    if (embedObserver) embedObserver.observe(embed); else loadEmbed();
    translate();
    window.addEventListener('languagechange', translate);
    window.addEventListener('pagehide', event => {
      if (event.persisted) return;
      disposed = true; clearTimeout(timeout); headerObserver?.disconnect(); frameObserver?.disconnect(); embedObserver?.disconnect();
      desktop.removeEventListener('change', restoreCloudFallback);
      window.removeEventListener('languagechange', translate);
    });
  }, { once: true });
})();
