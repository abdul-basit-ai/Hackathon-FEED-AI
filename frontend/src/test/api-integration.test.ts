import { describe, expect, it, vi } from "vitest";
import { createHttpFeedintelApi } from "@/services/httpFeedintelApi";
import { toCapabilities } from "@/services/backendContract";
import type { AnalysisInput } from "@/types/analysis";
// The production backend is plain JavaScript shared with Deno.
// @ts-expect-error Backend JavaScript has no TypeScript declarations.
import { createApp } from "../../../supabase/functions/_shared/feedintel/app.js";

const token = crypto.randomUUID();
const input: AnalysisInput = { skill: "competitor_spy", query: "Nike", compare_with: "Adidas", period_days: 90, max_videos: 6, ai_provider: "lovable_ai" };

function integratedApi() {
  const app = createApp({ env: (name: string) => ({ FEEDINTEL_MODE: "demo", DEMO_ACCESS_TOKEN: token } as Record<string, string>)[name] });
  const fetcher = vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => app(new Request(String(url), options)));
  return { api: createHttpFeedintelApi({ baseUrl: "http://backend", getToken: async () => token, fetcher }), fetcher };
}

describe("Frontend against the actual backend handler", () => {
  it.each(["competitor_spy", "trend_detector"] as const)("runs %s, maps evidence, reopens saved reports, and lists summaries", async (skill) => {
    const { api, fetcher } = integratedApi();
    const result = await api.analyze({ ...input, skill, compare_with: skill === "competitor_spy" ? "Adidas" : null });
    expect(result.query).toBe("Nike");
    expect(result.kpis.videos).toBe(6);
    expect(result.kpis.shares).toBeNull();
    expect(result.is_demo).toBe(true);
    expect(result.videos[0]?.caption).toContain("Fictional");
    for (const insight of result.insights) for (const id of insight.evidence_video_ids) expect(result.videos.some((v) => v.id === id)).toBe(true);
    const body = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string);
    expect(body.intelligence_provider).toBe("lovable");
    expect(body.ai_provider).toBeUndefined();
    expect(body.model_id).toBeUndefined();
    const saved = await api.getAnalysis(result.analysis_id);
    expect(saved.query).toBe("Nike");
    expect(saved.compare_with).toBe(skill === "competitor_spy" ? "Adidas" : null);
    expect(saved.period_days).toBe(90);
    expect(saved.ai_provider).toBe("lovable_ai");
    expect(saved.kpis).toEqual(result.kpis);
    const history = await api.listAnalyses();
    expect(history[0]?.analysis_id).toBe(result.analysis_id);
    expect(history[0]?.ai_provider).toBe("lovable_ai");
    expect(history[0]?.video_count).toBeNull();
    const capabilities = await api.getCapabilities();
    expect(capabilities.providers.map((p) => p.id)).toEqual(["lovable_ai", "openai_api", "anthropic_api"]);
  });

  it("does not send requests without a signed-in session", async () => {
    const fetcher = vi.fn();
    const api = createHttpFeedintelApi({ baseUrl: "https://backend.example", getToken: async () => null, fetcher });
    await expect(api.listAnalyses()).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("calls without credentials only when the backend allows public access", async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _options?: RequestInit) => new Response(JSON.stringify({ analyses: [], limit: 100, offset: 0 }), { status: 200 }));
    const api = createHttpFeedintelApi({ baseUrl: "https://backend.example", getToken: async () => null, fetcher, allowAnonymous: async () => true });
    await expect(api.listAnalyses()).resolves.toEqual([]);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).has("Authorization")).toBe(false);
  });

  it("preserves actionable backend errors without returning demo data", async () => {
    const api = createHttpFeedintelApi({ baseUrl: "https://backend.example", getToken: async () => token,
      fetcher: vi.fn(async () => new Response(JSON.stringify({ error: { code: "OPENAI_CREDITS_EXHAUSTED", message: "The OpenAI project has no available credits." } }), { status: 503 })) });
    await expect(api.analyze(input)).rejects.toMatchObject({ code: "OPENAI_CREDITS_EXHAUSTED", status: 503, message: "The OpenAI project has no available credits." });
  });

  it("maps configured provider flags without claiming live health", () => {
    const result = toCapabilities({ default_provider: "claude", mode: "live", providers: [
      { id: "claude", configured: false }, { id: "openai", configured: true }, { id: "lovable", configured: false },
    ] });
    expect(result.default_provider).toBe("anthropic_api");
    expect(result.providers[0]?.enabled).toBe(false);
    expect(result.providers[1]?.enabled).toBe(true);
  });

  it("encodes report IDs and supplies session authorization", async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _options?: RequestInit) => new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Analysis not found." } }), { status: 404 }));
    const api = createHttpFeedintelApi({ baseUrl: "https://backend.example/", getToken: async () => token, fetcher });
    await expect(api.getAnalysis("x/y")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://backend.example/analyses/x%2Fy");
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("authorization")).toBe(`Bearer ${token}`);
  });
});
