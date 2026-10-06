import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../assets/home-refinements.js', import.meta.url), 'utf8');
const cursorCode = source.slice(source.indexOf('  function initManagedCursor() {'), source.indexOf("  document.addEventListener('DOMContentLoaded', () => {"));
function harness({ fine = true, childOrigin = 'http://localhost:8001' } = {}) {
  const targets = [], frames = new Map(), observers = [];
  let nextId = 0;
  class Target {
    constructor() { this.events = new Map(); targets.push(this); }
    addEventListener(type, fn) { if (!this.events.has(type)) this.events.set(type, new Set()); this.events.get(type).add(fn); }
    removeEventListener(type, fn) { this.events.get(type)?.delete(fn); }
    emit(type, values = {}) { for (const fn of [...(this.events.get(type) || [])]) fn({ type, ...values }); }
  }
  class Element extends Target {
    constructor(tag, doc) {
      super(); this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.parentElement = null; this.children = []; this.attributes = {}; this.style = {};
      this.nodeType = 1; this.disabled = false; const classes = new Set();
      this.classList = { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name), toggle: (name, force) => { const enabled = force ?? !classes.has(name); if (enabled) classes.add(name); else classes.delete(name); return enabled; } };
    }
    get isConnected() { return this === this.ownerDocument?.documentElement || Boolean(this.parentElement?.isConnected); }
    get className() { return ''; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    appendChild(child) { child.remove(); child.parentElement = this; this.children.push(child); return child; }
    remove() { if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = null; }
    matches(selector) {
      return selector.split(',').some(part => {
        const value = part.trim();
        if (value.startsWith('.')) return this.classList.contains(value.slice(1));
        if (value === 'input:not([type="hidden"])') return this.tagName === 'INPUT' && this.getAttribute('type') !== 'hidden';
        const match = value.match(/^([a-z]+)?\[([^=\]]+)(?:="([^"]*)")?\]$/);
        if (match) return (!match[1] || this.tagName === match[1].toUpperCase()) && (match[3] === undefined ? this.getAttribute(match[2]) !== null : this.getAttribute(match[2]) === match[3]);
        return value.toUpperCase() === this.tagName;
      });
    }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
    querySelectorAll(selector) { return this.children.flatMap(child => [child, ...child.querySelectorAll('*')]).filter(child => selector === '*' || child.matches(selector)); }
    getBoundingClientRect() { return this.box || { left: 0, top: 0, width: 100, height: 50 }; }
  }
  function makeDocument(origin = 'http://localhost:8001') {
    const doc = new Target(); doc.hidden = false; doc.hasFocus = () => true;
    doc.documentElement = new Element('html', doc); doc.head = new Element('head', doc); doc.body = new Element('body', doc);
    doc.documentElement.appendChild(doc.head); doc.documentElement.appendChild(doc.body);
    doc.createElement = tag => new Element(tag, doc);
    doc.querySelectorAll = selector => doc.documentElement.querySelectorAll(selector);
    doc.querySelector = selector => doc.querySelectorAll(selector)[0] || null;
    const win = new Target(); win.document = doc; win.location = { origin };
    win.getComputedStyle = element => ({ paddingLeft: element.style.paddingLeft || '0px', paddingTop: element.style.paddingTop || '0px' });
    doc.defaultView = win; return doc;
  }
  function makeFrame(doc, origin = 'http://localhost:8001') {
    const element = new Element('iframe', doc);
    element.offsetWidth = 200; element.offsetHeight = 100; element.clientLeft = 0; element.clientTop = 0;
    element.box = { left: 100, top: 200, width: 200, height: 100 };
    element.contentDocument = makeDocument(origin); element.contentWindow = element.contentDocument.defaultView;
    doc.body.appendChild(element); return element;
  }
  const document = makeDocument(), host = document.defaultView;
  const cursor = new Element('div', document); cursor.classList.add('custom-cursor'); document.body.appendChild(cursor);
  const iframe = makeFrame(document, childOrigin), mode = new Target(); mode.matches = fine;
  Object.assign(host, {
    console, window: host, matchMedia: () => mode,
    requestAnimationFrame(fn) { const id = ++nextId; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    MutationObserver: class {
      constructor(fn) { this.fn = fn; this.node = null; observers.push(this); }
      observe(node) { this.node = node; }
      disconnect() { this.node = null; }
    }
  });
  vm.createContext(host); vm.runInContext(cursorCode + '\ninitManagedCursor();', host);
  const add = (doc, tag, attrs = {}) => { const element = new Element(tag, doc); Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, value)); doc.body.appendChild(element); return element; };
  return { document, host, cursor, iframe, mode, frames, observers, makeDocument, makeFrame, add,
    get api() { return host.GameCursor; },
    move(doc, target, x, y, type = 'mouse') { doc.emit('pointermove', { target, clientX: x, clientY: y, pointerType: type }); },
    flush() { const batch = [...frames]; frames.clear(); batch.forEach(([, fn]) => fn()); },
    mutate(doc, addedNodes = []) { for (const observer of observers) if (observer.node?.ownerDocument === doc) observer.fn([{ addedNodes }]); },
    styles(doc) { return doc.head.children.filter(node => node.getAttribute('data-game-cursor-style') !== null); },
    countListeners() { return targets.reduce((n, target) => n + [...target.events.values()].reduce((sum, callbacks) => sum + callbacks.size, 0), 0); }
  };
}

test('normal content uses the parent overlay; real buttons, answer controls and drag items use its dot state', () => {
  const h = harness(), paragraph = h.add(h.document, 'p');
  h.move(h.document, paragraph, 55, 76); h.flush();
  assert.equal(h.cursor.style.left, '55px'); assert.equal(h.cursor.style.top, '76px');
  assert.equal(h.cursor.classList.contains('hover'), false); assert.equal(h.cursor.getAttribute('aria-hidden'), 'true');
  for (const [tag, attrs] of [['button', {}], ['a', { href: '#home' }], ['input', { type: 'text' }], ['select', {}], ['summary', {}], ['div', { role: 'button' }], ['li', { draggable: 'true' }]]) {
    const control = h.add(h.document, tag, attrs); h.move(h.document, control, 60, 80); h.flush();
    assert.equal(h.cursor.classList.contains('hover'), true, tag);
  }
  const disabled = h.add(h.document, 'button'); disabled.disabled = true;
  h.move(h.document, disabled, 60, 80); h.flush(); assert.equal(h.cursor.classList.contains('hover'), false);
  h.api.destroy();
});

test('iframe coordinates include CSS scaling, border and padding without adding child scroll offsets', () => {
  const h = harness(), child = h.iframe.contentDocument, answer = h.add(child, 'button');
  h.iframe.box = { left: 100, top: 200, width: 400, height: 300 };
  h.iframe.clientLeft = 2; h.iframe.clientTop = 3; h.iframe.style.paddingLeft = '4px'; h.iframe.style.paddingTop = '5px';
  child.defaultView.scrollY = 900;
  h.move(child, answer, 20, 10); h.flush();
  assert.equal(h.cursor.style.left, '152px'); assert.equal(h.cursor.style.top, '254px');
  assert.equal(h.cursor.classList.contains('hover'), true); assert.equal(h.api.getState().documents, 2);
  assert.equal(h.styles(child).length, 1); assert.equal(child.documentElement.classList.contains('gc-cursor-managed'), true);
  h.api.destroy();
});

test('nested same-origin documents map back through both iframe viewports', () => {
  const h = harness(), child = h.iframe.contentDocument, nested = h.makeFrame(child);
  nested.box = { left: 30, top: 40, width: 200, height: 100 };
  h.mutate(child, [nested]);
  const inside = h.add(nested.contentDocument, 'button');
  h.move(nested.contentDocument, inside, 5, 7); h.flush();
  assert.equal(h.cursor.style.left, '135px'); assert.equal(h.cursor.style.top, '247px');
  assert.equal(h.api.getState().documents, 3); h.api.destroy();
});

test('native sorting drag events keep following the iframe and release the overlay on drag end', () => {
  const h = harness(), child = h.iframe.contentDocument, item = h.add(child, 'li', { draggable: 'true' });
  let prevented = false;
  child.emit('dragover', { target: item, clientX: 35, clientY: 45, preventDefault() { prevented = true; } });
  h.flush();
  assert.equal(h.cursor.style.left, '135px'); assert.equal(h.cursor.style.top, '245px');
  assert.equal(h.cursor.classList.contains('hover'), true); assert.equal(prevented, false);
  child.emit('dragend'); assert.equal(h.api.getState().visible, false);
  h.api.destroy(); assert.equal(h.countListeners(), 0);
});

test('iframe reload removes old hooks/styles and cancelled old frames cannot move the new overlay', () => {
  const h = harness(), oldDoc = h.iframe.contentDocument, oldButton = h.add(oldDoc, 'button');
  h.move(oldDoc, oldButton, 1, 1); const stale = [...h.frames.values()][0];
  const fresh = h.makeDocument(); h.iframe.contentDocument = fresh; h.iframe.contentWindow = fresh.defaultView; h.iframe.emit('load');
  assert.equal(h.styles(oldDoc).length, 0); assert.equal(oldDoc.documentElement.classList.contains('gc-cursor-managed'), false);
  assert.equal([...oldDoc.events.values()].reduce((n, values) => n + values.size, 0), 0);
  assert.equal(h.api.getState().documents, 2); assert.equal(h.styles(fresh).length, 1);
  h.move(fresh, h.add(fresh, 'p'), 40, 30); h.flush(); const before = h.cursor.style.left;
  stale(); assert.equal(h.cursor.style.left, before); assert.equal(h.cursor.classList.contains('hover'), false);
  h.api.destroy(); assert.equal(h.countListeners(), 0); assert.equal(h.frames.size, 0);
  assert.ok(h.observers.every(observer => !observer.node));
});

test('coarse input never installs child cursor hiding; media changes release and restore management once', () => {
  const h = harness({ fine: false }), child = h.iframe.contentDocument;
  assert.equal(h.api.getState().active, false); assert.equal(h.styles(child).length, 0);
  h.mode.matches = true; h.mode.emit('change');
  assert.equal(h.api.getState().documents, 2); assert.equal(h.styles(child).length, 1);
  h.move(child, h.add(child, 'button'), 20, 20, 'touch'); h.flush();
  assert.equal(h.api.getState().visible, false);
  h.mode.matches = false; h.mode.emit('change');
  assert.equal(h.api.getState().documents, 0); assert.equal(h.styles(child).length, 0);
  assert.equal(h.document.documentElement.classList.contains('gc-cursor-managed'), false);
  h.mode.matches = true; h.mode.emit('change'); assert.equal(h.styles(child).length, 1);
  h.api.destroy();
});

test('cross-origin frames and native top-layer dialogs retain native cursor behavior', () => {
  const h = harness({ childOrigin: 'https://external.example' });
  assert.equal(h.api.getState().documents, 1); assert.equal(h.styles(h.iframe.contentDocument).length, 0);
  h.move(h.document, h.iframe, 110, 220); h.flush(); assert.equal(h.api.getState().visible, false);
  const dialog = h.add(h.document, 'dialog', { open: '' }); const button = h.add(h.document, 'button'); dialog.appendChild(button);
  h.move(h.document, button, 150, 150); h.flush(); assert.equal(h.api.getState().visible, false);
  h.api.destroy();
});

test('pointer events coalesce to the newest document and leaving cancels pending frames', () => {
  const h = harness(), a = h.add(h.document, 'p'), b = h.add(h.iframe.contentDocument, 'button');
  h.move(h.document, a, 20, 30); h.move(h.iframe.contentDocument, b, 40, 50);
  assert.equal(h.frames.size, 1); h.flush(); assert.equal(h.cursor.style.left, '140px');
  h.move(h.document, a, 10, 20); h.document.emit('pointerout', { relatedTarget: null });
  assert.equal(h.frames.size, 0); assert.equal(h.api.getState().visible, false);
  h.api.destroy();
});

test('removed frames and page suspension clean listeners and restore on BFCache return', () => {
  const h = harness(), child = h.iframe.contentDocument;
  h.move(child, h.add(child, 'button'), 20, 20); h.flush();
  h.iframe.remove(); h.mutate(h.document);
  assert.equal(h.api.getState().documents, 1); assert.equal(h.styles(child).length, 0); assert.equal(h.api.getState().visible, false);
  h.host.emit('pagehide', { persisted: true }); assert.equal(h.api.getState().documents, 0);
  h.host.emit('pageshow', { persisted: true }); assert.equal(h.api.getState().documents, 1);
  h.host.emit('pagehide', { persisted: false }); assert.equal(h.countListeners(), 0);
  assert.equal(h.frames.size, 0); assert.ok(h.observers.every(observer => !observer.node));
});
