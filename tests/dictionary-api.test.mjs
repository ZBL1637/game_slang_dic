import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createWorker } from '../backend/core.mjs';

const [code, html, defaultConfig] = await Promise.all([
  readFile(new URL('../assets/dictionary-api.js', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../assets/api-config.json', import.meta.url), 'utf8')
]);
const local = { term: '开黑', definition: '组队游戏', usage: '与朋友组队', examples: ['一起开黑'], context: '游戏', level: '本地词库', synonyms: [] };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
function client(fetcher, { fastTimeout = false } = {}) {
  const context = { URL, AbortController, Uint8Array, TextDecoder, setTimeout: fastTimeout ? (fn, ms) => setTimeout(fn, Math.min(ms, 30)) : setTimeout, clearTimeout };
  vm.createContext(context); vm.runInContext(code, context);
  return { api: context.GameDictionaryAPI, instance: context.GameDictionaryAPI.createClient({ fetch: fetcher, baseURL: 'https://zbl1637.github.io/game_slang_dic/' }) };
}
test('site configuration contains only the known public endpoint and client settings', () => {
  const config = JSON.parse(defaultConfig);
  assert.deepEqual(Object.keys(config).sort(), ['endpoint', 'timeoutMs', 'version']);
  assert.ok(['', 'https://game-slang-api.zbl1637wddy.workers.dev/api/slang/explain'].includes(config.endpoint));
  assert.equal(config.version, 1);
  assert.ok(config.timeoutMs >= 2000 && config.timeoutMs <= 30000);
});
test('an empty endpoint performs local search without an external request', async () => {
  const config = { version: 1, endpoint: '', timeoutMs: 18000 };
  const requests = [], c = client(async url => { requests.push(String(url)); return json(config); });
  const result = await c.instance.search({ query: '开黑', locale: 'zh' }, local);
  assert.equal(result.result, local); assert.equal(result.source, 'local');
  assert.deepEqual(requests, ['https://zbl1637.github.io/game_slang_dic/assets/api-config.json']);
  await c.instance.search({ query: '开黑' }, local); assert.equal(requests.length, 1);
});
test('only a public HTTPS proxy is called, with bounded input and no client credentials', async () => {
  const requests = [], c = client(async (url, options) => {
    requests.push({ url: String(url), options });
    return requests.length === 1 ? json({ endpoint: 'https://proxy.example.test/api/slang/explain' }) : json({ source: 'ai', result: local });
  });
  const outcome = await c.instance.search({ query: '开黑', gameId: 'all', locale: 'en', context: 'x'.repeat(1500) }, local);
  assert.equal(outcome.source, 'remote'); assert.equal(outcome.result.level, 'AI-assisted explanation');
  const request = requests[1]; assert.equal(request.options.method, 'POST'); assert.equal(request.options.credentials, 'omit');
  assert.deepEqual(JSON.parse(JSON.stringify(request.options.headers)), { 'Content-Type': 'application/json' });
  assert.equal(JSON.parse(request.options.body).context.length, 1000);
  for (const endpoint of ['http://untrusted.example/api', 'https://user:password@example.test/api', 'https://example.test/api?key=not-real', 'javascript:alert(1)']) {
    assert.equal(c.api.configValue({ endpoint }, 'https://site.example').endpoint, '');
  }
});
test('bad status, malformed or oversized output all preserve the local dictionary result', async () => {
  for (const response of [json({ error: 'rate_limited' }, 429), new Response('<html>error</html>', { headers: { 'Content-Type': 'text/html' } }), json({ source: 'ai', result: { ...local, definition: 5 } }), json({ source: 'ai', result: { ...local, examples: ['x'.repeat(33000)] } })]) {
    let calls = 0; const c = client(async () => ++calls === 1 ? json({ endpoint: 'https://proxy.example.test/api/slang/explain' }) : response);
    const outcome = await c.instance.search({ query: '开黑', locale: 'zh' }, local);
    assert.equal(outcome.source, 'fallback'); assert.equal(outcome.result.definition, local.definition); assert.match(outcome.result.level, /本地/);
    assert.equal(calls, 2, 'failed paid requests are never retried');
  }
});
test('only the explicit no-evidence 404 is a normal not-found, retaining a local match without a failure label', async () => {
  for (const localResult of [null, local]) {
    let calls = 0;
    const c = client(async () => ++calls === 1 ? json({ endpoint: 'https://proxy.example.test/api/slang/explain' }) : json({ error: 'no_local_evidence' }, 404));
    const outcome = await c.instance.search({ query: localResult ? '开黑' : 'qa未收录词条x927', locale: 'zh' }, localResult);
    assert.equal(outcome.source, localResult ? 'local' : 'not-found'); assert.equal(outcome.result, localResult); assert.equal(calls, 2);
  }
  for (const response of [json({ error: 'not_found' }, 404), json({ error: 'no_local_evidence' }, 429), json({ error: 'no_local_evidence' }, 500), json({ error: 'no_local_evidence' }), new Response('Not Found', { status: 404 })]) {
    let calls = 0; const c = client(async () => ++calls === 1 ? json({ endpoint: 'https://proxy.example.test/api/slang/explain' }) : response);
    const outcome = await c.instance.search({ query: '开黑', locale: 'en' }, null);
    assert.equal(outcome.source, 'fallback'); assert.equal(outcome.result, null); assert.equal(calls, 2);
  }
});
test('a rejected wrong-language provider answer falls back to the current English dictionary evidence with no paid retry', async () => {
  const featured = JSON.parse(await readFile(new URL('../assets/featured-terms.json', import.meta.url), 'utf8'));
  const definition = featured.find(row => row.term === '开黑').definition.en;
  const englishLocal = { ...local, definition, usage: 'Used when forming a team.', examples: [], context: 'Delta Force', level: 'Local dictionary' };
  let providerCalls = 0, clientCalls = 0;
  const worker = createWorker({ dictionaries: {}, featured, fetch: async () => {
    providerCalls++; return json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ ...local, definition: '和朋友一起组队玩游戏。' }) } }] });
  } });
  const c = client(async (url, options) => {
    if (++clientCalls === 1) return json({ endpoint: 'https://proxy.example.test/api/slang/explain' });
    return worker.fetch(new Request(url, { ...options, headers: { ...options.headers, Origin: 'https://zbl1637.github.io', 'CF-Connecting-IP': '192.0.2.8' } }), {
      ALLOWED_ORIGIN: 'https://zbl1637.github.io', LLM_BASE_URL: 'https://provider.example.test', LLM_MODEL: 'test-model', LLM_API_KEY: 'not-a-real-key', IP_LIMITER: { async limit() { return { success: true }; } }
    });
  });
  const outcome = await c.instance.search({ query: '开黑', gameId: 'all', locale: 'en' }, englishLocal);
  assert.equal(outcome.source, 'fallback'); assert.equal(outcome.result.definition, definition); assert.equal(outcome.result.term, '开黑');
  assert.match(outcome.result.level, /^Local dictionary/); assert.equal(providerCalls, 1); assert.equal(clientCalls, 2);
});
test('remote timeout aborts the request and user cancellation never becomes a fallback render', async () => {
  let calls = 0, upstreamSignal;
  const c = client(async (_, options) => {
    if (++calls === 1) return json({ endpoint: 'https://proxy.example.test/api/slang/explain', timeoutMs: 2000 });
    upstreamSignal = options.signal; return new Promise(() => {});
  }, { fastTimeout: true });
  const outcome = await c.instance.search({ query: '开黑' }, local);
  assert.equal(outcome.source, 'fallback'); assert.equal(upstreamSignal.aborted, true);
  const controller = new AbortController(), running = c.instance.search({ query: '开黑' }, local, { signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve)); controller.abort();
  const cancelled = await running; assert.equal(cancelled.source, 'cancelled'); assert.equal(cancelled.result, null);
});
test('configuration failure fails back locally and does not guess an upstream endpoint', async () => {
  let calls = 0; const c = client(async () => { calls++; throw new Error('offline'); });
  const outcome = await c.instance.search({ query: '开黑' }, local);
  assert.equal(outcome.source, 'local'); assert.equal(outcome.result, local); assert.equal(calls, 1);
});

function queryHarness() {
  const timers = new Map(), requests = [], rendered = [], loading = [], listeners = new Map(); let nextTimer = 0, lang = 'zh';
  const elements = { '#searchInput': { value: '' }, '#searchBtn': { disabled: false }, '#popularWords': { style: {} } };
  const context = {
    AbortController, currentGame: 'all', Utils: { safeQuerySelector: id => elements[id] },
    setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; }, clearTimeout(id) { timers.delete(id); },
    setSearchLoading(value) { loading.push(value); }, buildLocalSearchResult(query) { return { ...local, term: query }; },
    displayAIResult(value) { rendered.push(value); }, displayAIError(value) { rendered.push({ error: value }); }, alert() {}
  };
  context.i18n = { getLang: () => lang };
  context.window = { i18n: context.i18n, addEventListener(name, callback) { listeners.set(name, callback); },
    gameDictionaryClient: { search(input, result, options) { return new Promise(resolve => requests.push({ input, result, options, resolve })); } } };
  vm.createContext(context);
  vm.runInContext(html.slice(html.indexOf('        let activeSearchTimer'), html.indexOf('        function displayAIResult')), context);
  return { context, requests, rendered, elements, loading,
    run() { const [id, timer] = [...timers].find(([, timer]) => timer.ms === 180); timers.delete(id); return timer.fn(); },
    language(value) { lang = value; listeners.get('languagechange')(); }, pagehide() { listeners.get('pagehide')(); }
  };
}
test('the real query entry cannot let an older remote response overwrite a newer query', async () => {
  const h = queryHarness(); h.context.aiSearchTerm('旧查询'); const first = h.run();
  h.context.aiSearchTerm('新查询'); const second = h.run();
  assert.equal(h.requests[0].options.signal.aborted, true);
  h.requests[1].resolve({ result: { ...local, term: '新查询' }, source: 'remote' }); await second;
  h.requests[0].resolve({ result: { ...local, term: '旧查询' }, source: 'remote' }); await first;
  assert.deepEqual(h.rendered.map(result => result.term), ['新查询']); assert.equal(h.elements['#searchBtn'].disabled, false);
});
test('language changes and leaving the page cancel in-flight lookup and release the loading state', async () => {
  for (const cancel of [h => h.language('en'), h => h.pagehide()]) {
    const h = queryHarness(); h.context.aiSearchTerm('开黑'); const pending = h.run(); cancel(h);
    assert.equal(h.requests[0].options.signal.aborted, true); assert.equal(h.elements['#searchBtn'].disabled, false); assert.equal(h.loading.at(-1), false);
    h.requests[0].resolve({ result: local, source: 'remote' }); await pending; assert.equal(h.rendered.length, 0);
  }
});
test('the real query renderer treats no-evidence as missing vocabulary instead of a service failure in either language', async () => {
  for (const lang of ['zh', 'en']) {
    const h = queryHarness(); h.language(lang); h.context.aiSearchTerm('qa未收录词条x927'); const pending = h.run();
    h.requests[0].resolve({ result: null, source: 'not-found' }); await pending;
    assert.equal(h.rendered.length, 1);
    assert.doesNotMatch(h.rendered[0].error, /外部解释暂不可用|Remote explanation is currently unavailable/i);
    assert.match(h.rendered[0].error, lang === 'en' ? /No matching term/i : /未找到/);
  }
});
test('remote text goes through the original HTML escaping for every visible result field', () => {
  const resultElement = { innerHTML: '' }, context = { i18n: { getLang: () => 'zh' }, Utils: { safeQuerySelector: () => resultElement }, setTimeout() {} };
  vm.createContext(context);
  vm.runInContext(html.slice(html.indexOf('        function escapeHTML'), html.indexOf('        function initAISearchFunction')), context);
  vm.runInContext(html.slice(html.indexOf('        function displayAIResult'), html.indexOf('        function displayAIError')), context);
  const attack = '<img src=x onerror="throw 1">'; context.displayAIResult({ term: attack, definition: attack, usage: attack, context: attack, level: attack, examples: [attack], synonyms: [attack] });
  assert.equal(resultElement.innerHTML.includes('<img'), false); assert.equal((resultElement.innerHTML.match(/&lt;img/g) || []).length, 7);
});

test('the real result renderer displays an empty-example message in both supported languages', () => {
  for (const [lang, placeholder] of [['zh', '暂无例句'], ['en', 'No examples available.']]) {
    const resultElement = { innerHTML: '' }, context = { i18n: { getLang: () => lang }, Utils: { safeQuerySelector: () => resultElement }, setTimeout() {} };
    vm.createContext(context);
    vm.runInContext(html.slice(html.indexOf('        function escapeHTML'), html.indexOf('        function initAISearchFunction')), context);
    vm.runInContext(html.slice(html.indexOf('        function displayAIResult'), html.indexOf('        function displayAIError')), context);
    context.displayAIResult({ ...local, examples: [] });
    assert.ok(resultElement.innerHTML.includes(placeholder));
    assert.ok(resultElement.innerHTML.includes(local.definition));
  }
});
