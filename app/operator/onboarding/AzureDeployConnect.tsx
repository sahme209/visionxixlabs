"use client";

/**
 * Azure one-click connect — calm, single-action ARM-template flow.
 *
 * Phases:
 *   loading_template → ready → deploying (in portal.azure.com) →
 *                      enter_ids → validating → connected
 *                                            ↘ failed → restart
 *
 * The customer clicks Deploy → Azure Portal opens with the ARM
 * template prefilled (no parameters to type) → they click Review +
 * create → role assignment lands → they bounce back here and the
 * deployment success page in Azure shows the Subscription + Tenant
 * IDs as outputs. They paste those two GUIDs once, we validate and
 * advance.
 */

import { useEffect, useState } from "react";

type Phase =
  | "loading_template"
  | "ready"
  | "deploying"
  | "enter_ids"
  | "validating"
  | "connected"
  | "failed";

interface ValidationOk {
  ok: true;
  subscriptionId: string;
  tenantId: string;
}
interface ValidationErr {
  ok: false;
  error: string;
  hint?: string;
}

export function AzureDeployConnect({
  onValidated,
}: {
  onValidated?: (info: { subscriptionId: string; tenantId: string }) => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading_template");
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [result, setResult] = useState<ValidationOk | ValidationErr | null>(null);

  // Load the deploy URL once.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/azure/quick-deploy-url")
      .then((r) => r.json())
      .then((data: { available: boolean; url?: string; hint?: string; reason?: string }) => {
        if (cancelled) return;
        if (data.available && data.url) {
          setDeployUrl(data.url);
          setPhase("ready");
        } else {
          setResult({
            ok: false,
            error: data.reason ?? "azure_unavailable",
            hint: data.hint ?? "Azure connections aren't ready yet. Try again in a few minutes.",
          });
          setPhase("failed");
        }
      })
      .catch(() => { if (!cancelled) setPhase("failed"); });
    return () => { cancelled = true; };
  }, []);

  async function handleValidate() {
    setPhase("validating");
    try {
      const res = await fetch("/api/azure/validate-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId, tenantId }),
      });
      const data = (await res.json()) as ValidationOk | ValidationErr;
      setResult(data);
      if (data.ok) {
        setPhase("connected");
        if (onValidated) onValidated({ subscriptionId: data.subscriptionId, tenantId: data.tenantId });
      } else {
        setPhase("enter_ids");
      }
    } catch (err) {
      setResult({ ok: false, error: "network_error", hint: err instanceof Error ? err.message : String(err) });
      setPhase("enter_ids");
    }
  }

  // ─── Connected ────────────────────────────────────────────────────
  if (phase === "connected" && result?.ok) {
    return (
      <CalmCard tone="emerald">
        <KickerLine tone="emerald">azure · connected</KickerLine>
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">Azure is verified.</h3>
        <p className="text-[13px] text-zinc-300 leading-relaxed mt-2">
          Subscription <code className="font-mono text-emerald-200">{result.subscriptionId}</code> is bound to the Reader role assignment you just created. We&apos;ll start the inventory in a moment.
        </p>
      </CalmCard>
    );
  }

  // ─── Validating ───────────────────────────────────────────────────
  if (phase === "validating") {
    return (
      <CalmCard tone="indigo">
        <KickerLine tone="indigo">azure · finalizing</KickerLine>
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">Confirming the deployment…</h3>
        <div className="mt-4 flex items-center gap-2.5">
          <span className="w-4 h-4 rounded-full border-2 border-indigo-300/70 border-t-transparent animate-spin" />
          <span className="text-[13px] text-zinc-300">Validating the subscription binding…</span>
        </div>
      </CalmCard>
    );
  }

  // ─── Failed ───────────────────────────────────────────────────────
  if (phase === "failed") {
    return (
      <CalmCard tone="amber">
        <KickerLine tone="amber">azure · needs another try</KickerLine>
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">
          {deployUrl ? "Azure didn't accept the deployment yet." : "Couldn't open the deploy link."}
        </h3>
        <p className="text-[13px] text-zinc-300 leading-relaxed mt-2">
          {result?.ok === false && result.hint
            ? result.hint
            : "Azure may still be propagating the role assignment. Wait a moment and try again."}
        </p>
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setPhase(deployUrl ? "ready" : "loading_template");
          }}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-[13px] font-medium transition-colors"
        >
          Try again
        </button>
      </CalmCard>
    );
  }

  // ─── Enter IDs (after they deployed in portal) ────────────────────
  if (phase === "enter_ids") {
    return (
      <div className="space-y-4">
        <CalmCard tone="indigo">
          <KickerLine tone="indigo">azure · finish connecting</KickerLine>
          <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">
            Paste the IDs from the Azure success page.
          </h3>
          <p className="text-[13px] text-zinc-300 leading-relaxed mt-2 max-w-2xl">
            After the deployment, Azure shows your <strong className="text-zinc-100">Subscription ID</strong> and <strong className="text-zinc-100">Tenant ID</strong> on the success screen. Paste them here and we&apos;ll finish the connection.
          </p>

          <div className="mt-5 space-y-3 max-w-lg">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-mono">Subscription ID</span>
              <input
                type="text"
                value={subscriptionId}
                onChange={(e) => setSubscriptionId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="mt-1.5 w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-[13px] font-mono placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none transition-colors"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-mono">Tenant ID</span>
              <input
                type="text"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="mt-1.5 w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-[13px] font-mono placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none transition-colors"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={handleValidate}
              disabled={!subscriptionId || !tenantId}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 disabled:cursor-not-allowed text-white text-[14px] font-medium shadow-sm transition-colors"
            >
              Finish connection
              <span aria-hidden className="opacity-70">→</span>
            </button>
            {deployUrl && (
              <a
                href={deployUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Re-open Azure deployment
              </a>
            )}
          </div>

          {result?.ok === false && (
            <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-3 text-[12.5px] text-amber-100/90 leading-relaxed">
              {result.hint ?? "Couldn't validate those IDs."}
            </div>
          )}
        </CalmCard>
      </div>
    );
  }

  // ─── Ready / loading_template / deploying ─────────────────────────
  return (
    <div className="space-y-4">
      <CalmCard tone="indigo">
        <KickerLine tone="indigo">azure · one click connect</KickerLine>
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">
          Connect Azure through ARM Templates.
        </h3>
        <p className="text-[13px] text-zinc-300 leading-relaxed mt-2 max-w-2xl">
          We&apos;ll open the Azure Portal with a Reader-role assignment pre-configured for your subscription. No JSON, no client secret to copy — just click Review + create in Azure, then paste two IDs back here.
        </p>

        <div className="mt-5">
          {phase === "ready" && deployUrl ? (
            <a
              href={deployUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => setPhase("deploying")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-[14px] font-medium shadow-sm transition-colors"
            >
              Open Azure Portal
              <span aria-hidden className="opacity-70">→</span>
            </a>
          ) : phase === "deploying" ? (
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-zinc-800/80 border border-zinc-700 text-zinc-200 text-[14px]">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-300/70 border-t-transparent animate-spin" />
                Waiting for Azure Portal…
              </div>
              <button
                type="button"
                onClick={() => setPhase("enter_ids")}
                className="block text-[13px] text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                I finished the deployment — enter my IDs →
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-zinc-800/60 border border-zinc-800 text-zinc-400 text-[14px]">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
              Preparing your connect link…
            </div>
          )}
        </div>
      </CalmCard>

      <CalmCard tone="neutral">
        <KickerLine tone="neutral">what happens next</KickerLine>
        <ol className="mt-3 space-y-3">
          <TimelineStep n={1} title="Azure Portal opens">
            The Reader role-assignment template is pre-filled. Pick your subscription, click <strong className="text-zinc-100">Review + create</strong>.
          </TimelineStep>
          <TimelineStep n={2} title="Azure provisions the role">
            Takes about 30 seconds. The portal shows a success page with your subscription and tenant IDs as outputs.
          </TimelineStep>
          <TimelineStep n={3} title="Paste the two IDs back">
            Copy <strong className="text-zinc-100">Subscription ID</strong> + <strong className="text-zinc-100">Tenant ID</strong> from the success screen into the fields here. You&apos;re connected.
          </TimelineStep>
        </ol>
      </CalmCard>

      <CalmCard tone="neutral">
        <KickerLine tone="neutral">what we can see</KickerLine>
        <p className="text-[13px] text-zinc-400 leading-relaxed mt-2">
          The Reader role grants read-only access to inventory and configuration — never to your data, never to write actions.
        </p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5">
          <ScopeRow>Compute · VMs, scale sets, App Service plans</ScopeRow>
          <ScopeRow>Storage · accounts, containers, blob policies</ScopeRow>
          <ScopeRow>Networking · VNets, NSGs, load balancers</ScopeRow>
          <ScopeRow>Identity · Entra roles, conditional access</ScopeRow>
          <ScopeRow>Cost · subscription spend summary</ScopeRow>
          <ScopeRow>Tags · resource tags across the subscription</ScopeRow>
        </div>
        <p className="text-[12px] text-zinc-500 leading-relaxed mt-4">
          Revoke instantly: remove the role assignment from the subscription in Azure Portal → Access control (IAM).
        </p>
      </CalmCard>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Local calm primitives — kept private to this file so it can ship
   without coupling to AwsKeyConnect's internal helpers.
   ──────────────────────────────────────────────────────────────────── */

type Tone = "emerald" | "indigo" | "amber" | "neutral";

const TONES: Record<Tone, { border: string; bg: string; kicker: string }> = {
  emerald: { border: "border-emerald-500/25", bg: "bg-emerald-500/[0.04]", kicker: "text-emerald-300" },
  indigo:  { border: "border-indigo-500/25",  bg: "bg-indigo-500/[0.04]",  kicker: "text-indigo-300" },
  amber:   { border: "border-amber-500/25",   bg: "bg-amber-500/[0.04]",   kicker: "text-amber-300" },
  neutral: { border: "border-zinc-800",       bg: "bg-zinc-900/40",        kicker: "text-zinc-400" },
};

function CalmCard({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const t = TONES[tone];
  return <div className={`rounded-2xl border ${t.border} ${t.bg} p-6`}>{children}</div>;
}

function KickerLine({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const t = TONES[tone];
  return <p className={`text-[10px] font-mono uppercase tracking-[0.22em] font-semibold ${t.kicker}`}>{children}</p>;
}

function TimelineStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-[11px] font-mono text-zinc-300 flex items-center justify-center mt-[1px]">{n}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-zinc-100">{title}</p>
        <p className="text-[12.5px] text-zinc-400 leading-relaxed mt-0.5">{children}</p>
      </div>
    </li>
  );
}

function ScopeRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[12.5px] text-zinc-300">
      <span aria-hidden className="w-1 h-1 rounded-full bg-emerald-400/70 flex-shrink-0" />
      <span>{children}</span>
    </div>
  );
}
