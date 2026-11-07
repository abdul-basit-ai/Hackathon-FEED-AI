export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function validateInput(body) {
  const fail = (message) => { throw new AppError(400, 'INVALID_INPUT', message); };
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Expected a JSON object.');
  const allowed = ['skill', 'query', 'compare_with', 'period_days', 'max_videos', 'intelligence_provider'];
  if (Object.keys(body).some((key) => !allowed.includes(key))) fail('Unknown request field.');
  if (!['competitor_spy', 'trend_detector'].includes(body.skill)) fail('Select competitor_spy or trend_detector.');
  const text = (value, name) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 200 || /[\x00-\x1f]/.test(value)) fail(`${name} must be 1–200 printable characters.`);
    return value.trim();
  };
  const query = text(body.query, 'query');
  let compare = null;
  if (body.skill === 'competitor_spy') {
    compare = text(body.compare_with, 'compare_with');
    if (query.toLowerCase() === compare.toLowerCase()) fail('Choose two different competitors.');
  } else if (body.compare_with != null) fail('compare_with must be null for trend_detector.');
  const period = body.period_days ?? 90;
  const max = body.max_videos ?? 40;
  if (!Number.isInteger(period) || period < 1 || period > 365) fail('period_days must be an integer from 1 to 365.');
  if (!Number.isInteger(max) || max < (compare ? 2 : 1) || max > 50) fail(`max_videos must be an integer from ${compare ? 2 : 1} to 50 (total across competitors).`);
  if (body.intelligence_provider !== undefined && !['openai', 'claude', 'lovable'].includes(body.intelligence_provider)) fail('intelligence_provider must be openai, claude, or lovable.');
  return { skill: body.skill, query, compare_with: compare, period_days: period, max_videos: max,
    ...(body.intelligence_provider === undefined ? {} : { intelligence_provider: body.intelligence_provider }) };
}

const metric = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

// Oriane's full projection has platformId, rather than a source URL.
// These are derived platform permalinks, not links checked for availability.
export function sourceUrl(row) {
  const id = String(row.platformId ?? '');
  if (row.platform === 'youtube' && /^[\w-]{11}$/.test(id)) return `https://www.youtube.com/watch?v=${id}`;
  if (row.platform === 'tiktok' && /^\d+$/.test(id) && /^[\w.]+$/.test(row.profileHandle ?? '')) return `https://www.tiktok.com/@${row.profileHandle}/video/${id}`;
  if (row.platform === 'instagram' && /^\d+$/.test(id)) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let number = BigInt(id);
    let code = '';
    while (number > 0n) { code = alphabet[Number(number % 64n)] + code; number /= 64n; }
    if (code) return `https://www.instagram.com/p/${code}/`;
  }
  return null;
}

export function normalizeVideo(row, brand) {
  if (!row || typeof row.id !== 'string' || !row.id || row.format !== 'video') return null;
  const url = sourceUrl(row);
  const timestamp = Date.parse(row.publishedAt);
  if (!url || !Number.isFinite(timestamp)) return null;
  const media = Array.isArray(row.media) ? row.media : [];
  return {
    id: crypto.randomUUID(), provider_id: row.id, url, platform: row.platform,
    creator: typeof row.profileHandle === 'string' ? row.profileHandle : null,
    published_at: new Date(timestamp).toISOString(),
    description: String(row.caption ?? row.title ?? '').slice(0, 4000),
    transcript: media.map((item) => typeof item?.transcript === 'string' ? item.transcript : '').join('\n').slice(0, 8000),
    visual_description: media.map((item) => typeof item?.caption === 'string' ? item.caption : '').join('\n').slice(0, 4000),
    views: metric(row.viewsCount), likes: metric(row.likesCount),
    comments: metric(row.commentsCount), shares: metric(row.sharesCount),
    brands: [brand], source_url_derived: true,
  };
}

export function deduplicate(videos) {
  const seen = new Map();
  for (const video of videos) {
    const key = `${video.platform}:${video.provider_id}`;
    const existing = seen.get(key);
    if (existing) existing.brands = [...new Set([...existing.brands, ...video.brands])];
    else seen.set(key, { ...video, brands: [...video.brands] });
  }
  return [...seen.values()];
}

// Totals are null when any source value is missing: partial sums must not
// masquerade as complete totals. An empty sample also has unknown totals.
export function calculateMetrics(videos) {
  const total = (field) => videos.length && videos.every((v) => v[field] !== null) ? videos.reduce((sum, v) => sum + v[field], 0) : null;
  const views = total('views');
  const likes = total('likes');
  const comments = total('comments');
  const shares = total('shares');
  const knownViews = videos.map((v) => v.views).filter((v) => v !== null).sort((a, b) => a - b);
  const middle = Math.floor(knownViews.length / 2);
  return {
    videos: videos.length, views, likes, comments, shares,
    mean_views: knownViews.length ? knownViews.reduce((a, b) => a + b, 0) / knownViews.length : null,
    median_views: knownViews.length ? (knownViews.length % 2 ? knownViews[middle] : (knownViews[middle - 1] + knownViews[middle]) / 2) : null,
    views_sample_size: knownViews.length,
    engagement_per_view: views > 0 && [likes, comments, shares].every((v) => v !== null) ? (likes + comments + shares) / views * 100 : null,
    metric_coverage: Object.fromEntries(['views', 'likes', 'comments', 'shares'].map((field) => [field, videos.filter((v) => v[field] !== null).length])),
  };
}

export function calculateCharts(videos, input, now) {
  const weeks = new Map();
  const monday = (value) => {
    const date = new Date(value);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    return date;
  };
  const start = monday(now.getTime() - input.period_days * 86400000);
  const end = monday(now);
  for (let date = start; date <= end; date = new Date(date.getTime() + 7 * 86400000)) weeks.set(date.toISOString().slice(0, 10), 0);
  for (const video of videos) {
    const week = monday(video.published_at).toISOString().slice(0, 10);
    weeks.set(week, (weeks.get(week) ?? 0) + 1);
  }
  const brands = input.compare_with ? [input.query, input.compare_with] : [];
  const brandMetrics = brands.map((label) => ({ label, ...calculateMetrics(videos.filter((v) => v.brands.includes(label))) }));
  return {
    posts_by_week: [...weeks].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
    theme_distribution: [],
    views_by_brand: brandMetrics.map(({ label, views }) => ({ label, views })),
    engagement_by_brand: brandMetrics.map(({ label, engagement_per_view }) => ({ label, engagement_per_view })),
    brand_metrics: brandMetrics,
    top_videos: [...videos].filter((v) => v.views !== null).sort((a, b) => b.views - a.views).slice(0, 5).map((v) => ({ video_id: v.id, views: v.views })),
  };
}

export function mapEvidence(analysis, videos) {
  const invalid = () => { throw new AppError(502, 'INVALID_AI_OUTPUT', 'The analysis provider returned invalid or unsupported findings.'); };
  const text = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 6000;
  const ids = new Set(videos.map((v) => v.id));
  const evidence = (list) => Array.isArray(list) && list.length > 0 && list.every((id) => typeof id === 'string' && ids.has(id)) && new Set(list).size === list.length;
  if (!analysis || !text(analysis.executive_summary) || !Array.isArray(analysis.recommendations) || !analysis.recommendations.length || !analysis.recommendations.every(text)) invalid();
  if (!Array.isArray(analysis.insights) || analysis.insights.length < 3 || analysis.insights.length > 5) invalid();
  for (const insight of analysis.insights) if (!insight || !text(insight.title) || !text(insight.explanation) || !evidence(insight.evidence_video_ids)) invalid();
  if (!Array.isArray(analysis.themes) || analysis.themes.length > 12) invalid();
  const labels = new Set();
  for (const theme of analysis.themes) {
    if (!theme || !text(theme.label) || !evidence(theme.video_ids) || labels.has(theme.label.toLowerCase())) invalid();
    labels.add(theme.label.toLowerCase());
  }
  return {
    ...analysis,
    insights: analysis.insights.map((item, index) => ({ id: `insight-${index + 1}`, title: item.title, explanation: item.explanation, evidence_video_ids: item.evidence_video_ids })),
    distribution: analysis.themes.map((theme) => ({ label: theme.label, count: theme.video_ids.length })),
  };
}
