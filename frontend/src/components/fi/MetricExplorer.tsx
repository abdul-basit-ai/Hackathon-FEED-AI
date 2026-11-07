import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalysisResult } from "@/types/analysis";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatNumber, formatWeek } from "@/lib/format";
import {
  MAX_SERIES, METRICS, SERIES_COLORS, buildBuckets, buildRows, formatMetric, groupsFor, rangeOptions, rankMetrics,
  type MetricId, type RankedMetric, type Row, type Series,
} from "@/lib/metrics";
import { ChartCard, axis } from "./AnalyticsCharts";

type PlotSeries = Series & { match: Parameters<typeof buildRows>[3][number]["match"] };

function useChartData(a: AnalysisResult, days: number, metrics: (MetricId | null)[]) {
  return useMemo(() => {
    const { buckets, granularity, start, end } = buildBuckets(a.generated_at, days);
    const chosen = metrics.map((m, slot) => (m ? { m, slot } : null)).filter((x): x is { m: MetricId; slot: number } => !!x);
    const multi = chosen.length > 1;
    // Several metrics: one line each, on a shared 0–100 index. One metric: one line per competitor.
    const series: PlotSeries[] = multi
      ? chosen.map(({ m, slot }) => ({ key: m, label: METRICS[m].label, metric: m, color: SERIES_COLORS[slot]!, match: () => true }))
      : groupsFor(a).map((g, i) => ({ key: g.key, label: g.label, metric: chosen[0]!.m, color: SERIES_COLORS[i]!, match: g.match }));
    const rows = buildRows(a.videos, buckets, { start, end }, series, multi);
    const inRange = a.videos.filter((v) => { const t = new Date(v.published_at).getTime(); return t >= start && t <= end; }).length;
    return { rows, series, multi, granularity, inRange };
  }, [a, days, metrics]);
}

function SeriesTooltip({ active, payload, label, series }: { active?: boolean; payload?: { payload: Row }[]; label?: string; series: PlotSeries[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]!.payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-card">
      <div className="mb-1 font-medium">{formatWeek(String(label))}</div>
      {series.map((s) => {
        const missing = Number(row[`${s.key}__missing`] ?? 0);
        return (
          <div key={s.key} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto tabular font-medium">{formatMetric(s.metric, row[`${s.key}__raw`] as number | null)}</span>
            {missing > 0 && <span className="text-muted-foreground">({missing} missing)</span>}
          </div>
        );
      })}
    </div>
  );
}

function MetricLines({ rows, series, indexed, unit }: { rows: Row[]; series: PlotSeries[]; indexed: boolean; unit: "count" | "percent" }) {
  return (
    <ResponsiveContainer>
      <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="bucket" tickFormatter={formatWeek} tick={axis} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={44} domain={indexed ? [0, 100] : [0, "auto"]}
          tickFormatter={(v: number) => (indexed ? String(Math.round(v)) : unit === "percent" ? `${v}%` : formatNumber(v))} />
        <Tooltip content={<SeriesTooltip series={series} />} cursor={{ stroke: "var(--border)" }} />
        {series.length > 1 && <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span className="text-foreground">{value}</span>} />}
        {series.map((s) => (
          <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={rows.length <= 14 ? { r: 4, strokeWidth: 0, fill: s.color } : false}
            activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} type="monotone" />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function DataTable({ rows, series }: { rows: Row[]; series: PlotSeries[] }) {
  return (
    <div className="mt-3 max-h-64 overflow-auto rounded-lg border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted text-left">
          <tr><th className="px-3 py-2 font-medium">Period starting</th>{series.map((s) => <th key={s.key} className="px-3 py-2 text-right font-medium">{s.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.bucket} className="border-t">
              <td className="px-3 py-1.5">{formatWeek(r.bucket)}</td>
              {series.map((s) => <td key={s.key} className="px-3 py-1.5 text-right tabular">{formatMetric(s.metric, r[`${s.key}__raw`] as number | null)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function rangeLabel(days: number) {
  return `Last ${days} days`;
}

export function MetricExplorer({ a, days, onDaysChange }: { a: AnalysisResult; days: number; onDaysChange: (d: number) => void }) {
  const ranked = useMemo(() => rankMetrics(a.skill, a.videos), [a]);
  const [slots, setSlots] = useState<(MetricId | null)[]>(() => [ranked.find((m) => m.available)?.id ?? "posts", null, null]);
  const [showTable, setShowTable] = useState(false);
  const { rows, series, multi, granularity, inRange } = useChartData(a, days, slots);
  const count = slots.filter(Boolean).length;
  const primary = slots.find(Boolean)!;

  // A metric keeps its colour slot until deselected, so changing the selection never repaints the others.
  const toggle = (id: MetricId) => setSlots((cur) => {
    const at = cur.indexOf(id);
    const next = [...cur];
    if (at >= 0) { if (count > 1) next[at] = null; return next; }
    const free = cur.indexOf(null);
    if (free >= 0) next[free] = id;
    return next;
  });

  const subtitle = multi
    ? "Each line is indexed to its own peak (= 100) so different scales compare; hover for actual values."
    : `${METRICS[primary].description}. ${a.skill === "competitor_spy" ? "One line per competitor." : ""}`;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Metric explorer</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="w-40 print:hidden">
          <Select value={String(days)} onValueChange={(v) => onDaysChange(Number(v))}>
            <SelectTrigger aria-label="Time range"><SelectValue /></SelectTrigger>
            <SelectContent>{rangeOptions(a.period_days).map((d) => <SelectItem key={d} value={String(d)}>{rangeLabel(d)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 print:hidden" role="group" aria-label="Metrics, most relevant first">
        {ranked.map((m) => {
          const slot = slots.indexOf(m.id);
          const on = slot >= 0;
          const full = !on && count >= MAX_SERIES;
          return (
            <button key={m.id} type="button" aria-pressed={on} disabled={!m.available || full} onClick={() => toggle(m.id)}
              title={!m.available ? "Not available from source" : full ? `Compare up to ${MAX_SERIES} metrics at once` : m.coverage < 1 ? `Reported for ${Math.round(m.coverage * 100)}% of videos` : undefined}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                on ? "border-primary bg-primary/10 font-medium text-foreground" : "bg-background text-muted-foreground hover:text-foreground")}>
              {on && multi && <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[slot] }} />}
              {m.label}
              {m.available && m.coverage < 1 && <span className="opacity-70">· {Math.round(m.coverage * 100)}%</span>}
              {!m.available && <span>· n/a</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-4 h-64">
        {inRange === 0
          ? <p className="grid h-full place-items-center text-sm text-muted-foreground">No sampled videos were published in this range.</p>
          : <MetricLines rows={rows} series={series} indexed={multi} unit={METRICS[primary].unit} />}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{granularity === "day" ? "Daily" : "Weekly (Monday start)"} · {inRange} videos by publication date · snapshot totals, not growth over time</span>
        <button type="button" className="underline-offset-2 hover:underline print:hidden" onClick={() => setShowTable((s) => !s)}>
          {showTable ? "Hide data table" : "Show data table"}
        </button>
      </div>
      {showTable && <DataTable rows={rows} series={series} />}
    </div>
  );
}

function SingleMetricChart({ a, days, metric }: { a: AnalysisResult; days: number; metric: RankedMetric }) {
  const slots = useMemo(() => [metric.id, null, null] as (MetricId | null)[], [metric.id]);
  const { rows, series } = useChartData(a, days, slots);
  const coverage = metric.coverage < 1 ? ` · reported for ${Math.round(metric.coverage * 100)}% of videos` : "";
  return (
    <ChartCard title={metric.label} subtitle={`${metric.description}${coverage}`}>
      <MetricLines rows={rows} series={series} indexed={false} unit={metric.unit} />
    </ChartCard>
  );
}

/** Every available metric as its own chart, most relevant first; unavailable ones are named, not plotted. */
export function MetricCharts({ a, days }: { a: AnalysisResult; days: number }) {
  const ranked = useMemo(() => rankMetrics(a.skill, a.videos), [a]);
  const missing = ranked.filter((m) => !m.available);
  return (
    <div className="space-y-2">
      <div className="grid gap-4 lg:grid-cols-2 print:block print:space-y-4">
        {ranked.filter((m) => m.available).map((m) => <SingleMetricChart key={m.id} a={a} days={days} metric={m} />)}
      </div>
      {missing.length > 0 && (
        <p className="text-xs text-muted-foreground">Not available from source: {missing.map((m) => m.label).join(", ")}.</p>
      )}
    </div>
  );
}
