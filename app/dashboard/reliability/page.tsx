import { HonestEmptyPage } from "@/components/dashboard/HonestEmptyPage";

export const dynamic = "force-dynamic";

export default function ReliabilityPage() {
  return (
    <HonestEmptyPage
      kicker="reliability"
      title="Circuits, retries, and dead-letter state."
      description="Component health, retry telemetry, and fleet state will surface here once telemetry collection is wired."
      needs={[
        "ReliabilityComponent rows from the live registry",
        "CircuitBreaker + RetryQueue snapshots",
        "Fleet health probes per component",
      ]}
    />
  );
}
