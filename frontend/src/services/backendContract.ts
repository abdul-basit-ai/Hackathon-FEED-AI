import { z } from "zod";
import type { AiProvider, AnalysisInput, AnalysisResult, AnalysisSummary, Capabilities } from "@/types/analysis";

export const providerToBackend = { openai_api: "openai", anthropic_api: "claude", lovable_ai: "lovable" } as const;
const providerFromBackend: Record<string, AiProvider> = { openai: "openai_api", claude: "anthropic_api", lovable: "lovable_ai" };
const metric = z.number().nonnegative().nullable();
const skill = z.enum(["competitor_spy", "trend_detector"]);
const provider = z.enum(["openai", "claude", "lovable"]);
const context = z.object({ skill, query: z.string(), compare_with: z.string().nullable(), period_days: z.number(), intelligence_provider: provider.optional() });
const backendResult = z.object({
  analysis_id: z.string(), skill, status: z.literal("completed"),
  kpis: z.object({ videos: z.number(), views: metric, likes: metric, comments: metric, shares: metric }),
  charts: z.object({ posts_by_week: z.array(z.object({ date: z.string(), count: z.number() })),
    theme_distribution: z.array(z.object({ label: z.string(), count: z.number() })),
    views_by_brand: z.array(z.object({ label: z.string(), views: metric })).optional() }),
  insights: z.array(z.object({ id: z.string(), title: z.string(), explanation: z.string(), evidence_video_ids: z.array(z.string()) })),
  videos: z.array(z.object({ id: z.string(), url: z.string().url().refine((url) => /^https?:\/\//.test(url)), creator: z.string().nullable(), platform: z.string(),
    published_at: z.string(), views: metric, likes: metric, comments: metric, description: z.string().optional(), brands: z.array(z.string()).optional() })),
  report: z.object({ title: z.string(), executive_summary: z.string(), recommendations: z.array(z.string()),
    intelligence: z.object({ provider: z.enum(["openai", "claude", "lovable", "demo"]) }).optional(), context: context.optional() }),
  limitations: z.array(z.string()), generated_at: z.string(),
});

export class FeedIntelError extends Error {
  constructor(public code: string, message: string, public status = 0) { super(message); }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new FeedIntelError("INVALID_RESPONSE", "The backend returned an unexpected response. Please try again.", 502);
  return result.data;
}

export function toBackendInput(input: AnalysisInput) {
  return { skill: input.skill, query: input.query, compare_with: input.compare_with ?? null,
    period_days: input.period_days, max_videos: input.max_videos ?? 40,
    ...(input.ai_provider ? { intelligence_provider: providerToBackend[input.ai_provider] } : {}) };
}

export function toAnalysisResult(value: unknown, submitted?: AnalysisInput): AnalysisResult {
  const data = parse(backendResult, value);
  const criteria = data.report.context ?? submitted;
  if (!criteria) throw new FeedIntelError("MISSING_CONTEXT", "This saved report lacks search criteria. Please run a new analysis.");
  const demo = data.report.intelligence?.provider === "demo";
  const selected = data.report.intelligence?.provider;
  const contextProvider = data.report.context?.intelligence_provider;
  return {
    ...data, query: criteria.query, compare_with: criteria.compare_with ?? null, period_days: criteria.period_days,
    ai_provider: selected && selected !== "demo" ? providerFromBackend[selected]! : contextProvider ? providerFromBackend[contextProvider]! : submitted?.ai_provider ?? "openai_api",
    videos: data.videos.map((video) => ({
      ...video, creator: video.creator ?? "Unknown creator",
      platform: ["instagram", "tiktok", "youtube"].includes(video.platform) ? video.platform as "instagram" | "tiktok" | "youtube" : "other",
      caption: video.description ?? null, brand: video.brands?.join(" / ") ?? null,
    })), is_demo: demo,
  };
}

const historySchema = z.object({ analyses: z.array(z.object({
  id: z.string(), skill, query: z.string(), status: z.literal("completed"), created_at: z.string(),
  parameters: z.object({ compare_with: z.string().nullable().optional(), intelligence_provider: provider.optional() }),
})), limit: z.number(), offset: z.number() });

export function toHistory(value: unknown): AnalysisSummary[] {
  return parse(historySchema, value).analyses.map((item) => ({
    analysis_id: item.id, skill: item.skill, status: item.status, query: item.query,
    compare_with: item.parameters.compare_with ?? null, generated_at: item.created_at,
    ai_provider: providerFromBackend[item.parameters.intelligence_provider ?? "openai"]!,
    video_count: null, title: `${item.skill === "competitor_spy" ? "Competitor analysis" : "Topic analysis"}: ${item.query}`,
  }));
}

export function toCapabilities(value: unknown): Capabilities {
  const data = parse(z.object({ default_provider: provider, mode: z.enum(["demo", "live"]), providers: z.array(z.object({ id: provider, configured: z.boolean() })) }), value);
  return { default_provider: providerFromBackend[data.default_provider]!, mode: data.mode,
    providers: data.providers.map((item) => ({ id: providerFromBackend[item.id]!, enabled: data.mode === "demo" || item.configured, connected: item.configured })) };
}
