import { ProviderDrilldown } from "@/components/dashboard/ProviderDrilldown";
import { JourneyTimeline } from "@/components/dashboard/JourneyTimeline";

export const metadata = { title: "GitHub · Axiom" };

export default function GitHubPage() {
  return (
    <>
      <ProviderDrilldown providerId="github" />
      <JourneyTimeline provider="github" />
    </>
  );
}
