import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PageHeader } from "@/components/fi/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { feedintelApi } from "@/services/feedintelApi";
import { getProviderPreference, saveProviderPreference } from "@/services/providerPreference";
import { ErrorState } from "@/components/fi/States";
import { PROVIDER_LABEL, type AiProvider, type ProviderCapability } from "@/types/analysis";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [ { title: "Settings & AI Integrations — Signal Spy" }, { name: "description", content: "Choose the AI analysis provider and learn how Lovable connectors and MCP differ." }, { property: "og:title", content: "Settings & AI Integrations — Signal Spy" }, { property: "og:description", content: "Choose the AI analysis provider and learn how Lovable connectors and MCP differ." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" } ] }),
  component: SettingsPage,
});

const DESC: Record<AiProvider, string> = {
  openai_api: "Default for the MVP. The key lives on the backend only — never in the browser.",
  lovable_ai: "Managed models through Lovable, available once a secure server-side adapter exists.",
  anthropic_api: "Use the configured Anthropic API project for evidence-backed Claude analysis.",
};

function StatusBadge({ p }: { p: ProviderCapability }) {
  const label = p.connected ? "Configured" : p.enabled ? "Fictional demo only" : "Not configured";
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold",
      p.connected ? "bg-success/15 text-success" : p.enabled ? "bg-demo text-demo-foreground" : "bg-muted text-muted-foreground")}>
      {label}
    </span>
  );
}

const MCP_URL = "https://mcp.lovable.dev";

function SettingsPage() {
  const caps = useQuery({ queryKey: ["capabilities"], queryFn: () => feedintelApi.getCapabilities() });
  const [selected, setSelected] = useState<AiProvider>("openai_api");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!caps.data) return;
    const preferred = getProviderPreference() ?? caps.data.default_provider;
    setSelected(caps.data.providers.find((p) => p.enabled && p.id === preferred)?.id ?? caps.data.providers.find((p) => p.enabled)?.id ?? "openai_api");
  }, [caps.data]);
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <PageHeader title="Settings & AI integrations" description="Configuration comes from the backend. Configured providers still require available credits and model access." />

      <section>
        <h2 className="text-lg font-semibold">AI analysis provider</h2>
        <p className="mb-4 text-sm text-muted-foreground">The model the running Signal Spy app uses to analyze videos.</p>
        {caps.isPending ? <Skeleton className="h-48 rounded-xl" /> : caps.isError ? <ErrorState message={caps.error.message} onRetry={() => caps.refetch()} /> : (
          <RadioGroup value={selected} onValueChange={(v) => setSelected(v as AiProvider)} className="gap-3">
            {(caps.data?.providers ?? []).map((p) => (
              <label key={p.id} className={cn("flex cursor-pointer gap-4 rounded-xl border bg-card p-5 shadow-card",
                selected === p.id && "border-primary ring-1 ring-primary", !p.enabled && "opacity-70")}>
                <RadioGroupItem value={p.id} disabled={!p.enabled} className="mt-1" />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{PROVIDER_LABEL[p.id]}</span><StatusBadge p={p} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{DESC[p.id]}</p>
                  {p.id === "openai_api" && !p.connected && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><KeyRound className="h-3.5 w-3.5" /> Owner setup: add the OpenAI key to the backend's secret store.</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" disabled={caps.isFetching} onClick={() => caps.refetch()}>Refresh configuration</Button>
                  </div>
                </div>
              </label>
            ))}
          </RadioGroup>
        )}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Only your provider preference is saved — never an API key.</p>
          <Button disabled={!caps.data?.providers.some((p) => p.id === selected && p.enabled)} onClick={() => {
            try { saveProviderPreference(selected); toast.success(`Default provider saved: ${PROVIDER_LABEL[selected]}.`); }
            catch { toast.error("Unable to save your preference in this browser."); }
          }}>Save preference</Button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6 shadow-card">
        <h2 className="text-lg font-semibold">Developer connectors / MCP</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The Lovable MCP endpoint connects ChatGPT, Claude or Claude Code to Lovable for <b>building and editing this project</b>.
          It is <b>not</b> an AI endpoint for analyzing Signal Spy videos.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <code className="rounded-md bg-muted px-3 py-2 text-sm tabular">{MCP_URL}</code>
          <Button variant="outline" size="sm" onClick={async () => { await navigator.clipboard.writeText(MCP_URL); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy MCP URL
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href="https://docs.lovable.dev/integrations/lovable-mcp-server" target="_blank" rel="noopener noreferrer">Open Lovable connector instructions <ExternalLink className="h-4 w-4" /></a>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Custom API connectors are configured with their real URL and auth in Lovable's connector settings — pasting a URL here does not activate any AI provider.
          See <a className="underline" href="https://docs.lovable.dev/features/ai" target="_blank" rel="noopener noreferrer">Lovable AI</a> and{" "}
          <a className="underline" href="https://docs.lovable.dev/integrations/create-connector" target="_blank" rel="noopener noreferrer">custom connectors</a>.
        </p>
      </section>
    </div>
  );
}
