import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import type { AnalysisResult } from "@/types/analysis";
import { Button } from "@/components/ui/button";
import { AnalysisContext } from "./AnalysisContext";
import { KPIGrid } from "./KPIGrid";
import { PostsByWeekChart, ThemeChart, ViewsByBrandChart } from "./AnalyticsCharts";
import { InsightCard } from "./InsightCard";
import { EvidenceVideoCard } from "./EvidenceVideoCard";
import { Limitations } from "./States";

export function AnalysisResultView({ a }: { a: AnalysisResult }) {
  return (
    <div className="space-y-6">
      <AnalysisContext a={a} />
      <div className="rounded-xl border bg-card p-5 shadow-card">
        <h2 className="text-lg font-semibold">Summary</h2>
        <p className="mt-1 text-sm text-foreground/80">{a.report.executive_summary}</p>
      </div>
      <KPIGrid kpis={a.kpis} />
      <div className="grid gap-4 lg:grid-cols-2">
        {a.charts.views_by_brand?.length ? <ViewsByBrandChart data={a.charts.views_by_brand} /> : null}
        <PostsByWeekChart data={a.charts.posts_by_week} />
        <ThemeChart data={a.charts.theme_distribution} />
      </div>
      <section>
        <h2 className="mb-3 text-lg font-semibold">AI insights</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {a.insights.map((i) => <InsightCard key={i.id} insight={i} videos={a.videos} />)}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Top videos</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...a.videos].sort((x, y) => (y.views ?? -1) - (x.views ?? -1)).map((v) => <EvidenceVideoCard key={v.id} video={v} />)}
        </div>
      </section>
      <Limitations items={a.limitations} />
      <div className="flex justify-end">
        <Button asChild>
          <Link to="/reports/$analysisId" params={{ analysisId: a.analysis_id }}>
            <FileText className="h-4 w-4" /> Generate report
          </Link>
        </Button>
      </div>
    </div>
  );
}
