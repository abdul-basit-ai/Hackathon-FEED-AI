import { AlertTriangle, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function LoadingState({ label = "Analyzing videos…" }: { label?: string }) {
  return (
    <div className="space-y-4" aria-busy="true">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-14 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-destructive/30 bg-card px-6 py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <h3 className="mt-3 font-semibold">Something went wrong</h3>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {onRetry && <Button className="mt-4" variant="outline" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function Limitations({ items }: { items: string[] }) {
  return (
    <div className="rounded-xl border border-warning/40 bg-demo/40 p-4 text-sm">
      <div className="mb-1 font-semibold text-demo-foreground">Limitations</div>
      <ul className="list-disc space-y-0.5 pl-5 text-foreground/80">
        {items.map((l) => <li key={l}>{l}</li>)}
      </ul>
    </div>
  );
}
