export const FEEDINTEL_API_URL = ((import.meta.env["VITE_FEEDINTEL_API_URL"] as string | undefined) ?? "https://neubatybcqqhrcqqssqp.supabase.co/functions/v1/feedintel").replace(/\/$/, "");

let cached: Promise<boolean> | undefined;

/** The backend decides whether visitors may analyze without signing in; asked once per page load. */
export function isPublicAccess(): Promise<boolean> {
  if (typeof window === "undefined" || !FEEDINTEL_API_URL) return Promise.resolve(false);
  cached ??= fetch(`${FEEDINTEL_API_URL}/health`, { signal: AbortSignal.timeout(10000) })
    .then(async (response) => (response.ok ? ((await response.json()) as { access?: string }).access === "public" : false))
    .catch(() => { cached = undefined; return false; });
  return cached;
}
