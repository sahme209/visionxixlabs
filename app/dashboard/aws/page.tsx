import { ProviderDrilldown } from "@/components/dashboard/ProviderDrilldown";
import { JourneyTimeline } from "@/components/dashboard/JourneyTimeline";

export const metadata = { title: "AWS · Axiom" };

export default function AwsPage() {
  return (
    <>
      <ProviderDrilldown providerId="aws" />
      <JourneyTimeline provider="aws" />
    </>
  );
}
