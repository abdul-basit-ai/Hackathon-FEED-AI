import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-warning/50 bg-demo px-2.5 py-1 text-xs font-semibold text-demo-foreground",
        className,
      )}
      title="All numbers and conclusions are fictional sample data until the backend is connected."
    >
      <FlaskConical className="h-3.5 w-3.5" /> Demo data
    </span>
  );
}
