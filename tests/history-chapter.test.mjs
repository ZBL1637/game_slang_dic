import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/history-chapter.js', import.meta.url), 'utf8');
const modelContext = { module: { exports: {} } };
vm.runInNewContext(source, modelContext);
const model = modelContext.module.exports;

class Events {
    constructor() { this.listeners = new Map(); this.registrations = []; }
    addEventListener(type, callback, options) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Map());
        this.listeners.get(type).set(callback, options);
        this.registrations.push({ type, callback, options });
    }
    removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
    emit(type, details = {}) {
        const event = { type, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...details };
        for (const [callback, options] of [...(this.listeners.get(type) || [])]) {
            if (options?.once) this.removeEventListener(type, callback);
            callback(event);
        }
        return event;
    }
    count(type) { return this.listeners.get(type)?.size || 0; }
}

class Element extends Events {
    constructor(dataset = {}) {
        super(); this.dataset = dataset; this.attributes = new Map(); this.hidden = false;
        this.textContent = ''; this.children = []; const names = new Set();
        this.classList = {
            toggle(name, enabled) { if (enabled) names.add(name); else names.delete(name); },
            contains(name) { return names.has(name); }
        };
    }
    set innerHTML(_) { throw new Error('History text must not be inserted as HTML'); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    querySelectorAll(selector) {
        const keys = [...selector.matchAll(/\[data-([a-z-]+)\]/g)].map(match => match[1].replace(/-([a-z])/g, (_, char) => char.toUpperCase()));
        return this.children.filter(child => keys.every(key => Object.hasOwn(child.dataset, key)));
    }
}

function fixture({ hash = '', reduced = false, loading = false, withResizeObserver = true, missingSection = false } = {}) {
    const win = new Events(), doc = new Events();
    const ids = ['arcade', 'party', 'chance', 'everyday'];
    const section = new Element();
    const bridge = new Element(), bridgeLeaf = new Element({ hxZh: '跨越语言时，这种变化又会怎样发生？', hxEn: 'What happens when it crosses into another language?' });
    bridge.children = [bridgeLeaf];
    const frames = new Map(), allFrames = new Map(), fontReady = [], observers = [], scrollCalls = [], pushes = [];
    let nextFrame = 0, measureReads = 0, language = 'zh';
    const media = { matches: reduced };
    win.document = doc; win.innerHeight = 800; win.scrollY = 0; win.location = { hash };
    win.i18n = { getLang: () => language }; win.matchMedia = () => media;
    win.requestAnimationFrame = callback => { const id = ++nextFrame; frames.set(id, callback); allFrames.set(id, callback); return id; };
    win.cancelAnimationFrame = id => frames.delete(id);
    win.history = { pushState(_state, _unused, url) { pushes.push(url); win.location.hash = url; } };
    const articles = ids.map((id, i) => {
        const element = new Element({ historyStep: id });
        element.absoluteTop = i * 900; element.height = 900;
        element.getBoundingClientRect = () => {
            measureReads++;
            return { top: element.absoluteTop - win.scrollY, bottom: element.absoluteTop + element.height - win.scrollY };
        };
        element.scrollIntoView = options => {
            scrollCalls.push({ id, ...options }); win.scrollY = element.absoluteTop; win.emit('scroll');
        };
        return element;
    });
    const scenes = ids.map(id => new Element({ historyScene: id }));
    const links = ids.map(id => { const element = new Element({ historyNav: id }); element.setAttribute('href', `#history-${id}`); return element; });
    const buttons = ['pofang', 'miaosha'].map(id => new Element({ historyWord: id }));
    const outputs = ['word', 'word', 'game', 'daily', 'note', 'source'].map(id => new Element({ historyOutput: id }));
    const leaf = new Element({ hxZh: '游戏里的词', hxEn: 'Words in games' });
    const aria = new Element({ hxAriaZh: '历史章节', hxAriaEn: 'History chapters' });
    section.children = [...articles, ...scenes, ...links, ...buttons, ...outputs, leaf, aria];
    doc.hidden = false; doc.readyState = loading ? 'loading' : 'complete';
    doc.getElementById = id => id === 'slang-history' && !missingSection ? section : id === 'history-culture-bridge' ? bridge : null;
    doc.fonts = new Events(); doc.fonts.ready = { then(callback) { fontReady.push(callback); } };
    if (withResizeObserver) win.ResizeObserver = class {
        constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
        observe(element) { this.element = element; }
        disconnect() { this.disconnected = true; }
    };
    const context = { window: win, module: { exports: {} } };
    vm.runInNewContext(source, context);
    return {
        win, doc, section, articles, scenes, links, buttons, outputs, leaf, aria, bridgeLeaf,
        frames, allFrames, fontReady, observers, scrollCalls, pushes, media,
        get model() { return win.GameSlangHistoryModel; },
        get runtime() { return win.GameSlangHistory; },
        get reads() { return measureReads; },
        output(name) { return outputs.find(element => element.dataset.historyOutput === name); },
        setLanguage(value) { language = value; win.emit('languagechange'); },
        flush() { const batch = [...frames.values()]; frames.clear(); batch.forEach(callback => callback()); }
    };
}

test('the standalone model exports four chapters and two bilingual, sourced comparisons', () => {
    assert.deepEqual(Array.from(model.order), ['arcade', 'party', 'chance', 'everyday']);
    assert.deepEqual(Object.keys(model.examples), ['pofang', 'miaosha']);
    assert.equal(modelContext.GameSlangHistory, undefined);
    assert.equal(modelContext.GameSlangHistoryModel, model);
    for (const example of Object.values(model.examples)) {
        for (const key of ['word', 'game', 'daily', 'note']) {
            assert.ok(example[key].zh.length > 0); assert.ok(example[key].en.length > 0);
        }
        assert.match(example.source.href, /^https:\/\//);
        assert.match(example.source.label.zh, /来源/); assert.match(example.source.label.en, /source/);
    }
    assert.equal(model.examples.pofang.game.zh, '这一击让对手破防了。');
    assert.equal(model.examples.pofang.source.number, 5);
    assert.equal(model.examples.pofang.source.href, 'https://www.cp.com.cn/Content/2021/12-08/1508424782.html');
    assert.equal(model.examples.miaosha.source.number, 6);
    assert.equal(model.examples.miaosha.source.href, 'https://pdf.hanspub.org/ml2024127_312913487.pdf#page=3');
    assert.match(model.examples.miaosha.note.zh, /不等于唯一词源/);
});

test('reading-line selection handles normal chapters, gaps, shared boundaries and overlaps', () => {
    const rects = [{ id: 'arcade', top: 100, bottom: 500 }, { id: 'party', top: 600, bottom: 1000 }];
    assert.equal(model.selectStep(rects, 800), 'arcade');
    assert.equal(model.selectStep(rects, 100, 0), 'arcade');
    assert.equal(model.selectStep(rects, 800, 1), 'party');
    assert.equal(model.selectStep(rects, 5000, 1), 'party');
    assert.equal(model.selectStep(rects, 550, 1), 'arcade');
    assert.equal(model.selectStep(rects, 570, 1), 'party');
    assert.equal(model.selectStep([{ id: 'arcade', top: 0, bottom: 280 }, { id: 'party', top: 280, bottom: 700 }], 800), 'party');
    assert.equal(model.selectStep([{ id: 'arcade', top: 0, bottom: 500 }, { id: 'party', top: 200, bottom: 700 }], 800), 'party');
});

test('invalid rectangles are ignored and a finite fallback handles invalid viewport inputs', () => {
    assert.equal(model.selectStep(null, 800), null);
    assert.equal(model.selectStep([], 800), null);
    assert.equal(model.selectStep([{ id: 'other', top: 0, bottom: 800 }, { id: 'arcade', top: NaN, bottom: 800 }, { id: 'party', top: 500, bottom: 100 }], 800), null);
    assert.equal(model.selectStep([{ id: 'arcade', top: 0, bottom: 800 }], NaN, Infinity), 'arcade');
});

test('scroll and resize use one passive frame without IntersectionObserver or scroll interception', () => {
    const f = fixture({ withResizeObserver: false });
    assert.equal(f.win.IntersectionObserver, undefined);
    f.flush(); assert.equal(f.runtime.getState().activeStep, 'arcade');
    const before = f.reads;
    f.win.scrollY = 1820;
    for (let i = 0; i < 10; i++) { f.win.emit('scroll'); f.win.emit('resize'); }
    assert.equal(f.frames.size, 1); assert.equal(f.reads, before);
    f.flush(); assert.equal(f.reads, before + 4);
    assert.equal(f.runtime.getState().activeStep, 'chance');
    assert.deepEqual(f.scenes.map(scene => scene.hidden), [true, true, false, true]);
    assert.equal(f.links[2].getAttribute('aria-current'), 'step');
    assert.equal(f.links[2].classList.contains('is-active'), true);
    assert.equal(f.links[0].getAttribute('aria-current'), null);
    for (const type of ['scroll', 'resize']) assert.equal(f.win.registrations.find(item => item.type === type).options.passive, true);
    for (const type of ['wheel', 'touchmove', 'keydown']) assert.equal(f.win.count(type), 0);
    f.runtime.destroy();
});

test('native anchor clicks including keyboard activation navigate smoothly; modified clicks remain native', () => {
    const f = fixture(); f.flush();
    const event = f.links[1].emit('click', { button: 0, detail: 0 });
    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(f.scrollCalls.at(-1), { id: 'party', block: 'start', behavior: 'smooth' });
    assert.equal(f.win.location.hash, '#history-party');
    f.flush(); assert.equal(f.runtime.getState().activeStep, 'party');
    const count = f.scrollCalls.length;
    for (const details of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }]) {
        f.links[3].emit('click', details);
    }
    f.links[3].setAttribute('target', '_blank');
    assert.equal(f.links[3].emit('click').defaultPrevented, false);
    assert.equal(f.scrollCalls.length, count);
    assert.equal(f.pushes.length, 1);
    f.runtime.destroy();
});

test('reduced motion switches immediately, and rapid navigation plus resize reads the latest viewport', () => {
    const f = fixture({ reduced: true }); f.flush();
    f.links[1].emit('click'); f.links[3].emit('click'); f.win.emit('resize');
    assert.equal(f.frames.size, 1);
    assert.ok(f.scrollCalls.every(call => call.behavior === 'instant'));
    f.flush(); assert.equal(f.runtime.getState().activeStep, 'everyday');
    f.media.matches = false; f.links[2].emit('click');
    assert.equal(f.scrollCalls.at(-1).behavior, 'smooth');
    f.runtime.destroy();
});

test('initial deep links are respected once; unknown or malformed hashes are safe', () => {
    const f = fixture({ hash: '#history-chance' });
    assert.equal(f.runtime.getState().activeStep, 'chance');
    assert.deepEqual(f.scrollCalls, [{ id: 'chance', block: 'start', behavior: 'instant' }]);
    f.flush(); assert.equal(f.runtime.getState().activeStep, 'chance'); f.runtime.destroy();
    for (const hash of ['#history-missing', '#other-section', '#history-%E0%A4%A']) {
        const other = fixture({ hash }); other.flush();
        assert.equal(other.scrollCalls.length, 0); assert.equal(other.runtime.getState().activeStep, 'arcade'); other.runtime.destroy();
    }
});

test('word interaction updates duplicate labels and citations, while translation preserves selection and chapter', () => {
    const f = fixture(); f.win.scrollY = 2800; f.flush();
    f.buttons[1].emit('click'); f.flush();
    assert.equal(f.buttons[0].getAttribute('aria-pressed'), 'false');
    assert.equal(f.buttons[1].getAttribute('aria-pressed'), 'true');
    assert.deepEqual(f.outputs.filter(node => node.dataset.historyOutput === 'word').map(node => node.textContent), ['秒杀', '秒杀']);
    assert.equal(f.output('game').textContent, '这个敌人被一招秒杀。');
    assert.equal(f.output('daily').textContent, '秒杀活动刚开始，这款商品就售罄了。');
    assert.equal(f.output('source').textContent, '[6]');
    assert.equal(f.output('source').getAttribute('href'), f.model.examples.miaosha.source.href);
    f.setLanguage('en'); f.flush();
    assert.equal(f.runtime.getState().selectedWord, 'miaosha');
    assert.equal(f.runtime.getState().activeStep, 'everyday');
    assert.equal(f.leaf.textContent, 'Words in games');
    assert.equal(f.bridgeLeaf.textContent, f.bridgeLeaf.dataset.hxEn);
    assert.equal(f.aria.getAttribute('aria-label'), 'History chapters');
    assert.equal(f.output('daily').textContent, f.model.examples.miaosha.daily.en);
    assert.equal(f.output('source').getAttribute('aria-label'), 'Read the source for miaosha [6]');
    f.buttons[0].emit('click');
    assert.equal(f.output('source').textContent, '[5]');
    assert.equal(f.output('source').getAttribute('href'), f.model.examples.pofang.source.href);
    f.setLanguage('zh');
    assert.equal(f.leaf.textContent, '游戏里的词'); assert.equal(f.aria.getAttribute('aria-label'), '历史章节');
    assert.equal(f.bridgeLeaf.textContent, f.bridgeLeaf.dataset.hxZh);
    assert.equal(f.output('source').getAttribute('aria-label'), '查看“破防”的来源 [5]');
    f.runtime.destroy();
});

test('native history/fragment navigation is measured without issuing another programmatic scroll', () => {
    const f = fixture(); f.flush();
    f.win.location.hash = '#history-party'; f.win.scrollY = 900;
    f.win.emit('hashchange'); f.win.emit('popstate'); f.flush();
    assert.equal(f.runtime.getState().activeStep, 'party');
    assert.equal(f.scrollCalls.length, 0); assert.equal(f.pushes.length, 0);
    f.runtime.destroy();
});

test('late fonts and content resize share a frame; destroy removes listeners and prevents stale work', () => {
    const f = fixture(); f.flush();
    const mounted = f.runtime.mount(); assert.equal(f.runtime.mount(), mounted);
    assert.equal(f.win.count('scroll'), 1); assert.equal(f.observers.length, 1);
    f.fontReady[0](); f.doc.fonts.emit('loadingdone'); f.observers[0].callback();
    assert.equal(f.frames.size, 1);
    const staleFrame = f.allFrames.get([...f.frames.keys()][0]);
    const readCount = f.reads;
    f.runtime.destroy(); f.runtime.destroy();
    assert.equal(f.runtime.getState(), null); assert.equal(f.frames.size, 0);
    assert.equal(f.observers[0].disconnected, true);
    for (const type of ['scroll', 'resize', 'hashchange', 'popstate', 'load', 'languagechange', 'pagehide', 'pageshow']) assert.equal(f.win.count(type), 0);
    assert.equal(f.doc.count('visibilitychange'), 0); assert.equal(f.doc.fonts.count('loadingdone'), 0);
    for (const node of [...f.links, ...f.buttons]) assert.equal(node.count('click'), 0);
    staleFrame(); f.fontReady[0](); f.observers[0].callback();
    assert.equal(f.frames.size, 0); assert.equal(f.reads, readCount);
});

test('BFCache restoration preserves word choice and uses restored scroll instead of an older hash', () => {
    const f = fixture({ hash: '#history-party' }); f.flush();
    f.buttons[1].emit('click'); f.flush();
    f.win.emit('pagehide', { persisted: true });
    assert.equal(f.runtime.getState(), null); assert.equal(f.win.count('scroll'), 0); assert.equal(f.win.count('pageshow'), 1);
    f.win.scrollY = 2700; f.win.emit('pageshow', { persisted: true });
    f.win.emit('pageshow', { persisted: true }); f.flush();
    assert.equal(f.runtime.getState().selectedWord, 'miaosha');
    assert.equal(f.runtime.getState().activeStep, 'everyday');
    assert.equal(f.scrollCalls.length, 1);
    assert.equal(f.win.count('scroll'), 1); assert.equal(f.buttons[1].count('click'), 1);
    assert.equal(f.output('source').textContent, '[6]');
    assert.equal(f.observers.length, 2); assert.equal(f.observers[0].disconnected, true);
    f.runtime.destroy();
});

test('hidden documents pause pending work and measure current geometry after becoming visible', () => {
    const f = fixture(); f.flush(); f.win.emit('scroll');
    f.doc.hidden = true; f.doc.emit('visibilitychange');
    assert.equal(f.frames.size, 0);
    f.win.scrollY = 1800; f.win.emit('scroll'); f.win.emit('resize');
    assert.equal(f.frames.size, 0);
    f.doc.hidden = false; f.doc.emit('visibilitychange');
    assert.equal(f.frames.size, 1); f.flush();
    assert.equal(f.runtime.getState().activeStep, 'chance'); f.runtime.destroy();
});

test('DOMContentLoaded mounting is idempotent and missing chapter markup is harmless', () => {
    const f = fixture({ loading: true });
    assert.equal(f.runtime.getState(), null);
    f.doc.emit('DOMContentLoaded'); f.doc.emit('DOMContentLoaded'); f.flush();
    assert.equal(f.win.count('scroll'), 1); assert.equal(f.observers.length, 1); f.runtime.destroy();
    const early = fixture({ loading: true }); early.runtime.destroy(); early.doc.emit('DOMContentLoaded');
    assert.equal(early.runtime.getState(), null); assert.equal(early.win.count('scroll'), 0);
    const absent = fixture({ missingSection: true });
    assert.equal(absent.runtime.mount(), null); assert.equal(absent.frames.size, 0); absent.runtime.destroy();
});
