// Copy into the Lovable project's src/services/feedintelApi.ts.
// Inject the existing Supabase session getter; never embed provider/service keys.
export type IntelligenceProvider = 'openai' | 'claude' | 'lovable';
export interface IntelligenceOptions {
  default_provider: IntelligenceProvider;
  mode: 'demo' | 'live';
  providers: { id: IntelligenceProvider; label: string; description: string; configured: boolean }[];
}
export interface AnalyzeRequest {
  skill: 'competitor_spy' | 'trend_detector';
  query: string;
  compare_with: string | null;
  period_days: number;
  max_videos: number;
  intelligence_provider?: IntelligenceProvider;
}

export interface Metrics {
  videos: number;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  mean_views: number | null;
  median_views: number | null;
  views_sample_size: number;
  engagement_per_view: number | null;
  metric_coverage: Record<'views' | 'likes' | 'comments' | 'shares', number>;
}

export interface Video {
  id: string;
  provider_id: string;
  url: string;
  creator: string | null;
  platform: string;
  published_at: string;
  description: string;
  transcript: string;
  visual_description: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  brands: string[];
  source_url_derived: boolean;
}

export interface Analysis {
  analysis_id: string;
  skill: AnalyzeRequest['skill'];
  status: 'completed';
  kpis: Metrics;
  charts: {
    posts_by_week: { date: string; count: number }[];
    theme_distribution: { label: string; count: number }[];
    views_by_brand: { label: string; views: number | null }[];
    engagement_by_brand: { label: string; engagement_per_view: number | null }[];
    brand_metrics: (Metrics & { label: string })[];
    top_videos: { video_id: string; views: number }[];
    themes_by_brand: { label: string; themes: { label: string; count: number }[] }[];
  };
  insights: { id: string; title: string; explanation: string; evidence_video_ids: string[] }[];
  videos: Video[];
  report: { title: string; executive_summary: string; recommendations: string[]; intelligence: { provider: IntelligenceProvider | 'demo' } };
  limitations: string[];
  generated_at: string;
}

export interface HistoryItem {
  id: string;
  skill: AnalyzeRequest['skill'];
  query: string;
  parameters: AnalyzeRequest;
  status: 'completed';
  created_at: string;
}

export class FeedIntelError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

export function createFeedIntelApi(baseUrl: string, getAccessToken: () => Promise<string | null>) {
  const base = baseUrl.replace(/\/$/, '');
  async function request<T>(path: string, method = 'GET', body?: AnalyzeRequest): Promise<T> {
    const token = await getAccessToken();
    if (!token) throw new FeedIntelError('UNAUTHORIZED', 'Sign in with the restricted demo account.', 401);
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(150000),
      });
    } catch { throw new FeedIntelError('NETWORK_ERROR', 'Unable to reach FeedIntel. Check your connection and try again.', 0); }
    const data = await response.json();
    if (!response.ok) throw new FeedIntelError(data.error?.code || 'REQUEST_FAILED', data.error?.message || 'Analysis request failed.', response.status);
    return data as T;
  }
  return {
    getIntelligenceOptions: () => request<IntelligenceOptions>('/intelligence-options'),
    analyze: (body: AnalyzeRequest) => request<Analysis>('/analyze', 'POST', body),
    getAnalysis: (id: string) => request<Analysis>(`/analyses/${encodeURIComponent(id)}`),
    listAnalyses: (limit = 20, offset = 0) => request<{ analyses: HistoryItem[]; limit: number; offset: number }>(`/analyses?limit=${limit}&offset=${offset}`),
  };
}
