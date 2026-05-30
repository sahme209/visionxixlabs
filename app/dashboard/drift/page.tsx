import { HonestEmptyPage } from "@/components/dashboard/HonestEmptyPage";

export const dynamic = "force-dynamic";

export default function DriftPage() {
  return (
    <HonestEmptyPage
      kicker="drift"
      title="Declared vs observed state."
      description="Drift findings — places where your Terraform / IaC declares one thing but the live cloud is different — show here once the drift detector is run against your tenant."
      needs={[
        "DriftFinding rows from the drift detector",
        "Linked AxiomAgentRun for each detection cycle",
        "Severity + remediation classification per drift",
      ]}
    />
  );
}
