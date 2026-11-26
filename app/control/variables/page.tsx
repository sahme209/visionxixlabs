import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { VariablesBoard } from "@/components/cockpit/VariablesBoard";

export const dynamic = "force-dynamic";

export default async function VariablesPage() {
  const context = await currentContext();
  if (context.isAuthenticated && !context.organizationId) redirect("/control/workspaces");
  if (!context.isAuthenticated || !context.organizationId) redirect("/auth/signin?callbackUrl=/control/variables");
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.045em]">Variables</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Plain configuration per environment. Set a workspace default, then override it where an environment needs a different value. Secrets do not belong here: names and values that look like credentials are refused, so keep them in scoped credentials.</p>
      <VariablesBoard />
    </div>
  );
}
