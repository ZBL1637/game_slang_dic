/* Local hierarchical data, independent ECharts view and native keyboard navigation. */
(function (global) {
    'use strict';
    // Distinct hues for the four categories; the largest branch stays purple.
    const PALETTE = ['#216d7e', '#ae3774', '#3c5aaf', '#7e42ad'];
    const numeric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    const number = (value, locale) => new Intl.NumberFormat(locale === 'en' ? 'en' : 'zh-CN').format(value);

    function normalizeData(raw) {
        let input = Array.isArray(raw) ? raw : raw && Array.isArray(raw.children) ? raw.children : [];
        // Match the reference component's optional single-root envelope.
        if (Array.isArray(raw) && input.length === 1 && Array.isArray(input[0]?.children)) input = input[0].children;
        function convert(list, parentId = null, depth = 1, topId = null) {
            return list.flatMap((source, index) => {
                if (!source || typeof source.name !== 'string' || !source.name.trim()) return [];
                const id = parentId === null ? String(index) : `${parentId}/${index}`;
                const children = Array.isArray(source.children) ? convert(source.children, id, depth + 1, topId ?? id) : [];
                const value = children.length ? children.reduce((sum, child) => sum + child.value, 0) : numeric(source.value);
                return [{ id, parentId, topId: topId ?? id, depth, name: source.name.trim(), value,
                    sourceValue: typeof source.value === 'number' && Number.isFinite(source.value) ? source.value : null,
                    leafCount: children.length ? children.reduce((sum, child) => sum + child.leafCount, 0) : 1,
                    ...(children.length ? { children } : {}) }];
            });
        }
        return convert(input);
    }

    function walk(nodes, visit) {
        for (const node of nodes) { visit(node); if (node.children) walk(node.children, visit); }
    }
    function findNode(nodes, id) {
        let found = null;
        walk(nodes, node => { if (node.id === id) found = node; });
        return found;
    }
    function summarize(nodes) {
        const names = new Set();
        const result = { categories: nodes.length, nodes: 0, leaves: 0, uniqueTerms: 0, weight: nodes.reduce((sum, node) => sum + node.value, 0), maxDepth: 0, unitWeights: 0, mismatches: [] };
        walk(nodes, node => {
            result.nodes += 1; result.maxDepth = Math.max(result.maxDepth, node.depth);
            if (!node.children) { result.leaves += 1; names.add(node.name); if (node.value === 1) result.unitWeights += 1; }
            if (node.sourceValue !== null && node.sourceValue !== node.value) result.mismatches.push(node.id);
        });
        result.uniqueTerms = names.size;
        return result;
    }
    function pathFor(nodes, node) {
        const path = [];
        for (let current = node; current; current = findNode(nodes, current.parentId)) path.unshift(current.name);
        return path;
    }
    function tint(hex, amount) {
        const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16));
        return '#' + channels.map(value => Math.round(value + (255 - value) * amount).toString(16).padStart(2, '0')).join('');
    }
    function chartData(nodes, roots = nodes, maxDepth = Infinity) {
        const colors = new Map(roots.map((node, index) => [node.id, PALETTE[index % PALETTE.length]]));
        const convert = list => list.map((node, index) => ({ id: node.id, name: node.name, value: node.value,
            itemStyle: { color: tint(colors.get(node.topId) || PALETTE[0], node.depth === 1 ? 0 : Math.min(.12, (node.depth - 1) * .035 + index % 3 * .01)) },
            ...(node.children && node.depth < maxDepth ? { children: convert(node.children) } : {}) }));
        return convert(nodes);
    }
    function buildOption(nodes, settings = {}) {
        const locale = settings.locale === 'en' ? 'en' : 'zh', compact = (settings.width || 900) < 600;
        const focus = findNode(nodes, settings.focusId), visible = focus?.children || nodes;
        const baseDepth = focus ? focus.depth : 0;
        let depth = 1; walk(visible, node => { depth = Math.max(depth, Math.min(3, node.depth - baseDepth)); });
        const levels = [{}];
        for (let level = 1; level <= depth; level += 1) levels.push({
            r0: `${17 + (level - 1) * 71 / depth}%`, r: `${17 + level * 71 / depth}%`,
            itemStyle: { borderColor: '#130b20', borderWidth: level === 1 ? 2 : 1 },
            label: { show: !(compact && level > 2), rotate: level === 1 ? 'tangential' : 'radial', position: 'inside',
                minAngle: compact ? 15 : level === 1 ? 10 : 8,
                fontSize: compact ? 10 : level === 1 ? 12 : 11, fontWeight: level === 1 ? 600 : 400 }
        });
        return {
            backgroundColor: 'transparent', color: PALETTE,
            animation: !settings.reducedMotion, animationDuration: 350, animationDurationUpdate: settings.reducedMotion ? 0 : 220,
            textStyle: { fontFamily: 'Inter, sans-serif', color: '#eee4fa' },
            aria: { enabled: true, label: { description: locale === 'en' ? 'Game slang categories. Use the category selector and term buttons to explore.' : '游戏黑话分类。可使用分类选择器和词条按钮逐层浏览。' } },
            tooltip: { trigger: 'item', confine: true, appendToBody: false, backgroundColor: 'rgba(17,8,28,.97)',
                borderColor: '#9864c6', textStyle: { color: '#f4eafd', fontFamily: 'Inter, sans-serif' },
                extraCssText: 'max-width: min(280px, 90vw); white-space: normal; overflow-wrap: anywhere;',
                formatter: params => {
                    const node = findNode(nodes, params?.data?.id);
                    const name = node?.name || (typeof params?.name === 'string' ? params.name : '');
                    const value = node?.value ?? numeric(params?.value);
                    return `${escapeHtml(name)}<br>${locale === 'en' ? 'Weight' : '频次权重'}: ${number(value, locale)}`;
                }
            },
            series: [{ id: 'slang-sunburst-series', type: 'sunburst', data: chartData(visible, nodes, baseDepth + 3),
                radius: ['17%', '88%'], center: ['50%', '50%'], sort: null, nodeClick: false,
                stillShowZeroSum: false, renderLabelForZeroData: false,
                itemStyle: { borderColor: '#130b20', borderWidth: 1, borderRadius: 0 },
                label: { color: '#ffffff', rotate: 'radial', position: 'inside', minAngle: compact ? 15 : 8,
                    overflow: 'truncate', width: compact ? 47 : 86, fontFamily: 'Inter, sans-serif' },
                labelLayout: { hideOverlap: true },
                emphasis: { focus: 'ancestor', itemStyle: { shadowBlur: 8, shadowColor: '#af77d050' } }, levels }]
        };
    }

    const model = { PALETTE: [...PALETTE], normalizeData, summarize, findNode, pathFor, chartData, buildOption, escapeHtml };
    global.GameSlangSunburstModel = model;
    if (typeof module !== 'undefined' && module.exports) module.exports = model;
    if (!global.document) return;

    global.GameSlangSunburst?.destroy?.();
    let instance = null;
    function mount() {
        if (instance) return instance;
        const doc = global.document, panel = doc.getElementById('slang-sunburst-panel');
        if (!panel) return null;
        if (typeof global.IntersectionObserver !== 'function') panel.classList?.add('animate-in');
        const chartDom = doc.getElementById('slang-sunburst-chart'), status = doc.getElementById('slang-sunburst-status');
        const select = doc.getElementById('slang-sunburst-select'), reset = doc.getElementById('slang-sunburst-reset');
        const detail = doc.getElementById('slang-sunburst-detail'), legend = doc.getElementById('slang-sunburst-legend');
        if (![chartDom, status, select, reset, detail, legend].every(Boolean)) return null;
        const reduced = global.matchMedia?.('(prefers-reduced-motion: reduce)');
        const cleanups = [];
        let nodes = [], focusId = null, selectedId = null, chart = null, scope = null, observer = null;
        let state = 'idle', disposed = false, generation = 0, request = null;
        const locale = () => global.i18n?.getLang() === 'en' ? 'en' : 'zh';
        const tr = (zh, en) => locale() === 'en' ? en : zh;
        const element = (tag, className, text) => {
            const node = doc.createElement(tag); if (className) node.className = className;
            if (text !== undefined) node.textContent = text; return node;
        };
        const back = element('button', 'sunburst-center-button'); back.type = 'button';
        Object.assign(back.style, { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: '2' });
        chartDom.style.position = 'relative';
        function listen(target, type, callback) {
            target?.addEventListener?.(type, callback); cleanups.push(() => target?.removeEventListener?.(type, callback));
        }
        function setState(next) { state = next; panel.dataset.state = next; chartDom.dataset.state = next; }
        function staticText() {
            reset.textContent = state === 'error' ? tr('重试加载', 'Retry loading') : tr('恢复全景', 'Reset view');
            reset.disabled = state === 'loading'; select.disabled = !nodes.length || state !== 'ready';
            select.setAttribute('aria-label', tr('选择一级分类', 'Choose a main category'));
            back.textContent = focusId ? tr('返回', 'Back') : tr('总览', 'All'); back.disabled = !focusId;
            back.setAttribute('aria-label', tr('返回上一级分类', 'Return to the parent category'));
            if (state === 'idle') status.textContent = tr('进入此区域后加载分类图。', 'The chart loads when this section comes into view.');
            if (state === 'loading') status.textContent = tr('正在加载分类图…', 'Loading categories…');
            if (state === 'error') status.textContent = tr('分类图暂时无法加载，请重试。', 'The chart could not load. Please retry.');
        }
        function updateNavigation() {
            const focus = findNode(nodes, focusId), summary = summarize(nodes);
            const legendFocus = legend.contains(doc.activeElement) ? doc.activeElement?.dataset.nodeId : null;
            select.replaceChildren(element('option', '', tr('全部分类', 'All categories')), ...nodes.map(node => {
                const option = element('option', '', node.name); option.value = node.id; return option;
            }));
            select.options[0].value = ''; select.value = focus?.topId || '';
            legend.replaceChildren(...nodes.map((node, index) => {
                const button = element('button', 'sunburst-legend-item'); button.type = 'button'; button.dataset.nodeId = node.id;
                const dot = element('span', 'sunburst-legend-dot'); dot.style.backgroundColor = PALETTE[index % PALETTE.length]; dot.setAttribute('aria-hidden', 'true');
                button.append(dot, doc.createTextNode(node.name)); button.setAttribute('aria-pressed', String(focus?.topId === node.id)); return button;
            }));
            if (legendFocus) [...legend.children].find(button => button.dataset.nodeId === legendFocus)?.focus({ preventScroll: true });
            status.textContent = tr(`${number(summary.leaves, locale())} 个词条记录 · 当前：${focus?.name || '全部分类'}`,
                `${number(summary.leaves, locale())} term records · View: ${focus?.name || 'All categories'}`);
            staticText();
        }
        function updateDetail() {
            const hadFocus = detail.contains(doc.activeElement), oldFocusId = doc.activeElement?.dataset?.nodeId;
            const focus = findNode(nodes, focusId), selected = findNode(nodes, selectedId), current = selected || focus;
            const title = element('h3', 'sunburst-detail-title', current?.name || tr('浏览分类', 'Explore categories'));
            title.tabIndex = -1;
            const path = current ? pathFor(nodes, current).join(' › ') : tr('点击扇区或下面的分类逐层展开。', 'Select a sector or a category below to explore.');
            const parts = [title, element('p', 'sunburst-detail-path', path)];
            if (current) parts.push(element('p', 'sunburst-detail-weight', tr('频次权重：', 'Weight: ') + number(current.value, locale())));
            const children = selected ? [] : focus?.children || nodes;
            if (children.length) {
                const list = element('div', 'sunburst-node-list');
                for (const node of children) {
                    const button = element('button', 'sunburst-node-button'); button.type = 'button'; button.dataset.nodeId = node.id;
                    button.append(element('span', '', node.name), element('span', 'sunburst-node-weight', number(node.value, locale())));
                    button.setAttribute('aria-label', node.name + (node.children ? tr('，展开分类', ', expand category') : tr('，查看详情', ', view details'))); list.appendChild(button);
                }
                parts.push(list);
            }
            if (selected) {
                const button = element('button', 'sunburst-node-button', tr('返回本层词条', 'Back to this level')); button.type = 'button'; button.dataset.backToList = 'true'; parts.push(button);
            }
            detail.replaceChildren(...parts);
            if (hadFocus) {
                const restored = [...detail.querySelectorAll('button')].find(button => button.dataset.nodeId === oldFocusId);
                (restored || title).focus({ preventScroll: true });
            }
        }
        function choose(id) {
            const node = findNode(nodes, id); if (!node) return;
            if (node.children) { focusId = node.id; selectedId = null; render(); }
            else { selectedId = node.id; updateDetail(); }
        }
        function ensureChart() {
            if (chart && !chart.isDisposed?.()) return;
            if (!global.echarts?.init || !global.GameChartLifecycle?.begin) throw new Error('Chart runtime unavailable');
            scope = global.GameChartLifecycle.begin('slang-sunburst');
            global.echarts.getInstanceByDom?.(chartDom)?.dispose();
            chart = scope.track(global.echarts.init(chartDom, null, { renderer: 'canvas', devicePixelRatio: Math.min(global.devicePixelRatio || 1, 2) }));
            chart.on('click', params => { if (params?.data?.id) choose(params.data.id); });
            scope.beforeResize(() => { if (!disposed && nodes.length) render(); });
            chartDom.appendChild(back);
        }
        function render() {
            if (disposed || !nodes.length) return;
            ensureChart();
            chart.setOption(buildOption(nodes, { locale: locale(), width: chartDom.clientWidth || 900, focusId, reducedMotion: Boolean(reduced?.matches) }), { notMerge: true });
            setState('ready'); updateNavigation(); updateDetail();
        }
        async function load() {
            if (disposed || state === 'loading') return;
            const version = ++generation; request?.abort?.(); request = typeof global.AbortController === 'function' ? new global.AbortController() : null;
            setState('loading'); staticText();
            try {
                const response = await global.fetch('assets/data/sunburst_data.json', request ? { signal: request.signal } : undefined);
                if (!response.ok) throw new Error('Data request failed');
                const raw = await response.json(); if (disposed || version !== generation) return;
                nodes = normalizeData(raw); if (!nodes.length || summarize(nodes).weight <= 0) throw new Error('Empty category data');
                focusId = null; selectedId = null; render();
            } catch (_) {
                if (disposed || version !== generation) return;
                scope?.dispose(); scope = null; chart = null; back.remove(); setState('error'); staticText();
            }
        }
        listen(select, 'change', () => { focusId = findNode(nodes, select.value)?.id || null; selectedId = null; render(); });
        listen(reset, 'click', () => { if (state !== 'ready') load(); else { focusId = null; selectedId = null; render(); } });
        listen(back, 'click', () => { focusId = findNode(nodes, focusId)?.parentId || null; selectedId = null; render(); });
        const navigate = event => {
            const button = event.target?.closest?.('button');
            if (button?.dataset.backToList) { selectedId = null; updateDetail(); }
            else if (button?.dataset.nodeId) choose(button.dataset.nodeId);
        };
        listen(detail, 'click', navigate); listen(legend, 'click', navigate);
        listen(global, 'languagechange', () => { if (state === 'ready') render(); else staticText(); });
        listen(reduced, 'change', () => { if (state === 'ready') render(); });
        const api = { load, destroy, getState: () => ({ state, disposed, focusId, selectedId, summary: summarize(nodes) }) };
        function destroy() {
            if (disposed) return;
            disposed = true; generation += 1; request?.abort?.(); observer?.disconnect(); scope?.dispose();
            cleanups.forEach(cleanup => cleanup()); back.remove(); chart = null; scope = null; instance = null;
        }
        listen(global, 'pagehide', destroy);
        instance = api; setState('idle'); staticText();
        if (typeof global.IntersectionObserver === 'function') {
            observer = new global.IntersectionObserver(entries => {
                if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
            }, { rootMargin: '120px 0px' }); observer.observe(panel);
        } else load();
        return api;
    }
    const resume = event => { if (event.persisted) mount(); };
    global.addEventListener('pageshow', resume);
    global.GameSlangSunburst = { mount, destroy: () => {
        global.document.removeEventListener('DOMContentLoaded', mount);
        global.removeEventListener('pageshow', resume);
        instance?.destroy();
    }, getState: () => instance?.getState() || null };
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', mount, { once: true });
    else mount();
})(typeof window !== 'undefined' ? window : globalThis);
