import { HonestEmptyPage } from "@/components/dashboard/HonestEmptyPage";

export const dynamic = "force-dynamic";

export default function ReleaseOpsPage() {
  return (
    <HonestEmptyPage
      kicker="release operations"
      title="No tenant release records yet"
      description="Release activity appears here only after this workspace connects a supported source and records a deployment. Axiom Agent does not substitute sample deployments for tenant data."
      needs={[
        "Deployment requests recorded for this workspace",
        "Approval and change events from configured connectors",
        "Validation evidence attached to completed runs",
      ]}
      ctaHref="/dashboard/connectors"
      ctaLabel="Review connectors"
    />
  );
}
