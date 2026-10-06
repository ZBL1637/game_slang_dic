import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const [code, lifecycle, rawText] = await Promise.all([
  fs.readFile(new URL('../assets/slang-network.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../assets/chart-lifecycle.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../assets/data/graph_data.json', import.meta.url), 'utf8')
]);
const raw = JSON.parse(rawText), layoutCalls = [];
const stubLayout = (graph, settings = {}) => graph.nodes.map((node, index) => ({
  ...node, x: 20 + index * 7, y: 30 + index * 5, labelShow: index % 2 === 0, labelPosition: 'right'
}));
const context = { GameSlangNetworkLayout: { layout(graph, settings) { layoutCalls.push({ graph, settings }); return stubLayout(graph, settings); } } };
vm.createContext(context); vm.runInContext(code, context);
const model = context.GameSlangNetworkModel;
const plain = value => JSON.parse(JSON.stringify(value));
const fixture = {
  nodes: [{ id: 'A', name: '词 A', value: 500, doc_freq: 400, category: '名词' }, { id: 'B', name: '词 B', value: 300, doc_freq: 200, category: '动词' }, { id: 'C', name: '词 C', value: 200, category: '其他' }],
  links: [{ source: 'A', target: 'B', value: 50 }, { source: 'B', target: 'C', value: 30 }]
};
const edgeKey = link => [link.source, link.target].sort().join('\u0000');
const sourceMap = links => new Map(links.map(link => [edgeKey(link), link.value]));
const relatedFixture = {
  nodes: ['游戏', '玩家', 'A', 'B', 'C', 'D'].map((id, index) => ({ id, name: id, value: 1000 - index * 100, category: '名词' })),
  links: [
    { source: '游戏', target: '玩家', value: 1000 },
    ...['A', 'B', 'C', 'D'].map((id, index) => ({ source: '游戏', target: id, value: 900 - index * 10 })),
    { source: '玩家', target: 'A', value: 800 },
    { source: 'A', target: 'B', value: 90 }, { source: 'A', target: 'C', value: 80 },
    { source: 'B', target: 'C', value: 95 }, { source: 'C', target: 'D', value: 85 },
    { source: 'B', target: 'D', value: 23 }
  ]
};

test('the complete supplied data reproduces the reference top-one union and exact 96-node / 90-edge result', () => {
  let links = raw.links.filter(link => (link.value ?? 0) >= 24);
  const adjacency = Object.fromEntries(raw.nodes.map(node => [node.id, []]));
  links.forEach(link => { adjacency[link.source]?.push(link); adjacency[link.target]?.push(link); });
  const selected = new Set();
  Object.keys(adjacency).forEach(id => adjacency[id].sort((a, b) => b.value - a.value).slice(0, 1).forEach(link => selected.add(link)));
  links = [...selected];
  const active = new Set(links.flatMap(link => [link.source, link.target]));
  const nodes = raw.nodes.filter(node => active.has(node.id) && node.value >= 140).sort((a, b) => b.value - a.value).slice(0, 96);
  const ids = new Set(nodes.map(node => node.id));
  links = links.filter(link => ids.has(link.source) && ids.has(link.target)).sort((a, b) => b.value - a.value).slice(0, 140);
  const graph = model.filterGraph(raw);
  assert.equal(graph.nodes.length, 96); assert.equal(graph.links.length, 90);
  assert.deepEqual(plain(graph.nodes.map(node => node.id)), nodes.map(node => node.id));
  assert.deepEqual(plain(graph.links), links); assert.equal(JSON.stringify(raw), JSON.stringify(JSON.parse(rawText)));
  assert.equal(context.GameSlangNetwork, undefined, 'the pure model loads without a document');
});

test('top-one is a union before node-frequency filtering, and later-isolated retained nodes stay in the model', () => {
  const graph = model.filterGraph({ nodes: ['A', 'B', 'C', 'D'].map(id => ({ id, value: id === 'B' ? 139 : 500 })),
    links: [{ source: 'A', target: 'B', value: 100 }, { source: 'A', target: 'C', value: 90 }, { source: 'C', target: 'D', value: 95 }] });
  assert.deepEqual(plain(graph.nodes.map(node => node.id)), ['A', 'C', 'D']);
  assert.deepEqual(plain(graph.links), [{ source: 'C', target: 'D', value: 95 }]);
  assert.equal(model.neighbors(graph, 'A').length, 0);
  const hub = model.filterGraph({ nodes: ['H', 'A', 'B', 'C'].map(id => ({ id, value: 140 })), links: ['A', 'B', 'C'].map((id, i) => ({ source: 'H', target: id, value: 24 + i })) });
  assert.equal(model.neighbors(hub, 'H').length, 3, 'top-one does not cap final node degree at one');
});

test('thresholds, stable equal-weight order and unknown endpoints are handled without mutating source records', () => {
  const input = { nodes: [{ id: 'A', value: 140 }, { id: 'B', value: 140 }, { id: 'C', value: 140 }],
    links: [{ source: 'A', target: 'B', value: 24 }, { source: 'A', target: 'C', value: 24 }, { source: 'B', target: 'C', value: 23 }, { source: 'missing', target: 'A', value: 99 }] };
  const before = JSON.stringify(input), graph = model.filterGraph(input);
  assert.equal(graph.links.length, 2); assert.equal(graph.links[0].target, 'B'); assert.equal(JSON.stringify(input), before);
  assert.throws(() => model.filterGraph({ nodes: [] }), /Invalid graph data/);
  assert.deepEqual(plain(model.filterGraph({ nodes: [], links: [] })), { nodes: [], links: [] });
});

test('overview keeps the reference nodes and edges while adding only genuine source links', () => {
  const before = JSON.stringify(raw), base = model.filterGraph(raw), extended = model.extendGraph(raw);
  const ids = new Set(base.nodes.map(node => node.id)), original = sourceMap(raw.links);
  assert.deepEqual(plain(extended.nodes), plain(base.nodes));
  assert.equal(extended.nodes.length, 96); assert.equal(extended.links.length, 149);
  const overview = sourceMap(extended.links);
  for (const link of base.links) assert.equal(overview.get(edgeKey(link)), link.value, 'base links must survive extension');
  assert.equal(new Set(extended.links.map(edgeKey)).size, extended.links.length);
  for (const link of [...extended.links, ...extended.sourceLinks]) {
    assert.ok(ids.has(link.source) && ids.has(link.target));
    assert.ok(link.value >= 24); assert.equal(original.get(edgeKey(link)), link.value);
  }
  const eligible = raw.links.filter(link => ids.has(link.source) && ids.has(link.target) && link.value >= 24);
  assert.deepEqual(plain(extended.sourceLinks), eligible, 'selection retains every eligible original edge, not only the overview');
  assert.equal(JSON.stringify(raw), before);
});

test('extra edges use the strongest non-generic relation per term and preserve weaker source links for exploration', () => {
  const before = JSON.stringify(relatedFixture), graph = model.extendGraph(relatedFixture);
  const base = sourceMap(model.filterGraph(relatedFixture).links), all = sourceMap(graph.links);
  const extras = graph.links.filter(link => !base.has(edgeKey(link)));
  assert.deepEqual(plain(extras.map(link => edgeKey(link)).sort()), ['A\u0000B', 'B\u0000C', 'C\u0000D']);
  assert.ok(extras.every(link => !['游戏', '玩家'].includes(link.source) && !['游戏', '玩家'].includes(link.target)));
  assert.equal(all.has('A\u0000C'), false, 'a weaker relation is not invented as an overview extra');
  assert.equal(sourceMap(graph.sourceLinks).get('A\u0000C'), 80, 'the same genuine relation stays available for a focused view');
  assert.equal(sourceMap(graph.sourceLinks).has('B\u0000D'), false, 'sub-threshold edges remain excluded');
  assert.equal(JSON.stringify(relatedFixture), before);
});

test('the 160-edge overview cap does not evict reference edges or discard the source relation pool', () => {
  const ids = Array.from({ length: 95 }, (_, index) => `term-${index}`);
  const input = {
    nodes: ['游戏', ...ids].map(id => ({ id, value: 500, category: '名词' })),
    links: [
      ...ids.map((id, index) => ({ source: '游戏', target: id, value: 10000 + index })),
      ...ids.slice(1).map((id, index) => ({ source: ids[index], target: id, value: 100 + index }))
    ]
  };
  const base = model.filterGraph(input), graph = model.extendGraph(input), kept = sourceMap(graph.links);
  assert.equal(base.links.length, 95); assert.equal(graph.links.length, 160);
  assert.equal(graph.sourceLinks.length, 189);
  for (const link of base.links) assert.equal(kept.get(edgeKey(link)), link.value);
  const original = sourceMap(input.links);
  for (const link of graph.links) assert.equal(original.get(edgeKey(link)), link.value);
});

test('focused views reveal only the strongest real center-to-neighbor links, including links outside the overview', () => {
  const graph = model.extendGraph(relatedFixture), before = JSON.stringify(graph);
  const selected = model.selectGraph(graph, 'A');
  assert.deepEqual(new Set(selected.nodes.map(node => node.id)), new Set(['A', 'B', 'C', '游戏', '玩家']));
  assert.equal(sourceMap(selected.links).get('A\u0000C'), 80);
  assert.ok(selected.links.every(link => link.source === 'A' || link.target === 'A'));
  assert.equal(sourceMap(selected.links).has('B\u0000C'), false, 'neighbor-to-neighbor edges do not become invented spokes');
  const limited = model.selectGraph(graph, 'A', 2);
  assert.deepEqual(new Set(limited.nodes.map(node => node.id)), new Set(['A', '游戏', '玩家']));
  assert.equal(limited.links.length, 2);
  const isolated = model.selectGraph(graph, 'A', 0);
  assert.deepEqual(plain(isolated.nodes.map(node => node.id)), ['A']); assert.equal(isolated.links.length, 0);
  assert.deepEqual(plain(model.selectGraph(graph, '')), { nodes: plain(graph.nodes), links: plain(graph.links) });
  assert.deepEqual(plain(model.selectGraph(graph, 'unknown')), plain(model.selectGraph(graph, '')));
  assert.equal(JSON.stringify(graph), before);
});

test('the supplied data exposes up to twelve genuine strongest neighbors and supports graphs without a source pool', () => {
  const full = model.extendGraph(raw), selected = model.selectGraph(full, '奶');
  const expected = full.sourceLinks.filter(link => link.source === '奶' || link.target === '奶')
    .sort((a, b) => b.value - a.value).slice(0, 12);
  assert.equal(selected.nodes.length, 13); assert.equal(selected.links.length, 12);
  assert.deepEqual(new Set(selected.links.map(edgeKey)), new Set(expected.map(edgeKey)));
  assert.ok(selected.nodes.some(node => node.id === '奶妈'));
  assert.ok(selected.nodes.some(node => node.id === '辅助'));
  const overview = sourceMap(full.links);
  assert.ok(selected.links.some(link => !overview.has(edgeKey(link))), 'selection must not be restricted to overview links');
  const fallback = model.selectGraph(fixture, 'B');
  assert.equal(fallback.nodes.length, 3); assert.equal(fallback.links.length, 2);
});

test('node size compresses frequency to 5–12 desktop pixels without reversing frequency order', () => {
  const sizes = [140, 500, 2000, 10000, 100000].map(value => model.nodeSize(value, 140, 100000));
  assert.equal(sizes[0], 5); assert.equal(sizes.at(-1), 12);
  for (let index = 1; index < sizes.length; index++) assert.ok(sizes[index] > sizes[index - 1]);
  assert.ok(model.nodeSize(500, 140, 100000, true) < model.nodeSize(500, 140, 100000));
});

test('layout requests delegate graph, available size and focus to the independently tested layout module', () => {
  const settings = { width: 390, height: 400, mobile: true, focusId: 'B' };
  const points = model.layoutNodes(fixture, settings), call = layoutCalls.at(-1);
  assert.equal(call.graph, fixture); assert.equal(call.settings, settings);
  assert.deepEqual(plain(points.map(node => node.id)), fixture.nodes.map(node => node.id));
});

test('options respect layout label decisions, escape node and edge tooltips, and keep the source weight meaning', () => {
  const graph = model.filterGraph(raw), points = model.layoutNodes(graph);
  const desktop = model.buildOption(graph, points, 'zh'), mobile = model.buildOption(graph, points, 'en', true);
  assert.equal(desktop.series[0].center, null); assert.equal(mobile.series[0].center, null);
  assert.deepEqual(plain(desktop.series[0].data.map(node => node.label.show)), plain(points.map(node => node.labelShow)));
  assert.equal(desktop.series[0].draggable, true); assert.equal(desktop.tooltip.confine, true);
  assert.equal(mobile.series[0].data[0].name, graph.nodes[0].name);
  const tooltip = desktop.tooltip.formatter({ dataType: 'node', data: { id: 'missing', name: '<img onerror="bad">', rawCategory: '<script>', value: 20, doc_freq: 99 } });
  assert.ok(tooltip.includes('&lt;img')); assert.ok(!tooltip.includes('<img')); assert.ok(!tooltip.includes('<script>'));
  assert.ok(tooltip.includes('词频权重')); assert.ok(!tooltip.includes('文档')); assert.ok(!tooltip.includes('99'));
  const edgeTooltip = desktop.tooltip.formatter({ dataType: 'edge', data: { source: '<img src=x>', target: '<svg onload=bad>', value: 37 } });
  assert.ok(edgeTooltip.includes('&lt;img')); assert.ok(edgeTooltip.includes('&lt;svg')); assert.ok(!edgeTooltip.includes('<img')); assert.ok(!edgeTooltip.includes('<svg'));
  assert.ok(edgeTooltip.includes('共现权重')); assert.ok(edgeTooltip.includes('37'));
  const focused = model.buildOption(fixture, stubLayout(fixture), 'en', false, { focusId: 'B', reducedMotion: true });
  assert.equal(focused.animation, false); assert.equal(focused.series[0].animation, false);
  assert.deepEqual(plain(focused.series[0].data.map(node => node.label.show)), stubLayout(fixture).map(node => node.labelShow));
  assert.ok(focused.series[0].data.find(node => node.id === 'B').symbolSize > focused.series[0].data.find(node => node.id === 'A').symbolSize);
});

function harness({ noObserver = false, width = 1100 } = {}) {
  const frames = new Map(), charts = [], observers = [], requests = [], elements = {}, layouts = [];
  let lang = 'zh', frameId = 0;
  let document;
  const target = object => Object.assign(object, {
    events: new Map(),
    addEventListener(type, fn) { if (!this.events.has(type)) this.events.set(type, new Set()); this.events.get(type).add(fn); },
    removeEventListener(type, fn) { this.events.get(type)?.delete(fn); },
    emit(type, values = {}) { for (const fn of [...(this.events.get(type) || [])]) fn(values); }
  });
  function element(tag = 'div') {
    const node = target({ tagName: tag.toUpperCase(), dataset: {}, attributes: {}, children: [], clientWidth: width, clientHeight: 560, disabled: false, value: '', classes: new Set() });
    node.classList = { add: name => node.classes.add(name) };
    node.setAttribute = (name, value) => { node.attributes[name] = value; };
    node.replaceChildren = (...children) => { node.children = children; node.content = ''; for (const child of children) child.parentNode = node; };
    node.closest = selector => selector === 'button' ? (node.tagName === 'BUTTON' ? node : node.parentNode?.closest(selector)) : null;
    node.querySelector = selector => {
      const all = [];
      const visit = parent => { for (const child of parent.children) { all.push(child); visit(child); } };
      visit(node);
      return all.find(child => selector.startsWith('.') ? child.className === selector.slice(1) : child.tagName === selector.toUpperCase()) || null;
    };
    node.focus = () => { document.activeElement = node; };
    Object.defineProperty(node, 'textContent', { get() { return this.content || this.children.map(child => child.textContent).join(''); }, set(value) { this.content = String(value); this.children = []; } });
    return node;
  }
  for (const id of ['panel', 'chart', 'status', 'select', 'reset', 'detail']) elements[id] = element();
  const media = target({ matches: false });
  document = target({ readyState: 'complete', activeElement: null, getElementById: id => elements[id.replace('slang-network-', '')], createElement: element });
  const host = target({ console, AbortController, setTimeout, clearTimeout,
    document,
    i18n: { getLang: () => lang }, matchMedia: () => media,
    GameSlangNetworkLayout: { layout(graph, settings) { layouts.push({ ids: graph.nodes.map(node => node.id), settings: { ...settings } }); return stubLayout(graph, settings); } },
    requestAnimationFrame(fn) { const id = ++frameId; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
    fetch(url, options) { return new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })); },
    ResizeObserver: class { constructor(fn) { this.fn = fn; this.node = null; this.kind = 'resize'; observers.push(this); } observe(node) { this.node = node; } disconnect() { this.node = null; } },
    echarts: { init() {
      const chart = { disposed: false, handlers: new Map(), actions: [], updates: [], option: null, resized: 0,
        setOption(option, notMerge) { assert.equal(this.disposed, false); this.updates.push({ option, notMerge }); this.option = option.series ? option : { ...this.option, ...option }; }, getOption() { return this.option; },
        on(type, fn) { this.handlers.set(type, fn); }, dispatchAction(action) { this.actions.push(action); },
        isDisposed() { return this.disposed; }, dispose() { this.disposed = true; this.handlers.clear(); }, resize() { assert.equal(this.disposed, false); this.resized++; } };
      charts.push(chart); return chart;
    } }
  });
  if (!noObserver) host.IntersectionObserver = class { constructor(fn) { this.fn = fn; this.kind = 'intersection'; this.node = null; observers.push(this); } observe(node) { this.node = node; } disconnect() { this.node = null; } };
  host.window = host; vm.createContext(host); vm.runInContext(lifecycle, host); vm.runInContext(code, host);
  return { host, elements, charts, observers, requests, frames, media, layouts,
    api: host.GameSlangNetwork,
    enter() { observers.filter(o => o.kind === 'intersection' && o.node).forEach(o => o.fn([{ isIntersecting: true }])); },
    async reply(index, data = fixture, ok = true) { requests[index].resolve({ ok, status: ok ? 200 : 503, json: async () => data }); await new Promise(resolve => setImmediate(resolve)); },
    language(next) { lang = next; host.emit('languagechange'); },
    buttons() {
      const all = []; const visit = parent => { for (const child of parent.children) { if (child.tagName === 'BUTTON') all.push(child); visit(child); } };
      visit(elements.detail); return all;
    },
    resize(next) { elements.chart.clientWidth = next; host.emit('resize'); const pending = [...frames]; frames.clear(); pending.forEach(([, fn]) => fn()); },
    cleanup() { host.GameSlangNetwork.destroy(); host.GameChartLifecycle.dispose(); }
  };
}

test('loading is lazy; native select, chart clicks and linked-term buttons all explore real relations', async () => {
  const h = harness(); assert.equal(h.requests.length, 0); assert.equal(h.elements.select.disabled, true);
  h.enter(); assert.equal(h.requests.length, 1); await h.reply(0);
  assert.equal(h.api.getState().phase, 'ready'); assert.equal(h.elements.select.disabled, false); assert.equal(h.elements.select.children.length, 4);
  h.elements.select.value = 'B'; h.elements.select.emit('change');
  assert.equal(h.api.getState().selected, 'B'); assert.equal(h.api.getState().visibleNodes, 3); assert.equal(h.api.getState().visibleEdges, 2);
  assert.ok(h.elements.detail.textContent.includes('可查联系 2')); assert.ok(h.elements.detail.textContent.includes('词频权重 300'));
  assert.equal(h.charts.length, 1, 'selection updates the existing chart');
  const beforeLanguage = plain(h.charts[0].option.series[0].data.map(node => [node.id, node.x, node.y]));
  h.charts[0].option.series[0].zoom = 1.8;
  h.charts[0].option.series[0].center = [240, 170];
  h.language('en'); assert.equal(h.api.getState().selected, 'B'); assert.ok(h.elements.detail.textContent.includes('Available links 2'));
  assert.equal(h.charts[0].option.series[0].zoom, 1.8);
  assert.deepEqual(plain(h.charts[0].option.series[0].center), [240, 170]);
  assert.deepEqual(plain(h.charts[0].option.series[0].data.map(node => [node.id, node.x, node.y])), beforeLanguage);
  const neighbor = h.buttons().find(button => button.dataset.termId === 'C');
  assert.ok(neighbor.attributes['aria-label'].includes('C')); assert.equal(neighbor.type, 'button');
  h.elements.detail.emit('click', { target: neighbor.children[0] });
  assert.equal(h.api.getState().selected, 'C'); assert.equal(h.api.getState().visibleNodes, 2); assert.equal(h.api.getState().visibleEdges, 1);
  assert.equal(h.host.document.activeElement, h.elements.detail.querySelector('.network-detail-title'));
  h.charts[0].handlers.get('click')({ dataType: 'node', data: { id: 'B' } }); assert.equal(h.elements.select.value, 'B');
  h.charts[0].option.series[0].zoom = 2; h.charts[0].option.series[0].center = [320, 210];
  h.elements.reset.emit('click');
  assert.equal(h.api.getState().selected, ''); assert.equal(h.api.getState().visibleNodes, 3);
  assert.equal(h.charts[0].option.series[0].zoom, 1);
  assert.equal(h.charts[0].option.series[0].center, null, 'reset must explicitly clear pan so an option merge cannot retain the old center');
  h.cleanup();
});

test('overview counts stay distinct from the twelve-link focus, and more exposes remaining source neighbors as real buttons', async () => {
  const h = harness(); h.enter(); await h.reply(0, raw);
  assert.equal(h.api.getState().nodeCount, 96); assert.equal(h.api.getState().edgeCount, 149);
  h.elements.select.value = '奶'; h.elements.select.emit('change');
  assert.equal(h.api.getState().nodeCount, 96); assert.equal(h.api.getState().edgeCount, 149);
  assert.equal(h.api.getState().visibleNodes, 13); assert.equal(h.api.getState().visibleEdges, 12);
  assert.equal(h.charts[0].option.series[0].data.length, 13); assert.equal(h.charts[0].option.series[0].links.length, 12);
  const available = model.neighbors({ nodes: model.extendGraph(raw).nodes, links: model.extendGraph(raw).sourceLinks }, '奶');
  const permitted = new Map(available.map(node => [node.id, node.weight]));
  assert.equal(h.buttons().filter(button => button.dataset.termId).length, 12);
  const more = h.buttons().find(button => button.dataset.expand);
  assert.ok(more); assert.equal(more.attributes['aria-expanded'], 'false');
  h.elements.detail.emit('click', { target: more });
  const expanded = h.buttons().filter(button => button.dataset.termId);
  assert.equal(expanded.length, permitted.size);
  for (const button of expanded) {
    assert.ok(permitted.has(button.dataset.termId));
    assert.equal(button.children[1].textContent, permitted.get(button.dataset.termId).toLocaleString('zh-CN'));
  }
  assert.equal(h.api.getState().visibleEdges, 12, 'expanding the text list does not fabricate graph links');
  const fewer = h.buttons().find(button => button.dataset.expand);
  assert.equal(fewer.attributes['aria-expanded'], 'true'); assert.equal(h.host.document.activeElement, fewer);
  h.elements.detail.emit('click', { target: fewer });
  assert.equal(h.buttons().filter(button => button.dataset.termId).length, 12);
  h.cleanup();
});

test('failed requests can retry, and destruction blocks a stale successful fetch from creating a chart', async () => {
  const h = harness(); h.enter(); await h.reply(0, fixture, false);
  assert.equal(h.api.getState().phase, 'error'); assert.equal(h.elements.reset.textContent, '重试加载');
  h.elements.reset.emit('click'); await h.reply(1); assert.equal(h.api.getState().phase, 'ready'); h.cleanup();
  const pending = harness(); pending.enter(); const request = pending.requests[0]; pending.api.destroy();
  assert.equal(request.options.signal.aborted, true); await pending.reply(0); assert.equal(pending.charts.length, 0); pending.cleanup();
});

test('a newer request wins even when an aborted fetch resolves later', async () => {
  const h = harness(); h.enter(); const first = h.requests[0];
  h.api.init().retry(); assert.equal(h.requests.length, 2); assert.equal(first.options.signal.aborted, true);
  await h.reply(1, relatedFixture); assert.equal(h.api.getState().nodeCount, 6);
  const rendered = h.charts[0].updates.length;
  await h.reply(0, fixture);
  assert.equal(h.api.getState().nodeCount, 6); assert.equal(h.charts.length, 1); assert.equal(h.charts[0].updates.length, rendered);
  h.cleanup();
});

test('resize uses the shared lifecycle, BFCache releases/recreates only this graph, and final unload removes its observers/listeners', async () => {
  const h = harness(); h.enter(); await h.reply(0); const original = h.charts[0];
  h.elements.select.value = 'B'; h.elements.select.emit('change');
  const oldWidth = h.layouts.at(-1).settings.width;
  original.option.series[0].zoom = 1.5;
  original.option.series[0].center = [225, 165];
  h.resize(390); assert.ok(original.resized > 1); assert.equal(h.charts.length, 1);
  assert.equal(h.layouts.at(-1).settings.mobile, true); assert.ok(h.layouts.at(-1).settings.width < oldWidth);
  assert.equal(h.layouts.at(-1).settings.focusId, 'B'); assert.equal(original.option.series[0].zoom, 1.5);
  assert.deepEqual(plain(original.option.series[0].center), [225, 165]);
  h.host.emit('pagehide', { persisted: true }); assert.equal(original.disposed, true); assert.ok(h.observers.every(o => !o.node));
  h.host.emit('pageshow', { persisted: true }); assert.equal(h.requests.length, 1); assert.equal(h.charts.length, 2); assert.equal(h.charts[1].disposed, false);
  assert.equal(h.api.getState().selected, 'B'); assert.equal(h.api.getState().visibleEdges, 2);
  h.host.emit('pagehide', { persisted: false }); assert.equal(h.charts[1].disposed, true); assert.ok(h.observers.every(o => !o.node));
  for (const name of ['languagechange', 'pagehide', 'pageshow']) assert.equal(h.host.events.get(name)?.size || 0, 0);
  assert.equal(h.elements.select.events.get('change').size, 0); assert.equal(h.elements.detail.events.get('click').size, 0);
  assert.equal(h.media.events.get('change').size, 0); h.cleanup();
});

test('BFCache cancels in-flight work and reloads on return without accepting the old response', async () => {
  const h = harness(); h.enter();
  h.host.emit('pagehide', { persisted: true }); assert.equal(h.requests[0].options.signal.aborted, true);
  await h.reply(0); assert.equal(h.charts.length, 0);
  h.host.emit('pageshow', { persisted: true }); assert.equal(h.requests.length, 2);
  await h.reply(1); assert.equal(h.api.getState().phase, 'ready'); assert.equal(h.charts.length, 1); h.cleanup();
});

test('reduced-motion remains active when selecting terms and changing language', async () => {
  const h = harness(); h.media.matches = true; h.enter(); await h.reply(0);
  assert.equal(h.charts[0].option.animation, false); assert.equal(h.charts[0].option.series[0].animation, false);
  h.elements.select.value = 'B'; h.elements.select.emit('change'); h.language('en');
  assert.equal(h.charts[0].option.animation, false); assert.equal(h.charts[0].option.series[0].animation, false); h.cleanup();
});

test('without IntersectionObserver the panel becomes visible and loads; empty data is explained without creating an empty chart', async () => {
  const h = harness({ noObserver: true }); assert.ok(h.elements.panel.classes.has('animate-in')); assert.equal(h.requests.length, 1);
  await h.reply(0, { nodes: [], links: [] }); assert.equal(h.api.getState().phase, 'empty'); assert.equal(h.charts.length, 0); h.cleanup();
});
