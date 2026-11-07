import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, FileText, Radar, Search, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { feedintelApi } from "@/services/feedintelApi";
import { SKILL_LABEL } from "@/types/analysis";
import { formatDate } from "@/lib/format";
import { DemoBadge } from "@/components/fi/DemoBadge";
import { EmptyState, ErrorState } from "@/components/fi/States";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [ { title: "Signal Spy — Overview" }, { name: "description", content: "Your recent social video analyses and quick access to Competitor Spy and Trend Detector." }, { property: "og:title", content: "Signal Spy — Overview" }, { property: "og:description", content: "Your recent social video analyses and quick access to Competitor Spy and Trend Detector." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" } ] }),
  component: Overview,
});

const STEPS = [
  { icon: Search, title: "Search", text: "Retrieve social videos for a brand or topic." },
  { icon: Sparkles, title: "Analyze", text: "AI groups themes and summarizes performance." },
  { icon: CheckCircle2, title: "Verify", text: "Every insight links to original videos." },
  { icon: FileText, title: "Report", text: "Export a clean, sourced PDF." },
];

function Overview() {
  const list = useQuery({ queryKey: ["analyses"], queryFn: () => feedintelApi.listAnalyses() });
  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <section className="bg-hero overflow-hidden rounded-2xl p-8 text-primary-foreground md:p-12">
        <div className="text-xs font-semibold uppercase tracking-widest opacity-75">Signal Spy</div>
        <h1 className="mt-2 max-w-2xl text-3xl font-bold md:text-5xl">Video intelligence for decisions</h1>
        <p className="mt-3 max-w-xl text-sm opacity-80 md:text-base">
          Compare competitors and detect trends across social video — with evidence you can click through.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg" variant="secondary">
            <Link to="/competitor-spy"><Radar className="h-4 w-4" /> Spy on competitors</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/trend-detector"><TrendingUp className="h-4 w-4" /> Detect a trend</Link>
          </Button>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent analyses</h2>
          <Link to="/history" className="text-sm font-medium text-primary hover:underline">View all</Link>
        </div>
        {list.isPending ? (
          <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div>
        ) : list.isError ? (
          <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
        ) : list.data.length === 0 ? (
          <EmptyState title="No analyses yet" description="Run your first analysis to see it here." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {list.data.slice(0, 4).map((a) => (
              <div key={a.analysis_id} className="rounded-xl border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">{SKILL_LABEL[a.skill]}</span>
                  {a.is_demo && <DemoBadge />}
                </div>
                <h3 className="mt-3 text-lg font-semibold">{a.compare_with ? `${a.query} vs ${a.compare_with}` : a.query}</h3>
                <div className="mt-1 text-sm text-muted-foreground">
                  {formatDate(a.generated_at)}{a.video_count !== null && <> · {a.video_count} videos</>} · <span className="capitalize">{a.status}</span>
                </div>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link to="/reports/$analysisId" params={{ analysisId: a.analysis_id }}>Open analysis <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex items-center gap-2 text-primary"><s.icon className="h-5 w-5" /><span className="text-xs font-semibold tabular">0{i + 1}</span></div>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
