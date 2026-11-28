import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { RunbookLibrary } from "@/components/cockpit/RunbookLibrary";

export const dynamic = "force-dynamic";

export default async function RunbooksPage() {
  const context = await currentContext();
  if (context.isAuthenticated && !context.organizationId) redirect("/control/workspaces");
  if (!context.isAuthenticated || !context.organizationId) redirect("/auth/signin?callbackUrl=/control/runbooks");
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.045em]">Runbooks</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Your team&apos;s procedures for failed deploys, incidents and freezes, with the approval each step needs. Runbooks are versioned and can be kept in Git. V19 does not run them in your systems; the Agent can read them to suggest the right one.</p>
      <RunbookLibrary />
    </div>
  );
}
