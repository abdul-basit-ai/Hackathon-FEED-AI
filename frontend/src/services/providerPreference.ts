import type { AiProvider } from "@/types/analysis";

export function getProviderPreference(): AiProvider | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem("feedintel.provider");
    return value === "openai_api" || value === "lovable_ai" || value === "anthropic_api" ? value : null;
  } catch { return null; }
}

export function saveProviderPreference(value: AiProvider) {
  try { localStorage.setItem("feedintel.provider", value); }
  catch { throw new Error("Your browser could not save this preference."); }
}
