import { ExternalLink } from "lucide-react";
import type { VideoEvidence } from "@/types/analysis";
import { formatDate, formatNumber } from "@/lib/format";

export function EvidenceVideoCard({ video }: { video: VideoEvidence }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border bg-card p-4 shadow-card transition-colors hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">@{video.creator}</div>
          <div className="text-xs capitalize text-muted-foreground">
            {video.platform} · {formatDate(video.published_at)}
            {video.brand ? ` · ${video.brand}` : ""}
          </div>
        </div>
        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
      </div>
      {video.caption && <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{video.caption}</p>}
      <div className="mt-3 flex gap-4 text-xs text-muted-foreground tabular">
        <span>{formatNumber(video.views)} views</span>
        <span>{formatNumber(video.likes)} likes</span>
        <span>{formatNumber(video.comments)} comments</span>
      </div>
    </a>
  );
}
