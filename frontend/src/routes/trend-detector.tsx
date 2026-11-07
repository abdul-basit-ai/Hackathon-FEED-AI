import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/fi/PageHeader";
import { SkillWorkspace } from "@/components/fi/SkillWorkspace";

export const Route = createFileRoute("/trend-detector")({
  head: () => ({ meta: [ { title: "Trend Detector — Signal Spy" }, { name: "description", content: "Analyze a topic's recurring themes, publishing patterns and engagement across social video." }, { property: "og:title", content: "Trend Detector — Signal Spy" }, { property: "og:description", content: "Analyze a topic's recurring themes, publishing patterns and engagement across social video." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" } ] }),
  component: () => (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Skill" title="Trend Detector" description="Analyze a topic's recurring themes, publishing patterns and engagement." />
      <SkillWorkspace skill="trend_detector" />
    </div>
  ),
});
