import { HonestEmptyPage } from "@/components/dashboard/HonestEmptyPage";

export const dynamic = "force-dynamic";

export default function TracesPage() {
  return (
    <HonestEmptyPage
      kicker="traces"
      title="Operation span timelines."
      description="Per-operation spans — broker AssumeRole, EC2 read, S3 read, finding analysis — render as waterfall charts here once OperationSpan persistence is wired."
      needs={[
        "OperationSpan rows linked to AxiomAgentRun",
        "Per-span latency + child-span tree",
        "Correlation ids across the scan / approval pipeline",
      ]}
    />
  );
}
