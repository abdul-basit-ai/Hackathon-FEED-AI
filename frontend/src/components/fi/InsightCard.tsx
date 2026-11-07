import { Lightbulb } from "lucide-react";
import { useState } from "react";
import type { Insight, VideoEvidence } from "@/types/analysis";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { EvidenceVideoCard } from "./EvidenceVideoCard";

export function InsightCard({ insight, videos }: { insight: Insight; videos: VideoEvidence[] }) {
  const [open, setOpen] = useState(false);
  // Only count evidence IDs that resolve to real videos.
  const evidence = insight.evidence_video_ids
    .map((id) => videos.find((v) => v.id === id))
    .filter((v): v is VideoEvidence => Boolean(v));
  return (
    <div className="flex flex-col rounded-xl border bg-card p-5 shadow-card">
      <div className="mb-2 grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground">
        <Lightbulb className="h-4 w-4" />
      </div>
      <h3 className="font-semibold">{insight.title}</h3>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{insight.explanation}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{evidence.length} supporting video{evidence.length === 1 ? "" : "s"}</span>
        <Button size="sm" variant="outline" disabled={!evidence.length} onClick={() => setOpen(true)}>
          View supporting videos
        </Button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{insight.title}</SheetTitle>
            <SheetDescription>Original videos supporting this insight.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-3 px-4 pb-4">
            {evidence.map((v) => <EvidenceVideoCard key={v.id} video={v} />)}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
