import { Eye, Heart, MessageCircle, Share2, Video } from "lucide-react";
import type { Kpis } from "@/types/analysis";
import { KPICard } from "./KPICard";

export function KPIGrid({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <KPICard label="Videos" value={kpis.videos} icon={Video} />
      <KPICard label="Total views" value={kpis.views} icon={Eye} />
      <KPICard label="Likes" value={kpis.likes} icon={Heart} />
      <KPICard label="Comments" value={kpis.comments} icon={MessageCircle} />
      <KPICard label="Shares" value={kpis.shares} icon={Share2} />
    </div>
  );
}
