import type { AnalysisResult } from "@/types/analysis";

// FICTIONAL DEMO DATA.
export const trendAnalysis: AnalysisResult = {
  analysis_id: "demo-002",
  skill: "trend_detector",
  status: "completed",
  query: "Protein coffee",
  compare_with: null,
  ai_provider: "openai_api",
  period_days: 30,
  is_demo: true,
  kpis: { videos: 36, views: 2_080_000, likes: 151_000, comments: 9_870, shares: null },
  charts: {
    posts_by_week: [
      { date: "2026-10-05", count: 6 }, { date: "2026-10-12", count: 8 },
      { date: "2026-10-19", count: 11 }, { date: "2026-10-26", count: 11 },
    ],
    theme_distribution: [
      { label: "Recipe how-to", count: 14 }, { label: "Taste test", count: 8 },
      { label: "Gym routine", count: 6 }, { label: "Product review", count: 5 },
      { label: "Nutrition facts", count: 3 },
    ],
  },
  insights: [
    { id: "t-insight-01", title: "Recipe tutorials dominate", explanation: "Step-by-step recipe videos are the most common format in the retrieved sample.", evidence_video_ids: ["t-video-01", "t-video-02"] },
    { id: "t-insight-02", title: "Taste tests drive comments", explanation: "Taste-test videos show the highest comment counts among sampled clips.", evidence_video_ids: ["t-video-03"] },
  ],
  videos: [
    { id: "t-video-01", url: "https://example.com/video/t01", creator: "fitkitchen", platform: "tiktok", published_at: "2026-10-20", views: 412_000, likes: 33_000, comments: 1_420, caption: "3-ingredient protein iced coffee" },
    { id: "t-video-02", url: "https://example.com/video/t02", creator: "macrobarista", platform: "instagram", published_at: "2026-10-14", views: 228_000, likes: 17_600, comments: 610, caption: "My morning proffee ritual" },
    { id: "t-video-03", url: "https://example.com/video/t03", creator: "honestbites", platform: "youtube", published_at: "2026-10-27", views: 175_000, likes: null, comments: 2_310, caption: "Rating 6 protein coffees" },
  ],
  report: {
    title: "Trend Report: Protein coffee",
    executive_summary: "In 36 sampled videos over 30 days, recipe tutorials were the leading format and publishing volume was highest in the final two weeks of the window.",
    recommendations: ["Lead with a fast recipe format.", "Invite taste-test reactions to encourage comments."],
  },
  limitations: [
    "Sampled videos only.",
    "Publication volume is not historical engagement growth.",
    "Shares unavailable from source.",
  ],
  generated_at: "2026-11-06T15:30:00Z",
};
