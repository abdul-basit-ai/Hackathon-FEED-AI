import { OrianeConnector, createAnalyzer, selectIntelligenceProvider, requireIntelligenceConfig } from '../supabase/functions/_shared/feedintel/providers.js';
import { calculateMetrics, calculateCharts, deduplicate, mapEvidence } from '../supabase/functions/_shared/feedintel/core.js';

// Explicit live diagnostic: makes small real searches and one AI request through the selected provider.
// Prints only status information and counts, never credentials or raw errors.
process.loadEnvFile();
const env = (name) => process.env[name];
let failed = false;
const fetcher = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    let code = null;
    try {
      const body = await response.clone().json();
      const candidate = body?.error?.code ?? body?.code;
      if (typeof candidate === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(candidate)) code = candidate;
    } catch { /* The normal provider handler sanitizes malformed responses. */ }
    console.log(JSON.stringify({ provider: new URL(url).hostname, status: response.status, error_code: code }));
  }
  return response;
};

async function checkDatabase() {
  const base = env('SUPABASE_URL');
  const key = env('SB_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
  if (!base || !key) { failed = true; console.log('Supabase: missing configuration.'); return; }
  const headers = { apikey: key, ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }) };
  for (const [name, path] of [
    ['Supabase connection', '/auth/v1/settings'],
    ['Supabase analyses table', '/rest/v1/analyses?select=id&limit=0'],
  ]) {
    try {
      const response = await fetcher(base + path, { headers, signal: AbortSignal.timeout(15000) });
      console.log(`${name}: HTTP ${response.status}`);
      if (!response.ok) failed = true;
    } catch { failed = true; console.log(`${name}: connection failed.`); }
  }
  if (!env('DEMO_USER_IDS')) { failed = true; console.log('Restricted demo account: DEMO_USER_IDS is not configured.'); }
}

async function checkAnalysis() {
  try {
    const now = new Date();
    const input = { skill: 'competitor_spy', query: 'Nike', compare_with: 'Adidas', period_days: 90, max_videos: 4 };
    const provider = selectIntelligenceProvider(input, env);
    requireIntelligenceConfig(provider, env);
    input.intelligence_provider = provider;
    const connector = new OrianeConnector(env, fetcher);
    const batches = await Promise.all([input.query, input.compare_with].map((term) => connector.search(term, 2, input.period_days, now)));
    const videos = deduplicate(batches.flatMap((batch) => batch.videos));
    if (!videos.length) throw new Error('No usable videos.');
    const kpis = calculateMetrics(videos);
    const charts = calculateCharts(videos, input, now);
    const analysis = mapEvidence(await createAnalyzer(provider, env, fetcher).analyze(input, videos, kpis, charts), videos);
    console.log(JSON.stringify({ live_analysis: 'passed', real_videos: videos.length, calculated_video_kpi: kpis.videos, ai_insights: analysis.insights.length, evidence_ids_validated: true }));
    console.log('Source URLs are derived platform links; availability is not verified by this check.');
  } catch (error) {
    failed = true;
    console.log(JSON.stringify({ live_analysis: 'failed', code: typeof error.code === 'string' ? error.code : 'CHECK_FAILED' }));
  }
}

await Promise.all([checkDatabase(), checkAnalysis()]);
if (failed) { console.log('Live setup is incomplete. Demo mode has not been changed.'); process.exitCode = 1; }
else console.log('Provider checks passed. Full saved-result acceptance and deployment still need verification.');
