import { describe, expect, it } from "vitest";
import type { VideoEvidence } from "@/types/analysis";
import { aggregate, buildBuckets, buildRows, rangeOptions, rankMetrics } from "@/lib/metrics";

const video = (over: Partial<VideoEvidence>): VideoEvidence => ({
  id: crypto.randomUUID(), url: "https://example.com/v", creator: "c", platform: "tiktok",
  published_at: "2026-11-05T12:00:00Z", views: 1000, likes: 50, comments: 10, shares: 5, ...over,
});

describe("metric relevance", () => {
  it("leads competitor analyses with performance and topic analyses with volume", () => {
    const videos = [video({})];
    expect(rankMetrics("competitor_spy", videos).map((m) => m.id).slice(0, 2)).toEqual(["views", "engagement"]);
    expect(rankMetrics("trend_detector", videos)[0]!.id).toBe("posts");
  });

  it("moves sparse metrics after covered ones and unavailable metrics last", () => {
    const videos = [video({ shares: null }), video({ shares: null, likes: null }), video({ shares: null })];
    const ranked = rankMetrics("competitor_spy", videos);
    expect(ranked.at(-1)).toMatchObject({ id: "shares", available: false });
    expect(ranked.at(-2)).toMatchObject({ id: "engagement", available: false });
    expect(ranked.find((m) => m.id === "likes")!.coverage).toBeCloseTo(2 / 3);
  });
});

describe("aggregation", () => {
  it("returns null when no video reports a metric, never zero", () => {
    expect(aggregate([video({ views: null })], "views").value).toBeNull();
    expect(aggregate([], "views").value).toBe(0);
    expect(aggregate([], "engagement").value).toBeNull();
  });

  it("sums known values and reports how many are missing", () => {
    expect(aggregate([video({ views: 100 }), video({ views: null })], "views")).toEqual({ value: 100, missing: 1 });
  });

  it("computes engagement per view only from fully reported videos", () => {
    const result = aggregate([video({ views: 1000, likes: 80, comments: 15, shares: 5 }), video({ shares: null })], "engagement");
    expect(result.value).toBeCloseTo(10);
    expect(result.missing).toBe(1);
  });
});

describe("time buckets", () => {
  it("uses daily buckets up to a month and weekly beyond", () => {
    expect(buildBuckets("2026-11-07T00:00:00Z", 7).granularity).toBe("day");
    const weekly = buildBuckets("2026-11-07T00:00:00Z", 90);
    expect(weekly.granularity).toBe("week");
    expect(new Date(weekly.buckets[0]!.start).getUTCDay()).toBe(1);
  });

  it("offers ranges within the analysis period", () => {
    expect(rangeOptions(30)).toEqual([7, 14, 30]);
    expect(rangeOptions(7)).toEqual([7]);
  });

  it("indexes multiple series to their own peak while keeping raw values", () => {
    const { buckets, start, end } = buildBuckets("2026-11-07T00:00:00Z", 7);
    const rows = buildRows([video({ views: 400, published_at: "2026-11-03T10:00:00Z" }), video({ views: 200, published_at: "2026-11-05T10:00:00Z" })],
      buckets, { start, end }, [{ key: "views", label: "Views", metric: "views", color: "#000", match: () => true }], true);
    const peak = rows.find((r) => r['views__raw'] === 400)!;
    expect(peak['views']).toBe(100);
    expect(rows.find((r) => r['views__raw'] === 200)!['views']).toBe(50);
  });
});
