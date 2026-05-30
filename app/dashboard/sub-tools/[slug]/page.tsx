import { HonestEmptyPage } from "@/components/dashboard/HonestEmptyPage";

export const dynamic = "force-dynamic";

export default function SubToolDetailPage() {
  return (
    <HonestEmptyPage
      kicker="sub-tool"
      title="Sub-tool detail."
      description="Per-tool drill-down (overview, owned routes, assigned agents, connected connectors, automation graph) renders here once the tool registry is wired to your tenant."
      needs={[
        "SubTool rows from the platform tool registry",
        "Per-tool agent + connector assignments",
        "Owned automation graph per tool",
      ]}
    />
  );
}
