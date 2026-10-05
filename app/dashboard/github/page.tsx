import { ProviderDrilldown } from "@/components/dashboard/ProviderDrilldown";
import { JourneyTimeline } from "@/components/dashboard/JourneyTimeline";
import { RunGithubSyncPanel } from "@/components/dashboard/RunGithubSyncPanel";

export const metadata = { title: "GitHub demo scan · Axiom" };

export default function GitHubPage() {
  return (
    <>
      <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-[12px] leading-relaxed text-amber-100">
        This page runs a live, read-only scan against Axiom&apos;s own demonstration
        repository — a single operator-configured GitHub account shared across every
        workspace, not a connection to your organization&apos;s GitHub. For your own
        repositories, PRs, checks, and workflow evidence bound to a release, use{" "}
        <a href="/dashboard/integrations/github" className="underline underline-offset-2 hover:text-amber-50">GitHub setup</a>{" "}
        instead.
      </div>
      <ProviderDrilldown providerId="github" />
      <RunGithubSyncPanel />
      <JourneyTimeline provider="github" />
    </>
  );
}
