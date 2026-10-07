import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
const assets = new URL('../assets/', import.meta.url);
const read = name => fs.readFileSync(new URL(name, assets), 'utf8');
const names = ['createTermDistributionChart', 'createGameSentimentCharts', 'createTermSentimentRadarChart', 'createMultiGameRadarCharts'];
const chartCode = [1, 2, 3, 4].map(n => read('chart' + n + '.js'));
// Data-only baselines captured from the approved release. Presentation may change.
const hashes = ['5673066b3bb145dc8ca828fba5790a5d7b564d2d7b93c9f4636118287c1a4866', '670527bf7f0c5957333be5da1c474a7dbbe29cd0770ddbc4495204a9afcde303', 'cdf6cb58660d21fa18d3676f0e042e49752382e4b6802889a6acdc4b04074189', 'e2e8a0d5de4f63fca81b5d197a897dc7da1594d685355a4f4f994dd244b2b28f'];
const json = x => JSON.parse(JSON.stringify(x));
function harness(width = 1440, initialLocale = 'zh', reduced = false, withObserver = true) {
  const listeners = new Map(), timers = new Map(), frames = new Map(), instances = [], observers = [], roots = {}, byDom = new WeakMap();
  let nextId = 0, language = initialLocale;
  const classes = node => ({
    contains: name => node.className.split(/\s+/).includes(name),
    add(...names) { node.className = [...new Set([...node.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
    toggle(name, force) { const set = new Set(node.className.split(/\s+/).filter(Boolean)), add = force ?? !set.has(name); add ? set.add(name) : set.delete(name); node.className = [...set].join(' '); return add; }
  });
  class Element {
    constructor(tag, root = false) { this.tagName = tag; this.root = root; this.children = []; this.parentElement = null; this.style = {}; this.attributes = {}; this.className = ''; this.classList = classes(this); this.events = new Map(); this.textContent = ''; }
    get connected() { return this.root || Boolean(this.parentElement?.connected); }
    get clientWidth() {
      if (!this.connected) return 0;
      if (this.root) return Math.max(180, host.innerWidth - 98);
      const parent = this.parentElement, width = parent.clientWidth;
      if (this.classList.contains('lc-game-card')) {
        if (parent.classList.contains('lc-one')) return Math.min(500, width) - 24;
        const columns = host.innerWidth < 700 ? 1 : Math.max(1, Math.floor((width + 18) / 278));
        return (width - (columns - 1) * 18) / columns - 24;
      }
      return width;
    }
    get offsetWidth() { return this.clientWidth; }
    appendChild(child) { if (child.parentElement) child.remove(); child.parentElement = this; this.children.push(child); return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    replaceChildren(...children) { this.children.forEach(child => { child.parentElement = null; }); this.children = []; this.append(...children); }
    set innerHTML(value) { this.replaceChildren(); this.textContent = value; }
    remove() { if (!this.parentElement) return; const parent = this.parentElement; parent.children.splice(parent.children.indexOf(this), 1); this.parentElement = null; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    addEventListener(type, fn) { if (!this.events.has(type)) this.events.set(type, new Set()); this.events.get(type).add(fn); }
    removeEventListener(type, fn) { this.events.get(type)?.delete(fn); }
    emit(type) { [...this.events.get(type) || []].forEach(fn => fn({ target: this })); }
  }
  const flatten = node => [node, ...node.children.flatMap(flatten)];
  const media = { matches: reduced, listeners: new Set(), addEventListener(_type, fn) { this.listeners.add(fn); } };
  const host = {
    innerWidth: width, devicePixelRatio: 3,
    document: { getElementById: id => Object.values(roots).flatMap(flatten).find(node => node.id === id), createElement: tag => new Element(tag) },
    console: { log() {}, warn() {}, error() {} }, matchMedia: () => media,
    i18n: { getLang: () => language, tGame: raw => language === 'en' ? ({ '英雄联盟': 'League of Legends', '最终幻想14': 'Final Fantasy XIV', '艾尔登法环': 'Elden Ring' })[raw] || raw : raw,
      tCategory: raw => language === 'en' ? ({ '交流/指挥类': 'Communication / commands', '物品/装备类': 'Items / equipment', '地图/副本类': 'Maps / dungeons', '跨游戏通用语': 'Cross-game terminology' })[raw] || raw : raw },
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    setTimeout(fn) { const id = ++nextId; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(fn) { const id = ++nextId; frames.set(id, fn); return id; }, cancelAnimationFrame(id) { frames.delete(id); },
    echarts: { getInstanceByDom: node => byDom.get(node), init(node, theme, settings) {
      const instance = { node, settings, disposed: false, resizeCount: 0, option: null, history: [],
        setOption(option, replace) { this.option = replace ? option : Object.assign({}, this.option, option); this.history.push(option); },
        isDisposed() { return this.disposed; }, dispose() { assert.equal(this.disposed, false, 'dispose once'); this.disposed = true; byDom.delete(node); },
        resize() { assert.equal(this.disposed, false); assert.equal(this.node.connected, true, 'no detached resize'); this.resizeCount++; }
      }; instances.push(instance); byDom.set(node, instance); return instance;
    } }
  };
  if (withObserver) host.ResizeObserver = class {
    constructor(fn) { this.fn = fn; this.nodes = new Set(); this.disconnected = false; observers.push(this); }
    observe(node) { this.nodes.add(node); } unobserve(node) { this.nodes.delete(node); } disconnect() { this.disconnected = true; this.nodes.clear(); }
  };
  for (let n = 1; n <= 4; n++) { roots['chart' + n] = new Element('div', true); roots['chart' + n].id = 'chart' + n; }
  host.window = host; vm.createContext(host);
  ['chart-lifecycle.js', 'legacy-chart-ui.js'].forEach(name => vm.runInContext(read(name), host, { filename: name }));
  chartCode.forEach((code, index) => vm.runInContext(code, host, { filename: 'chart' + (index + 1) + '.js' }));
  return { host, roots, listeners, timers, frames, instances, observers, media,
    init() { names.forEach(name => host[name]()); }, emit(type, event = {}) { [...listeners.get(type) || []].forEach(fn => fn(event)); },
    locale(value) { language = value; this.emit('languagechange'); }, flushFrame() { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn()); },
    active() { return instances.filter(instance => !instance.disposed); }, nodes(id, predicate) { return flatten(roots[id]).filter(predicate); },
    find(id) { return host.document.getElementById(id); }, change(id, value) { const select = this.find(id); select.value = value; select.emit('change'); },
    chart(id) { return this.active().find(chart => flatten(roots[id]).includes(chart.node)); }
  };
}

test('four source arrays preserve every original value and the 14/14/10/12 scopes', () => {
  chartCode.forEach((source, index) => {
    let captured; const ui = { register() {}, mountBar(_id, data) { captured = data; }, mountSentiment(_id, data) { captured = data; }, mountGames(_id, data) { captured = data; } };
    const context = { window: { LegacyChartUI: ui } }; vm.createContext(context); vm.runInContext(source + '\n' + names[index] + '();', context);
    assert.equal(createHash('sha256').update(JSON.stringify(captured)).digest('hex'), hashes[index]); assert.equal(captured.length, [14, 14, 10, 12][index]);
  });
});
test('both radar tooltips show corresponding full-precision values for all ten categories', () => {
  const h = harness(); h.init(); const chart = h.chart('chart3'), negative = chart.option.series[2];
  assert.equal(negative.data[0].value[2], .3047945205);
  const text = chart.option.tooltip.formatter({ seriesName: negative.name, value: negative.data[0].value, dataIndex: 0 });
  assert.match(text, /机制类: <b>30.48%<\/b>/); assert.match(text, /交流\/指挥类: <b>0%<\/b>/); assert.equal((text.match(/<b>/g) || []).length, 10);
  const game = h.chart('chart4'), result = game.option.tooltip.formatter({ value: game.option.series[0].data[0].value, name: '<img onerror=bad>' });
  assert.match(result, /行为类: <b>79.38%<\/b>/); assert.match(result, /&lt;img/); assert.doesNotMatch(result, /<img/); assert.equal((result.match(/<b>/g) || []).length, 10);
});
test('donuts show source percentages without outside labels or renormalizing rounded totals', () => {
  const h = harness(390); h.init(); const chart = h.chart('chart2'); assert.equal(chart.option.series[0].label.show, false);
  assert.deepEqual(json(chart.option.series[0].data.map(item => item.value)), [93.81, 2.06, 4.12]);
  assert.deepEqual(h.nodes('chart2', node => node.tagName === 'dd').map(node => node.textContent), ['93.81%', '2.06%', '4.12%']);
  assert.match(chart.option.tooltip.formatter({ name: '负面', value: 4.12 }), /4\.12%/); assert.equal(chart.option.tooltip.confine, true);
});
test('320/390 phones default to one game with native all-game and keyboard table controls', () => {
  for (const width of [320, 390]) { const h = harness(width); h.init(); assert.equal(h.active().length, 4);
    for (const [id, total] of [['chart2', 14], ['chart4', 12]]) {
      const select = h.find(id + '-game'); assert.equal(select.tagName, 'select'); assert.equal(select.children.length, total + 1); assert.equal(select.children[0].value, 'all');
      assert.equal(h.nodes(id, node => node.tagName === 'label')[0].htmlFor, select.id);
    }
    assert.ok(h.nodes('chart3', node => node.tagName === 'summary').length); assert.ok(h.nodes('chart3', node => node.tagName === 'th' && node.attributes.scope === 'col').length);
    h.change('chart4-game', 'all'); assert.equal(h.nodes('chart4', node => node.classList.contains('lc-game-card')).length, 12); assert.equal(h.active().length, 15);
  }
});
test('narrow radar axes use bounded numbers and all ten full translated names in the key', () => {
  for (const locale of ['zh', 'en']) for (const width of [320, 390]) {
    const h = harness(width, locale); h.init();
    for (const id of ['chart3', 'chart4']) { const chart = h.chart(id), radar = chart.option.radar;
      assert.deepEqual(json(radar.indicator.map(item => item.name)), ['1','2','3','4','5','6','7','8','9','10']); assert.ok(radar.radius + 24 < chart.node.clientWidth / 2);
      const key = h.nodes(id, node => node.classList.contains('lc-axis-key'))[0]; assert.equal(key.hidden, false); assert.equal(key.children.length, 10);
      if (locale === 'en') assert.match(key.children[0].textContent, /Communication/);
    }
  }
});
test('mobile bars keep all 14 games and preserve the user range on same-breakpoint resize', () => {
  const h = harness(390); h.init(); const chart = h.chart('chart1'); assert.equal(chart.option.xAxis.data.length, 14); assert.equal(chart.option.dataZoom[0].endValue, 3);
  chart.option.dataZoom[0].startValue = 5; chart.option.dataZoom[0].endValue = 8; const history = chart.history.length;
  h.host.innerWidth = 320; h.emit('resize'); h.flushFrame(); assert.equal(chart.history.length, history); assert.equal(chart.option.dataZoom[0].startValue, 5);
  h.host.innerWidth = 1440; h.emit('resize'); h.flushFrame(); assert.equal(chart.option.dataZoom[0].show, false); assert.equal(chart.option.dataZoom[0].endValue, 13);
  assert.equal(new Set(chart.option.series.map(series => series.itemStyle.color)).size, 10);
});
test('game choices dispose hidden charts and survive language and responsive changes', () => {
  const h = harness(); h.init(); const original = h.active().slice(); assert.equal(original.length, 28);
  h.change('chart2-game', '英雄联盟'); h.change('chart4-game', '艾尔登法环'); assert.equal(h.active().length, 4);
  assert.ok(original.filter(chart => chart.node.parentElement?.classList.contains('lc-game-card')).every(chart => chart.disposed));
  h.locale('en'); assert.equal(h.active().length, 4); assert.equal(h.find('chart2-game').value, '英雄联盟'); assert.equal(h.find('chart4-game').value, '艾尔登法环');
  assert.match(h.nodes('chart4', node => node.tagName === 'h4')[0].textContent, /Elden Ring/);
  h.host.innerWidth = 320; h.emit('resize'); h.flushFrame(); assert.equal(h.find('chart4-game').value, '艾尔登法环'); assert.equal(h.active().length, 4);
});
test('automatic defaults follow the mobile breakpoint until the reader chooses a view', () => {
  const h = harness(); h.init(); assert.equal(h.active().length, 28); h.host.innerWidth = 390; h.emit('resize'); h.flushFrame(); assert.equal(h.active().length, 4);
  h.change('chart2-game', 'all'); assert.equal(h.active().length, 17); h.host.innerWidth = 1440; h.emit('resize'); h.flushFrame(); assert.equal(h.active().length, 28);
  h.host.innerWidth = 390; h.emit('resize'); h.flushFrame(); assert.equal(h.active().length, 17); assert.equal(h.find('chart2-game').value, 'all');
});
test('repeat mounts have one observer and one resize listener without stale children', () => {
  const h = harness(); h.init(); const original = h.active().slice(); h.init(); assert.ok(original.every(chart => chart.disposed)); assert.equal(h.active().length, 28);
  assert.equal(h.listeners.get('resize').size, 1); assert.equal(h.listeners.get('languagechange').size, 1);
  const observers = h.observers.filter(observer => !observer.disconnected); assert.equal(observers.length, 1); assert.equal(observers[0].nodes.size, 4);
  h.emit('resize'); h.emit('resize'); observers[0].fn([]); assert.equal(h.frames.size, 1); h.flushFrame();
  assert.ok(h.active().every(chart => chart.resizeCount === 1)); assert.ok(h.active().every(chart => chart.settings.devicePixelRatio === 2));
});
test('pagehide releases charts and pending resize; BFCache restores chosen views', () => {
  const h = harness(390); h.init(); h.change('chart4-game', '英雄联盟'); h.emit('resize'); h.emit('pagehide', { persisted: true });
  assert.equal(h.active().length, 0); assert.equal(h.frames.size, 0); assert.equal(h.listeners.get('resize').size, 0); assert.ok(h.observers.every(observer => observer.disconnected));
  h.emit('pageshow', { persisted: true }); assert.equal(h.active().length, 4); assert.equal(h.find('chart4-game').value, '英雄联盟');
  h.emit('resize'); h.flushFrame(); assert.ok(h.active().every(chart => chart.resizeCount === 1));
});
test('reduced motion applies initially and on change, including without ResizeObserver', () => {
  const h = harness(390, 'en', true, false); h.init(); assert.equal(h.active().length, 4); assert.ok(h.active().every(chart => chart.option.animation === false));
  h.media.matches = false; h.media.listeners.forEach(fn => fn()); assert.ok(h.active().every(chart => chart.option.animation === true && chart.option.animationDuration <= 300));
  h.emit('resize'); h.flushFrame(); assert.ok(h.active().every(chart => chart.resizeCount === 1));
});
test('the main category radar fills a desktop panel without enlarging the game mini-radars', () => {
  const h = harness(1120); h.init();
  assert.equal(h.chart('chart3').node.style.height, '500px');
  assert.ok(h.chart('chart3').option.radar.radius >= 200);
  assert.ok(h.chart('chart4').option.radar.radius <= 155);
  h.host.innerWidth = 390; h.emit('resize'); h.flushFrame();
  assert.equal(h.chart('chart3').node.style.height, '310px');
  assert.ok(h.chart('chart3').option.radar.radius < 155);
});
test('missing ECharts and failed canvas initialization retain translated controls and exact HTML data', () => {
  for (const failure of ['missing', 'init', 'setOption']) {
    const h = harness(390, 'en');
    if (failure === 'missing') h.host.echarts = undefined;
    if (failure === 'init') h.host.echarts.init = () => { throw Error('canvas unavailable'); };
    if (failure === 'setOption') { const init = h.host.echarts.init; h.host.echarts.init = (...args) => { const chart = init(...args); chart.setOption = () => { throw Error('renderer failed'); }; return chart; }; }
    h.init(); assert.equal(h.active().length, 0);
    assert.ok(h.nodes('chart1', node => node.tagName === 'table').length);
    assert.ok(h.nodes('chart3', node => node.tagName === 'td' && node.textContent === '30.48%').length);
    assert.deepEqual(h.nodes('chart2', node => node.tagName === 'dd').map(node => node.textContent), ['93.81%', '2.06%', '4.12%']);
    assert.match(h.nodes('chart4', node => node.classList.contains('lc-unavailable'))[0].textContent, /unavailable/);
    h.change('chart4-game', '英雄联盟'); h.emit('resize'); h.flushFrame(); h.locale('zh');
    assert.equal(h.find('chart4-game').value, '英雄联盟'); assert.equal(h.active().length, 0);
  }
});
test('scopes release individual charts, run cleanup once and cancel obsolete timers', () => {
  const h = harness(), manager = h.host.GameChartLifecycle, scope = manager.begin('example'); let cleaned = 0, late = 0, disposed = 0;
  const chart = { dispose() { disposed++; } }; scope.track(chart); scope.cleanup(() => cleaned++); scope.schedule('late', () => late++, 10);
  scope.release(chart); scope.release(chart); assert.equal(disposed, 1); manager.begin('example'); assert.equal(cleaned, 1); assert.equal(h.timers.size, 0); assert.equal(late, 0);
  scope.dispose(); assert.equal(cleaned, 1); manager.dispose(); assert.equal(h.listeners.get('resize').size, 0);
});
