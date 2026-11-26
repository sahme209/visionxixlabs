import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { ChecksBoard } from "@/components/cockpit/ChecksBoard";

export const dynamic = "force-dynamic";

export default async function ChecksPage() {
  const context = await currentContext();
  if (context.isAuthenticated && !context.organizationId) redirect("/control/workspaces");
  if (!context.isAuthenticated || !context.organizationId) redirect("/auth/signin?callbackUrl=/control/checks");
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.045em]">Deployment checks</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Attach checks to each release stage: smoke tests, health checks, migration dry runs, custom scripts, manual checklists, security scans, supply-chain evidence and resilience experiments. Blocking checks must pass before a stage can finish; advisory checks are recorded. V19 never runs a check itself. Checks run in your CI or runners and their results come back as evidence.</p>
      <ChecksBoard />
    </div>
  );
}
