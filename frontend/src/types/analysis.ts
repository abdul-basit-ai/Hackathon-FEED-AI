export type AiProvider = "openai_api" | "lovable_ai" | "anthropic_api";
export type Skill = "competitor_spy" | "trend_detector";
export type PeriodDays = 7 | 30 | 90 | 180 | 365;
export type AnalysisStatus = "queued" | "running" | "completed" | "failed";
export type Platform = "instagram" | "tiktok" | "youtube" | "other";

export const PERIOD_OPTIONS: PeriodDays[] = [7, 30, 90, 180, 365];

export interface AnalysisInput {
  skill: Skill;
  query: string;
  compare_with?: string | null;
  period_days: PeriodDays;
  max_videos?: number;
  ai_provider?: AiProvider;
  model_id?: string | null;
}

/** Absent metrics are `null`, never zero. */
export interface Kpis {
  videos: number;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

export interface Charts {
  posts_by_week: { date: string; count: number }[];
  theme_distribution: { label: string; count: number }[];
  views_by_brand?: { label: string; views: number | null }[] | undefined;
}

export interface Insight {
  id: string;
  title: string;
  explanation: string;
  evidence_video_ids: string[];
}

export interface VideoEvidence {
  id: string;
  url: string;
  creator: string;
  platform: Platform;
  published_at: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  brand?: string | null;
  caption?: string | null;
}

export interface AnalysisReport {
  title: string;
  executive_summary: string;
  recommendations: string[];
}

export interface AnalysisResult {
  analysis_id: string;
  skill: Skill;
  status: AnalysisStatus;
  query: string;
  compare_with: string | null;
  ai_provider: AiProvider;
  period_days: number;
  kpis: Kpis;
  charts: Charts;
  insights: Insight[];
  videos: VideoEvidence[];
  report: AnalysisReport;
  limitations: string[];
  generated_at: string;
  /** Frontend-only flag: true while data comes from the mock adapter. */
  is_demo?: boolean;
}

export interface ProviderCapability {
  id: AiProvider;
  enabled: boolean;
  connected: boolean;
  models?: { id: string; label: string }[];
}

export interface Capabilities {
  providers: ProviderCapability[];
  default_provider?: AiProvider;
  mode?: "demo" | "live";
}

export interface AnalysisSummary {
  analysis_id: string;
  skill: Skill;
  status: AnalysisStatus;
  query: string;
  compare_with: string | null;
  ai_provider: AiProvider;
  generated_at: string;
  video_count: number | null;
  title: string;
  is_demo?: boolean;
}

export interface FeedIntelApi {
  readonly mode: "mock" | "http";
  analyze(input: AnalysisInput): Promise<AnalysisResult>;
  getAnalysis(id: string): Promise<AnalysisResult>;
  listAnalyses(): Promise<AnalysisSummary[]>;
  getCapabilities(): Promise<Capabilities>;
}

export const SKILL_LABEL: Record<Skill, string> = {
  competitor_spy: "Competitor Spy",
  trend_detector: "Trend Detector",
};

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  openai_api: "OpenAI API",
  lovable_ai: "Lovable AI",
  anthropic_api: "Claude / Anthropic",
};
