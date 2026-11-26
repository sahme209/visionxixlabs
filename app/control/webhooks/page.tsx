import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { WebhooksBoard } from "@/components/cockpit/WebhooksBoard";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  const context = await currentContext();
  if (context.isAuthenticated && !context.organizationId) redirect("/control/workspaces");
  if (!context.isAuthenticated || !context.organizationId) redirect("/auth/signin?callbackUrl=/control/webhooks");
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.045em]">Webhooks</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Send V19 events to Slack, a pager or your own service. Choose the events each address receives. Every delivery is signed with a secret shown once when you add the webhook. Only public https addresses are accepted, and a webhook that keeps failing is switched off automatically.</p>
      <WebhooksBoard />
    </div>
  );
}
