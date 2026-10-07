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
  assert.equal(calls[0].options.redirect, 'manual'); assert.equal(calls[0].options.headers.Authorization, 'Bearer not-a-real-key');
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
test('the deployed DeepSeek defaults send non-thinking JSON requests while client overrides are ignored', async () => {
  const config = JSON.parse(await readFile(new URL('../backend/wrangler.jsonc', import.meta.url), 'utf8'));
  const calls = [], worker = createWorker({ dictionaries, fetch: async (url, options) => { calls.push({ url, options }); return upstream(); } });
  const response = await worker.fetch(request({ ...input, thinking: { type: 'enabled' }, model: 'client-model', max_tokens: 999999 }), { ...env(), ...config.vars });
  assert.equal(response.status, 200); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.deepseek.com/chat/completions');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.model, 'deepseek-flash'); assert.deepEqual(body.thinking, { type: 'disabled' });
  assert.equal(body.max_tokens, 700); assert.equal(body.stream, false); assert.deepEqual(body.response_format, { type: 'json_object' });
  const example = JSON.parse(body.messages[0].content.slice(body.messages[0].content.indexOf('{"term"')));
  assert.deepEqual(Object.keys(example).sort(), Object.keys(result).sort());
  assert.equal((await response.json()).result.definition, result.definition);
});
test('Chinese queries in English use the shared bilingual supplement, preserve the original term and constrain every explanation field', async () => {
  const [zh, en, featured] = await Promise.all(['combined_game_data.json', 'data_en.json', 'featured-terms.json'].map(async name => JSON.parse(await readFile(new URL('../assets/' + name, import.meta.url), 'utf8'))));
  const calls = [], english = { term: 'Squad up', definition: 'Form a group and play together.', usage: 'Use this when arranging a game with friends.', examples: ['Let us play together tonight.'], context: 'Delta Force', level: 'generated level', synonyms: [] };
  const worker = createWorker({ dictionaries: { zh, en }, featured, fetch: async (_, options) => { calls.push(JSON.parse(options.body)); return upstream(english); } });
  for (const gameId of ['all', '三角洲行动']) {
    const response = await worker.fetch(request({ ...input, locale: 'en', gameId }), env());
    assert.equal(response.status, 200);
    const data = await response.json(); assert.equal(data.result.term, '开黑'); assert.equal(data.result.definition, english.definition); assert.equal(data.result.level, 'AI-assisted explanation');
    const call = calls.at(-1), evidence = JSON.parse(call.messages[1].content).evidence;
    assert.equal(evidence[0].locale, 'en'); assert.equal(evidence[0].term, '开黑'); assert.match(evidence[0].id, /^featured:en:/);
    assert.equal(evidence[0].definition, featured.find(row => row.term === '开黑').definition.en);
    assert.equal(new Set(evidence.map(row => JSON.stringify([row.locale, row.term, row.game]))).size, evidence.length);
    if (gameId !== 'all') assert.ok(evidence.every(row => row.game === gameId));
    assert.match(call.messages[0].content, /Output language: English/);
    assert.match(call.messages[0].content, /definition, usage, context, every example and level/);
  }
  assert.equal(calls.length, 2, 'one provider request per search, without retry');
  const entry = await readFile(new URL('../backend/worker.js', import.meta.url), 'utf8');
  assert.match(entry, /import featured from ['"]\.\.\/assets\/featured-terms\.json['"]/);
  assert.match(entry, /createWorker\(\{ dictionaries: \{ zh, en \}, featured \}\)/);
});
test('obvious wrong-language explanations fail safely without retry or echoing the rejected prose', async () => {
  const english = { ...result, definition: 'Form a group and play games together.', usage: 'Invite friends to join the same team.', context: 'League of Legends', examples: ['Let us team up tonight.'] };
  for (const wrongField of ['definition', 'usage', 'context', 'examples']) {
    const bad = { ...english, [wrongField]: wrongField === 'examples' ? ['我们今晚一起组队玩游戏吧。'] : '我们可以和朋友一起组队玩游戏。' };
    let calls = 0;
    const worker = createWorker({ dictionaries, fetch: async () => { calls++; return upstream(bad); } });
    const response = await worker.fetch(request({ ...input, locale: 'en' }), env());
    assert.equal(response.status, 502); assert.deepEqual(await response.json(), { error: 'invalid_upstream_language' }); assert.equal(calls, 1);
  }
  let calls = 0;
  const worker = createWorker({ dictionaries, fetch: async () => { calls++; return upstream(english); } });
  const response = await worker.fetch(request(), env());
  assert.equal(response.status, 502); assert.deepEqual(await response.json(), { error: 'invalid_upstream_language' }); assert.equal(calls, 1);
});
test('language validation permits original Chinese names inside English prose and short gaming acronyms', async () => {
  const english = { ...result, definition: '开黑 means playing together with friends.', usage: 'Invite friends to team up for a match.', examples: ['Anyone up for 开黑?'], context: '英雄联盟' };
  const worker = createWorker({ dictionaries, fetch: async () => upstream(english) });
  assert.equal((await worker.fetch(request({ ...input, locale: 'en' }), env())).status, 200);
  for (const locale of ['zh', 'en']) {
    const abbreviation = { term: 'ADC', definition: locale === 'zh' ? 'ADC通常指持续物理输出角色。' : 'Attack Damage Carry.', usage: locale === 'zh' ? '常见于队伍角色分工。' : 'Team roles.', examples: ['ADC / DPS'], context: 'MOBA', level: 'AI', synonyms: ['AD Carry'] };
    const worker = createWorker({ dictionaries: { zh: [{ term: 'ADC', game: '英雄联盟', definition: '持续物理输出角色。' }] }, fetch: async () => upstream(abbreviation) });
    const response = await worker.fetch(request({ ...input, query: 'ADC', locale }), env());
    assert.equal(response.status, 200); assert.equal((await response.json()).result.term, 'ADC');
  }
});
test('DeepSeek empty JSON content and truncated content are rejected without retry', async () => {
  for (const [content, finish_reason] of [['', 'stop'], ['{"term":"开黑"', 'length']]) {
    let calls = 0;
    const worker = createWorker({ dictionaries, fetch: async () => { calls++; return new Response(JSON.stringify({ choices: [{ finish_reason, message: { content } }] })); } });
    const response = await worker.fetch(request(), { ...env(), LLM_BASE_URL: 'https://api.deepseek.com', LLM_MODEL: 'deepseek-flash' });
    assert.equal(response.status, 502); assert.deepEqual(await response.json(), { error: 'invalid_upstream_result' }); assert.equal(calls, 1);
  }
});
test('single-IP rate limiting rejects before paying for upstream and refuses a missing limiter', async () => {
  let calls = 0, key; const worker = createWorker({ dictionaries, fetch: async () => { calls++; return upstream(); } });
  const config = env(); config.IP_LIMITER.limit = async input => { key = input.key; return { success: false }; };
  const response = await worker.fetch(request(), config); assert.equal(response.status, 429); assert.equal(response.headers.get('Retry-After'), '60'); assert.equal(key, 'slang:192.0.2.8');
  delete config.IP_LIMITER; assert.equal((await worker.fetch(request(), config)).status, 503); assert.equal(calls, 0);
});
test('invalid input, unknown games and missing configuration never call the provider', async () => {
  let calls = 0; const worker = createWorker({ dictionaries, fetch: async () => { calls++; return upstream(); } });
  for (const bad of [{ ...input, query: '' }, { ...input, query: 'x'.repeat(81) }, { ...input, locale: 'fr' }, { ...input, gameId: 'not-a-game' }, { ...input, context: 'x'.repeat(1001) }]) assert.equal((await worker.fetch(request(bad), env())).status, 400);
  assert.equal((await worker.fetch(request('{bad'), env())).status, 400);
  assert.equal((await worker.fetch(request(input, { 'Content-Type': 'text/plain' }), env())).status, 415);
  const config = env(); delete config.LLM_API_KEY; assert.equal((await worker.fetch(request(), config)).status, 503);
  assert.equal(calls, 0);
});
test('a gaming question without a dictionary match reaches the model and returns AI with empty source IDs', async () => {
  let calls = 0;
  const answer = { term: 'wind-up', definition: 'A wind-up is the preparation before an action takes effect.', usage: 'A long wind-up can give an opponent time to react.', context: 'Action and fighting games.', level: 'AI', examples: [], synonyms: [] };
  const query = 'What does wind-up mean in a fighting game?';
  const worker = createWorker({ dictionaries, fetch: async (_, options) => {
    calls++; const messages = JSON.parse(options.body).messages, data = JSON.parse(messages[1].content);
    assert.equal(data.query, query); assert.deepEqual(data.evidence, []);
    assert.match(messages[0].content, /Dictionary evidence is optional reference/);
    assert.match(messages[0].content, /general gaming knowledge/);
    return upstream({ ...answer, sourceIds: ['fabricated:1'] });
  } });
  const response = await worker.fetch(request({ query, locale: 'en', gameId: 'all', evidence: null }), env());
  assert.equal(response.status, 200);
  const data = await response.json(); assert.equal(data.source, 'ai'); assert.equal(data.result.term, query);
  assert.equal(data.result.definition, answer.definition); assert.deepEqual(data.sourceIds, []); assert.equal(calls, 1);
});
test('ambiguous unmatched terms can ask for context in the existing result schema in Chinese or English', async () => {
  const answers = {
    zh: { term: '蓝莲花', definition: '这个名称可能指不同的事物，单凭名称还不能确定具体游戏含义。', usage: '你在哪款游戏、任务或聊天场景里看到它？', context: '请补充游戏名或前后句。', level: '待确认', examples: [], synonyms: [] },
    en: { term: 'Blue Lotus', definition: 'This name may refer to different things; its gaming meaning is unclear without context.', usage: 'Which game or scene did you see it in?', context: 'Please share the game or the surrounding sentence.', level: 'Needs context', examples: [], synonyms: [] }
  };
  for (const locale of ['zh', 'en']) {
    let calls = 0;
    const worker = createWorker({ dictionaries, fetch: async (_, options) => {
      calls++; const messages = JSON.parse(options.body).messages;
      assert.deepEqual(JSON.parse(messages[1].content).evidence, []);
      assert.match(messages[0].content, /ask for the specific game, scene or surrounding sentence/);
      assert.match(messages[0].content, /Do not invent definitions, sources, citations/);
      assert.ok(!messages[0].content.includes('蓝莲花'), 'no term-specific response is hardcoded');
      return upstream(answers[locale]);
    } });
    const response = await worker.fetch(request({ query: '蓝莲花', gameId: 'all', locale }), env());
    assert.equal(response.status, 200);
    const data = await response.json(); assert.equal(data.source, 'ai'); assert.equal(data.result.term, '蓝莲花');
    assert.equal(data.result.usage, answers[locale].usage); assert.deepEqual(data.result.examples, []); assert.deepEqual(data.result.synonyms, []);
    assert.equal(data.result.level, locale === 'en' ? 'AI-assisted explanation' : 'AI 辅助解释'); assert.deepEqual(data.sourceIds, []); assert.equal(calls, 1);
  }
});
test('empty evidence still enforces the output language while allowing the requested term and game as proper names', async () => {
  const query = '未知游戏术语';
  const english = { term: query, definition: 'The meaning is unclear without more context.', usage: 'Where did you encounter this expression?', context: '英雄联盟', level: 'AI', examples: [], synonyms: [] };
  const worker = createWorker({ dictionaries, fetch: async () => upstream(english) });
  const response = await worker.fetch(request({ query, gameId: '英雄联盟', locale: 'en' }), env());
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).sourceIds, []);
  for (const [locale, answer] of [['zh', english], ['en', { ...result, definition: '这个名称的具体含义尚不明确。' }]]) {
    let calls = 0;
    const worker = createWorker({ dictionaries, fetch: async () => { calls++; return upstream(answer); } });
    const response = await worker.fetch(request({ query, gameId: 'all', locale }), env());
    assert.equal(response.status, 502); assert.deepEqual(await response.json(), { error: 'invalid_upstream_language' }); assert.equal(calls, 1);
  }
});
test('unmatched queries still report provider configuration, rate-limit and upstream failures as service errors', async () => {
  for (const [upstreamStatus, expectedStatus] of [[401, 502], [429, 429], [500, 502]]) {
    let calls = 0;
    const worker = createWorker({ dictionaries, fetch: async () => { calls++; return new Response('private provider diagnostic', { status: upstreamStatus }); } });
    const response = await worker.fetch(request({ ...input, query: '未收录游戏词条' }), env());
    assert.equal(response.status, expectedStatus); assert.deepEqual(await response.json(), { error: 'upstream_unavailable' }); assert.equal(calls, 1);
  }
  let calls = 0;
  const worker = createWorker({ dictionaries, fetch: async () => { calls++; return upstream(); } });
  const config = env(); delete config.LLM_API_KEY;
  const response = await worker.fetch(request({ ...input, query: '未收录游戏词条' }), config);
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'provider_unconfigured' }); assert.equal(calls, 0);
});
test('a non-gaming English phrase cannot use single-letter entries from the real dictionary as evidence', async () => {
  const [zh, en] = await Promise.all(['combined_game_data.json', 'data_en.json'].map(async name => JSON.parse(await readFile(new URL('../assets/' + name, import.meta.url), 'utf8'))));
  let calls = 0;
  const worker = createWorker({ dictionaries: { zh, en }, fetch: async (_, options) => {
    calls++; assert.deepEqual(JSON.parse(JSON.parse(options.body).messages[1].content).evidence, []);
    return upstream({ term: 'quantum mechanics', definition: 'This helper covers gaming terms and related questions.', usage: 'Please ask a question about a game.', context: 'Gaming topics.', level: 'AI', examples: [], synonyms: [] });
  } });
  const response = await worker.fetch(request({ query: 'quantum mechanics', gameId: 'all', locale: 'en', context: '' }), env());
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).sourceIds, []); assert.equal(calls, 1);
});
test('defined numeric terms from the real dictionaries remain searchable while empty numeric rows supply no evidence', async () => {
  const [zh, en] = await Promise.all(['combined_game_data.json', 'data_en.json'].map(async name => JSON.parse(await readFile(new URL('../assets/' + name, import.meta.url), 'utf8'))));
  let calls = 0;
  const worker = createWorker({ dictionaries: { zh, en }, fetch: async (_, options) => {
    calls++;
    const { evidence, locale } = JSON.parse(JSON.parse(options.body).messages[1].content);
    assert.ok(evidence.every(row => typeof row.term === 'string' && row.definition.trim()));
    return upstream({ ...result, term: evidence[0].term, definition: evidence[0].definition,
      usage: locale === 'en' ? 'Used in game chat.' : '用于游戏聊天。', context: evidence[0].game, examples: [] });
  } });
  for (const [locale, query, gameId] of [['zh', '666', '三角洲行动'], ['zh', '233', '绝地求生'], ['en', '666', '三角洲行动']]) {
    const response = await worker.fetch(request({ query, gameId, locale }), env());
    assert.equal(response.status, 200); assert.equal((await response.json()).result.term, query);
  }
  assert.equal(calls, 3);
  const numericOnly = { zh: zh.filter(row => typeof row.term === 'number') };
  let emptyCalls = 0;
  const emptyWorker = createWorker({ dictionaries: numericOnly, fetch: async (_, options) => {
    emptyCalls++; assert.deepEqual(JSON.parse(JSON.parse(options.body).messages[1].content).evidence, []);
    return upstream({ term: '2', definition: '这个数字的含义需要结合具体场景判断。', usage: '你在哪个场景看到它？', context: '需要补充上下文。', level: 'AI', examples: [], synonyms: [] });
  } });
  const response = await emptyWorker.fetch(request({ query: '2', gameId: '三角洲行动', locale: 'zh' }), env());
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).sourceIds, []); assert.equal(emptyCalls, 1);
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
test('upstream redirects are never followed and their destination and body remain private', async () => {
  let calls = 0, cancelled = false;
  const worker = createWorker({ dictionaries, fetch: async (_, options) => {
    calls++; assert.equal(options.redirect, 'manual');
    const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('private upstream redirect body')); }, cancel() { cancelled = true; } });
    return new Response(body, { status: 302, headers: { Location: 'https://other-provider.invalid/private' } });
  } });
  const response = await worker.fetch(request(), env());
  assert.equal(response.status, 502); assert.deepEqual(await response.json(), { error: 'upstream_unavailable' });
  assert.equal(response.headers.get('location'), null); assert.equal(calls, 1); assert.equal(cancelled, true);
});
test('caller cancellation reaches the upstream controller and does not return a successful explanation', async () => {
  const controller = new AbortController(); let signal, began;
  const started = new Promise(resolve => { began = resolve; });
  const worker = createWorker({ dictionaries, fetch: async (_, options) => { signal = options.signal; began(); return new Promise(() => {}); } });
  const running = worker.fetch(request(input, {}, { signal: controller.signal }), env());
  await started; controller.abort();
  const response = await running; assert.equal(response.status, 499); assert.equal(signal.aborted, true);
});
