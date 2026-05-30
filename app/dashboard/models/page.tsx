import { HonestEmptyPage } from "@/components/dashboard/HonestEmptyPage";

export const dynamic = "force-dynamic";

export default function ModelsPage() {
  return (
    <HonestEmptyPage
      kicker="models"
      title="Model registry."
      description="The LLM / scanner / reasoner models the platform uses, with version, cost, and tenant overrides. This page renders once the model registry is wired to your tenant."
      needs={[
        "ModelDeployment rows per tenant",
        "Per-model cost + token telemetry",
        "Override + pinning configuration",
      ]}
    />
  );
}
