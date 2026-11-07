import type { AnalysisResult } from "@/types/analysis";

// FICTIONAL DEMO DATA — not real brand performance.
export const competitorAnalysis: AnalysisResult = {
  analysis_id: "demo-001",
  skill: "competitor_spy",
  status: "completed",
  query: "Nike",
  compare_with: "Adidas",
  ai_provider: "openai_api",
  period_days: 90,
  is_demo: true,
  kpis: { videos: 40, views: 1_240_000, likes: 86_500, comments: 6_520, shares: null },
  charts: {
    posts_by_week: [
      { date: "2026-08-17", count: 3 }, { date: "2026-08-24", count: 4 },
      { date: "2026-08-31", count: 2 }, { date: "2026-09-07", count: 5 },
      { date: "2026-09-14", count: 3 }, { date: "2026-09-21", count: 6 },
      { date: "2026-09-28", count: 4 }, { date: "2026-10-05", count: 5 },
      { date: "2026-10-12", count: 3 }, { date: "2026-10-19", count: 2 },
      { date: "2026-10-26", count: 3 },
    ],
    theme_distribution: [
      { label: "Product demos", count: 12 }, { label: "Athlete stories", count: 9 },
      { label: "Behind the scenes", count: 7 }, { label: "Running tips", count: 6 },
      { label: "Collabs & drops", count: 4 }, { label: "Sustainability", count: 2 },
    ],
    views_by_brand: [
      { label: "Nike", views: 720_000 },
      { label: "Adidas", views: 520_000 },
    ],
  },
  insights: [
    {
      id: "insight-01",
      title: "Product demonstrations lead the sample",
      explanation: "Close-up product demos were the most frequent theme for both brands within the retrieved videos and appear among the top-viewed clips.",
      evidence_video_ids: ["video-01", "video-03", "video-05"],
    },
    {
      id: "insight-02",
      title: "Nike leans on athlete storytelling",
      explanation: "A larger share of Nike's sampled videos feature named athletes in narrative formats compared with Adidas.",
      evidence_video_ids: ["video-02", "video-04"],
    },
    {
      id: "insight-03",
      title: "Adidas publishes more collab content",
      explanation: "Collaboration and limited-drop announcements appear more often in Adidas's sampled videos.",
      evidence_video_ids: ["video-06"],
    },
  ],
  videos: [
    { id: "video-01", url: "https://example.com/video/01", creator: "nike", brand: "Nike", platform: "instagram", published_at: "2026-10-05", views: 182_000, likes: 12_400, comments: 840, caption: "Pegasus 43 — every detail, up close." },
    { id: "video-02", url: "https://example.com/video/02", creator: "nikerunning", brand: "Nike", platform: "tiktok", published_at: "2026-09-21", views: 241_000, likes: 19_800, comments: 1_120, caption: "Race morning with our marathon squad." },
    { id: "video-03", url: "https://example.com/video/03", creator: "adidas", brand: "Adidas", platform: "instagram", published_at: "2026-09-28", views: 156_000, likes: 9_900, comments: 610, caption: "Adizero unboxed." },
    { id: "video-04", url: "https://example.com/video/04", creator: "nike", brand: "Nike", platform: "youtube", published_at: "2026-09-07", views: 98_000, likes: null, comments: 430, caption: "Mini doc: the comeback season." },
    { id: "video-05", url: "https://example.com/video/05", creator: "adidasoriginals", brand: "Adidas", platform: "tiktok", published_at: "2026-10-12", views: 133_000, likes: 11_200, comments: 720, caption: "Samba restock — first look." },
    { id: "video-06", url: "https://example.com/video/06", creator: "adidas", brand: "Adidas", platform: "instagram", published_at: "2026-10-19", views: 87_000, likes: 6_100, comments: null, caption: "New collab drops Friday." },
  ],
  report: {
    title: "Competitive Intelligence Report: Nike vs Adidas",
    executive_summary: "Across 40 sampled social videos over 90 days, product demonstrations were the dominant theme for both brands. Nike's sample skews toward athlete storytelling while Adidas features more collaboration announcements.",
    recommendations: [
      "Test short-form close-up product demos as a recurring format.",
      "Pair launches with an athlete or creator narrative.",
      "Monitor collab-driven spikes in competitor publishing.",
    ],
  },
  limitations: [
    "Sampled videos only; not all market content.",
    "Shares were not available from the source and are shown as missing.",
    "Engagement reflects the moment of retrieval, not final performance.",
  ],
  generated_at: "2026-11-05T10:00:00Z",
};
