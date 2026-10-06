import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const model = require('../assets/slang-sunburst.js');
const code = readFileSync(new URL('../assets/slang-sunburst.js', import.meta.url), 'utf8');
const lifecycleCode = readFileSync(new URL('../assets/chart-lifecycle.js', import.meta.url), 'utf8');
const raw = JSON.parse(readFileSync(new URL('../assets/data/sunburst_data.json', import.meta.url), 'utf8'));
const flatten = nodes => nodes.flatMap(node => [node, ...flatten(node.children || [])]);
const json = value => JSON.parse(JSON.stringify(value));

test('the copied source has four categories, 538 leaf records and additive weights without claiming the full dictionary', () => {
    const nodes = model.normalizeData(raw), summary = model.summarize(nodes);
    assert.deepEqual(summary, { categories: 4, nodes: 571, leaves: 538, uniqueTerms: 537,
        weight: 194480, maxDepth: 4, unitWeights: 303, mismatches: [] });
    assert.deepEqual(nodes.map(node => node.value), [47198, 3488, 29125, 114669]);
    const duplicates = flatten(nodes).filter(node => !node.children && node.name === '走位');
    assert.equal(duplicates.length, 2); assert.notEqual(duplicates[0].id, duplicates[1].id);
    assert.notDeepEqual(model.pathFor(nodes, duplicates[0]), model.pathFor(nodes, duplicates[1]));
});

test('normalization handles optional root envelopes and sanitizes malformed numbers without trusting parent totals', () => {
    assert.deepEqual(model.normalizeData([{ name: 'root', children: raw }]), model.normalizeData(raw));
    assert.deepEqual(model.normalizeData({ name: 'root', children: raw }), model.normalizeData(raw));
    assert.equal(model.normalizeData({ name: 'root', children: raw.slice(0, 1) })[0].name, raw[0].name);
    const input = [{ name: 'A', value: 999, children: [{ name: 'leaf', value: 5 }, { name: 'bad', value: '7' }] },
        { name: 'negative', value: -2 }, { name: '', value: 7 }, null];
    const before = structuredClone(input), normalized = model.normalizeData(input);
    assert.equal(normalized[0].value, 5); assert.equal(normalized[1].value, 0);
    assert.equal(model.summarize(normalized).weight, 5); assert.deepEqual(input, before);
    assert.deepEqual(model.normalizeData(null), []);
});

test('overview displays at most three rings while preserving deep branches for further drilling', () => {
    const nodes = model.normalizeData(raw), option = model.buildOption(nodes, { width: 900 });
    const visible = option.series[0].data, branch = flatten(nodes).find(node => node.name === '恋爱游戏' && node.children);
    const depthOf = (list, depth = 1) => Math.max(0, ...list.map(node => node.children ? depthOf(node.children, depth + 1) : depth));
    assert.equal(depthOf(visible), 3); assert.equal(option.series[0].levels.length, 4);
    assert.equal(flatten(visible).find(node => node.id === branch.id).children, undefined);
    assert.equal(branch.children.length, 5);
    const drilled = model.buildOption(nodes, { focusId: branch.id }).series[0].data;
    assert.deepEqual(drilled.map(node => node.name), branch.children.map(node => node.name));
    assert.equal(drilled.reduce((sum, node) => sum + node.value, 0), branch.value);
});

test('small-screen labels stay inside, first-ring labels are tangential and reduced motion is honored', () => {
    const nodes = model.normalizeData(raw), option = model.buildOption(nodes, { width: 390, locale: 'en', reducedMotion: true });
    assert.equal(option.animation, false); assert.equal(option.animationDurationUpdate, 0);
    assert.deepEqual(option.series[0].radius, ['17%', '88%']);
    assert.equal(option.series[0].levels[1].label.rotate, 'tangential');
    assert.ok(option.series[0].levels[1].label.minAngle >= 10);
    assert.equal(option.series[0].levels[3].label.show, false);
    assert.ok(option.series[0].levels.slice(1).every(level => level.label.position === 'inside'));
    assert.deepEqual(option.series[0].data.map(node => node.itemStyle.color), model.PALETTE);
    assert.equal(option.series[0].data[0].name, raw[0].name);
    assert.equal(option.tooltip.confine, true);
});

test('tooltip escapes markup and only prints finite source weights', () => {
    const nodes = model.normalizeData([{ name: '<img src=x onerror="run()">', value: 5 }, { name: 'plain', value: 1 }]);
    const format = model.buildOption(nodes).tooltip.formatter;
    const output = format({ data: { id: '0' } });
    assert.match(output, /&lt;img/); assert.doesNotMatch(output, /<img/); assert.match(output, /频次权重: 5/);
    assert.doesNotMatch(format({ name: 'x', value: Infinity }), /Infinity/);
    assert.equal(model.escapeHtml("<&\"'>"), '&lt;&amp;&quot;&#39;&gt;');
});

test('model loads in a browser-like VM without document, fetch or ECharts', () => {
    const sandbox = { window: {} }; vm.createContext(sandbox); vm.runInContext(code, sandbox);
    assert.equal(typeof sandbox.window.GameSlangSunburstModel.buildOption, 'function');
    assert.equal(sandbox.window.GameSlangSunburst, undefined);
});

function harness({ width = 900, intersection = true } = {}) {
    const targets = [], observers = [], frames = new Map(), timers = new Map(), requests = [], charts = [];
    let tick = 0, lang = 'zh';
    class Target {
        constructor() { this.listeners = new Map(); targets.push(this); }
        addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
        removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
        emit(type, event = {}) { for (const fn of [...this.listeners.get(type) || []]) fn({ target: this, ...event }); }
    }
    const doc = new Target(); doc.readyState = 'complete';
    class Element extends Target {
        constructor(tag = 'div') { super(); this.tag = tag; this.children = []; this.parentElement = null; this.style = {}; this.dataset = {}; this.attributes = {}; this.value = ''; this.disabled = false; this._text = ''; this.clientWidth = width;
            this.classes = new Set(); this.classList = { add: name => this.classes.add(name), contains: name => this.classes.has(name) }; }
        get options() { return this.children; }
        get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
        set textContent(value) { this._text = String(value); this.replaceChildren(); }
        appendChild(child) { child.remove(); child.parentElement = this; this.children.push(child); return child; }
        append(...children) { children.forEach(child => this.appendChild(child)); }
        replaceChildren(...children) { [...this.children].forEach(child => child.remove()); this.append(...children); }
        remove() { if (this.parentElement) { if (this.contains(doc.activeElement)) doc.activeElement = null; this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); } this.parentElement = null; }
        setAttribute(name, value) { this.attributes[name] = String(value); }
        contains(node) { return node === this || this.children.some(child => child.contains(node)); }
        closest(tag) { return this.tag === tag ? this : this.parentElement?.closest(tag) || null; }
        querySelectorAll(tag) { return this.children.flatMap(child => [child, ...child.querySelectorAll('*')]).filter(child => tag === '*' || child.tag === tag); }
        focus() { doc.activeElement = this; }
    }
    const ids = Object.fromEntries(['panel', 'chart', 'status', 'select', 'reset', 'detail', 'legend'].map(name => [`slang-sunburst-${name}`, new Element(name === 'select' ? 'select' : name === 'reset' ? 'button' : 'div')]));
    doc.getElementById = id => ids[id] || null; doc.createElement = tag => new Element(tag); doc.createTextNode = text => { const node = new Element('#text'); node.textContent = text; return node; };
    const win = new Target(), media = new Target(); media.matches = false;
    Object.assign(win, { document: doc, console, devicePixelRatio: 3, AbortController,
        i18n: { getLang: () => lang }, matchMedia: () => media,
        requestAnimationFrame(fn) { const id = ++tick; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
        setTimeout(fn) { const id = ++tick; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
        IntersectionObserver: class { constructor(fn) { this.fn = fn; this.active = false; observers.push(this); } observe() { this.active = true; } disconnect() { this.active = false; } },
        fetch(url, options) { return new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })); },
        echarts: { getInstanceByDom: () => charts.find(chart => !chart.disposed), init(node, theme, settings) {
            const chart = { disposed: false, events: new Map(), options: [], settings, resizes: 0,
                isDisposed() { return this.disposed; }, dispose() { this.disposed = true; },
                setOption(option) { assert.equal(this.disposed, false); this.option = option; this.options.push(option); },
                resize() { assert.equal(this.disposed, false); this.resizes += 1; },
                on(type, callback) { this.events.set(type, callback); }, click(id) { this.events.get('click')({ data: { id } }); } };
            charts.push(chart); return chart;
        } }
    });
    if (!intersection) delete win.IntersectionObserver;
    win.window = win; vm.createContext(win); vm.runInContext(lifecycleCode, win); vm.runInContext(code, win);
    const settle = () => new Promise(resolve => setImmediate(resolve));
    return { win, doc, ids, requests, charts, observers, frames, media, targets,
        get: name => ids[`slang-sunburst-${name}`], state: () => win.GameSlangSunburst.getState(),
        enter() { for (const observer of observers.filter(item => item.active)) observer.fn([{ isIntersecting: true }]); },
        async respond(data = raw, ok = true) { requests.at(-1).resolve({ ok, json: async () => data }); await settle(); }, settle,
        async fail() { requests.at(-1).reject(Error('offline')); await settle(); },
        language(value) { lang = value; win.emit('languagechange'); },
        flush() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); },
        click(container, button) { button.focus(); container.emit('click', { target: button }); }
    };
}

test('lazy initialization fetches once, tracks one ECharts instance and initializes native controls', async () => {
    const h = harness(); assert.equal(h.requests.length, 0); assert.equal(h.state().state, 'idle');
    h.enter(); h.enter(); assert.equal(h.requests.length, 1); await h.respond();
    assert.equal(h.state().state, 'ready'); assert.equal(h.get('panel').dataset.state, 'ready');
    assert.equal(h.charts.length, 1); assert.equal(h.charts[0].settings.devicePixelRatio, 2);
    assert.equal(h.get('select').children.length, 5); assert.equal(h.get('legend').children.length, 4);
    assert.equal(h.get('reset').textContent, '恢复全景');
    h.win.GameSlangSunburst.mount(); assert.equal(h.charts.length, 1);
});

test('sector, selector, detail buttons and center back preserve full hierarchy including tiny fourth-level leaves', async () => {
    const h = harness(); h.enter(); await h.respond(); const chart = h.charts[0];
    chart.click('0'); assert.equal(h.state().focusId, '0');
    chart.click('0/0'); chart.click('0/0/0'); assert.equal(h.state().selectedId, '0/0/0');
    assert.match(h.get('detail').textContent, /动态难度/);
    const back = h.get('chart').children.find(node => node.className === 'sunburst-center-button');
    back.emit('click'); assert.equal(h.state().focusId, '0'); assert.equal(h.state().selectedId, null);
    h.get('select').value = '1'; h.get('select').emit('change'); assert.equal(h.state().focusId, '1');
    const deep = flatten(model.normalizeData(raw)).find(node => node.name === '恋爱游戏' && node.children);
    chart.click(deep.id); assert.equal(h.state().focusId, deep.id);
    const leafButton = h.get('detail').querySelectorAll('button').find(button => button.dataset.nodeId === deep.children[0].id);
    h.click(h.get('detail'), leafButton); assert.equal(h.state().selectedId, deep.children[0].id);
    assert.equal(h.doc.activeElement.tag, 'h3');
    h.get('reset').emit('click'); assert.equal(h.state().focusId, null); assert.equal(h.state().selectedId, null);
    assert.equal(h.charts.length, 1);
});

test('language, reduced motion and resize redraw one tracked instance while preserving the current category', async () => {
    const h = harness(); h.enter(); await h.respond(); const chart = h.charts[0]; chart.click('2');
    h.language('en'); assert.equal(h.state().focusId, '2'); assert.equal(h.get('reset').textContent, 'Reset view');
    assert.match(h.get('status').textContent, /538 term records/);
    h.media.matches = true; h.media.emit('change'); assert.equal(chart.option.animation, false);
    h.get('chart').clientWidth = 390; h.win.emit('resize'); h.win.emit('resize'); h.flush();
    assert.equal(chart.resizes, 1); assert.equal(h.charts.length, 1); assert.equal(h.state().focusId, '2');
    assert.equal(chart.option.series[0].levels[1].label.fontSize, 10);
});

test('network failure is retryable and pagehide cancels in-flight work without creating stale charts', async () => {
    const h = harness(); h.enter(); await h.fail(); assert.equal(h.state().state, 'error');
    assert.equal(h.get('reset').textContent, '重试加载'); h.get('reset').emit('click'); await h.respond(); assert.equal(h.state().state, 'ready');
    h.win.emit('pagehide', { persisted: true }); assert.equal(h.charts[0].disposed, true); assert.equal(h.state(), null);
    h.win.emit('pageshow', { persisted: true }); h.enter(); assert.equal(h.requests.length, 3);
    h.win.emit('pagehide'); assert.equal(h.requests.at(-1).options.signal.aborted, true);
    await h.respond(); assert.equal(h.charts.length, 1); assert.equal(h.state(), null);
});

test('destroy removes instance listeners and observer, and an empty response remains a retryable error', async () => {
    const h = harness(); h.enter(); await h.respond([]); assert.equal(h.state().state, 'error');
    h.get('reset').emit('click'); await h.respond();
    h.win.GameSlangSunburst.destroy(); assert.equal(h.charts[0].disposed, true);
    assert.ok(h.observers.every(observer => !observer.active));
    assert.equal(h.win.listeners.get('languagechange').size, 0); assert.equal(h.media.listeners.get('change').size, 0);
    assert.equal(h.get('select').listeners.get('change').size, 0); assert.equal(h.get('detail').listeners.get('click').size, 0);
    h.win.GameSlangSunburst.destroy();
});

test('without IntersectionObserver the panel becomes visible and loads immediately', async () => {
    const h = harness({ intersection: false });
    assert.equal(h.get('panel').classList.contains('animate-in'), true); assert.equal(h.requests.length, 1);
    await h.respond(); assert.equal(h.state().state, 'ready');
});
