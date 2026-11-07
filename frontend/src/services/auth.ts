import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

// Created only in the browser: SSR requests never share a user's session.
export function getAuthClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (client) return client;
  const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
  if (!url || !key) return null;
  if (key.startsWith("sb_secret_")) throw new Error("A server secret cannot be used as a frontend key.");
  // Legacy anon keys are supported, but reject legacy service-role keys.
  if (key.includes(".")) {
    try {
      const part = key.split(".")[1] ?? "";
      const claims = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as { role?: string };
      if (claims.role === "service_role") throw new Error("Server credentials are not allowed in the frontend.");
    } catch { throw new Error("Use a valid public Supabase client key."); }
  }
  client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  return client;
}

export async function getAccessToken(): Promise<string | null> {
  const auth = getAuthClient();
  if (!auth) return null;
  const { data, error } = await auth.auth.getSession();
  if (error) throw new Error("Your session could not be refreshed. Please sign in again.");
  return data.session?.access_token ?? null;
}
