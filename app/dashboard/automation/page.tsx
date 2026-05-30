import { HonestEmptyPage } from "@/components/dashboard/HonestEmptyPage";

export const dynamic = "force-dynamic";

export default function AutomationPage() {
  return (
    <HonestEmptyPage
      kicker="automation"
      title="Scripts, workflows, and runs."
      description="Once automation scripts run against your tenant, the registry + recent runs + risk metadata land here. No sample rows in the meantime."
      needs={[
        "AutomationScript and AutomationRun tables (real per-tenant rows)",
        "ApprovalGate decisions linked to each run",
        "Per-script execution mode + risk classification",
      ]}
    />
  );
}
