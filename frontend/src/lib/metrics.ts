import type { AnalysisResult, Skill, VideoEvidence } from "@/types/analysis";

export type MetricId = "views" | "engagement" | "likes" | "comments" | "shares" | "posts";

export interface MetricDef {
  id: MetricId;
  label: string;
  unit: "count" | "percent";
  description: string;
}

export const METRICS: Record<MetricId, MetricDef> = {
  views: { id: "views", label: "Views", unit: "count", description: "Sum of views on videos published in each period" },
  engagement: { id: "engagement", label: "Engagement per view", unit: "percent", description: "(likes + comments + shares) ÷ views, for videos with all four metrics" },
  likes: { id: "likes", label: "Likes", unit: "count", description: "Sum of likes on videos published in each period" },
  comments: { id: "comments", label: "Comments", unit: "count", description: "Sum of comments on videos published in each period" },
  shares: { id: "shares", label: "Shares", unit: "count", description: "Sum of shares on videos published in each period" },
  posts: { id: "posts", label: "Videos posted", unit: "count", description: "Number of sampled videos published in each period" },
};

/** Base relevance per skill: comparisons lead with performance, topic analysis with publishing volume. */
const BASE_ORDER: Record<Skill, MetricId[]> = {
  competitor_spy: ["views", "engagement", "likes", "comments", "shares", "posts"],
  trend_detector: ["posts", "views", "engagement", "likes", "comments", "shares"],
};

/** Categorical slots validated all-pairs for colour-vision deficiency; at most three series at once. */
export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a"] as const;
export const MAX_SERIES = SERIES_COLORS.length;

const engagementEligible = (v: VideoEvidence) =>
  v.views !== null && v.views > 0 && v.likes !== null && v.comments !== null && v.shares != null;

function known(v: VideoEvidence, id: MetricId): boolean {
  if (id === "posts") return true;
  if (id === "engagement") return engagementEligible(v);
  return v[id] != null;
}

export interface RankedMetric extends MetricDef {
  /** Share of sampled videos that report this metric (0–1). */
  coverage: number;
  available: boolean;
}

/** Most relevant first; sparse metrics after well-covered ones, unavailable last. */
export function rankMetrics(skill: Skill, videos: VideoEvidence[]): RankedMetric[] {
  const ranked = BASE_ORDER[skill].map((id, index) => {
    const coverage = videos.length ? videos.filter((v) => known(v, id)).length / videos.length : 0;
    return { ...METRICS[id], coverage, available: coverage > 0, index };
  });
  const tier = (m: (typeof ranked)[number]) => (!m.available ? 2 : m.coverage < 0.5 ? 1 : 0);
  return ranked.sort((a, b) => tier(a) - tier(b) || a.index - b.index).map(({ index: _index, ...m }) => m);
}

export function rangeOptions(periodDays: number): number[] {
  return [...new Set([7, 14, 30, 90, 180, 365].filter((d) => d < periodDays).concat(periodDays))];
}

export interface Bucket {
  key: string;
  start: number;
  end: number;
}

const DAY = 86_400_000;

/** Daily buckets up to a month, otherwise Monday-based UTC weeks; empty periods are kept. */
export function buildBuckets(endIso: string, days: number): { granularity: "day" | "week"; buckets: Bucket[]; start: number; end: number } {
  const end = new Date(endIso).getTime();
  const start = end - days * DAY;
  const granularity = days <= 31 ? "day" : "week";
  const first = new Date(start);
  first.setUTCHours(0, 0, 0, 0);
  if (granularity === "week") first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  const step = granularity === "day" ? DAY : 7 * DAY;
  const buckets: Bucket[] = [];
  for (let t = first.getTime(); t <= end; t += step) buckets.push({ key: new Date(t).toISOString().slice(0, 10), start: t, end: t + step });
  return { granularity, buckets, start, end };
}

/** Null when no video in the group reports the metric; zero only when nothing was published. */
export function aggregate(videos: VideoEvidence[], id: MetricId): { value: number | null; missing: number } {
  if (id === "posts") return { value: videos.length, missing: 0 };
  if (!videos.length) return { value: id === "engagement" ? null : 0, missing: 0 };
  if (id === "engagement") {
    const eligible = videos.filter(engagementEligible);
    if (!eligible.length) return { value: null, missing: videos.length };
    const interactions = eligible.reduce((s, v) => s + v.likes! + v.comments! + v.shares!, 0);
    const views = eligible.reduce((s, v) => s + v.views!, 0);
    return { value: (interactions / views) * 100, missing: videos.length - eligible.length };
  }
  const values = videos.map((v) => v[id]).filter((n): n is number => n != null);
  return { value: values.length ? values.reduce((s, n) => s + n, 0) : null, missing: videos.length - values.length };
}

export interface Group {
  key: string;
  label: string;
  match: (v: VideoEvidence) => boolean;
}

/** Competitor analyses split by brand; topic analyses are a single group. */
export function groupsFor(a: AnalysisResult): Group[] {
  if (a.skill !== "competitor_spy") return [{ key: "all", label: a.query, match: () => true }];
  const labels = a.charts.views_by_brand?.map((b) => b.label) ?? [a.query, a.compare_with].filter((x): x is string => !!x);
  return labels.slice(0, MAX_SERIES).map((label) => ({
    key: label,
    label,
    match: (v) => (v.brands ?? (v.brand ? v.brand.split(" / ") : [])).some((b) => b.toLowerCase() === label.toLowerCase()),
  }));
}

export interface Series {
  key: string;
  label: string;
  metric: MetricId;
  color: string;
}

export type Row = { bucket: string } & Record<string, number | null | string>;

/** One row per bucket; `${series.key}` holds the plotted value and `${series.key}__raw` the actual value. */
export function buildRows(
  videos: VideoEvidence[],
  buckets: Bucket[],
  range: { start: number; end: number },
  series: (Series & { match: (v: VideoEvidence) => boolean })[],
  indexed: boolean,
): Row[] {
  const inRange = videos.filter((v) => {
    const t = new Date(v.published_at).getTime();
    return t >= range.start && t <= range.end;
  });
  const rows: Row[] = buckets.map((b) => ({ bucket: b.key }));
  for (const s of series) {
    const values = buckets.map((b) => {
      const vids = inRange.filter((v) => s.match(v) && new Date(v.published_at).getTime() >= b.start && new Date(v.published_at).getTime() < b.end);
      return aggregate(vids, s.metric);
    });
    const peak = Math.max(0, ...values.map((x) => x.value ?? 0));
    values.forEach((x, i) => {
      rows[i]![`${s.key}__raw`] = x.value;
      rows[i]![`${s.key}__missing`] = x.missing;
      rows[i]![s.key] = indexed && x.value !== null ? (peak > 0 ? (x.value / peak) * 100 : 0) : x.value;
    });
  }
  return rows;
}

export function formatMetric(id: MetricId, value: number | null | undefined): string {
  if (value === null || value === undefined) return "Not available";
  if (METRICS[id].unit === "percent") return `${value.toFixed(value < 1 ? 2 : 1)}%`;
  return new Intl.NumberFormat("en", { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}
