import { HonestEmptyPage } from "@/components/dashboard/HonestEmptyPage";

export const dynamic = "force-dynamic";

export default function GapsPage() {
  return (
    <HonestEmptyPage
      kicker="gaps"
      title="Capability gaps."
      description="Where the platform thinks it can't help you yet — missing integrations, missing data, unhandled action classes. Populates once the gap analyzer runs against your tenant."
      needs={[
        "CapabilityGap rows from the analyzer",
        "Per-gap severity + suggested remediation",
        "Coverage cross-walk against AxiomFinding categories",
      ]}
    />
  );
}
