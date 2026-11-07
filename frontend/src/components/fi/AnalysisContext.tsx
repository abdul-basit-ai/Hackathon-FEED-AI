import type { AnalysisResult } from "@/types/analysis";
import { PROVIDER_LABEL, SKILL_LABEL } from "@/types/analysis";
import { formatDate } from "@/lib/format";
import { DemoBadge } from "./DemoBadge";

/** Always-visible context strip: analysis name, skill, period, dataset size, status. */
export function AnalysisContext({ a }: { a: AnalysisResult }) {
  const items = [
    ["Analysis", a.compare_with ? `${a.query} vs ${a.compare_with}` : a.query],
    ["Skill", SKILL_LABEL[a.skill]],
    ["Period", `Last ${a.period_days} days`],
    ["Dataset", `${a.kpis.videos} videos`],
    ["Provider", PROVIDER_LABEL[a.ai_provider]],
    ["Generated", formatDate(a.generated_at)],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card px-5 py-3 text-sm shadow-card">
      {items.map(([k, v]) => (
        <div key={k}>
          <span className="text-xs text-muted-foreground">{k} </span>
          <span className="font-medium">{v}</span>
        </div>
      ))}
      {a.is_demo && <DemoBadge className="ml-auto" />}
    </div>
  );
}
