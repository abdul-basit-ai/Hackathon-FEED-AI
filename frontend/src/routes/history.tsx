import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/fi/PageHeader";
import { EmptyState, ErrorState } from "@/components/fi/States";
import { Skeleton } from "@/components/ui/skeleton";
import { feedintelApi, isDemoMode } from "@/services/feedintelApi";
import { PROVIDER_LABEL, SKILL_LABEL, type Skill } from "@/types/analysis";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [ { title: "Analysis History — Signal Spy" }, { name: "description", content: "Search, filter and reopen past Signal Spy analyses." }, { property: "og:title", content: "Analysis History — Signal Spy" }, { property: "og:description", content: "Search, filter and reopen past Signal Spy analyses." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" } ] }),
  component: HistoryPage,
});

function HistoryPage() {
  const list = useQuery({ queryKey: ["analyses"], queryFn: () => feedintelApi.listAnalyses() });
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState<"all" | Skill>("all");
  const rows = (list.data ?? []).filter(
    (a) => (skill === "all" || a.skill === skill) && `${a.query} ${a.compare_with ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Analysis history" description={isDemoMode ? "Fictional analyses stored for this demo session." : "Your saved analyses, retrieved without running them again."} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input placeholder="Search queries…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={skill} onValueChange={(v) => setSkill(v as typeof skill)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All skills</SelectItem>
            <SelectItem value="competitor_spy">Competitor Spy</SelectItem>
            <SelectItem value="trend_detector">Trend Detector</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {list.isPending ? <Skeleton className="h-64 rounded-xl" /> : list.isError ? (
        <ErrorState message={list.error.message} onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No analyses found" description="Run your first analysis to build up history."
          action={<Button asChild><Link to="/competitor-spy">Start an analysis</Link></Button>} />
      ) : (
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Query</TableHead><TableHead>Skill</TableHead><TableHead>Provider</TableHead>
              <TableHead>Created</TableHead><TableHead className="text-right">Videos</TableHead><TableHead>Status</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.analysis_id}>
                  <TableCell className="font-medium">{a.compare_with ? `${a.query} vs ${a.compare_with}` : a.query}</TableCell>
                  <TableCell>{SKILL_LABEL[a.skill]}</TableCell>
                  <TableCell>{PROVIDER_LABEL[a.ai_provider]}</TableCell>
                  <TableCell>{formatDate(a.generated_at)}</TableCell>
                  <TableCell className="text-right tabular">{a.video_count ?? "—"}</TableCell>
                  <TableCell className="capitalize">{a.status}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline"><Link to="/reports/$analysisId" params={{ analysisId: a.analysis_id }}>View</Link></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
