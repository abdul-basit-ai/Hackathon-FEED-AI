import type { AnalysisResult } from "@/types/analysis";
import { PROVIDER_LABEL, SKILL_LABEL } from "@/types/analysis";
import { formatDate, formatNumber } from "@/lib/format";
import { ThemeChart, ViewsByBrandChart } from "./AnalyticsCharts";
import { MetricCharts } from "./MetricExplorer";

/** A4-style report rendered from the same AnalysisResult as the dashboard. */
export function ReportPreview({ a }: { a: AnalysisResult }) {
  const kpiRows: [string, number | null][] = [
    ["Videos", a.kpis.videos], ["Views", a.kpis.views], ["Likes", a.kpis.likes],
    ["Comments", a.kpis.comments], ["Shares", a.kpis.shares],
  ];
  return (
    <article className="mx-auto max-w-[210mm] space-y-8 rounded-xl border bg-card p-8 shadow-card md:p-12 print:border-none print:shadow-none">
      <header className="border-b pb-6">
        {a.is_demo && <div className="mb-3 text-xs font-bold uppercase tracking-widest text-demo-foreground">Demo data — fictional sample</div>}
        <h1 className="text-3xl font-bold">{a.report.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {SKILL_LABEL[a.skill]} · Generated {formatDate(a.generated_at)} · {PROVIDER_LABEL[a.ai_provider]}
        </p>
      </header>
      <section>
        <h2 className="text-lg font-semibold">Search criteria</h2>
        <p className="mt-1 text-sm">Query: <b>{a.query}</b>{a.compare_with && <> · Compared with: <b>{a.compare_with}</b></>} · Last {a.period_days} days · {a.kpis.videos} videos</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Executive summary</h2>
        <p className="mt-1 text-sm leading-relaxed">{a.report.executive_summary}</p>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Key metrics</h2>
        <table className="w-full text-sm">
          <tbody>
            {kpiRows.map(([k, v]) => (
              <tr key={k} className="border-b last:border-none">
                <td className="py-2 text-muted-foreground">{k}</td>
                <td className="py-2 text-right tabular">{v === null ? "Not available" : formatNumber(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="grid gap-4 print:block">
        {a.charts.views_by_brand?.length ? <ViewsByBrandChart data={a.charts.views_by_brand} /> : null}
        <ThemeChart data={a.charts.theme_distribution} />
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Metrics by publication date</h2>
        <MetricCharts a={a} days={a.period_days} />
      </section>
      <section>
        <h2 className="text-lg font-semibold">Findings</h2>
        <ol className="mt-2 space-y-3 text-sm">
          {a.insights.map((i, n) => (
            <li key={i.id}>
              <b>{n + 1}. {i.title}</b> — {i.explanation}
              <span className="text-muted-foreground"> (evidence: {i.evidence_video_ids.filter((id) => a.videos.some((v) => v.id === id)).join(", ")})</span>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Recommendations</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{a.report.recommendations.map((r) => <li key={r}>{r}</li>)}</ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Sources</h2>
        <ul className="mt-2 space-y-1 text-xs">
          {a.videos.map((v) => (
            <li key={v.id}><span className="text-muted-foreground">{v.id} · @{v.creator} · {v.platform} · {formatDate(v.published_at)} — </span>
              <a href={v.url} className="text-primary underline break-all">{v.url}</a></li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Methodology & limitations</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{a.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
      </section>
    </article>
  );
}
