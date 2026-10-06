import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../assets/focused-app.js', import.meta.url), 'utf8');
const bridge = source.slice(source.indexOf('  function bridgeQuiz() {'), source.indexOf('  function revealOriginalSections()'));
function harness({ origin = 'http://localhost:8001', childOrigin = origin } = {}) {
  const frames = new Map(), observers = [], targets = [];
  let nextId = 0, locale = 'zh';
  class Target {
    constructor() { this.events = new Map(); targets.push(this); }
    addEventListener(name, fn) { if (!this.events.has(name)) this.events.set(name, new Set()); this.events.get(name).add(fn); }
    removeEventListener(name, fn) { this.events.get(name)?.delete(fn); }
    emit(name, event = {}) { for (const fn of [...(this.events.get(name) || [])]) fn(event); }
  }
  function childPage(pageOrigin = origin) {
    const child = new Target(), doc = new Target();
    const container = { bottom: 800, getBoundingClientRect() { return { bottom: this.bottom }; } };
    doc.getElementById = id => id === 'dnaContainer' ? container : null;
    child.location = { origin: pageOrigin }; child.scrollY = 0;
    child.getComputedStyle = () => ({ marginBottom: '20px' });
    const changes = []; let childLocale = 'en';
    child.i18n = { getLang: () => childLocale, setLang(value) { childLocale = value; changes.push(value); child.emit('languagechange'); } };
    return { child, doc, container, changes };
  }
  const iframe = new Target(); iframe.style = {};
  let page = childPage(childOrigin);
  iframe.contentWindow = page.child; iframe.contentDocument = page.doc;
  const host = new Target(); host.window = host;
  Object.assign(host, {
    document: { querySelector: selector => selector === '.dna-test-module iframe' ? iframe : null },
    location: { origin }, i18n: { getLang: () => locale },
    requestAnimationFrame(fn) { const id = ++nextId; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class {
      constructor(fn) { this.fn = fn; this.observed = new Set(); observers.push(this); }
      observe(element) { this.observed.add(element); }
      disconnect() { this.observed.clear(); }
    }
  });
  vm.createContext(host); vm.runInContext(bridge + '\nbridgeQuiz();', host);
  return { host, iframe, frames, observers, get page() { return page; },
    flush() { const batch = [...frames]; frames.clear(); batch.forEach(([, fn]) => fn()); },
    language(value) { locale = value; host.emit('languagechange'); },
    load(pageOrigin = origin) { page = childPage(pageOrigin); iframe.contentWindow = page.child; iframe.contentDocument = page.doc; iframe.emit('load'); return page; },
    listeners() { return targets.reduce((sum, target) => sum + [...target.events.values()].reduce((n, listeners) => n + listeners.size, 0), 0); }
  };
}

test('the original same-origin quiz receives language through its own i18n and height can shrink', () => {
  const h = harness();
  assert.deepEqual(h.page.changes, ['zh']); h.flush();
  assert.equal(h.iframe.style.height, '820px');
  h.language('en'); assert.deepEqual(h.page.changes, ['zh', 'en']);
  h.language('en'); assert.deepEqual(h.page.changes, ['zh', 'en'], 'unchanged language should not regenerate a quiz report');
  h.page.container.bottom = 440;
  for (let i = 0; i < 10; i++) h.observers[0].fn();
  assert.equal(h.frames.size, 1); h.flush();
  assert.equal(h.iframe.style.height, '460px', 'resetting a tall result must permit a smaller document height');
  h.host.emit('pagehide', { persisted: false }); assert.equal(h.listeners(), 0);
});

test('iframe replacement releases old observers/listeners and stale frames cannot resize the new quiz', () => {
  const h = harness(), old = h.page, stale = [...h.frames.values()][0];
  h.load(); const currentObserver = h.observers.at(-1);
  assert.equal(h.observers[0].observed.size, 0);
  assert.equal([...old.child.events.values()].reduce((n, listeners) => n + listeners.size, 0), 0);
  assert.equal([...old.doc.events.values()].reduce((n, listeners) => n + listeners.size, 0), 0);
  h.page.container.bottom = 520; h.flush(); assert.equal(h.iframe.style.height, '540px');
  old.container.bottom = 17000; stale(); assert.equal(h.iframe.style.height, '540px');
  h.page.doc.emit('click'); assert.equal(h.frames.size, 1);
  h.host.emit('pagehide', { persisted: false });
  assert.equal(h.frames.size, 0); assert.equal(currentObserver.observed.size, 0); assert.equal(h.listeners(), 0);
});

test('cross-origin and opaque frames are not accessed for language or resize', () => {
  for (const settings of [{ childOrigin: 'https://other.example' }, { origin: 'null', childOrigin: 'null' }]) {
    const h = harness(settings);
    h.language('en'); h.flush();
    assert.deepEqual(h.page.changes, []); assert.equal(h.iframe.style.height, undefined);
    assert.equal(h.observers.length, 0); h.host.emit('pagehide', { persisted: false }); assert.equal(h.listeners(), 0);
  }
});

test('BFCache return reconnects one child observer and keeps the parent language authoritative', () => {
  const h = harness(); h.flush();
  h.host.emit('pagehide', { persisted: true });
  assert.equal(h.frames.size, 0); assert.ok(h.observers.every(item => item.observed.size === 0));
  h.language('en'); assert.equal(h.page.child.i18n.getLang(), 'zh');
  h.host.emit('pageshow', { persisted: true }); h.flush();
  assert.equal(h.page.child.i18n.getLang(), 'en');
  assert.equal(h.observers.filter(item => item.observed.size).length, 1);
  h.host.emit('pagehide', { persisted: false }); assert.equal(h.listeners(), 0);
});
