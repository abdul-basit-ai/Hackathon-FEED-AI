import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { feedintelApi, isDemoMode } from "@/services/feedintelApi";
import { getProviderPreference } from "@/services/providerPreference";
import { PERIOD_OPTIONS, PROVIDER_LABEL, type AiProvider, type AnalysisInput, type PeriodDays, type Skill } from "@/types/analysis";

export function SkillForm({ skill, busy, onSubmit }: { skill: Skill; busy: boolean; onSubmit: (input: AnalysisInput) => void }) {
  const isSpy = skill === "competitor_spy";
  const [query, setQuery] = useState(isSpy ? "Nike" : "Protein coffee");
  const [compare, setCompare] = useState(isSpy ? "Adidas" : "");
  const [period, setPeriod] = useState<PeriodDays>(isSpy ? 90 : 30);
  const [provider, setProvider] = useState<AiProvider | "">("");
  const [error, setError] = useState<string | null>(null);
  const caps = useQuery({ queryKey: ["capabilities"], queryFn: () => feedintelApi.getCapabilities() });
  useEffect(() => {
    if (!caps.data) return;
    const enabled = caps.data.providers.filter((p) => p.enabled);
    const preferred = getProviderPreference() ?? caps.data.default_provider;
    setProvider((current) => enabled.some((p) => p.id === current) ? current : enabled.find((p) => p.id === preferred)?.id ?? enabled[0]?.id ?? "");
  }, [caps.data]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim(), c = compare.trim();
    if (!q) return setError(isSpy ? "Enter Brand A." : "Enter a topic or keyword.");
    if (isSpy && !c) return setError("Enter Brand B.");
    if (isSpy && q.toLowerCase() === c.toLowerCase()) return setError("Brands must be different.");
    if (!provider || !caps.data?.providers.some((p) => p.id === provider && p.enabled)) return setError("Choose a configured intelligence provider.");
    setError(null);
    onSubmit({ skill, query: q, compare_with: isSpy ? c : null, period_days: period, ai_provider: provider, max_videos: 40 });
  }

  return (
    <form onSubmit={submit} className="rounded-xl border bg-card p-5 shadow-card">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="q">{isSpy ? "Brand A" : "Topic or keyword"}</Label>
          <Input id="q" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} />
        </div>
        {isSpy && (
          <div className="space-y-1.5">
            <Label htmlFor="c">Brand B</Label>
            <Input id="c" value={compare} onChange={(e) => setCompare(e.target.value)} maxLength={80} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Period</Label>
          <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v) as PeriodDays)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((p) => <SelectItem key={p} value={String(p)}>Last {p} days</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>AI provider</Label>
          <Select value={provider} onValueChange={(v) => setProvider(v as AiProvider)} disabled={caps.isPending || busy}>
            <SelectTrigger><SelectValue placeholder="Choose intelligence" /></SelectTrigger>
            <SelectContent>
              {(caps.data?.providers ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id} disabled={!p.enabled}>
                  {PROVIDER_LABEL[p.id]} {caps.data?.mode === "demo" ? "(fictional demo)" : !p.enabled ? "(unavailable)" : !p.connected ? "(not configured)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {caps.isError && <p role="alert" className="mt-3 text-sm text-destructive">{caps.error.message} <button type="button" className="underline" onClick={() => caps.refetch()}>Retry</button></p>}
      {caps.data && !caps.data.providers.some((p) => p.enabled) && <p role="alert" className="mt-3 text-sm text-destructive">No intelligence provider is configured. Ask the workspace owner to connect one.</p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {isDemoMode || caps.data?.mode === "demo" ? "Demo mode: results are fictional sample data." : "Runs against the Signal Spy backend."}
        </p>
        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-destructive">{error}</span>}
          <Button type="submit" disabled={busy || caps.isPending || caps.isError || !provider}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSpy ? "Analyze competitors" : "Detect trends"}
          </Button>
        </div>
      </div>
    </form>
  );
}
