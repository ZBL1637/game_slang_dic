import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const [controllerCode, coreCode] = await Promise.all([
  fs.readFile(new URL('../assets/word-scanner.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../assets/word-scanner-core.js', import.meta.url), 'utf8')
]);
const rows = Array.from({ length: 100 }, (_, index) => ({ slang: `词条 ${index}`, definition: `释义 ${index}`, gameKey: 'game', game: 'Example game' }));

function harness({ width = 1000, fine = true, rng = Math.random } = {}) {
  const targets = [], frames = new Map(), timers = new Map(), observers = [];
  let nextId = 0, fontReady;
  class Target {
    constructor() { this.events = new Map(); targets.push(this); }
    addEventListener(type, fn) { if (!this.events.has(type)) this.events.set(type, new Set()); this.events.get(type).add(fn); }
    removeEventListener(type, fn) { this.events.get(type)?.delete(fn); }
    emit(type, values = {}) { for (const fn of [...(this.events.get(type) || [])]) fn({ type, target: this, preventDefault() {}, ...values }); }
  }
  class Element extends Target {
    constructor(tag) {
      super(); this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.parentElement = null;
      this.children = []; this.dataset = {}; this.attributes = {}; this.hidden = false; this.disabled = false; this.id = '';
      this.style = { height: '', writes: [], setProperty(name, value) { this[name] = value; this.writes.push([name, value]); } };
      this._text = ''; this.classes = new Set();
      this.classList = { add: (...names) => names.forEach(name => this.classes.add(name)), remove: (...names) => names.forEach(name => this.classes.delete(name)), contains: name => this.classes.has(name), toggle: (name, force) => { const enabled = force ?? !this.classes.has(name); if (enabled) this.classes.add(name); else this.classes.delete(name); return enabled; } };
    }
    get className() { return [...this.classes].join(' '); }
    set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this._text = String(value); for (const child of this.children) child.parentElement = null; this.children = []; }
    get isConnected() { return this === doc.documentElement || Boolean(this.parentElement?.isConnected); }
    appendChild(child) {
      if (child.isConnected && child.contains(doc.activeElement)) {
        const focused = doc.activeElement; doc.activeElement = doc.body;
        dispatch(focused, 'focusout', { relatedTarget: doc.body });
      }
      child.remove(); child.parentElement = this; this.children.push(child); return child;
    }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    insertBefore(child, before) { child.remove(); child.parentElement = this; this.children.splice(this.children.indexOf(before), 0, child); }
    replaceChildren(...children) { for (const child of [...this.children]) child.remove(); this._text = ''; this.append(...children); }
    remove() { if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = null; }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    removeAttribute(name) { delete this.attributes[name]; }
    matches(selector) { return selector[0] === '.' ? this.classes.has(selector.slice(1)) : selector[0] === '#' ? this.id === selector.slice(1) : this.tagName === selector.toUpperCase(); }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
    querySelectorAll(selector) { return this.children.flatMap(child => [child, ...child.querySelectorAll('*')]).filter(child => selector === '*' || child.matches(selector)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    get clientWidth() { return this.width ?? this.parentElement?.clientWidth ?? width; }
    get clientHeight() { return parseFloat(this.style.height) || 800; }
    get offsetWidth() { return Math.min(parseFloat(this.style.maxWidth) || Infinity, this.classes.has('ws-word') ? this.textContent.length * 9 + 34 : 340); }
    get offsetHeight() { return this.classes.has('ws-word') ? Math.ceil((this.textContent.length * 9 + 34) / this.offsetWidth) * 24 + 20 : Math.min(parseFloat(this.style.maxHeight) || Infinity, 76 + this.querySelectorAll('.ws-detail-entry').length * 110); }
    getBoundingClientRect() {
      const left = this.box?.left ?? (parseFloat(this.style.left) || 0), top = this.box?.top ?? (parseFloat(this.style.top) || 0);
      const rectWidth = this.box?.width ?? (this.classes.has('ws-field') ? this.clientWidth : this.offsetWidth);
      const rectHeight = this.box?.height ?? (this.classes.has('ws-field') ? this.clientHeight : this.offsetHeight);
      return { left, top, width: rectWidth, height: rectHeight, right: left + rectWidth, bottom: top + rectHeight };
    }
    focus() {
      for (let node = this; node; node = node.parentElement) {
        if (node.hidden || node.style.visibility === 'hidden') return;
      }
      const previous = doc.activeElement; if (previous === this) return;
      doc.activeElement = this;
      if (previous) dispatch(previous, 'focusout', { relatedTarget: this });
      dispatch(this, 'focusin', { relatedTarget: previous });
    }
  }
  const doc = new Target(), win = new Target();
  doc.defaultView = win; doc.hidden = false;
  doc.documentElement = new Element('html'); doc.head = new Element('head'); doc.body = new Element('body');
  doc.documentElement.append(doc.head, doc.body);
  doc.createElement = tag => new Element(tag);
  doc.querySelectorAll = selector => doc.documentElement.querySelectorAll(selector);
  doc.querySelector = selector => doc.documentElement.querySelector(selector);
  doc.fonts = new Target(); doc.fonts.ready = { then(fn) { fontReady = fn; } };
  const fineMode = new Target(), reduced = new Target(); fineMode.matches = fine; reduced.matches = false;
  Object.assign(win, {
    window: win, document: doc, console, innerWidth: 1200, innerHeight: 800,
    Math: Object.assign(Object.create(Math), { random: rng }),
    matchMedia: query => query.includes('reduced') ? reduced : fineMode,
    requestAnimationFrame(fn) { const id = ++nextId; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
    setTimeout(fn) { const id = ++nextId; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    ResizeObserver: class { constructor(fn) { this.kind = 'resize'; this.fn = fn; this.node = null; observers.push(this); } observe(node) { this.node = node; } disconnect() { this.node = null; } },
    IntersectionObserver: class { constructor(fn) { this.kind = 'intersection'; this.fn = fn; this.node = null; observers.push(this); } observe(node) { this.node = node; } disconnect() { this.node = null; } }
  });
  function dispatch(node, type, values = {}) {
    const event = { target: node, preventDefault() {}, ...values };
    for (let current = node; current; current = current.parentElement) current.emit(type, event);
    doc.emit(type, event); win.emit(type, event);
  }
  const board = new Element('div'), field = new Element('div'); field.id = 'floatingWords'; field.width = width;
  doc.body.appendChild(board); board.appendChild(field);
  vm.createContext(win); vm.runInContext(coreCode, win); vm.runInContext(controllerCode, win);
  const flush = () => { const batch = [...frames]; frames.clear(); batch.forEach(([, fn]) => fn()); };
  const intersect = (isIntersecting = true) => observers.filter(o => o.kind === 'intersection' && o.node).forEach(o => o.fn([{ isIntersecting }]));
  return { doc, win, board, field, frames, timers, observers, fineMode, reduced, dispatch, flush,
    mount(data = rows, options = {}) { const api = win.WordScanner.mount(field, data, { lang: 'zh', getGame: e => e.game, getCategory: () => '战术', ...options }); flush(); intersect(); flush(); return api; },
    buttons: () => field.querySelectorAll('.ws-word'), detail: () => doc.querySelector('.ws-detail'),
    tickTimers() { const batch = [...timers]; timers.clear(); batch.forEach(([, fn]) => fn()); },
    resize(newWidth) { field.width = newWidth; observers.filter(o => o.kind === 'resize' && o.node).forEach(o => o.fn([{ contentRect: { width: newWidth } }])); flush(); },
    intersect, fontsReady: () => fontReady?.(),
    click(button, detail = 1) { button.focus(); dispatch(button, 'click', { detail }); flush(); },
    move(x, y, pointerType = 'mouse') { dispatch(field, 'pointermove', { clientX: x, clientY: y, pointerType }); },
    countListeners: () => targets.reduce((sum, target) => sum + [...target.events.values()].reduce((n, listeners) => n + listeners.size, 0), 0)
  };
}

function assertPixels(actual, expected) {
  assert.match(actual, /^-?[0-9.e]+px$/);
  assert.ok(Math.abs(parseFloat(actual) - expected) < 1e-8, 'coordinates agree within subpixel precision');
}

const center = button => ({ x: parseFloat(button.style.left) + button.offsetWidth / 2, y: parseFloat(button.style.top) + button.offsetHeight / 2 });

test('scanning coalesces the latest pointer sample, locks a cached card and never opens a popup automatically', () => {
  const h = harness(), api = h.mount(), [a, b] = h.buttons(), p = center(a), q = center(b);
  h.move(p.x, p.y); h.move(q.x, q.y); assert.equal(h.frames.size, 1); h.flush();
  assert.equal(api.getState().scannedKey, b.dataset.key); assert.equal(h.detail().hidden, true);
  const atmosphere = h.field.querySelector('.ws-atmosphere');
  assertPixels(atmosphere.style['--scan-x'], q.x); assertPixels(atmosphere.style['--scan-y'], q.y);
  assert.deepEqual(atmosphere.style.writes.filter(([name]) => name.startsWith('--scan-')), [['--scan-x', `${q.x}px`], ['--scan-y', `${q.y}px`]], 'only the latest sample writes the two background coordinates');
  assert.equal(b.classList.contains('is-scanned'), true); assert.equal(h.field.querySelector('.ws-lock').hidden, false);
  assert.equal(h.board.querySelector('.ws-status').textContent, '等待扫描');
  h.tickTimers(); assert.ok(h.board.querySelector('.ws-status').textContent.includes(b.textContent));
  assert.equal(h.frames.size, 0); api.destroy();
});

test('scanning maps scaled field coordinates, and clicking the locked blank area opens its definition', () => {
  const h = harness(), api = h.mount(), button = h.buttons()[0], p = center(button);
  h.field.box = { left: 100, top: 200, width: h.field.clientWidth * 2, height: h.field.clientHeight * 2 };
  h.move(100 + p.x * 2, 200 + p.y * 2); h.flush();
  assert.equal(api.getState().scannedKey, button.dataset.key);
  const lens = h.field.querySelector('.ws-lens').style.transform.match(/^translate3d\(([-\d.e]+)px,([-\d.e]+)px,0\)$/);
  assert.ok(lens, 'scanner lens retains a valid translation');
  // Scale/unscale can round at the last floating-point bit across runtimes.
  for (const [actual, expected] of [[lens[1], p.x], [lens[2], p.y],
    [h.field.querySelector('.ws-atmosphere').style['--scan-x'], p.x],
    [h.field.querySelector('.ws-atmosphere').style['--scan-y'], p.y]]) {
    assert.ok(Math.abs(parseFloat(actual) - expected) < 1e-8, 'scanner coordinates agree within subpixel precision');
  }
  h.dispatch(h.field, 'click', { detail: 1 }); h.flush();
  assert.equal(api.getState().pinnedKey, button.dataset.key); assert.equal(h.detail().hidden, false);
  assert.equal(h.field.querySelector('.ws-lens').hidden, true);
  api.destroy();
});

test('a pinned definition survives movement and pointer leave, switches by direct click, and closes from field whitespace', () => {
  const h = harness(), api = h.mount(), [a, b] = h.buttons();
  h.click(a); const q = center(b); h.move(q.x, q.y); h.flush();
  assert.equal(api.getState().pinnedKey, a.dataset.key); h.field.emit('pointerleave'); assert.equal(api.getState().pinnedKey, a.dataset.key);
  h.click(b); assert.equal(api.getState().pinnedKey, b.dataset.key);
  h.dispatch(h.field, 'click', { detail: 1 }); assert.equal(api.getState().pinnedKey, null); assert.equal(h.detail().hidden, true);
  h.click(a); h.doc.emit('pointerdown', { target: h.doc.body }); assert.equal(api.getState().pinnedKey, null);
  assert.equal(h.doc.activeElement, a); api.destroy();
});

test('keyboard focus locks without a popup; Enter focuses close only after visible positioning and Escape restores the word', () => {
  const h = harness(), api = h.mount(), [a, b] = h.buttons();
  a.focus(); assert.equal(api.getState().scannedKey, a.dataset.key); assert.equal(h.detail().hidden, true);
  h.dispatch(a, 'click', { detail: 0 }); const close = h.detail().querySelector('.ws-detail-close');
  assert.equal(h.detail().style.visibility, 'hidden'); close.focus(); assert.equal(h.doc.activeElement, a);
  h.flush(); assert.equal(h.doc.activeElement, close); assert.equal(a.getAttribute('aria-expanded'), 'true');
  h.doc.emit('keydown', { key: 'Escape' }); assert.equal(h.doc.activeElement, a); assert.equal(h.detail().hidden, true);
  h.dispatch(a, 'click', { detail: 0 }); const old = [...h.frames.values()];
  h.doc.emit('keydown', { key: 'Escape' }); b.focus(); old.forEach(fn => fn());
  assert.equal(h.doc.activeElement, b); assert.equal(api.getState().pinnedKey, null); h.flush(); api.destroy();
});

test('mobile uses twelve stable words, ignores touch scanning, and supports direct tap and responsive pinned retention', () => {
  const h = harness({ width: 390, fine: false }), api = h.mount();
  assert.equal(h.buttons().length, 12); assert.equal(h.board.querySelector('.ws-hint').textContent, '点击词条解析，点空白处收起');
  h.move(100, 100, 'touch'); h.flush(); assert.equal(api.getState().scannedKey, null); assert.equal(h.field.querySelector('.ws-lens').hidden, true);
  h.click(h.buttons()[0]); assert.ok(api.getState().pinnedKey); h.resize(1000); assert.equal(h.buttons().length, 30);
  h.click(h.buttons()[29]); const fixed = api.getState().pinnedKey; h.resize(390);
  assert.equal(h.buttons().length, 12); assert.ok(api.getState().keys.includes(fixed)); assert.equal(api.getState().pinnedKey, fixed); api.destroy();
});

test('repeated mounts and font measurements preserve the selected pool, pin and single owned DOM tree', () => {
  const h = harness(), api = h.mount(), initial = [...api.getState().keys]; h.click(h.buttons()[2]); const fixed = api.getState().pinnedKey;
  assert.equal(h.mount(rows.map(row => ({ ...row }))), api); assert.deepEqual([...api.getState().keys], initial); assert.equal(api.getState().pinnedKey, fixed);
  h.fontsReady(); h.flush(); assert.deepEqual([...api.getState().keys], initial);
  assert.equal(h.board.querySelectorAll('.ws-header').length, 1); assert.equal(h.doc.querySelectorAll('.ws-detail').length, 1);
  assert.equal(h.field.querySelectorAll('.ws-lens').length, 1); assert.equal(h.observers.length, 2); api.destroy();
});

test('definitions are text-only, duplicate terms keep their games, and data/language changes discard old scan and pin state', () => {
  const h = harness(); const data = [{ slang: '<img src=x>', definition: '<script>bad()</script>', game: '游戏 A', gameKey: 'a' }, { slang: '<img src=x>', definition: '另一含义', game: '游戏 B', gameKey: 'b' }];
  const api = h.mount(data, { colors: { a: '#7F0056' } }); assert.equal(h.buttons().length, 1); assert.equal(h.buttons()[0].style['--word-color'], '#7F0056');
  h.click(h.buttons()[0]); assert.equal(h.detail().querySelectorAll('.ws-detail-entry').length, 2);
  assert.ok(h.detail().textContent.includes('<script>bad()</script>')); assert.equal(h.detail().querySelectorAll('script').length, 0);
  assert.ok(h.detail().textContent.includes('游戏 A · 战术')); assert.ok(h.detail().textContent.includes('游戏 B · 战术'));
  h.mount([{ slang: 'New', definition: 'Meaning', game: 'Actual game' }], { lang: 'en', getGame: () => '' });
  assert.equal(api.getState().pinnedKey, null); assert.equal(api.getState().scannedKey, null); assert.equal(h.detail().hidden, true);
  assert.equal(h.board.querySelector('.ws-label').textContent, 'Slang scanner'); h.click(h.buttons()[0]); assert.ok(h.detail().textContent.includes('Actual game')); api.destroy();
});

test('offscreen, hidden and reduced-motion states pause CSS and release pointer work without a continuous loop', () => {
  const h = harness(), api = h.mount(), p = center(h.buttons()[0]); h.move(p.x, p.y); h.flush();
  h.field.emit('pointerleave'); assert.equal(h.field.querySelector('.ws-lens').hidden, true); assert.equal(api.getState().scannedKey, null);
  h.reduced.matches = true; h.reduced.emit('change'); assert.equal(h.board.classList.contains('ws-paused'), true);
  h.reduced.matches = false; h.reduced.emit('change'); h.intersect(false); assert.equal(h.board.classList.contains('ws-paused'), true);
  h.intersect(true); h.move(p.x, p.y); h.doc.hidden = true; h.doc.emit('visibilitychange'); assert.equal(h.frames.size, 0); assert.equal(h.field.querySelector('.ws-lens').hidden, true);
  h.doc.hidden = false; h.doc.emit('visibilitychange'); assert.equal(h.board.classList.contains('ws-paused'), false); assert.equal(h.frames.size, 0); api.destroy();
});

test('BFCache reconnects and complete destruction clears every listener, observer, timer and pending callback', () => {
  const h = harness(), api = h.mount(), initial = [...api.getState().keys]; h.click(h.buttons()[0]);
  h.win.emit('pagehide', { persisted: true }); assert.equal(api.getState().suspended, true); assert.equal(h.frames.size, 0); assert.ok(h.observers.every(o => !o.node));
  h.win.emit('pageshow', { persisted: true }); h.flush(); assert.deepEqual([...api.getState().keys], initial); assert.ok(h.observers.every(o => o.node));
  h.doc.emit('keydown', { key: 'Escape' }); const p = center(h.buttons()[0]); h.move(p.x, p.y); h.win.emit('resize'); const old = [...h.frames.values()];
  api.destroy(); old.forEach(fn => fn()); h.fontsReady();
  assert.equal(h.countListeners(), 0); assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0); assert.ok(h.observers.every(o => !o.node));
  assert.equal(h.doc.querySelectorAll('.ws-detail').length, 0); assert.equal(h.buttons().length, 0); assert.equal(h.field.querySelectorAll('.ws-atmosphere').length, 0);
  const fresh = h.mount(); assert.notEqual(fresh, api); fresh.destroy();
});

test('edge popovers stay in a narrow viewport and tall grouped definitions remain scrollable', () => {
  const h = harness({ width: 300 }); h.win.innerWidth = 320; h.win.innerHeight = 420;
  const api = h.mount(Array.from({ length: 12 }, (_, i) => ({ slang: 'Same', definition: `Definition ${i}`, game: `Game ${i}` })));
  const button = h.buttons()[0]; button.box = { left: 270, top: 370, width: 45, height: 44 }; h.click(button);
  assert.ok(parseFloat(h.detail().style.left) >= 12); assert.ok(parseFloat(h.detail().style.top) >= 12);
  assert.ok(parseFloat(h.detail().style.left) + h.detail().offsetWidth <= 308); assert.ok(parseFloat(h.detail().style.maxHeight) <= 396); api.destroy();
});

test('scroll hides the stale pointer lens while keeping a keyboard lock; a pinned popup repositions instead', () => {
  const h = harness(), api = h.mount(), [a, b] = h.buttons(), p = center(a), q = center(b);
  h.move(p.x, p.y); h.flush(); h.win.emit('scroll');
  assert.equal(h.field.querySelector('.ws-lens').hidden, true); assert.equal(api.getState().scannedKey, null);
  a.focus(); h.move(q.x, q.y); h.flush(); assert.equal(api.getState().scannedKey, b.dataset.key);
  h.win.emit('scroll'); assert.equal(api.getState().scannedKey, a.dataset.key); assert.equal(h.field.querySelector('.ws-lens').hidden, true);
  h.field.emit('pointerleave'); assert.equal(api.getState().scannedKey, a.dataset.key);
  h.click(a); h.win.emit('scroll'); assert.equal(api.getState().pinnedKey, a.dataset.key); assert.equal(h.frames.size, 1);
  h.flush(); assert.equal(h.detail().hidden, false); api.destroy();
});

test('resize, late fonts and an equivalent remount keep the existing focused word node in place', () => {
  const h = harness(), api = h.mount(), word = h.buttons()[2];
  word.focus(); assert.equal(api.getState().scannedKey, word.dataset.key);
  h.resize(900); assert.equal(h.doc.activeElement, word); assert.equal(api.getState().scannedKey, word.dataset.key);
  h.fontsReady(); h.flush(); assert.equal(h.doc.activeElement, word);
  h.mount(rows.map(row => ({ ...row }))); assert.equal(h.doc.activeElement, word);
  // This models the browser behavior that the controller must avoid.
  h.field.appendChild(word); assert.equal(h.doc.activeElement, h.doc.body);
  api.destroy();
});

test('the decorative background is one non-interactive hidden subtree with fixed, bounded spark coordinates', () => {
  const h = harness(), api = h.mount(), atmosphere = h.field.querySelector('.ws-atmosphere');
  assert.equal(atmosphere.getAttribute('aria-hidden'), 'true'); assert.equal(atmosphere.style.pointerEvents, 'none');
  assert.deepEqual(atmosphere.children.map(node => node.className), ['ws-holo-base', 'ws-holo-reveal', 'ws-holo-flow', 'ws-holo-sparks']);
  const sparks = atmosphere.querySelector('.ws-holo-sparks').children;
  assert.equal(sparks.length, 6);
  for (const spark of sparks) {
    assert.equal(spark.tagName, 'SPAN');
    for (const name of ['--spark-x', '--spark-y']) {
      assert.match(spark.style[name], /^\d+(\.\d+)?%$/);
      assert.ok(parseFloat(spark.style[name]) > 0 && parseFloat(spark.style[name]) < 100);
    }
    assert.match(spark.style['--spark-delay'], /^-?\d+(\.\d+)?s$/);
  }
  assert.equal(atmosphere.querySelectorAll('button').length, 0);
  h.mount(rows.map(row => ({ ...row })));
  assert.equal(h.field.querySelector('.ws-atmosphere'), atmosphere); assert.equal(h.field.querySelectorAll('.ws-holo-reveal').length, 1);
  assert.equal(h.frames.size, 0, 'decorative layers do not schedule an animation loop'); api.destroy();
});

test('keyboard targeting uses the card center, cancels an old pointer sample and yields to the next pointer frame', () => {
  const h = harness(), api = h.mount(), [a, b] = h.buttons(), p = center(a), q = center(b), atmosphere = h.field.querySelector('.ws-atmosphere');
  h.move(q.x, q.y); const stale = [...h.frames.values()]; a.focus();
  assert.equal(h.frames.size, 0); stale.forEach(callback => callback());
  assert.equal(api.getState().scannedKey, a.dataset.key); assert.equal(h.board.classList.contains('ws-targeted'), true);
  assert.equal(h.board.classList.contains('ws-pointer'), false);
  assertPixels(atmosphere.style['--scan-x'], p.x); assertPixels(atmosphere.style['--scan-y'], p.y);
  h.move(q.x, q.y); h.flush();
  assert.equal(h.board.classList.contains('ws-pointer'), true); assert.equal(h.board.classList.contains('ws-targeted'), false);
  assertPixels(atmosphere.style['--scan-x'], q.x); assertPixels(atmosphere.style['--scan-y'], q.y);
  h.field.emit('pointerleave');
  assert.equal(h.board.classList.contains('ws-pointer'), false); assert.equal(h.board.classList.contains('ws-targeted'), true, 'keyboard focus remains visible after pointer departure');
  h.doc.body.focus(); assert.equal(h.board.classList.contains('ws-targeted'), false); api.destroy();
});

test('touch and pinned targeting stay on the selected card through resize and ignore pointer movement', () => {
  for (const fine of [false, true]) {
    const h = harness({ width: 390, fine }), api = h.mount(), [a, b] = h.buttons(), atmosphere = h.field.querySelector('.ws-atmosphere');
    h.dispatch(a, 'click', { detail: 1 }); h.flush();
    const selected = center(a);
    assert.equal(h.board.classList.contains('ws-targeted'), true); assert.equal(h.board.classList.contains('ws-pointer'), false);
    assertPixels(atmosphere.style['--scan-x'], selected.x); assertPixels(atmosphere.style['--scan-y'], selected.y);
    const other = center(b); h.move(other.x, other.y, fine ? 'mouse' : 'touch'); h.flush(); h.field.emit('pointerleave');
    assertPixels(atmosphere.style['--scan-x'], selected.x); assert.equal(h.board.classList.contains('ws-targeted'), true);
    h.resize(1000); const moved = center(a);
    assert.equal(api.getState().pinnedKey, a.dataset.key); assertPixels(atmosphere.style['--scan-x'], moved.x); assertPixels(atmosphere.style['--scan-y'], moved.y);
    api.destroy();
  }
});

test('leave, offscreen, hidden and BFCache suppress active backgrounds and destruction removes the complete decoration', () => {
  const h = harness(), api = h.mount(), [word] = h.buttons(), p = center(word), atmosphere = h.field.querySelector('.ws-atmosphere');
  h.move(p.x, p.y); h.flush(); h.field.emit('pointerleave');
  assert.equal(h.board.classList.contains('ws-pointer'), false); assert.equal(h.board.classList.contains('ws-targeted'), false);
  h.click(word); assert.equal(h.board.classList.contains('ws-targeted'), true);
  h.intersect(false); assert.equal(h.board.classList.contains('ws-targeted'), false); assert.equal(h.board.classList.contains('ws-pointer'), false);
  h.intersect(true); h.flush(); assert.equal(h.board.classList.contains('ws-targeted'), true);
  h.doc.hidden = true; h.doc.emit('visibilitychange'); assert.equal(h.board.classList.contains('ws-targeted'), false);
  h.doc.hidden = false; h.doc.emit('visibilitychange'); h.flush(); assert.equal(h.board.classList.contains('ws-targeted'), true);
  h.reduced.matches = true; h.reduced.emit('change'); assert.equal(h.board.classList.contains('ws-paused'), true); assert.equal(h.board.classList.contains('ws-targeted'), true, 'reduced motion keeps a static selection');
  h.win.emit('pagehide', { persisted: true }); assert.equal(h.board.classList.contains('ws-targeted'), false);
  h.win.emit('pageshow', { persisted: true }); h.flush(); assert.equal(h.board.classList.contains('ws-targeted'), true);
  api.destroy(); assert.equal(atmosphere.isConnected, false);
  assert.equal(h.field.querySelectorAll('.ws-holo-sparks').length, 0); assert.equal(h.board.classList.contains('ws-targeted'), false);
  assert.equal(h.board.classList.contains('ws-pointer'), false); assert.equal(h.countListeners(), 0); assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0);
});
