import { ProviderDrilldown } from "@/components/dashboard/ProviderDrilldown";
import { JourneyTimeline } from "@/components/dashboard/JourneyTimeline";
import { RunGithubSyncPanel } from "@/components/dashboard/RunGithubSyncPanel";

export const metadata = { title: "GitHub · Axiom" };

export default function GitHubPage() {
  return (
    <>
      <ProviderDrilldown providerId="github" />
      <RunGithubSyncPanel />
      <JourneyTimeline provider="github" />
    </>
  );
}
