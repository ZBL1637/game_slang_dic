/* Progressive enhancement for the history chapter. No scroll lock or external dependencies. */
(function (global) {
    'use strict';
    const order = ['arcade', 'party', 'chance', 'everyday'];
    // Editorial usage examples; cited sources support the comparison, not a unique origin.
    const examples = {
        pofang: {
            word: { zh: '破防', en: '破防 · pofang' },
            game: { zh: '这一击让对手破防了。', en: 'That hit broke through the opponent’s defense.' },
            daily: { zh: '看到这段告别，我破防了。', en: 'That farewell really got to me.' },
            note: { zh: '同一组字，从防御机制延伸到情绪体验；日常用法既可能是感动，也可能是受伤。', en: 'The same characters extend from a defense mechanic to an emotional experience. In everyday use, they can express being moved or hurt.' },
            source: {
                number: 5, href: 'https://www.cp.com.cn/Content/2021/12-08/1508424782.html',
                label: { zh: '查看“破防”的来源 [5]', en: 'Read the source for pofang [5]' }
            }
        },
        miaosha: {
            word: { zh: '秒杀', en: '秒杀 · miaosha' },
            game: { zh: '这个敌人被一招秒杀。', en: 'This enemy was defeated in a single hit.' },
            daily: { zh: '秒杀活动刚开始，这款商品就售罄了。', en: 'This item sold out as soon as the flash sale began.' },
            note: { zh: '保留“极快”的感受，场景从战斗扩展到购物。用法对照不等于唯一词源。', en: 'The sense of speed carries from combat into shopping. Comparing these uses does not establish a single origin.' },
            source: {
                number: 6, href: 'https://pdf.hanspub.org/ml2024127_312913487.pdf#page=3',
                label: { zh: '查看“秒杀”的来源 [6]', en: 'Read the source for miaosha [6]' }
            }
        }
    };

    function selectStep(rects, viewportHeight, readingRatio = .35) {
        const height = Number.isFinite(viewportHeight) ? Math.max(0, viewportHeight) : 0;
        const ratio = Number.isFinite(readingRatio) ? Math.max(0, Math.min(1, readingRatio)) : .35;
        const line = height * ratio;
        let selected = null, nearest = Infinity, selectedTop = -Infinity;
        for (const rect of Array.isArray(rects) ? rects : []) {
            if (!rect || !order.includes(rect.id) || !Number.isFinite(rect.top) || !Number.isFinite(rect.bottom) || rect.bottom < rect.top) continue;
            const distance = Math.max(rect.top - line, line - rect.bottom, 0);
            // If articles overlap, the later starting article owns their shared reading line.
            if (distance < nearest || distance === 0 && nearest === 0 && rect.top > selectedTop) {
                nearest = distance; selected = rect.id; selectedTop = rect.top;
            }
        }
        return selected;
    }

    const model = { order: [...order], examples, selectStep };
    global.GameSlangHistoryModel = model;
    if (typeof module !== 'undefined' && module.exports) module.exports = model;
    if (!global.document) return;
    global.GameSlangHistory?.destroy?.();

    let instance = null, hasMounted = false;
    let savedWord = 'pofang';
    function mount() {
        if (instance) return instance;
        const doc = global.document, section = doc.getElementById('slang-history');
        if (!section) return null;
        const articles = [...section.querySelectorAll('[data-history-step]')].filter(node => order.includes(node.dataset.historyStep));
        if (!articles.length) return null;
        const byStep = new Map(articles.map(node => [node.dataset.historyStep, node]));
        const scenes = [...section.querySelectorAll('[data-history-scene]')];
        const links = [...section.querySelectorAll('[data-history-nav]')];
        const wordButtons = [...section.querySelectorAll('[data-history-word]')];
        const outputs = [...section.querySelectorAll('[data-history-output]')];
        const reduced = global.matchMedia?.('(prefers-reduced-motion: reduce)');
        const removers = [];
        let activeStep = null, selectedWord = savedWord, frame = 0, disposed = false, resizeObserver = null;
        const locale = () => global.i18n?.getLang() === 'en' ? 'en' : 'zh';
        const listen = (target, type, callback, options) => {
            target?.addEventListener?.(type, callback, options);
            removers.push(() => target?.removeEventListener?.(type, callback, options));
        };
        function setActive(id) {
            if (!byStep.has(id)) return;
            activeStep = id; section.dataset.historyActive = id;
            for (const scene of scenes) scene.hidden = scene.dataset.historyScene !== id;
            for (const link of links) {
                const active = link.dataset.historyNav === id;
                link.classList?.toggle('is-active', active);
                if (active) link.setAttribute('aria-current', 'step'); else link.removeAttribute('aria-current');
            }
        }
        function measure() {
            if (disposed || doc.hidden) return;
            const rects = articles.map(article => {
                const rect = article.getBoundingClientRect();
                return { id: article.dataset.historyStep, top: rect.top, bottom: rect.bottom };
            });
            const next = selectStep(rects, global.innerHeight);
            if (next && next !== activeStep) setActive(next);
        }
        function scheduleMeasure() {
            if (disposed || doc.hidden || frame) return;
            frame = global.requestAnimationFrame(() => { frame = 0; measure(); });
        }
        function renderExample() {
            const example = examples[selectedWord] || examples.pofang, lang = locale();
            for (const button of wordButtons) button.setAttribute('aria-pressed', String(button.dataset.historyWord === selectedWord));
            for (const output of outputs) {
                const value = example[output.dataset.historyOutput];
                if (!value) continue;
                if (output.dataset.historyOutput === 'source') {
                    output.textContent = `[${value.number}]`;
                    output.setAttribute('href', value.href);
                    output.setAttribute('aria-label', value.label[lang] ?? value.label.zh);
                } else output.textContent = value[lang] ?? value.zh;
            }
            section.dataset.historyWord = selectedWord;
        }
        function translate() {
            const english = locale() === 'en';
            const bridge = doc.getElementById('history-culture-bridge');
            const leaves = [...section.querySelectorAll('[data-hx-zh][data-hx-en]'), ...(bridge?.querySelectorAll('[data-hx-zh][data-hx-en]') || [])];
            for (const leaf of leaves) leaf.textContent = english ? leaf.dataset.hxEn : leaf.dataset.hxZh;
            for (const node of section.querySelectorAll('[data-hx-aria-zh][data-hx-aria-en]')) node.setAttribute('aria-label', english ? node.dataset.hxAriaEn : node.dataset.hxAriaZh);
            renderExample(); scheduleMeasure();
        }
        function hashStep() {
            let hash;
            try { hash = decodeURIComponent(global.location?.hash || ''); } catch (_) { return null; }
            const id = hash.startsWith('#history-') ? hash.slice(9) : null;
            return byStep.has(id) ? id : null;
        }
        function scrollToStep(id, initial = false) {
            const article = byStep.get(id); if (!article) return;
            article.scrollIntoView({ block: 'start', behavior: initial || reduced?.matches ? 'instant' : 'smooth' });
            scheduleMeasure();
        }
        for (const link of links) listen(link, 'click', event => {
            const id = link.dataset.historyNav;
            if (!byStep.has(id) || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
                || event.button != null && event.button !== 0 || link.getAttribute('target') === '_blank') return;
            event.preventDefault();
            const hash = `#history-${id}`;
            if (global.location?.hash !== hash) {
                try { global.history?.pushState?.(null, '', hash); } catch (_) { /* Anchor remains readable if history is restricted. */ }
            }
            scrollToStep(id);
        });
        for (const button of wordButtons) listen(button, 'click', () => {
            const id = button.dataset.historyWord; if (!Object.prototype.hasOwnProperty.call(examples, id)) return;
            selectedWord = id; savedWord = id; renderExample(); scheduleMeasure();
        });
        listen(global, 'scroll', scheduleMeasure, { passive: true });
        listen(global, 'resize', scheduleMeasure, { passive: true });
        // Native fragment/history scrolling remains authoritative; measure its final viewport.
        listen(global, 'hashchange', scheduleMeasure);
        listen(global, 'popstate', scheduleMeasure);
        listen(global, 'load', scheduleMeasure);
        listen(global, 'languagechange', translate);
        listen(doc, 'visibilitychange', () => {
            if (doc.hidden) { global.cancelAnimationFrame(frame); frame = 0; } else scheduleMeasure();
        });
        if (typeof global.ResizeObserver === 'function') {
            resizeObserver = new global.ResizeObserver(scheduleMeasure); resizeObserver.observe(section);
        }
        doc.fonts?.ready?.then(() => { if (!disposed) scheduleMeasure(); });
        listen(doc.fonts, 'loadingdone', scheduleMeasure);
        function destroy() {
            if (disposed) return;
            disposed = true; savedWord = selectedWord;
            global.cancelAnimationFrame(frame); frame = 0; resizeObserver?.disconnect();
            removers.forEach(remove => remove()); instance = null;
        }
        listen(global, 'pagehide', destroy);
        const api = { destroy, refresh: scheduleMeasure, getState: () => ({ activeStep, selectedWord, disposed, pendingFrame: Boolean(frame) }) };
        instance = api;
        setActive(articles[0].dataset.historyStep); translate();
        // A BFCache restore uses its restored scroll position, not an older hash.
        if (!hasMounted) { const initial = hashStep(); if (initial) { setActive(initial); scrollToStep(initial, true); } }
        hasMounted = true; scheduleMeasure(); return api;
    }
    const resume = event => { if (event.persisted) mount(); };
    global.addEventListener('pageshow', resume);
    global.GameSlangHistory = {
        mount, getState: () => instance?.getState() || null,
        destroy() {
            global.document.removeEventListener('DOMContentLoaded', mount);
            global.removeEventListener('pageshow', resume);
            instance?.destroy();
        }
    };
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', mount, { once: true });
    else mount();
})(typeof window !== 'undefined' ? window : globalThis);
