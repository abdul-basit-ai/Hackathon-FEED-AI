import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/fi/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { feedintelApi } from "@/services/feedintelApi";
import { formatDate } from "@/lib/format";
import { SKILL_LABEL } from "@/types/analysis";
import { EmptyState, ErrorState } from "@/components/fi/States";

export const Route = createFileRoute("/reports/")({
  head: () => ({ meta: [ { title: "Reports — FeedIntel" }, { name: "description", content: "Printable, evidence-backed reports for every completed analysis." }, { property: "og:title", content: "Reports — FeedIntel" }, { property: "og:description", content: "Printable, evidence-backed reports for every completed analysis." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" } ] }),
  component: ReportsIndex,
});

function ReportsIndex() {
  const list = useQuery({ queryKey: ["analyses"], queryFn: () => feedintelApi.listAnalyses() });
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Reports" description="Open a report to preview it and download it as a PDF." />
      {list.isPending ? <Skeleton className="h-40 rounded-xl" /> : list.isError ? <ErrorState message={list.error.message} onRetry={() => list.refetch()} /> : list.data.length === 0 ? <EmptyState title="No reports yet" description="Run an analysis to create your first report." /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(list.data ?? []).filter((a) => a.status === "completed").map((a) => (
            <Link key={a.analysis_id} to="/reports/$analysisId" params={{ analysisId: a.analysis_id }}
              className="rounded-xl border bg-card p-5 shadow-card transition-colors hover:border-primary/50">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold">{a.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{SKILL_LABEL[a.skill]} · {formatDate(a.generated_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
