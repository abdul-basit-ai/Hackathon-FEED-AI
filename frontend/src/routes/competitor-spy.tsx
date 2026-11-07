import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/fi/PageHeader";
import { SkillWorkspace } from "@/components/fi/SkillWorkspace";

export const Route = createFileRoute("/competitor-spy")({
  head: () => ({ meta: [ { title: "Competitor Spy — Signal Spy" }, { name: "description", content: "Compare two brands' social video themes and observed performance, backed by original video evidence." }, { property: "og:title", content: "Competitor Spy — Signal Spy" }, { property: "og:description", content: "Compare two brands' social video themes and observed performance, backed by original video evidence." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" } ] }),
  component: () => (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Skill" title="Competitor Spy" description="Compare two brands' social video themes and observed performance." />
      <SkillWorkspace skill="competitor_spy" />
    </div>
  ),
});
