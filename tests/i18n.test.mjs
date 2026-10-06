import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('parent locale initializes and toggles with unavailable storage, and rejects invalid cache', () => {
  const code = readFileSync(new URL('../assets/i18n.js', import.meta.url), 'utf8');
  for (const mode of ['normal', 'read-denied', 'write-denied', 'both-denied', 'invalid-cache']) {
    const ready = [], clicks = [], events = [], attributes = {};
    const toggle = { setAttribute() {}, addEventListener(type, handler) { if (type === 'click') clicks.push(handler); } };
    const context = vm.createContext({
      window: { dispatchEvent(event) { events.push(event); } },
      document: { documentElement: { setAttribute(key, value) { attributes[key] = value; } }, querySelectorAll() { return []; }, getElementById(id) { return id === 'langToggle' ? toggle : null; }, addEventListener(type, handler) { if (type === 'DOMContentLoaded') ready.push(handler); } },
      navigator: { language: 'zh-CN' },
      localStorage: {
        getItem() { if (['read-denied', 'both-denied'].includes(mode)) throw Error('Storage disabled'); return mode === 'invalid-cache' ? 'invalid' : null; },
        setItem() { if (['write-denied', 'both-denied'].includes(mode)) throw Error('Quota or storage denied'); }
      },
      CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } }
    });
    new vm.Script(code).runInContext(context); ready.forEach(handler => handler());
    assert.equal(context.window.i18n.getLang(), 'zh', mode); assert.equal(clicks.length, 1, mode);
    clicks[0](); assert.equal(context.window.i18n.getLang(), 'en', mode); assert.equal(attributes.lang, 'en', mode);
    assert.equal(events.at(-1).type, 'languagechange'); assert.equal(events.at(-1).detail.lang, 'en');
    clicks[0](); assert.equal(context.window.i18n.getLang(), 'zh', mode); assert.equal(attributes.lang, 'zh', mode);
  }
});
