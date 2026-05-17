import { ProviderDrilldown } from "@/components/dashboard/ProviderDrilldown";
import { JourneyTimeline } from "@/components/dashboard/JourneyTimeline";
import { RunAwsScanPanel } from "@/components/dashboard/RunAwsScanPanel";

export const metadata = { title: "AWS · Axiom" };

export default function AwsPage() {
  return (
    <>
      <ProviderDrilldown providerId="aws" />
      <RunAwsScanPanel />
      <JourneyTimeline provider="aws" />
    </>
  );
}
