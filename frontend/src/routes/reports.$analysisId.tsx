import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportPreview } from "@/components/fi/ReportPreview";
import { ErrorState, LoadingState } from "@/components/fi/States";
import { feedintelApi } from "@/services/feedintelApi";

export const Route = createFileRoute("/reports/$analysisId")({
  head: () => ({ meta: [ { title: "Report — Signal Spy" }, { name: "description", content: "Evidence-backed social video intelligence report with sources and limitations." }, { property: "og:title", content: "Report — Signal Spy" }, { property: "og:description", content: "Evidence-backed social video intelligence report with sources and limitations." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" } ] }),
  component: ReportPage,
});

function ReportPage() {
  const { analysisId } = Route.useParams();
  const q = useQuery({ queryKey: ["analysis", analysisId], queryFn: () => feedintelApi.getAnalysis(analysisId) });
  const back = q.data?.skill === "trend_detector" ? "/trend-detector" : "/competitor-spy";
  return (
    <div className="mx-auto max-w-5xl">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost"><Link to={back}><ArrowLeft className="h-4 w-4" /> Back to analysis</Link></Button>
        <div className="flex flex-wrap items-center gap-2">
          {["Word", "Excel", "PowerPoint"].map((f) => (
            <span key={f} className="rounded-md border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground">{f} · Planned</span>
          ))}
          <Button onClick={() => window.print()} disabled={!q.data}><Download className="h-4 w-4" /> Download PDF</Button>
        </div>
      </div>
      {q.isPending ? <LoadingState label="Loading report…" /> : q.isError ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : <ReportPreview a={q.data} />}
    </div>
  );
}
