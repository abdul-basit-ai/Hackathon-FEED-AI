import type { AnalysisInput, AnalysisResult, FeedIntelApi } from "@/types/analysis";
import { competitorAnalysis } from "@/mocks/competitorAnalysis";
import { trendAnalysis } from "@/mocks/trendAnalysis";

// In-memory session store only — not durable storage.
const store = new Map<string, AnalysisResult>([
  [competitorAnalysis.analysis_id, competitorAnalysis],
  [trendAnalysis.analysis_id, trendAnalysis],
]);

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockFeedintelApi: FeedIntelApi = {
  mode: "mock",
  async analyze(input: AnalysisInput) {
    await delay(1600);
    const base = input.skill === "competitor_spy" ? competitorAnalysis : trendAnalysis;
    const id = `demo-${Date.now().toString(36)}`;
    const result: AnalysisResult = {
      ...base,
      analysis_id: id,
      query: input.query,
      compare_with: input.skill === "competitor_spy" ? (input.compare_with ?? null) : null,
      period_days: input.period_days,
      ai_provider: input.ai_provider ?? "openai_api",
      generated_at: new Date().toISOString(),
      charts: {
        ...base.charts,
        views_by_brand: base.charts.views_by_brand?.map((b, i) => ({
          ...b,
          label: i === 0 ? input.query : (input.compare_with ?? b.label),
        })),
      },
      report: {
        ...base.report,
        title:
          input.skill === "competitor_spy"
            ? `Competitive Intelligence Report: ${input.query} vs ${input.compare_with}`
            : `Trend Report: ${input.query}`,
      },
      is_demo: true,
    };
    store.set(id, result);
    return result;
  },
  async getAnalysis(id) {
    await delay(250);
    const r = store.get(id);
    if (!r) throw new Error(`Analysis ${id} not found`);
    return r;
  },
  async listAnalyses() {
    await delay(250);
    return [...store.values()].sort((a, b) => b.generated_at.localeCompare(a.generated_at)).map((a) => ({
      analysis_id: a.analysis_id, skill: a.skill, status: a.status, query: a.query,
      compare_with: a.compare_with, ai_provider: a.ai_provider, generated_at: a.generated_at,
      video_count: a.kpis.videos, title: a.report.title, is_demo: true,
    }));
  },
  async getCapabilities() {
    await delay(200);
    // Truthful: nothing is connected in demo mode.
    return {
      default_provider: "openai_api", mode: "demo",
      providers: [
        { id: "openai_api", enabled: true, connected: false },
        { id: "lovable_ai", enabled: true, connected: false },
        { id: "anthropic_api", enabled: true, connected: false },
      ],
    };
  },
};
