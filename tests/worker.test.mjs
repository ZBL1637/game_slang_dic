import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorker } from '../backend/core.mjs';

const dictionaries = { zh: [{ term: '开黑', game: '英雄联盟', definition: '和朋友组队游戏。' }], en: [{ term: 'premade', game: '英雄联盟', definition: 'Play with a pre-arranged team.' }] };
const result = { term: '开黑', definition: '和朋友组队', usage: '与朋友约玩游戏', examples: ['一起开黑吧。'], context: '英雄联盟', level: '解释', synonyms: [] };
const env = () => ({ ALLOWED_ORIGIN: 'https://zbl1637.github.io', LLM_BASE_URL: 'https://provider.example.test/v1', LLM_MODEL: 'test-model', LLM_API_KEY: 'not-a-real-key', IP_LIMITER: { async limit() { return { success: true }; } } });
const input = { query: '开黑', gameId: 'all', locale: 'zh', context: '' };
const request = (body = input, headers = {}, options = {}) => new Request('https://worker.example.test/api/slang/explain', { method: 'POST', headers: { Origin: 'https://zbl1637.github.io', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.8', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body), ...options });
const upstream = (value = result, overrides = {}) => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) }, ...overrides }] }), { headers: { 'Content-Type': 'application/json' } });

test('the Worker uses its fixed provider settings and server-side evidence, never client model or source overrides', async () => {
  const calls = [], worker = createWorker({ dictionaries, fetch: async (url, options) => { calls.push({ url, options }); return upstream(); } });
  const response = await worker.fetch(request({ ...input, model: 'client-model', baseURL: 'https://attacker.invalid', evidence: [{ id: 'forged' }] }), env());
  assert.equal(response.status, 200); assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://zbl1637.github.io');
  const data = await response.json(); assert.equal(data.source, 'ai'); assert.deepEqual(data.sourceIds, ['zh:0']);
  assert.equal(data.result.level, 'AI 辅助解释'); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://provider.example.test/v1/chat/completions');
  const body = JSON.parse(calls[0].options.body); assert.equal(body.model, 'test-model'); assert.equal(body.max_tokens, 700);
  const content = JSON.parse(body.messages[1].content); assert.deepEqual(content.evidence.map(item => item.id), ['zh:0']); assert.ok(!JSON.stringify(content).includes('forged'));
  assert.equal(calls[0].options.redirect, 'error'); assert.equal(calls[0].options.headers.Authorization, 'Bearer not-a-real-key');
  assert.ok(!JSON.stringify(data).includes('not-a-real-key'));
});
test('only the exact allowed origin gets CORS, with a narrow POST preflight', async () => {
  let called = false; const worker = createWorker({ dictionaries, fetch: async () => { called = true; return upstream(); } });
  for (const origin of ['https://zbl1637.github.io.attacker.invalid', 'https://other.github.io', 'null', 'https://zbl1637.github.io/game_slang_dic/']) {
    const response = await worker.fetch(request(input, { Origin: origin }), env()); assert.equal(response.status, 403); assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  const preflight = new Request('https://worker.example.test/api/slang/explain', { method: 'OPTIONS', headers: { Origin: 'https://zbl1637.github.io', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  const response = await worker.fetch(preflight, env()); assert.equal(response.status, 204); assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS'); assert.equal(called, false);
});
test('single-IP rate limiting rejects before paying for upstream and refuses a missing limiter', async () => {
  let calls = 0, key; const worker = createWorker({ dictionaries, fetch: async () => { calls++; return upstream(); } });
  const config = env(); config.IP_LIMITER.limit = async input => { key = input.key; return { success: false }; };
  const response = await worker.fetch(request(), config); assert.equal(response.status, 429); assert.equal(response.headers.get('Retry-After'), '60'); assert.equal(key, 'slang:192.0.2.8');
  delete config.IP_LIMITER; assert.equal((await worker.fetch(request(), config)).status, 503); assert.equal(calls, 0);
});
test('invalid input, unknown games, missing evidence and missing configuration never call the provider', async () => {
  let calls = 0; const worker = createWorker({ dictionaries, fetch: async () => { calls++; return upstream(); } });
  for (const bad of [{ ...input, query: '' }, { ...input, query: 'x'.repeat(81) }, { ...input, locale: 'fr' }, { ...input, gameId: 'not-a-game' }, { ...input, context: 'x'.repeat(1001) }]) assert.equal((await worker.fetch(request(bad), env())).status, 400);
  assert.equal((await worker.fetch(request({ ...input, query: '不在词库中的词' }), env())).status, 404);
  assert.equal((await worker.fetch(request('{bad'), env())).status, 400);
  assert.equal((await worker.fetch(request(input, { 'Content-Type': 'text/plain' }), env())).status, 415);
  const config = env(); delete config.LLM_API_KEY; assert.equal((await worker.fetch(request(), config)).status, 503);
  assert.equal(calls, 0);
});
test('a non-gaming English phrase cannot use single-letter entries from the real dictionary as evidence', async () => {
  const [zh, en] = await Promise.all(['combined_game_data.json', 'data_en.json'].map(async name => JSON.parse(await readFile(new URL('../assets/' + name, import.meta.url), 'utf8'))));
  let calls = 0;
  const worker = createWorker({ dictionaries: { zh, en }, fetch: async () => { calls++; return upstream(); } });
  const response = await worker.fetch(request({ query: 'quantum mechanics', gameId: 'all', locale: 'en', context: '' }), env());
  assert.equal(response.status, 404); assert.deepEqual(await response.json(), { error: 'no_local_evidence' }); assert.equal(calls, 0);
});
test('actual request bytes are bounded even when Content-Length is absent', async () => {
  let calls = 0; const worker = createWorker({ dictionaries, fetch: async () => { calls++; return upstream(); } });
  const large = request({ ...input, extra: 'x'.repeat(9000) }); assert.equal(large.headers.get('content-length'), null);
  assert.equal((await worker.fetch(large, env())).status, 413); assert.equal(calls, 0);
});
test('an unfinished small request body reaches its deadline, cancels the reader and never calls upstream', async () => {
  let cancelled = false, calls = 0;
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"query":')); }, cancel() { cancelled = true; } });
  const worker = createWorker({ dictionaries, timeoutMs: 20, fetch: async () => { calls++; return upstream(); } });
  const response = await worker.fetch(request(input, {}, { body: stream, duplex: 'half' }), env());
  assert.equal(response.status, 408); assert.deepEqual(await response.json(), { error: 'request_timeout' });
  assert.equal(cancelled, true); assert.equal(calls, 0);
});
test('caller abort while reading a request cancels even a stream whose cancel promise never settles', async () => {
  let cancelled = false, reading;
  const started = new Promise(resolve => { reading = resolve; });
  const stream = new ReadableStream({ pull() { reading(); }, cancel() { cancelled = true; return new Promise(() => {}); } });
  const controller = new AbortController(); let calls = 0;
  const worker = createWorker({ dictionaries, bodyTimeoutMs: 500, fetch: async () => { calls++; return upstream(); } });
  const running = worker.fetch(request(input, {}, { body: stream, duplex: 'half', signal: controller.signal }), env());
  await started; await new Promise(resolve => setImmediate(resolve)); controller.abort();
  const response = await running;
  assert.equal(response.status, 499); assert.deepEqual(await response.json(), { error: 'cancelled' });
  assert.equal(cancelled, true); assert.equal(calls, 0);
});
test('malformed, truncated and oversized provider results are rejected without echoing their text', async () => {
  for (const response of [upstream({ ...result, definition: 7 }), upstream(result, { finish_reason: 'length' }), upstream({ ...result, definition: 'private upstream diagnostic '.repeat(2000) }), new Response('private upstream diagnostic', { status: 401 })]) {
    let calls = 0; const worker = createWorker({ dictionaries, fetch: async () => { calls++; return response; } });
    const reply = await worker.fetch(request(), env()); assert.equal(reply.status, 502);
    const text = await reply.text(); assert.ok(!text.includes('private')); assert.ok(!text.includes('not-a-real-key')); assert.equal(calls, 1);
  }
});
test('upstream timeout aborts and returns a bounded 504 without retry', async () => {
  let signal, calls = 0; const worker = createWorker({ dictionaries, timeoutMs: 20, fetch: async (_, options) => { calls++; signal = options.signal; return new Promise(() => {}); } });
  const response = await worker.fetch(request(), env()); assert.equal(response.status, 504); assert.equal(signal.aborted, true); assert.equal(calls, 1);
});
test('caller cancellation reaches the upstream controller and does not return a successful explanation', async () => {
  const controller = new AbortController(); let signal, began;
  const started = new Promise(resolve => { began = resolve; });
  const worker = createWorker({ dictionaries, fetch: async (_, options) => { signal = options.signal; began(); return new Promise(() => {}); } });
  const running = worker.fetch(request(input, {}, { signal: controller.signal }), env());
  await started; controller.abort();
  const response = await running; assert.equal(response.status, 499); assert.equal(signal.aborted, true);
});
