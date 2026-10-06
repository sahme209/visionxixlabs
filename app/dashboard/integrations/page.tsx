/**
 * /dashboard/integrations — unified integration status hub.
 *
 * Single page answering 'what is the platform connected to right
 * now?' across cloud providers + notification channels. Each row
 * links to the surface that manages it — cloud providers to
 * /dashboard/connect-cloud, notifications to
 * /dashboard/settings/notifications.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

const PROVIDER_LABEL: Record<string, string> = {
  aws:   "Amazon Web Services",
  azure: "Microsoft Azure",
  gcp:   "Google Cloud",
};

const STATUS_TONE: Record<string, string> = {
  connected:           "text-emerald-300",
  setup_started:       "text-zinc-400",
  waiting_for_provider:"text-zinc-300",
  validating:          "text-zinc-300",
  needs_attention:     "text-zinc-300",
  failed:              "text-rose-300",
  disconnected:        "text-zinc-500",
  revoked:             "text-rose-300",
  not_connected:       "text-zinc-600",
};

export default async function IntegrationsPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.email) {
    redirect("/auth/signin?callbackUrl=/dashboard/integrations");
  }

  let sessions: Array<{ provider: string; status: string; firstConnectedAt: Date | null; lastTransitionAt: Date | null }> = [];
  let migrationPending = false;
  try {
    sessions = await prisma.connectorSetupSession.findMany({
      where: { organizationId: ctx.organizationId },
      select: {
        provider: true,
        status: true,
        firstConnectedAt: true,
        lastTransitionAt: true,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      migrationPending = true;
    } else {
      throw err;
    }
  }

  const user = await prisma.user.findUnique({
    where: { email: ctx.email.toLowerCase() },
    select: { id: true },
  });
  const lead = await prisma.lead.findFirst({
    where: {
      source: "cloud-operator",
      OR: [
        ...(user?.id ? [{ userId: user.id }] : []),
        { email: ctx.email.toLowerCase() },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { fullPayload: true },
  });
  const payload = (lead?.fullPayload as Record<string, unknown>) ?? {};
  const notif = (payload.notifications as Record<string, unknown> | undefined) ?? {};
  const slackOn = typeof notif.slackWebhookUrl === "string" && notif.slackWebhookUrl.length > 0;
  const teamsOn = typeof notif.teamsWebhookUrl === "string" && notif.teamsWebhookUrl.length > 0;
  const emailOn = typeof notif.emailDigestTo === "string" && notif.emailDigestTo.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">integrations</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          What&apos;s wired up.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          Every external system the platform talks to today, with current
          status. Click any row to manage it.
        </p>
      </header>

      {migrationPending && (
        <div className="mb-8 rounded-2xl border border-white/15 bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-300 mb-1">migration pending</p>
          <p className="text-[13px] text-zinc-300">
            ConnectorSetupSession table not migrated yet. Run <code className="font-mono text-white">prisma migrate deploy</code>.
          </p>
        </div>
      )}

      <section className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">cloud providers</p>
        <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
          {(["aws", "azure", "gcp"] as const).map((provider) => {
            const session = sessions.find((s) => s.provider === provider);
            const status = session?.status ?? "not_connected";
            const tone = STATUS_TONE[status] ?? "text-zinc-500";
            return (
              <li key={provider}>
                <Link
                  href="/dashboard/connect-cloud"
                  className="group flex items-center gap-4 px-6 py-4 hover:bg-white/[0.015] transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 text-[10px] font-mono font-semibold tracking-wider text-zinc-300">
                    {provider.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-white">{PROVIDER_LABEL[provider]}</p>
                    <p className={`text-[11px] font-mono uppercase tracking-wider mt-0.5 ${tone}`}>
                      {status.replace(/_/g, " ")}
                      {session?.lastTransitionAt && (
                        <span className="text-zinc-600"> · {session.lastTransitionAt.toISOString().slice(0, 10)}</span>
                      )}
                    </p>
                  </div>
                  <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">notification channels</p>
        <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
          <ChannelRow label="Slack" configured={slackOn} hint="Incoming webhook URL" />
          <ChannelRow label="Microsoft Teams" configured={teamsOn} hint="Connector URL" />
          <ChannelRow label="Email digest" configured={emailOn} hint="Recipient address" deferred />
        </ul>
      </section>
    </div>
  );
}

function ChannelRow({
  label,
  configured,
  hint,
  deferred,
}: {
  label: string;
  configured: boolean;
  hint: string;
  deferred?: boolean;
}) {
  return (
    <li>
      <Link
        href="/dashboard/settings/notifications"
        className="group flex items-center gap-4 px-6 py-4 hover:bg-white/[0.015] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-white">{label}</p>
          <p className={`text-[11px] font-mono uppercase tracking-wider mt-0.5 ${configured ? "text-emerald-300" : "text-zinc-500"}`}>
            {configured ? "configured" : "not set"}
            <span className="text-zinc-600"> · {hint}</span>
            {deferred && <span className="text-zinc-600"> · wiring pending</span>}
          </p>
        </div>
        <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
      </Link>
    </li>
  );
}
