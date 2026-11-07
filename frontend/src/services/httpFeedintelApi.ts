import type { FeedIntelApi } from "@/types/analysis";
import { getAccessToken } from "./auth";
import { FEEDINTEL_API_URL, isPublicAccess } from "./access";
import { FeedIntelError, toAnalysisResult, toBackendInput, toCapabilities, toHistory } from "./backendContract";

export { FEEDINTEL_API_URL };

export function createHttpFeedintelApi({ baseUrl, getToken, fetcher = fetch, allowAnonymous = async () => false }: {
  baseUrl: string; getToken: () => Promise<string | null>; fetcher?: typeof fetch; allowAnonymous?: () => Promise<boolean>;
}): FeedIntelApi {
  async function request(path: string, init?: RequestInit): Promise<unknown> {
    if (!baseUrl) throw new FeedIntelError("NOT_CONFIGURED", "The analysis service has not been configured.");
    const token = await getToken();
    if (!token && !(await allowAnonymous())) throw new FeedIntelError("UNAUTHORIZED", "Please sign in to analyze videos and open saved reports.", 401);
    let response: Response;
    try {
      response = await fetcher(`${baseUrl.replace(/\/$/, "")}${path}`, {
        ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: AbortSignal.timeout(150000),
      });
    } catch { throw new FeedIntelError("NETWORK_ERROR", "Unable to reach Signal Spy. Check your connection and try again."); }
    let data: unknown;
    try { data = await response.json(); }
    catch { throw new FeedIntelError("INVALID_RESPONSE", "The service returned an unreadable response.", response.status); }
    if (!response.ok) {
      const error = data as { error?: { code?: string; message?: string } } | null;
      throw new FeedIntelError(error?.error?.code ?? "REQUEST_FAILED", error?.error?.message ?? `Request failed (${response.status}).`, response.status);
    }
    return data;
  }
  return {
    mode: "http",
    async analyze(input) { return toAnalysisResult(await request("/analyze", { method: "POST", body: JSON.stringify(toBackendInput(input)) }), input); },
    async getAnalysis(id) { return toAnalysisResult(await request(`/analyses/${encodeURIComponent(id)}`)); },
    async listAnalyses() { return toHistory(await request("/analyses?limit=100&offset=0")); },
    async getCapabilities() { return toCapabilities(await request("/intelligence-options")); },
  };
}

export const httpFeedintelApi = createHttpFeedintelApi({ baseUrl: FEEDINTEL_API_URL, getToken: getAccessToken, allowAnonymous: isPublicAccess });
