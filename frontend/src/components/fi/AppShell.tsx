import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, FileText, History, LayoutDashboard, Menu, Radar, Settings, TrendingUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DemoBadge } from "./DemoBadge";
import { isDemoMode } from "@/services/feedintelApi";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/competitor-spy", label: "Competitor Spy", icon: Radar },
  { to: "/trend-detector", label: "Trend Detector", icon: TrendingUp },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function NavList({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? path === "/" : path.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className={cn("h-4 w-4", active && "text-sidebar-primary")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <BarChart3 className="h-5 w-5" />
      </div>
      <div>
        <div className="font-display text-base font-bold text-sidebar-accent-foreground">Signal Spy</div>
        <div className="text-[11px] text-sidebar-foreground/60">Video intelligence for decisions</div>
      </div>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  return (
    <div className="flex h-full flex-col gap-8 bg-sidebar p-4">
      <Brand />
      <NavList onNavigate={onNavigate} />
      <div className="mt-auto rounded-lg border border-sidebar-border p-3 text-xs text-sidebar-foreground/70">
        <div className="mb-1 flex items-center gap-2 font-semibold text-sidebar-accent-foreground">
          <span className={cn("h-2 w-2 rounded-full", isDemoMode ? "bg-warning" : "bg-success")} />
          {isDemoMode ? "Fictional demo" : "Live workspace"}
        </div>
        {isDemoMode ? "Showing fictional demo data." : "Analysis and history use the Signal Spy service."}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen w-full">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 lg:block">
        <SidebarBody />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 border-none p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur lg:px-8">
          <button
            className="rounded-md p-2 hover:bg-muted lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display font-bold lg:hidden">Signal Spy</span>
          <div className="ml-auto">{isDemoMode && <DemoBadge />}</div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
