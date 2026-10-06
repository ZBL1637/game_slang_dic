import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const base = new URL('../assets/', import.meta.url);
const data = JSON.parse(await fs.readFile(new URL('culture-exhibit.json', base), 'utf8'));
const code = await fs.readFile(new URL('culture-exhibit.js', base), 'utf8');
const sandbox = { URL };
vm.runInNewContext(code, sandbox, { filename: 'culture-exhibit.js' });
const exhibit = sandbox.CultureExhibit;
const copy = () => structuredClone(data);
const plain = value => JSON.parse(JSON.stringify(value));

/* Minimal DOM with real tree identity, focus loss on detached descendants,
   event bubbling and observable scrolling. It deliberately does not model
   browser geometry or claim visual/layout verification. */
class Target {
  listeners = new Map();
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  emit(type, extra = {}) {
    const event = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
    for (let current = this; current; current = current.parentElement) {
      for (const fn of [...(current.listeners?.get(type) || [])]) fn(event);
    }
    return event;
  }
}
function decode(text) { return text.replace(/&(amp|lt|gt|quot|#39);/g, (_, value) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[value])); }
function dataKey(name) { return name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); }
class Element extends Target {
  constructor(tag, owner) { super(); this.tagName = tag.toUpperCase(); this.nodeType = 1; this.ownerDocument = owner; this.attributes = new Map(); this.dataset = {}; this.childNodes = []; this.parentElement = null; this.htmlWrites = 0; this.scrollTop = 0; this.animationCalls = []; }
  get children() { return this.childNodes.filter(node => node.nodeType === 1); }
  get className() { return this.getAttribute('class') || ''; }
  set className(value) { this.setAttribute('class', value); }
  get classList() { return { add: (...names) => this.className = [...new Set(this.className.split(/\s+/).filter(Boolean).concat(names))].join(' ') }; }
  get id() { return this.getAttribute('id') || ''; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); if (name.startsWith('data-')) this.dataset[dataKey(name)] = String(value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); if (name.startsWith('data-')) delete this.dataset[dataKey(name)]; }
  appendChild(node) { node.parentElement = this; this.childNodes.push(node); return node; }
  contains(node) { for (let current = node; current; current = current.parentElement) if (current === this) return true; return false; }
  clear() {
    if (this.ownerDocument?.activeElement !== this && this.contains(this.ownerDocument?.activeElement)) this.ownerDocument.activeElement = this.ownerDocument.body;
    this.childNodes.forEach(node => node.parentElement = null); this.childNodes = [];
  }
  get textContent() { return this.childNodes.map(node => node.textContent).join(''); }
  set textContent(value) { this.clear(); this.appendChild({ nodeType: 3, textContent: String(value), parentElement: this }); }
  get innerHTML() { return this._html || ''; }
  set innerHTML(html) { this.clear(); this.htmlWrites++; this._html = html; parse(html, this); }
  matches(selector) {
    let remaining = selector.trim();
    const attributes = [...remaining.matchAll(/\[([^\]=\s]+)(?:="([^"]*)")?\]/g)];
    remaining = remaining.replace(/\[[^\]]+\]/g, '');
    if (attributes.some(([, key, value]) => value === undefined ? !this.hasAttribute(key) : this.getAttribute(key) !== value)) return false;
    const id = remaining.match(/#([\w-]+)/)?.[1]; if (id && this.id !== id) return false;
    const classes = [...remaining.matchAll(/\.([\w-]+)/g)].map(match => match[1]);
    if (classes.some(name => !this.className.split(/\s+/).includes(name))) return false;
    const tag = remaining.match(/^[\w-]+/)?.[0]; return !tag || this.tagName.toLowerCase() === tag.toLowerCase();
  }
  querySelectorAll(selector) {
    const found = [];
    const visit = parent => { for (const child of parent.children) { if (child.matches(selector)) found.push(child); visit(child); } };
    visit(this); return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { for (let current = this; current; current = current.parentElement) if (current.matches(selector)) return current; return null; }
  replaceWith(next) {
    const parent = this.parentElement, index = parent.childNodes.indexOf(this);
    if (this.contains(this.ownerDocument.activeElement)) this.ownerDocument.activeElement = this.ownerDocument.body;
    parent.childNodes[index] = next; next.parentElement = parent; this.parentElement = null;
  }
  focus(options) { this.ownerDocument.activeElement = this; this.lastFocusOptions = options; }
  get open() { return this.hasAttribute('open'); }
  showModal() { this.showModalCalls = (this.showModalCalls || 0) + 1; this.setAttribute('open', ''); this.querySelector('.ce-close-button')?.focus({ preventScroll: true }); }
  close() { this.removeAttribute('open'); this.emit('close'); }
  getBoundingClientRect() {
    if (this.matches('.ce-dialog-head')) return { top: 70, left: 100, right: 820, bottom: 150, height: 80 };
    if (this.dataset.ceSourceEntry) {
      const dialog = this.closest('dialog'), index = dialog.querySelectorAll('[data-ce-source-entry]').indexOf(this);
      const top = 200 + index * 180 - dialog.scrollTop;
      return { top, left: 124, right: 796, bottom: top + 160, height: 160 };
    }
    return { top: 100, left: 100, right: 820, bottom: 700, height: 600 };
  }
  animate(frames, options) { const animation = { frames, options, cancelled: false, cancel() { this.cancelled = true; } }; this.animationCalls.push(animation); return animation; }
}
function parse(html, parent) {
  const stack = [parent], voids = new Set(['img', 'br', 'hr', 'input', 'meta', 'link']);
  for (const token of html.match(/<[^>]+>|[^<]+/g) || []) {
    if (token.startsWith('</')) { stack.pop(); continue; }
    if (token.startsWith('<')) {
      const tag = token.match(/^<([\w-]+)/)?.[1]; if (!tag) continue;
      const element = new Element(tag, parent.ownerDocument), attr = token.slice(tag.length + 1, -1);
      for (const match of attr.matchAll(/([^\s=/>]+)(?:="([^"]*)")?/g)) element.setAttribute(match[1], decode(match[2] || ''));
      stack.at(-1).appendChild(element); if (!voids.has(tag)) stack.push(element);
    } else stack.at(-1).appendChild({ nodeType: 3, textContent: decode(token), parentElement: stack.at(-1) });
  }
}
function setup() {
  const owner = { hidden: false, documentElement: { lang: 'zh' }, activeElement: null, createElement(tag) { return new Element(tag, this); } };
  owner.body = owner.createElement('body'); owner.activeElement = owner.body;
  const section = owner.createElement('section'), header = owner.createElement('header'), old = owner.createElement('div'), summary = owner.createElement('footer');
  old.className = 'culture-content'; header.textContent = 'Existing chapter heading'; summary.textContent = 'Accurate editorial summary';
  owner.body.appendChild(section); section.appendChild(header); section.appendChild(old); section.appendChild(summary);
  const motion = new Target(); motion.matches = false;
  const target = new Target(); target.i18n = { getLang: () => 'zh' }; target.matchMedia = () => motion; target.scrollY = 2000;
  const controller = exhibit.mount(data, section, target), root = section.querySelector('.ce-exhibit');
  return { owner, section, header, summary, root, controller, target, motion };
}
function activate(button) { button.focus({ preventScroll: true }); button.emit('click'); }
function language(target, locale) { target.emit('languagechange', { detail: { lang: locale } }); }

test('supplied terms and three identity comparisons have complete bilingual observations and traceable sources', () => {
  assert.equal(exhibit.validateData(data), data);
  assert.equal(data.terms.length, 6); assert.equal(data.routes.length, 3);
  assert.deepEqual(data.dossiers.map(item => item.id), ['wukong', 'bajie', 'jingubang']);
  const sources = new Map(data.sources.map(item => [item.id, item]));
  for (const term of data.terms) {
    assert.ok(term.sourceIds.some(id => sources.get(id).sourceType.startsWith('official_')), 'public English spelling has official evidence');
    for (const id of term.sourceIds) assert.match(sources.get(id).sourceType, /^(official_\w+|primary_text)$/);
    for (const locale of ['zh', 'en']) assert.ok(term.observation[locale] && term.description[locale] && term.scope[locale]);
  }
  for (const dossier of data.dossiers) {
    for (const locale of ['zh', 'en']) {
      assert.ok(dossier.label[locale] && dossier.takeaway[locale]);
      for (const side of [dossier.left, dossier.right]) for (const key of ['name', 'role', 'description']) assert.ok(side[key][locale]);
    }
    for (const id of dossier.sourceIds) assert.ok(sources.has(id));
  }
  assert.equal(data.terms.find(item => item.id === 'jingubang').en, 'Jingubang');
  assert.equal(data.terms.find(item => item.id === 'loong').en, 'Yellow Loong');
  assert.doesNotMatch(JSON.stringify(data), /Pigsy|Jin Gu Bang|十诫|西方龙必然/);
});

test('teaching sentences and per-card reading notes are distinct from official dialogue', () => {
  assert.equal(data.experiment.sourceType, 'teaching_example');
  assert.equal(data.experiment.original, '当心这片山里的妖怪。');
  assert.deepEqual(data.experiment.variants.map(item => item.english), ['Beware of yaoguai in these mountains.', 'Beware of monsters in these mountains.']);
  for (const locale of ['zh', 'en']) {
    assert.ok(data.experiment.boundary[locale]);
    for (const variant of data.experiment.variants) assert.ok(variant.carries[locale] && variant.needs[locale]);
    const html = exhibit.renderExhibit(data, exhibit.createController(data, locale).getState());
    assert.match(html, /Beware of <mark>yaoguai<\/mark> in these mountains\./);
    assert.match(html, /Beware of <mark>monsters<\/mark> in these mountains\./);
    assert.equal((html.match(/class="ce-variant-notes"/g) || []).length, 2);
    assert.equal((html.match(/class="ce-lab-boundary"/g) || []).length, 1);
    assert.doesNotMatch(html, /class="ce-teaching-note"/, 'avoid repeating the boundary beneath itself');
    assert.equal((html.match(/class="ce-module /g) || []).length, 4);
    assert.equal((html.match(/<img /g) || []).length, 1, 'only the catalogue illustration belongs to the mounted content');
  }
});

test('the original text highlight is exact, without changing any quoted characters', () => {
  const controller = exhibit.createController(data, 'zh');
  for (const route of data.routes) {
    assert.ok(route.highlight && route.quote.includes(route.highlight));
    const source = data.sources.find(item => item.id === route.sourceIds[0]);
    assert.equal(source.sourceType, 'primary_text');
    assert.match(source.url, /zh\.wikisource\.org\/wiki\/西遊記\/第\d{3}回$/);
    controller.choose('route', route.id);
    const owner = { activeElement: null }, root = new Element('div', owner);
    root.innerHTML = exhibit.renderExhibit(data, controller.getState());
    const quote = root.querySelector('#ce-route-detail').querySelector('blockquote');
    assert.equal(quote.textContent, '“' + route.quote + '”');
    assert.equal(quote.querySelector('mark').textContent, route.highlight);
  }
});

test('component spelling is paired honestly while the public source instance remains explicit', () => {
  const controller = exhibit.createController(data, 'zh'); controller.choose('term', 'loong');
  const root = new Element('div', { activeElement: null }); root.innerHTML = exhibit.renderExhibit(data, controller.getState());
  assert.equal(root.querySelector('.ce-term-pair').textContent, '龙→Loong');
  assert.match(root.querySelector('#ce-term-detail').textContent, /Yellow Loong/);
  assert.doesNotMatch(root.querySelector('.ce-term-pair').textContent, /Yellow/);
});

test('controller repeats are no-ops, invalid selections are rejected and source entries are validated', () => {
  let changes = 0;
  const controller = exhibit.createController(data, 'unsupported', () => changes++);
  const initial = plain(controller.getState());
  assert.equal(initial.locale, 'zh');
  for (const key of ['term', 'strategy', 'route', 'dossier']) assert.equal(controller.choose(key, initial[key]), false);
  assert.equal(controller.setLocale('zh'), false); assert.equal(controller.showSources(false), false);
  assert.equal(controller.choose('constructor', 'x'), false); assert.equal(controller.choose('term', 'unknown'), false);
  assert.equal(controller.showSources(true, 'unknown'), false); assert.equal(changes, 0);
  controller.choose('term', 'bajie'); controller.showSources(true, 'novel-19');
  assert.equal(controller.showSources(true, 'novel-19'), false);
  assert.equal(changes, 2); assert.equal(controller.getState().sourceId, 'novel-19');
  const snapshot = controller.getState(); snapshot.term = 'corrupted'; assert.equal(controller.getState().term, 'bajie');
});

test('locale changes preserve all selections and open-source state; listener cleanup is effective', () => {
  const controller = exhibit.createController(data, 'zh'), target = new Target(), cleanup = exhibit.bindLanguage(controller, target);
  controller.choose('term', 'jingubang'); controller.choose('strategy', 'familiar'); controller.choose('route', 'discipline'); controller.choose('dossier', 'bajie'); controller.showSources(true, 'teaching');
  language(target, 'en');
  assert.deepEqual(plain(controller.getState()), { locale: 'en', term: 'jingubang', strategy: 'familiar', route: 'discipline', dossier: 'bajie', sourcesOpen: true, sourceId: 'teaching' });
  cleanup(); language(target, 'zh'); assert.equal(controller.getState().locale, 'en');
});

test('unsafe sources, inconsistent highlights and incomplete new comparison fields are rejected', () => {
  for (const [change, message] of [
    [d => d.terms[0].sourceIds = ['missing'], /Missing evidence/],
    [d => d.sources[0].url = 'javascript:alert(1)', /HTTPS/],
    [d => d.sources.push(d.sources[0]), /Invalid source/],
    [d => d.experiment.sourceType = 'official_announcement', /Teaching material/],
    [d => d.routes[0].highlight = 'not present in the original', /Highlight/],
    [d => d.dossiers[0].left.description.en = '', /identity comparison/],
    [d => d.experiment.variants[0].carries.en = '', /comparison translation/]
  ]) { const changed = copy(); change(changed); assert.throws(() => exhibit.validateData(changed), message); }
});

test('new pairs, source labels and quote highlights are escaped, while external links remain safe', () => {
  const changed = copy(); changed.terms[0].pairEn = '<img src=x onerror=alert(1)>'; changed.terms[0].mark = '<script>';
  changed.routes[0].quote = 'abc <script>alert(1)</script> xyz'; changed.routes[0].highlight = '<script>alert(1)</script>';
  const html = exhibit.renderExhibit(changed, exhibit.createController(changed, 'en').getState());
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/); assert.doesNotMatch(html, /<script>|<img src=x/);
  for (const link of html.matchAll(/<a[^>]+target="_blank"[^>]*>/g)) assert.match(link[0], /rel="noopener noreferrer"/);
  assert.doesNotMatch(html.match(/class="ce-term-button"[\s\S]*?<\/button>/)[0], /↗/);
});

test('rapid term changes update only their detail and preserve all controls, images, dialog and focused button', () => {
  const { root, controller, owner, target } = setup();
  const term = root.querySelector('#ce-term-detail'), lab = root.querySelector('.ce-lab'), map = root.querySelector('#ce-route-detail');
  const image = root.querySelector('img'), dialog = root.querySelector('dialog'), button = root.querySelector('[data-ce-key="term-bajie"]');
  const mapHTML = map.innerHTML, mapWrites = map.htmlWrites, termWrites = term.htmlWrites; button.focus({ preventScroll: true });
  for (const id of ['bajie', 'jingubang', 'loong', 'bajie']) controller.choose('term', id);
  assert.equal(root.htmlWrites, 1); assert.equal(term.htmlWrites, termWrites + 4);
  assert.equal(root.querySelector('.ce-lab'), lab); assert.equal(root.querySelector('img'), image);
  assert.equal(root.querySelector('dialog'), dialog); assert.equal(root.querySelector('[data-ce-key="term-bajie"]'), button);
  assert.equal(map.innerHTML, mapHTML); assert.equal(map.htmlWrites, mapWrites); assert.equal(owner.activeElement, button);
  assert.equal(target.scrollY, 2000, 'controller does not request a page scroll');
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  const before = term.htmlWrites; activate(button); assert.equal(term.htmlWrites, before, 'clicking the selected option does no DOM work');
});

test('a specific source opens at its own entry, below the dialog header, and closes back to its exact trigger', () => {
  const { root, owner } = setup();
  const button = root.querySelector('.ce-lab-boundary').querySelector('[data-ce-source="teaching"]'), dialog = root.querySelector('dialog');
  activate(button);
  const entry = dialog.querySelector('[data-ce-source-entry="teaching"]');
  assert.equal(dialog.open, true); assert.equal(owner.activeElement, entry);
  assert.equal(entry.getBoundingClientRect().top - dialog.getBoundingClientRect().top, 104, '80px sticky header plus 24px space');
  const event = dialog.emit('cancel'); assert.equal(event.defaultPrevented, true);
  assert.equal(dialog.open, false); assert.equal(owner.activeElement, button); assert.equal(button.lastFocusOptions.preventScroll, true);
});

test('an open dialog and its scroll position survive locale changes, and logical source focus returns to the same detail', () => {
  const { root, controller, owner, target } = setup();
  const oldTrigger = root.querySelector('#ce-term-detail').querySelector('[data-ce-source]'), dialog = root.querySelector('dialog');
  activate(oldTrigger); const entry = owner.activeElement; dialog.scrollTop = 321;
  language(target, 'en');
  assert.equal(root.querySelector('dialog'), dialog); assert.equal(dialog.open, true); assert.equal(dialog.showModalCalls, 1);
  assert.equal(dialog.scrollTop, 321); assert.equal(owner.activeElement, entry);
  assert.match(root.querySelector('#ce-term-title').textContent, /Keyword comparison/);
  const replacement = root.querySelector('#ce-term-detail').querySelector('[data-ce-source]');
  assert.notEqual(replacement, oldTrigger, 'localized detail contents may change while the detail container remains');
  controller.showSources(false); assert.equal(owner.activeElement, replacement);
});

test('native dialog close and backdrop close restore the actual source button', () => {
  const { root, owner, controller } = setup(), trigger = root.querySelector('.ce-lab-boundary').querySelector('[data-ce-source]');
  const dialog = root.querySelector('dialog');
  activate(trigger); dialog.close();
  assert.equal(controller.getState().sourcesOpen, false); assert.equal(owner.activeElement, trigger);
  activate(trigger); dialog.emit('click', { clientX: 5, clientY: 5 });
  assert.equal(dialog.open, false); assert.equal(owner.activeElement, trigger);
  activate(trigger); dialog.emit('click', { clientX: 110, clientY: 120 }); assert.equal(dialog.open, true, 'clicking the dialog padding does not count as backdrop');
});

test('short local animations cancel stale runs and obey reduced motion, hidden pages and destroy cleanup', () => {
  const { root, controller, motion, owner, target } = setup(), detail = root.querySelector('#ce-term-detail');
  controller.choose('term', 'bajie'); const first = detail.animationCalls[0]; assert.equal(first.options.duration, 180);
  controller.choose('term', 'loong'); assert.equal(first.cancelled, true);
  const second = detail.animationCalls.at(-1); motion.matches = true; motion.emit('change'); assert.equal(second.cancelled, true);
  controller.choose('term', 'wukong'); assert.equal(detail.animationCalls.length, 2);
  motion.matches = false; owner.hidden = true; controller.choose('term', 'jingubang'); assert.equal(detail.animationCalls.length, 2);
  owner.hidden = false; controller.choose('term', 'destined'); const last = detail.animationCalls.at(-1);
  controller.destroy(); assert.equal(last.cancelled, true); assert.equal(target.listeners.get('languagechange').size, 0); assert.equal(motion.listeners.get('change').size, 0);
  const writes = detail.htmlWrites; controller.choose('term', 'bajie'); assert.equal(detail.htmlWrites, writes);
});

test('mount preserves adjacent chapter DOM and summary, and duplicate initialization is harmless', () => {
  const { section, header, summary, root, controller, target } = setup();
  assert.deepEqual(section.children, [header, root, summary]);
  const summaryText = summary.textContent;
  controller.choose('dossier', 'bajie'); language(target, 'en');
  assert.deepEqual(section.children, [header, root, summary]); assert.equal(summary.textContent, summaryText);
  assert.equal(exhibit.mount(data, section, target), null);
  assert.equal(root.querySelectorAll('.ce-module').length, 4);
  assert.equal(root.querySelectorAll('.ce-identity').length, 2);
  assert.equal(root.querySelector('.ce-dossier-grid'), null);
});
