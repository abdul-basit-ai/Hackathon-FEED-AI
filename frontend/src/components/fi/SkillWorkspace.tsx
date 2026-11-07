import { useMutation, useQueryClient } from "@tanstack/react-query";
import { feedintelApi } from "@/services/feedintelApi";
import type { Skill } from "@/types/analysis";
import { SkillForm } from "./SkillForm";
import { AnalysisResultView } from "./AnalysisResultView";
import { EmptyState, ErrorState, LoadingState } from "./States";

export function SkillWorkspace({ skill }: { skill: Skill }) {
  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: feedintelApi.analyze,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analyses"] }),
  });
  return (
    <div className="space-y-6">
      <SkillForm skill={skill} busy={run.isPending} onSubmit={(i) => run.mutate(i)} />
      {run.isPending ? (
        <LoadingState />
      ) : run.isError ? (
        <ErrorState message={(run.error as Error).message} onRetry={() => run.variables && run.mutate(run.variables)} />
      ) : run.data ? (
        <AnalysisResultView a={run.data} />
      ) : (
        <EmptyState title="No analysis yet" description="Fill in the form above and run the analysis to see KPIs, charts, insights and evidence." />
      )}
    </div>
  );
}
