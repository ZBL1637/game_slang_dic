/* Optional public proxy configuration. Provider credentials never belong here. */
(function (global) {
  'use strict';
  function validateResult(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const result = {};
    for (const [key, max] of Object.entries({ term: 80, definition: 2000, usage: 1200, context: 200, level: 160 })) {
      if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > max) return null;
      result[key] = value[key];
    }
    for (const [key, count, max] of [['examples', 4, 500], ['synonyms', 8, 80]]) {
      if (!Array.isArray(value[key]) || value[key].length > count || value[key].some(item => typeof item !== 'string' || !item.trim() || item.length > max)) return null;
      result[key] = [...value[key]];
    }
    return result;
  }
  function configValue(raw, baseURL) {
    if (!raw || typeof raw.endpoint !== 'string' || !raw.endpoint.trim()) return { endpoint: '', timeoutMs: 18000 };
    try {
      const url = new URL(raw.endpoint, baseURL);
      if (url.username || url.password || url.search || url.hash) throw new Error('Invalid endpoint');
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('HTTPS required');
      return { endpoint: url.href, timeoutMs: Math.max(2000, Math.min(30000, Number(raw.timeoutMs) || 18000)) };
    } catch (_) { return { endpoint: '', timeoutMs: 18000 }; }
  }
  function deadline(operation, ms, parentSignal) {
    const controller = new AbortController();
    let timer, cancel;
    const stopped = new Promise((_, reject) => {
      cancel = () => { controller.abort(); reject(new Error('cancelled')); };
      if (parentSignal?.aborted) cancel(); else parentSignal?.addEventListener('abort', cancel, { once: true });
      timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, ms);
    });
    return Promise.race([stopped, Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new Error('cancelled');
      return operation(controller.signal);
    })]).finally(() => { clearTimeout(timer); parentSignal?.removeEventListener('abort', cancel); });
  }
  async function readJSON(response, allowNotFound = false) {
    if ((!response.ok && !(allowNotFound && response.status === 404)) || !/application\/json/i.test(response.headers.get('content-type') || '')) throw new Error('Invalid response');
    const reader = response.body.getReader(), chunks = []; let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength; if (bytes > 32768) throw new Error('Response too large'); chunks.push(value);
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    const all = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(all));
  }
  function createClient({ fetch: fetcher = global.fetch?.bind(global), baseURL = global.location?.href || 'http://localhost/', configURL = 'assets/api-config.json', configTimeoutMs = 2500 } = {}) {
    let configPromise;
    const configuration = () => configPromise ||= deadline(async signal => configValue(await readJSON(await fetcher(new URL(configURL, baseURL), { signal, cache: 'no-cache', credentials: 'omit' })), baseURL), configTimeoutMs)
      .catch(() => ({ endpoint: '', timeoutMs: 18000 }));
    async function search(input, localResult, { signal } = {}) {
      const config = await configuration();
      if (signal?.aborted) return { result: null, source: 'cancelled' };
      if (!config.endpoint || typeof input.query !== 'string' || input.query.length > 80) return { result: localResult, source: 'local' };
      try {
        const payload = { query: input.query, gameId: String(input.gameId || 'all'), locale: input.locale === 'en' ? 'en' : 'zh', context: String(input.context || '').slice(0, 1000) };
        const responseData = await deadline(async requestSignal => {
          const response = await fetcher(config.endpoint, {
            method: 'POST', signal: requestSignal, credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
          });
          return { status: response.status, data: await readJSON(response, true) };
        }, config.timeoutMs, signal);
        const { status, data } = responseData;
        if (status === 404) {
          if (data?.error === 'no_local_evidence') return { result: localResult, source: localResult ? 'local' : 'not-found' };
          throw new Error('Invalid endpoint');
        }
        const result = validateResult(data.result);
        if (!result || data.source !== 'ai') throw new Error('Invalid result');
        result.level = input.locale === 'en' ? 'AI-assisted explanation' : 'AI 辅助解释';
        return { result, source: 'remote' };
      } catch (_) {
        if (signal?.aborted) return { result: null, source: 'cancelled' };
        return { result: localResult ? { ...localResult, level: (input.locale === 'en' ? 'Local dictionary · Remote explanation unavailable' : '本地词库 · 外部解释暂不可用') } : null, source: 'fallback' };
      }
    }
    return { search, preload: configuration };
  }
  global.GameDictionaryAPI = { createClient, validateResult, configValue };
  if (global.document) { global.gameDictionaryClient = createClient(); global.gameDictionaryClient.preload(); }
})(typeof window !== 'undefined' ? window : globalThis);
