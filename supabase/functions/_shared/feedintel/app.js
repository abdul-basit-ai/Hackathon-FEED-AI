import { AppError, validateInput, deduplicate, calculateMetrics, calculateCharts, mapEvidence } from './core.js';
import { OrianeConnector, SupabaseStore, requireEnv, createAnalyzer, selectIntelligenceProvider, requireIntelligenceConfig, intelligenceOptions } from './providers.js';
import { DemoConnector, DemoAnalyzer, MemoryStore } from './demo.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 16384;

async function readJson(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new AppError(415, 'JSON_REQUIRED', 'Use Content-Type: application/json.');
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw new AppError(413, 'BODY_TOO_LARGE', 'Request body exceeds 16 KB.');
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, 'INVALID_JSON', 'A JSON body is required.');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw new AppError(413, 'BODY_TOO_LARGE', 'Request body exceeds 16 KB.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new AppError(400, 'INVALID_JSON', 'Request body must be valid JSON.'); }
}

export function createApp({ env, connector, analyzer, store, authenticate, fetcher = fetch, now = () => new Date() }) {
  const mode = env('FEEDINTEL_MODE') || 'live';
  if (!['demo', 'live'].includes(mode)) throw new AppError(503, 'NOT_CONFIGURED', 'FEEDINTEL_MODE must be demo or live.');
  const demo = mode === 'demo';
  store ??= demo ? new MemoryStore() : new SupabaseStore(env, fetcher);
  connector ??= demo ? new DemoConnector() : new OrianeConnector(env, fetcher);
  if (demo) analyzer ??= new DemoAnalyzer();
  authenticate ??= async (token) => {
    if (!demo) return store.authenticate(token);
    const expected = requireEnv(env, 'DEMO_ACCESS_TOKEN');
    if (expected.length < 24) throw new AppError(503, 'NOT_CONFIGURED', 'DEMO_ACCESS_TOKEN must contain at least 24 characters.');
    if (token !== expected) throw new AppError(401, 'UNAUTHORIZED', 'Invalid local demo token.');
    return 'local-demo';
  };
  let running = 0;

  return async function handle(request) {
    const requestId = crypto.randomUUID();
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Request-Id': requestId, Vary: 'Origin' };
    const json = (status, data) => new Response(JSON.stringify(data), { status, headers });
    try {
      const origin = request.headers.get('origin');
      const origins = (env('ALLOWED_ORIGINS') || '').split(',').map((o) => o.trim()).filter(Boolean);
      if (origin) {
        if (!origins.includes(origin)) throw new AppError(403, 'ORIGIN_NOT_ALLOWED', 'This frontend origin is not allowed.');
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Headers'] = 'authorization, content-type, apikey, x-client-info';
        headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
      }
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      const path = new URL(request.url).pathname.replace(/^\/functions\/v1\/feedintel(?=\/|$)/, '').replace(/^\/feedintel(?=\/|$)/, '') || '/';
      if (path === '/health' && request.method === 'GET') return json(200, { status: 'ok', service: 'FeedIntel backend', mode });
      if (!(path === '/analyze' || path === '/analyses' || path === '/intelligence-options' || /^\/analyses\/[^/]+$/.test(path))) throw new AppError(404, 'NOT_FOUND', 'Route not found.');
      const method = path === '/analyze' ? 'POST' : 'GET';
      if (request.method !== method) { headers.Allow = method; throw new AppError(405, 'METHOD_NOT_ALLOWED', `Use ${method} for this route.`); }
      const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
      if (!token) throw new AppError(401, 'UNAUTHORIZED', 'A Bearer access token is required.');
      const owner = await authenticate(token);
      if (path === '/intelligence-options') return json(200, { ...intelligenceOptions(env), mode });
      if (path === '/analyses') {
        const params = new URL(request.url).searchParams;
        const limit = Number(params.get('limit') ?? 20);
        const offset = Number(params.get('offset') ?? 0);
        if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 10000) throw new AppError(400, 'INVALID_INPUT', 'Use limit 1–100 and offset 0–10000.');
        return json(200, { analyses: await store.list(owner, limit, offset), limit, offset });
      }
      if (path.startsWith('/analyses/')) {
        const id = path.slice('/analyses/'.length);
        if (!uuid.test(id)) throw new AppError(400, 'INVALID_INPUT', 'Analysis ID must be a UUID.');
        const result = await store.get(owner, id);
        if (!result) throw new AppError(404, 'NOT_FOUND', 'Analysis not found.');
        return json(200, result);
      }
      const input = validateInput(await readJson(request));
      const provider = selectIntelligenceProvider(input, env);
      input.intelligence_provider = provider;
      if (running >= 2) throw new AppError(429, 'BUSY', 'The server is processing other analyses. Please retry shortly.');
      running++;
      try {
        if (!demo) {
          for (const name of ['ORIANE_API_KEY', 'ORIANE_AUTH_HEADER', 'ORIANE_AUTH_TEMPLATE']) requireEnv(env, name);
          requireIntelligenceConfig(provider, env);
        }
        await store.consumeQuota(owner);
        const generatedAt = now();
        const terms = input.compare_with ? [input.query, input.compare_with] : [input.query];
        const batches = await Promise.all(terms.map((term, index) => connector.search(term,
          terms.length === 1 ? input.max_videos : Math.floor(input.max_videos / 2) + (index === 0 ? input.max_videos % 2 : 0), input.period_days, generatedAt)));
        const videos = deduplicate(batches.flatMap((batch) => batch.videos));
        if (!videos.length) throw new AppError(422, 'NO_RESULTS', 'No usable videos were found in this period. Try a broader query or date range.');
        const kpis = calculateMetrics(videos);
        const charts = calculateCharts(videos, input, generatedAt);
        const selectedAnalyzer = analyzer ?? createAnalyzer(provider, env, fetcher);
        const interpretation = mapEvidence(await selectedAnalyzer.analyze(input, videos, kpis, charts), videos);
        charts.theme_distribution = interpretation.distribution;
        charts.themes_by_brand = terms.map((label) => ({ label, themes: interpretation.themes.map((theme) => ({
          label: theme.label, count: videos.filter((v) => v.brands.includes(label) && theme.video_ids.includes(v.id)).length,
        })).filter((theme) => theme.count > 0) }));
        const limitations = [
          'Findings describe a bounded search sample, not the entire market. Search labels do not verify brand ownership.',
          'Publication counts are not historical engagement growth. First and last calendar weeks may be partial.',
          'Missing metrics are null. Totals require complete coverage; mean and median use videos with known views.',
          'Themes are AI-assigned and may overlap; counts are computed from validated video references.',
          'Source permalinks are derived from provider platform IDs and have not been checked for availability.',
          'Evidence IDs are validated, but AI interpretations still need human review.',
        ];
        if (batches.some((batch) => batch.skipped)) limitations.push('Some records were excluded because dates, video format, or usable source references were missing.');
        if (videos.length < input.max_videos) limitations.push('Fewer usable unique videos were available than requested within the bounded search.');
        if (terms.some((term) => !videos.some((v) => v.brands.includes(term)))) limitations.push('One competitor had no usable results; no supported head-to-head conclusion can be made.');
        if (videos.some((v) => v.brands.length > 1)) limitations.push('Some videos match both brands. Overall totals deduplicate these; brand samples overlap.');
        if (demo) limitations.unshift('FICTIONAL DEMO: no real provider calls; example.com links are placeholders. History is in memory and resets on restart.');
        const result = {
          analysis_id: crypto.randomUUID(), skill: input.skill, status: 'completed', kpis, charts,
          insights: interpretation.insights, videos,
          report: { title: input.skill === 'competitor_spy' ? 'Competitive Intelligence Report' : 'Topic Patterns Report', executive_summary: interpretation.executive_summary, recommendations: interpretation.recommendations,
            intelligence: { provider: demo ? 'demo' : provider }, context: input },
          limitations, generated_at: generatedAt.toISOString(),
        };
        await store.save(owner, input, result);
        return json(200, result);
      } finally { running--; }
    } catch (error) {
      const expected = error instanceof AppError;
      return json(expected ? error.status : 500, { error: { code: expected ? error.code : 'INTERNAL_ERROR', message: expected ? error.message : 'An unexpected server error occurred.', request_id: requestId } });
    }
  };
}
