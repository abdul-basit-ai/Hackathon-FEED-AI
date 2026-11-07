import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Charts } from "@/types/analysis";
import { formatNumber, formatWeek } from "@/lib/format";
import type { ReactNode } from "react";

export function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-4 h-60">{children}</div>
    </div>
  );
}

export const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const tip = { contentStyle: { borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 } };

export function PostsByWeekChart({ data }: { data: Charts["posts_by_week"] }) {
  return (
    <ChartCard title="Videos published per week" subtitle="Publication volume in the sample — not engagement growth">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" tickFormatter={formatWeek} tick={axis} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} width={28} />
          <Tooltip {...tip} labelFormatter={(l) => `Week of ${formatWeek(String(l))}`} />
          <Bar dataKey="count" name="Videos" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ThemeChart({ data }: { data: Charts["theme_distribution"] }) {
  return (
    <ChartCard title="Theme frequency" subtitle="Videos per recurring theme">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" tick={axis} tickLine={false} axisLine={false} width={110} />
          <Tooltip {...tip} />
          <Bar dataKey="count" name="Videos" fill="var(--chart-2)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ViewsByBrandChart({ data }: { data: NonNullable<Charts["views_by_brand"]> }) {
  return (
    <ChartCard title="Views by competitor" subtitle="Sum of views across sampled videos; missing totals are unavailable">
      {data.every((item) => item.views === null) ? <p className="grid h-full place-items-center text-sm text-muted-foreground">Views are unavailable for this sample.</p> :
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v) => formatNumber(v)} tick={axis} tickLine={false} axisLine={false} width={44} />
          <Tooltip {...tip} formatter={(v: number) => formatNumber(v)} />
          <Bar dataKey="views" name="Views" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>}
    </ChartCard>
  );
}
