import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { setMaxListeners } from 'node:events';

const source = await fs.readFile(new URL('../assets/decorative-props.js', import.meta.url), 'utf8');

// Small event/DOM boundary: execute the shipped module and observe its external
// effects. Timers are explicit so a removed decoration cannot hide pending work.
function harness({ readyState = 'complete', loadModel = () => Promise.reject(Error('WebGL module unavailable')) } = {}) {
  const targets = [], timers = new Map(), frames = new Map(), actions = [], imports = [];
  let nextId = 0, locale = 'zh';
  class Target {
    constructor() { this.listeners = new Map(); targets.push(this); }
    addEventListener(type, fn, options = {}) {
      if (options.signal?.aborted) return;
      if (!this.listeners.has(type)) this.listeners.set(type, new Map());
      const list = this.listeners.get(type);
      if (list.has(fn)) return;
      const abort = () => this.removeEventListener(type, fn);
      list.set(fn, { once: options.once, signal: options.signal, abort });
      if (options.signal) options.signal.addEventListener('abort', abort, { once: true });
    }
    removeEventListener(type, fn) {
      const entry = this.listeners.get(type)?.get(fn);
      entry?.signal?.removeEventListener('abort', entry.abort);
      this.listeners.get(type)?.delete(fn);
    }
    emit(type, values = {}) {
      const event = { type, target: this, button: 0, pointerId: 1, repeat: false,
        prevented: false, stopped: false,
        preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...values };
      for (const [fn, entry] of [...(this.listeners.get(type) || [])]) {
        if (entry.once) this.removeEventListener(type, fn);
        fn(event);
      }
      return event;
    }
  }
  class Element extends Target {
    constructor(tag) {
      super(); this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.className = ''; this.attributes = {}; this.dataset = {};
      this.style = { setProperty(key, value) { this[key] = value; } };
      const words = () => new Set(this.className.split(/\s+/).filter(Boolean));
      this.classList = {
        contains: value => words().has(value),
        add: (...values) => { this.className = [...new Set([...words(), ...values])].join(' '); },
        remove: (...values) => { this.className = [...words()].filter(value => !values.includes(value)).join(' '); },
        toggle: (value, force) => { const enabled = force ?? !words().has(value); this.classList[enabled ? 'add' : 'remove'](value); return enabled; }
      };
    }
    get isConnected() { return this === document.body || Boolean(this.parentNode?.isConnected); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    append(...nodes) { for (const node of nodes) { node.remove(); node.parentNode = this; this.children.push(node); } }
    appendChild(node) { this.append(node); return node; }
    prepend(node) { node.remove(); node.parentNode = this; this.children.unshift(node); }
    remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
    set innerHTML(value) { this.children.forEach(child => { child.parentNode = null; }); this.children = []; this.markup = value; if (value.includes('<svg')) this.append(new Element('svg')); }
    get innerHTML() { return this.markup || ''; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) {
      const all = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
      return all.filter(child => selector === '*' || (selector.startsWith('.') ? child.classList.contains(selector.slice(1)) : child.tagName.toLowerCase() === selector));
    }
    setPointerCapture() {}
    getBoundingClientRect() { return { width: 80, height: 80, left: 0, top: 0 }; }
  }
  const document = new Target(); document.readyState = readyState; document.hidden = false;
  document.currentScript = { src: 'http://localhost/assets/decorative-props.js' };
  document.documentElement = { lang: 'zh-CN' }; document.body = new Element('body');
  document.createElement = tag => new Element(tag);
  document.getElementById = id => document.body.querySelectorAll('*').find(node => node.id === id) || null;
  const motion = new Target(); motion.matches = false;
  const host = new Target(); host.window = host; host.document = document;
  Object.assign(host, {
    console, URL, innerWidth: 1600, innerHeight: 1000, devicePixelRatio: 1,
    AbortController: class extends AbortController { constructor() { super(); setMaxListeners(0, this.signal); } },
    matchMedia: () => motion,
    getComputedStyle: node => ({ display: node.style.display || 'block' }),
    setTimeout(fn) { const id = ++nextId; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame(fn) { const id = ++nextId; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    i18n: { getLang: () => locale },
    fetch: (...args) => { actions.push(['fetch', ...args]); throw Error('Unexpected request'); },
    scrollTo: (...args) => actions.push(['scroll', ...args]),
    open: (...args) => actions.push(['open', ...args]),
    performSearch: (...args) => actions.push(['search', ...args]),
    updateCurrentData: (...args) => actions.push(['data', ...args]),
    openWukongModal: (...args) => actions.push(['modal', ...args]),
    location: { href: 'http://localhost/index.html', assign: (...args) => actions.push(['navigate', ...args]) }
  });
  host.__loadModel = url => { imports.push(url); return loadModel(url); };
  vm.createContext(host);
  // Replace only the dynamic import I/O boundary; the actual DOM/lifecycle code runs unchanged.
  assert.equal((source.match(/import\(modelURL\)/g) || []).length, 1);
  const load = () => vm.runInContext(source.replace('import(modelURL)', '__loadModel(modelURL)'), host, { filename: 'decorative-props.js' });
  load();
  return { host, document, motion, timers, frames, targets, actions, imports, load,
    get api() { return host.DecorativeProps; },
    get layer() { return document.getElementById('decorativeProps'); },
    props() { return this.layer?.querySelectorAll('.dp-prop') || []; },
    buttons() { return document.body.querySelectorAll('button'); },
    liveListeners() { return targets.reduce((total, target) => total + [...target.listeners.values()].reduce((n, set) => n + set.size, 0), 0); },
    flushFrames() { const batch = [...frames]; frames.clear(); for (const [, fn] of batch) fn(); },
    flushTimers() { const batch = [...timers]; timers.clear(); for (const [, fn] of batch) fn(); },
    setLanguage(next) { locale = next; host.emit('languagechange'); }
  };
}

test('decorative controls give local feedback without navigation, content actions or requests', () => {
  const h = harness();
  assert.ok(h.props().length > 0, 'the decoration layer must contain models');
  assert.equal(h.api.getStats().decorations, h.props().length);
  assert.equal(h.buttons().length, 4);
  for (const button of h.buttons()) {
    assert.equal(button.type, 'button', 'decorations must not submit a surrounding form');
    const event = button.emit('click');
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
  }
  assert.equal(h.api.getStats().activations, 4);
  assert.equal(h.timers.size, 4);
  assert.deepEqual(h.actions, []);
  h.flushTimers();
  assert.equal(h.api.getStats().pendingFeedback, 0);
  assert.ok(h.layer.children.every(prop => !prop.className.includes('dp-pressed-')));
  h.api.destroy();
});

test('rapid repeated feedback remains bounded and destroy releases events, timers and DOM', () => {
  const h = harness(), oldLayer = h.layer, oldButtons = h.buttons();
  const eventCount = h.liveListeners();
  for (let i = 0; i < 30; i++) oldButtons[0].emit('click');
  assert.equal(h.timers.size, 1, 'repeated clicks reuse one pending reset per control');
  assert.equal(h.api.init(), h.api);
  assert.equal(h.layer, oldLayer);
  h.api.destroy(); h.api.destroy();
  assert.equal(h.layer, null);
  assert.equal(h.timers.size, 0);
  assert.equal(h.frames.size, 0);
  assert.equal(h.liveListeners(), 0);
  oldButtons[0].emit('click'); h.host.emit('pageshow'); h.document.emit('visibilitychange');
  assert.equal(h.timers.size, 0);
  h.api.init();
  assert.notEqual(h.layer, oldLayer);
  assert.equal(h.buttons().length, 4);
  assert.equal(h.liveListeners(), eventCount, 'reinitialization has exactly one fresh set of listeners');
  h.api.destroy();
});

test('hidden pages and pagehide release feedback; reduced motion pauses decoration drift', () => {
  const h = harness(); h.buttons()[0].emit('click');
  h.document.hidden = true; h.document.emit('visibilitychange');
  assert.equal(h.timers.size, 0);
  assert.equal(h.api.getStats().animationPaused, true);
  h.document.hidden = false; h.document.emit('visibilitychange');
  assert.equal(h.api.getStats().animationPaused, false);
  h.motion.matches = true; h.motion.emit('change');
  assert.equal(h.api.getStats().animationPaused, true);
  h.buttons()[0].emit('click'); h.host.emit('pagehide');
  assert.equal(h.timers.size, 0);
  h.api.destroy();
});

test('destroy before DOM ready cancels automatic boot; explicit initialization remains available', () => {
  const h = harness({ readyState: 'loading' });
  assert.equal(h.api.getStats().initialized, false);
  h.api.destroy(); h.document.emit('DOMContentLoaded');
  assert.equal(h.layer, null);
  assert.equal(h.liveListeners(), 0);
  h.api.init(); assert.equal(h.buttons().length, 4);
  h.api.destroy();
});

test('replacement script instances dispose the old controls before initializing', () => {
  const h = harness(), oldApi = h.api, oldLayer = h.layer, oldButtons = h.buttons();
  oldButtons[0].emit('click'); const eventCount = h.liveListeners();
  h.load();
  assert.equal(oldApi.getStats().initialized, false);
  assert.equal(oldLayer.isConnected, false);
  assert.equal(h.timers.size, 0);
  assert.equal(h.liveListeners(), eventCount);
  assert.equal(h.document.body.children.length, 1);
  h.api.destroy();
});

test('control labels follow language changes and detached buttons stop receiving updates', () => {
  const h = harness(), button = h.buttons()[0];
  assert.match(button.getAttribute('aria-label'), /装饰/);
  h.setLanguage('en'); assert.match(button.getAttribute('aria-label'), /Decorative/);
  h.api.destroy(); h.setLanguage('zh');
  assert.match(button.getAttribute('aria-label'), /Decorative/);
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function settle() { for (let i = 0; i < 5; i++) await Promise.resolve(); }
function modelStub({ failCreate = false } = {}) {
  const instances = [];
  const module = { createDecorativeRenderer(options) {
    if (failCreate) throw Error('WebGL unavailable');
    const instance = { disposed: false, disposeCount: 0, renders: [], options,
      render(kind, canvas, pressed) {
        assert.equal(this.disposed, false, 'a disposed renderer must never draw');
        assert.equal(canvas.isConnected, true, 'a detached decoration must never draw');
        this.renders.push({ kind, canvas, pressed: [...pressed] }); return true;
      },
      dispose() { this.disposeCount++; this.disposed = true; },
      getStats() { return { renders: this.renders.length }; }
    };
    instances.push(instance); return instance;
  } };
  return { module, instances };
}

test('destroy and reinit during delayed module loading cannot install a stale renderer', async () => {
  const pending = [deferred(), deferred()], stub = modelStub(); let loads = 0;
  const h = harness({ loadModel: () => pending[loads++].promise });
  assert.equal(h.imports.length, 1);
  const staleLayer = h.layer; h.api.destroy(); h.api.init();
  assert.equal(h.imports.length, 2);
  pending[0].resolve(stub.module); await settle();
  assert.equal(stub.instances.length, 0, 'stale completion must not allocate a GPU context');
  pending[1].resolve(stub.module); await settle();
  assert.equal(stub.instances.length, 1);
  const rendered = stub.instances[0].renders;
  assert.equal(rendered.length, h.props().length, 'every mounted decoration uses the same renderer');
  assert.deepEqual(new Set(rendered.map(draw => draw.canvas)), new Set(h.props().map(prop => prop.querySelector('canvas'))), 'repeated model kinds must still paint every distinct decoration canvas');
  assert.equal(staleLayer.isConnected, false);
  h.host.emit('resize'); h.api.destroy();
  assert.equal(h.frames.size, 0);
  assert.equal(stub.instances[0].disposeCount, 1);
  assert.equal(h.liveListeners(), 0);
});

test('resizes coalesce and WebGL redraw is demand-driven rather than a perpetual frame loop', async () => {
  const stub = modelStub(), h = harness({ loadModel: async () => stub.module });
  await settle(); const renderer = stub.instances[0], initialDraws = h.props().length;
  assert.equal(renderer.renders.length, initialDraws);
  assert.equal(h.frames.size, 0);
  for (let i = 0; i < 20; i++) h.host.emit('resize');
  assert.equal(h.frames.size, 1);
  h.flushFrames(); await settle();
  assert.equal(renderer.renders.length, initialDraws * 2);
  assert.equal(h.frames.size, 0);
  h.buttons()[0].emit('click');
  assert.equal(renderer.renders.length, initialDraws * 2 + 1);
  h.flushTimers(); assert.equal(renderer.renders.length, initialDraws * 2 + 2);
  assert.deepEqual(h.actions, []);
  h.api.destroy(); assert.equal(renderer.disposeCount, 1);
});

test('invisibility while import is pending defers context creation until the decoration is visible', async () => {
  for (const mode of ['background', 'narrow viewport']) {
    const pending = deferred(), stub = modelStub();
    const h = harness({ loadModel: () => pending.promise });
    if (mode === 'background') h.document.hidden = true;
    else h.layer.style.display = 'none';
    pending.resolve(stub.module); await settle();
    assert.equal(stub.instances.length, 0, mode);
    h.document.hidden = false; h.layer.style.display = 'block';
    h.host.emit('pageshow'); await settle();
    assert.equal(stub.instances.length, 1, mode);
    h.api.destroy();
  }
});

test('failed WebGL creation or module loading preserves usable SVG feedback without retry loops', async () => {
  for (const loader of [() => Promise.reject(Error('Offline')), async () => modelStub({ failCreate: true }).module]) {
    const h = harness({ loadModel: loader }); await settle();
    assert.equal(h.api.getStats().fallback, true);
    assert.equal(h.api.getStats().renderer, 'SVG fallback');
    assert.ok(h.layer.children.every(prop => !prop.classList.contains('dp-rendered')));
    for (let i = 0; i < 10; i++) h.host.emit('pageshow');
    assert.equal(h.imports.length, 1, 'persistent failure must not spin on repeated visibility events');
    h.buttons()[0].emit('click'); assert.equal(h.api.getStats().activations, 1);
    h.flushTimers(); assert.equal(h.timers.size, 0);
    assert.deepEqual(h.actions, []);
    h.api.destroy();
  }
});

test('lost WebGL context restores SVG, releases the renderer and preserves button feedback', async () => {
  const stub = modelStub(), h = harness({ loadModel: async () => stub.module }); await settle();
  const renderer = stub.instances[0];
  assert.ok(h.layer.children.every(prop => prop.classList.contains('dp-rendered')));
  renderer.options.onContextLost();
  assert.equal(renderer.disposeCount, 1);
  assert.ok(h.layer.children.every(prop => !prop.classList.contains('dp-rendered')));
  const draws = renderer.renders.length;
  h.buttons()[0].emit('click'); h.flushTimers();
  assert.equal(h.api.getStats().activations, 1);
  assert.equal(renderer.renders.length, draws);
  h.api.destroy(); assert.equal(renderer.disposeCount, 1);
});

test('right mouse presses affect only the decorative right button and return to neutral', async () => {
  const stub = modelStub(), h = harness({ loadModel: async () => stub.module }); await settle();
  const left = h.buttons().find(button => button.classList.contains('dp-mouse-left'));
  left.emit('pointerdown', { button: 2 }); left.emit('pointerup', { button: 2 });
  const press = stub.instances[0].renders.at(-1);
  assert.equal(press.kind, 'mouse'); assert.deepEqual(press.pressed, ['right']);
  assert.equal(left.parentNode.classList.contains('dp-pressed-left'), false);
  const menu = left.emit('contextmenu'); assert.equal(menu.prevented, true); assert.equal(menu.stopped, true);
  h.flushTimers(); assert.deepEqual(stub.instances[0].renders.at(-1).pressed, []);
  assert.deepEqual(h.actions, []); h.api.destroy();
});
