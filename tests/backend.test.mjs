import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../supabase/functions/_shared/feedintel/app.js';
import { validateInput, normalizeVideo, deduplicate, calculateMetrics, calculateCharts, mapEvidence, AppError } from '../supabase/functions/_shared/feedintel/core.js';
import { OrianeConnector, OpenAIAnalyzer, SupabaseStore, ClaudeAnalyzer, LovableAnalyzer, intelligenceOptions, requireIntelligenceConfig } from '../supabase/functions/_shared/feedintel/providers.js';
import { DemoAnalyzer, DemoConnector, MemoryStore } from '../supabase/functions/_shared/feedintel/demo.js';

// Tokens below are generated at runtime for tests, never provider credentials.
const token = crypto.randomUUID();
const env = (name) => ({ FEEDINTEL_MODE: 'demo', DEMO_ACCESS_TOKEN: token, ALLOWED_ORIGINS: 'http://localhost:5173' })[name];
const input = { skill: 'competitor_spy', query: 'Nike', compare_with: 'Adidas', period_days: 90, max_videos: 6 };
const clock = new Date('2026-11-07T10:00:00Z');
const row = (overrides = {}) => ({ id: 'provider-1', format: 'video', platform: 'tiktok', platformId: '1234567890', profileHandle: 'creator', publishedAt: '2026-11-01T10:00:00Z', caption: 'Product review', viewsCount: 100, likesCount: 10, commentsCount: 2, sharesCount: 1, media: [{ transcript: 'A review' }], ...overrides });
const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), { status });
const post = (body = input, options = {}) => new Request('http://localhost/analyze', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers }, body: JSON.stringify(body),
});

test('validation enforces skill, distinct competitors, bounds, and exact fields', () => {
  assert.equal(validateInput(input).query, 'Nike');
  for (const update of [{ compare_with: 'nike' }, { max_videos: 51 }, { period_days: 0 }, { query: '' }, { skill: 'unknown' }, { extra: true }, { max_videos: 1 }]) assert.throws(() => validateInput({ ...input, ...update }), AppError);
  assert.equal(validateInput({ skill: 'trend_detector', query: 'Fashion' }).compare_with, null);
  assert.throws(() => validateInput({ ...input, skill: 'trend_detector' }), AppError);
});

test('normalization preserves missing metrics, validates references, and deduplicates brands', () => {
  const first = normalizeVideo(row({ viewsCount: null, likesCount: -1 }), 'Nike');
  assert.equal(first.views, null); assert.equal(first.likes, null);
  assert.equal(first.url, 'https://www.tiktok.com/@creator/video/1234567890');
  assert.equal(first.transcript, 'A review');
  assert.equal(normalizeVideo(row({ publishedAt: 'bad' }), 'Nike'), null);
  assert.equal(normalizeVideo(row({ platformId: 'bad' }), 'Nike'), null);
  assert.equal(normalizeVideo(row({ format: 'image' }), 'Nike'), null);
  const merged = deduplicate([first, normalizeVideo(row(), 'Adidas')]);
  assert.equal(merged.length, 1); assert.deepEqual(merged[0].brands, ['Nike', 'Adidas']);
});

test('numeric metrics use real arithmetic with strict missing-data totals', () => {
  const a = normalizeVideo(row(), 'Nike');
  const b = normalizeVideo(row({ id: 'two', viewsCount: 300, sharesCount: null }), 'Nike');
  const result = calculateMetrics([a, b]);
  assert.equal(result.views, 400); assert.equal(result.mean_views, 200); assert.equal(result.median_views, 200);
  assert.equal(result.shares, null); assert.equal(result.engagement_per_view, null);
  assert.equal(result.metric_coverage.shares, 1);
  assert.equal(calculateMetrics([a]).engagement_per_view, 13);
  assert.equal(calculateMetrics([a, { ...b, views: null }]).views, null);
  assert.equal(calculateMetrics([]).views, null);
  assert.equal(calculateMetrics([{ ...a, views: 0 }]).engagement_per_view, null);
});

test('publication charts include zero weeks and preserve calendar boundaries', () => {
  const videos = [normalizeVideo(row(), 'Nike')];
  const charts = calculateCharts(videos, input, clock);
  assert.equal(charts.posts_by_week.reduce((n, week) => n + week.count, 0), 1);
  assert.ok(charts.posts_by_week.some((week) => week.count === 0));
  assert.equal(charts.views_by_brand[1].views, null);
});

test('both skills return the contract, valid evidence, retrievable results, and history', async () => {
  for (const skill of ['competitor_spy', 'trend_detector']) {
    const app = createApp({ env, now: () => clock });
    const response = await app(post({ ...input, skill, compare_with: skill === 'competitor_spy' ? 'Adidas' : null }));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(Object.keys(result), ['analysis_id', 'skill', 'status', 'kpis', 'charts', 'insights', 'videos', 'report', 'limitations', 'generated_at']);
    assert.equal(result.kpis.videos, 6);
    assert.ok(result.limitations[0].includes('FICTIONAL'));
    for (const insight of result.insights) for (const id of insight.evidence_video_ids) assert.ok(result.videos.some((v) => v.id === id));
    const headers = { Authorization: `Bearer ${token}` };
    const saved = await app(new Request(`http://localhost/analyses/${result.analysis_id}`, { headers }));
    assert.deepEqual(await saved.json(), result);
    const history = await app(new Request('http://localhost/analyses', { headers }));
    assert.equal((await history.json()).analyses[0].id, result.analysis_id);
  }
});

test('API enforces authentication, CORS, methods, JSON, body size, and rate limit', async () => {
  const app = createApp({ env });
  assert.equal((await app(post(input, { headers: { Authorization: '' } }))).status, 401);
  assert.equal((await app(post(input, { headers: { Origin: 'https://evil.example' } }))).status, 403);
  assert.equal((await app(new Request('http://localhost/analyze'))).status, 405);
  assert.equal((await app(post(input, { headers: { 'Content-Type': 'text/plain' } }))).status, 415);
  assert.equal((await app(new Request('http://localhost/analyze', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{' }))).status, 400);
  assert.equal((await app(post({ ...input, query: 'x'.repeat(17000) }))).status, 413);
  assert.equal((await app(new Request('http://localhost/analyses/bad', { headers: { Authorization: `Bearer ${token}` } }))).status, 400);
  assert.equal((await app(new Request('http://localhost/analyses?limit=200', { headers: { Authorization: `Bearer ${token}` } }))).status, 400);
  const preflight = await app(new Request('http://localhost/analyze', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } }));
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  for (let i = 0; i < 5; i++) assert.equal((await app(post())).status, 200);
  assert.equal((await app(post())).status, 429);
});

test('unknown AI citations fail instead of silently replacing evidence', async () => {
  const videos = [normalizeVideo(row(), 'Nike')];
  const ai = await new DemoAnalyzer().analyze(input, videos);
  ai.insights[0].evidence_video_ids = ['invented'];
  assert.throws(() => mapEvidence(ai, videos), /invalid or unsupported/);
  const app = createApp({ env, analyzer: { analyze: async () => ai } });
  assert.equal((await app(post())).status, 502);
});

test('empty results and storage errors do not return completed analyses', async () => {
  const app = createApp({ env, connector: { search: async () => ({ videos: [], skipped: 0 }) } });
  assert.equal((await app(post())).status, 422);
  const store = new MemoryStore();
  store.save = async () => { throw new AppError(502, 'DATABASE_UNAVAILABLE', 'Storage unavailable.'); };
  const failed = await createApp({ env, store })(post());
  assert.equal(failed.status, 502); assert.equal((await failed.json()).error.code, 'DATABASE_UNAVAILABLE');
});

test('stored analyses are isolated by owner', async () => {
  const app = createApp({ env, authenticate: async (value) => value });
  const result = await (await app(post())).json();
  const response = await app(new Request(`http://localhost/analyses/${result.analysis_id}`, { headers: { Authorization: 'Bearer another-test-user' } }));
  assert.equal(response.status, 404);
});

test('Oriane connector uses documented filters and paginates full projection', async () => {
  const calls = [];
  const connector = new OrianeConnector((name) => ({ ORIANE_API_KEY: token, ORIANE_AUTH_HEADER: 'X-Test-Auth', ORIANE_AUTH_TEMPLATE: '{key}' })[name], async (url, options) => {
    calls.push({ url: new URL(url), options });
    const offset = Number(new URL(url).searchParams.get('offset'));
    const count = Number(new URL(url).searchParams.get('limit'));
    return jsonResponse({ data: { results: Array.from({ length: count }, (_, i) => row({ id: `provider-${offset + i}` })) }, metadata: { pagination: { totalCount: 25, aiSearchAnchor: 'anchor' } } });
  });
  const result = await connector.search('Nike', 25, 90, clock);
  assert.equal(result.videos.length, 25); assert.equal(calls.length, 2);
  assert.equal(calls[1].url.searchParams.get('offset'), '20');
  assert.equal(calls[1].url.searchParams.get('aiSearchAnchor'), 'anchor');
  assert.equal(calls[0].url.pathname, '/rest/contents/search');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.filters.format.includes[0], 'video');
  assert.equal(body.queries[0].filters.transcript.includesFuzzy.values[0], 'Nike');
});

test('provider errors are sanitized and no undocumented auth default is assumed', async () => {
  const connector = new OrianeConnector(() => undefined);
  await assert.rejects(() => connector.search('Nike', 2, 90, clock), /ORIANE_API_KEY/);
  const analyzer = new OpenAIAnalyzer(() => token, async () => jsonResponse({ secret: 'must-not-leak' }, 429));
  await assert.rejects(() => analyzer.analyze(input, [], {}, {}), (error) => error.code === 'OPENAI_UNAVAILABLE' && !error.message.includes('must-not-leak'));
});

test('OpenAI requests use strict structured outputs and reject incomplete responses', async () => {
  let sent;
  const analyzer = new OpenAIAnalyzer((name) => name === 'OPENAI_MODEL' ? 'gpt-4o-mini' : token, async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses'); sent = JSON.parse(options.body);
    return jsonResponse({ status: 'completed', output: [{ content: [{ type: 'output_text', text: '{"example":true}' }] }] });
  });
  assert.deepEqual(await analyzer.analyze(input, [], {}, {}), { example: true });
  assert.equal(sent.text.format.strict, true); assert.equal(sent.store, false);
  const incomplete = new OpenAIAnalyzer(() => token, async () => jsonResponse({ status: 'incomplete' }));
  await assert.rejects(() => incomplete.analyze(input, [], {}, {}), (error) => error.code === 'OPENAI_INCOMPLETE');
});

test('Supabase authentication checks the remote user and account allowlist', async () => {
  const user = crypto.randomUUID();
  const config = (name) => ({ SUPABASE_URL: 'https://project.example', SB_SECRET_KEY: token, DEMO_USER_IDS: user })[name];
  const store = new SupabaseStore(config, async () => jsonResponse({ id: user, is_anonymous: false }));
  assert.equal(await store.authenticate(token), user);
  const denied = new SupabaseStore(config, async () => jsonResponse({ id: crypto.randomUUID() }));
  await assert.rejects(() => denied.authenticate(token), (error) => error.status === 403);
  const anonymous = new SupabaseStore(config, async () => jsonResponse({ id: user, is_anonymous: true }));
  await assert.rejects(() => anonymous.authenticate(token), (error) => error.status === 401);
});

test('live configuration failures never return fictional success', async () => {
  const liveEnv = (name) => name === 'FEEDINTEL_MODE' ? 'live' : undefined;
  const app = createApp({ env: liveEnv, authenticate: async () => crypto.randomUUID() });
  const response = await app(post());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'NOT_CONFIGURED');
});

test('concurrency rejects a third active analysis and releases slots afterward', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let started = 0;
  let notify;
  const bothStarted = new Promise((resolve) => { notify = resolve; });
  const demo = new DemoAnalyzer();
  const app = createApp({ env, analyzer: { analyze: async (...args) => {
    started++;
    if (started === 2) notify();
    await gate;
    return demo.analyze(...args);
  } } });
  const first = app(post());
  const second = app(post());
  await bothStarted;
  assert.equal((await app(post())).status, 429);
  release();
  assert.equal((await first).status, 200);
  assert.equal((await second).status, 200);
  assert.equal((await app(post())).status, 200);
});

test('Supabase persistence uses service credentials and owner-filtered RPCs', async () => {
  const owner = crypto.randomUUID();
  const id = crypto.randomUUID();
  const calls = [];
  const store = new SupabaseStore((name) => ({ SUPABASE_URL: 'https://project.example', SB_SECRET_KEY: `sb_secret_${token}` })[name], async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return jsonResponse(url.endsWith('consume_feedintel_quota') ? true : null);
  });
  await store.consumeQuota(owner);
  await store.get(owner, id);
  await store.list(owner, 20, 0);
  await store.save(owner, input, { analysis_id: id });
  assert.equal(calls[1].body.p_owner, owner);
  assert.equal(calls[1].body.p_id, id);
  assert.ok(calls[3].url.endsWith('/rest/v1/rpc/save_feedintel_analysis'));
  assert.equal(calls[3].options.headers.Authorization, undefined);
  assert.ok(calls[3].options.headers.apikey.startsWith('sb_secret_'));
  const limited = new SupabaseStore((name) => ({ SUPABASE_URL: 'https://project.example', SB_SECRET_KEY: token })[name], async () => jsonResponse(false));
  await assert.rejects(() => limited.consumeQuota(owner), (error) => error.status === 429);
});

test('provider timeouts become sanitized upstream failures', async () => {
  const analyzer = new OpenAIAnalyzer(() => token, async () => { throw new DOMException('private transport details', 'TimeoutError'); });
  await assert.rejects(() => analyzer.analyze(input, [], {}, {}), (error) => error.status === 502 && !error.message.includes('private transport'));
});

test('exhausted OpenAI credit produces an actionable sanitized error', async () => {
  for (const code of ['credit_balance_exhausted', 'insufficient_quota']) {
    const analyzer = new OpenAIAnalyzer(() => token, async () => jsonResponse({ error: { code, message: 'private upstream detail' } }, 429));
    await assert.rejects(() => analyzer.analyze(input, [], {}, {}), (error) => error.status === 503 && error.code === 'OPENAI_CREDITS_EXHAUSTED' && !error.message.includes('private upstream'));
  }
});

test('intelligence choice validates input and reveals no credentials in options', async () => {
  assert.throws(() => validateInput({ ...input, intelligence_provider: 'unknown' }), AppError);
  for (const intelligence_provider of ['openai', 'claude', 'lovable']) assert.equal(validateInput({ ...input, intelligence_provider }).intelligence_provider, intelligence_provider);
  const options = intelligenceOptions((name) => ({ INTELLIGENCE_PROVIDER: 'claude', ANTHROPIC_API_KEY: token, ANTHROPIC_MODEL: 'test-model' })[name]);
  assert.equal(options.default_provider, 'claude');
  assert.equal(options.providers.find((p) => p.id === 'claude').configured, true);
  assert.equal(options.providers.find((p) => p.id === 'openai').configured, false);
  assert.ok(!JSON.stringify(options).includes(token));
  const app = createApp({ env });
  assert.equal((await app(new Request('http://localhost/intelligence-options'))).status, 401);
  const response = await app(new Request('http://localhost/intelligence-options', { headers: { Authorization: `Bearer ${token}` } }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).providers.length, 3);
});

test('Claude uses its own authenticated structured-output API and handles refusals', async () => {
  let body;
  const claudeEnv = (name) => ({ ANTHROPIC_API_KEY: token, ANTHROPIC_MODEL: 'test-structured-model' })[name];
  const analyzer = new ClaudeAnalyzer(claudeEnv, async (url, options) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(options.headers['x-api-key'], token);
    body = JSON.parse(options.body);
    return jsonResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"example":true}' }] });
  });
  assert.deepEqual(await analyzer.analyze(input, [], {}, {}), { example: true });
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.equal(body.model, 'test-structured-model');
  assert.ok(body.system.includes('untrusted DATA'));
  const refused = new ClaudeAnalyzer(claudeEnv, async () => jsonResponse({ stop_reason: 'refusal' }));
  await assert.rejects(() => refused.analyze(input, [], {}, {}), (error) => error.code === 'ANALYSIS_REFUSED');
  const truncated = new ClaudeAnalyzer(claudeEnv, async () => jsonResponse({ stop_reason: 'max_tokens' }));
  await assert.rejects(() => truncated.analyze(input, [], {}, {}), (error) => error.code === 'CLAUDE_INCOMPLETE');
});

test('Lovable bridge requires HTTPS, keeps credentials server-side, and sends the shared contract', async () => {
  const settings = { LOVABLE_ANALYSIS_URL: 'https://bridge.example/interpret', LOVABLE_BRIDGE_TOKEN: token };
  const bridgeEnv = (name) => settings[name];
  const analyzer = new LovableAnalyzer(bridgeEnv, async (url, options) => {
    assert.equal(String(url), settings.LOVABLE_ANALYSIS_URL);
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(options.redirect, 'error');
    const payload = JSON.parse(options.body);
    assert.equal(payload.data.request.skill, input.skill);
    assert.equal(payload.output_schema.type, 'object');
    assert.ok(!options.body.includes(token));
    return jsonResponse({ executive_summary: 'Example bridge result' });
  });
  assert.equal((await analyzer.analyze(input, [], {}, {})).executive_summary, 'Example bridge result');
  for (const url of ['http://bridge.example', 'https://user:password@bridge.example', 'https://bridge.example?key=private']) {
    assert.throws(() => requireIntelligenceConfig('lovable', (name) => name === 'LOVABLE_ANALYSIS_URL' ? url : token), AppError);
  }
  const failed = new LovableAnalyzer(bridgeEnv, async () => jsonResponse({ private: token }, 500));
  await assert.rejects(() => failed.analyze(input, [], {}, {}), (error) => error.code === 'LOVABLE_UNAVAILABLE' && !error.message.includes(token));
});

test('live routes use only the selected provider, preserve evidence, and save provider choice', async () => {
  for (const provider of ['openai', 'claude', 'lovable']) {
    const settings = {
      FEEDINTEL_MODE: 'live', INTELLIGENCE_PROVIDER: provider,
      ORIANE_API_KEY: token, ORIANE_AUTH_HEADER: 'Authorization', ORIANE_AUTH_TEMPLATE: 'Bearer {key}',
      ...(provider === 'openai' ? { OPENAI_API_KEY: token } : {}),
      ...(provider === 'claude' ? { ANTHROPIC_API_KEY: token, ANTHROPIC_MODEL: 'test-model' } : {}),
      ...(provider === 'lovable' ? { LOVABLE_ANALYSIS_URL: 'https://bridge.example/interpret', LOVABLE_BRIDGE_TOKEN: token } : {}),
    };
    let calls = 0;
    const app = createApp({
      env: (name) => settings[name], connector: new DemoConnector(), store: new MemoryStore(), authenticate: async () => 'test-owner',
      fetcher: async (url, options) => {
        calls++;
        const body = JSON.parse(options.body);
        let data;
        if (provider === 'openai') { assert.equal(new URL(url).hostname, 'api.openai.com'); data = JSON.parse(body.input); }
        else if (provider === 'claude') { assert.equal(new URL(url).hostname, 'api.anthropic.com'); data = JSON.parse(body.messages[0].content); }
        else { assert.equal(new URL(url).hostname, 'bridge.example'); data = body.data; }
        const answer = await new DemoAnalyzer().analyze(data.request, data.videos);
        if (provider === 'openai') return jsonResponse({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(answer) }] }] });
        if (provider === 'claude') return jsonResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(answer) }] });
        return jsonResponse(answer);
      },
    });
    const response = await app(post({ ...input, intelligence_provider: provider }));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.report.intelligence.provider, provider);
    assert.equal(calls, 1);
    const history = await (await app(new Request('http://localhost/analyses', { headers: { Authorization: `Bearer ${token}` } }))).json();
    assert.equal(history.analyses[0].parameters.intelligence_provider, provider);
  }
});

test('unconfigured selected provider fails before retrieval and never falls back', async () => {
  let searches = 0;
  const settings = { FEEDINTEL_MODE: 'live', ORIANE_API_KEY: token, ORIANE_AUTH_HEADER: 'Authorization', ORIANE_AUTH_TEMPLATE: 'Bearer {key}', OPENAI_API_KEY: token };
  const app = createApp({ env: (name) => settings[name], store: new MemoryStore(), authenticate: async () => 'test-owner', connector: { search: async () => { searches++; return { videos: [], skipped: 0 }; } } });
  const response = await app(post({ ...input, intelligence_provider: 'claude' }));
  assert.equal(response.status, 503); assert.equal(searches, 0);
});

test('public access runs sessionless requests as the shared owner and keeps tokens verified', async () => {
  const publicOwner = crypto.randomUUID();
  const publicEnv = (name) => ({ ...{ FEEDINTEL_MODE: 'demo', DEMO_ACCESS_TOKEN: token }, PUBLIC_ACCESS_OWNER_ID: publicOwner })[name];
  const owners = [];
  const store = new MemoryStore();
  const consume = store.consumeQuota.bind(store);
  store.consumeQuota = async (owner) => { owners.push(owner); return consume(owner); };
  const app = createApp({ env: publicEnv, store });
  assert.equal((await (await app(new Request('http://localhost/health'))).json()).access, 'public');
  const anonymous = (path, init = {}) => app(new Request(`http://localhost${path}`, init));
  const created = await anonymous('/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skill: 'trend_detector', query: 'running shoes' }) });
  assert.equal(created.status, 200);
  assert.deepEqual(owners, [publicOwner]);
  const { analysis_id: id } = await created.json();
  assert.equal((await anonymous(`/analyses/${id}`)).status, 200);
  assert.equal((await anonymous('/analyses')).status, 200);
  const wrongToken = await anonymous('/analyses', { headers: { Authorization: 'Bearer not-the-demo-token' } });
  assert.equal(wrongToken.status, 401);
});

test('public access is off by default and rejects a malformed owner', async () => {
  assert.equal((await (await createApp({ env })(new Request('http://localhost/health'))).json()).access, 'account');
  assert.equal((await createApp({ env })(new Request('http://localhost/analyses'))).status, 401);
  const bad = createApp({ env: (name) => ({ FEEDINTEL_MODE: 'demo', DEMO_ACCESS_TOKEN: token, PUBLIC_ACCESS_OWNER_ID: 'not-a-uuid' })[name] });
  assert.equal((await bad(new Request('http://localhost/analyses'))).status, 503);
});
