import type { LucideIcon } from "lucide-react";
import { formatNumber } from "@/lib/format";

export function KPICard({ label, value, icon: Icon }: { label: string; value: number | null; icon: LucideIcon }) {
  const missing = value === null;
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        {label}
        <Icon className="h-4 w-4" />
      </div>
      <div className={missing ? "mt-2 text-2xl font-semibold text-muted-foreground/60 tabular" : "mt-2 text-2xl font-semibold tabular"}>
        {formatNumber(value)}
      </div>
      {missing && <div className="mt-1 text-[11px] text-muted-foreground">Not available from source</div>}
    </div>
  );
}
