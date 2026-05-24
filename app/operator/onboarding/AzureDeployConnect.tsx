"use client";

/**
 * Azure one-click connect — calm, self-service Cloud Shell flow.
 *
 * Phases:
 *   loading_url → ready → deploying (Cloud Shell open) →
 *                 paste_json → validating → connected
 *                                       ↘ failed → restart
 *
 * No platform-side ENV is required. The customer clicks Open Cloud
 * Shell → runs one az command that creates a Reader-role service
 * principal in their own tenant → pastes the JSON output back here.
 * We validate the shape and advance.
 */

import { useEffect, useState } from "react";

type Phase =
  | "loading_url"
  | "ready"
  | "deploying"
  | "paste_json"
  | "validating"
  | "connected"
  | "failed";

const AZ_COMMAND = `az ad sp create-for-rbac --name axiom-agent-reader --role Reader --scopes /subscriptions/$(az account show --query id -o tsv) --sdk-auth`;

interface ValidationOk {
  ok: true;
  tenantId: string;
  subscriptionId: string;
  clientId: string;
}
interface ValidationErr {
  ok: false;
  error: string;
  hint?: string;
}

export function AzureDeployConnect({
  onValidated,
}: {
  onValidated?: (info: { tenantId: string; subscriptionId: string; clientId: string; credentialsJson: string }) => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading_url");
  const [shellUrl, setShellUrl] = useState<string | null>(null);
  const [credsJson, setCredsJson] = useState("");
  const [result, setResult] = useState<ValidationOk | ValidationErr | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/azure/quick-deploy-url")
      .then((r) => r.json())
      .then((data: { available: boolean; url?: string }) => {
        if (cancelled) return;
        if (data.available && data.url) {
          setShellUrl(data.url);
          setPhase("ready");
        } else {
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
        body: JSON.stringify({ credentialsJson: credsJson }),
      });
      const data = (await res.json()) as ValidationOk | ValidationErr;
      setResult(data);
      if (data.ok) {
        setPhase("connected");
        if (onValidated) onValidated({
          tenantId: data.tenantId,
          subscriptionId: data.subscriptionId,
          clientId: data.clientId,
          credentialsJson: credsJson,
        });
      } else {
        setPhase("paste_json");
      }
    } catch (err) {
      setResult({ ok: false, error: "network_error", hint: err instanceof Error ? err.message : String(err) });
      setPhase("paste_json");
    }
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(AZ_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — customer can still hand-copy */ }
  }

  // ─── Connected ────────────────────────────────────────────────────
  if (phase === "connected" && result?.ok) {
    return (
      <CalmCard tone="emerald">
        <KickerLine tone="emerald">azure · connected</KickerLine>
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">Azure is verified.</h3>
        <p className="text-[13px] text-zinc-300 leading-relaxed mt-2">
          Subscription <code className="font-mono text-emerald-200">{result.subscriptionId}</code> is bound to the read-only service principal you just created. We&apos;ll start the inventory in a moment.
        </p>
      </CalmCard>
    );
  }

  // ─── Validating ───────────────────────────────────────────────────
  if (phase === "validating") {
    return (
      <CalmCard tone="indigo">
        <KickerLine tone="indigo">azure · finalizing</KickerLine>
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">Validating Azure access…</h3>
        <p className="text-[13px] text-zinc-400 leading-relaxed mt-2">
          Acquiring a management token and confirming Reader access on the subscription. Usually takes a few seconds.
        </p>
        <div className="mt-4 flex items-center gap-2.5">
          <span className="w-4 h-4 rounded-full border-2 border-indigo-300/70 border-t-transparent animate-spin" />
          <span className="text-[13px] text-zinc-300">Calling Microsoft Entra + Azure Resource Manager…</span>
        </div>
      </CalmCard>
    );
  }

  // ─── Failed ───────────────────────────────────────────────────────
  if (phase === "failed") {
    return (
      <CalmCard tone="amber">
        <KickerLine tone="amber">azure · needs another try</KickerLine>
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">Couldn&apos;t open Azure Cloud Shell.</h3>
        <p className="text-[13px] text-zinc-300 leading-relaxed mt-2">
          Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={() => { setResult(null); setPhase(shellUrl ? "ready" : "loading_url"); }}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-[13px] font-medium transition-colors"
        >
          Try again
        </button>
      </CalmCard>
    );
  }

  // ─── Paste JSON (after Cloud Shell) ──────────────────────────────
  if (phase === "paste_json") {
    return (
      <div className="space-y-4">
        <CalmCard tone="indigo">
          <KickerLine tone="indigo">azure · finish connecting</KickerLine>
          <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">
            Paste the JSON output from Cloud Shell.
          </h3>
          <p className="text-[13px] text-zinc-300 leading-relaxed mt-2 max-w-2xl">
            The az command prints a JSON block at the end. Copy the entire block (including the <code className="font-mono text-zinc-100">{"{"}</code> and <code className="font-mono text-zinc-100">{"}"}</code>) and paste it below.
          </p>

          <textarea
            value={credsJson}
            onChange={(e) => setCredsJson(e.target.value)}
            placeholder={'{\n  "clientId": "...",\n  "clientSecret": "...",\n  "subscriptionId": "...",\n  "tenantId": "..."\n}'}
            rows={8}
            className="mt-4 w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-[12.5px] font-mono placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none transition-colors resize-y"
            spellCheck={false}
            autoComplete="off"
          />

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleValidate}
              disabled={!credsJson.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 disabled:cursor-not-allowed text-white text-[14px] font-medium shadow-sm transition-colors"
            >
              Finish connection
              <span aria-hidden className="opacity-70">→</span>
            </button>
            {shellUrl && (
              <a
                href={shellUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Re-open Cloud Shell
              </a>
            )}
          </div>

          {result?.ok === false && (
            <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-3 text-[12.5px] text-amber-100/90 leading-relaxed">
              {result.hint ?? "Couldn't validate that JSON."}
            </div>
          )}
        </CalmCard>
      </div>
    );
  }

  // ─── Ready / loading_url / deploying — primary connect screen ────
  return (
    <div className="space-y-4">
      <CalmCard tone="indigo">
        <KickerLine tone="indigo">azure · one click connect</KickerLine>
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">
          Connect Azure through Cloud Shell.
        </h3>
        <p className="text-[13px] text-zinc-300 leading-relaxed mt-2 max-w-2xl">
          We&apos;ll open Azure Cloud Shell in a new tab. Paste one <code className="font-mono text-zinc-100">az</code> command to create a Reader-role service principal in your own tenant — then paste the JSON output back here. No portal wizard, no client secret to email around.
        </p>

        <div className="mt-5">
          {phase === "ready" && shellUrl ? (
            <a
              href={shellUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => setPhase("deploying")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-[14px] font-medium shadow-sm transition-colors"
            >
              Open Azure Cloud Shell
              <span aria-hidden className="opacity-70">→</span>
            </a>
          ) : phase === "deploying" ? (
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-zinc-800/80 border border-zinc-700 text-zinc-200 text-[14px]">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-300/70 border-t-transparent animate-spin" />
                Waiting for Cloud Shell…
              </div>
              <button
                type="button"
                onClick={() => setPhase("paste_json")}
                className="block text-[13px] text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                I have the JSON — paste it now →
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-zinc-800/60 border border-zinc-800 text-zinc-400 text-[14px]">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
              Preparing your Cloud Shell link…
            </div>
          )}
        </div>
      </CalmCard>

      <CalmCard tone="neutral">
        <KickerLine tone="neutral">paste this in Cloud Shell</KickerLine>
        <p className="text-[12.5px] text-zinc-400 leading-relaxed mt-2">
          One command. It creates a service principal scoped to your active subscription, prints the JSON, and exits.
        </p>
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-[12px] text-zinc-200 leading-relaxed break-all">
          {AZ_COMMAND}
        </div>
        <button
          type="button"
          onClick={copyCommand}
          className="mt-3 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-[12.5px] font-medium transition-colors"
        >
          {copied ? "Copied" : "Copy command"}
        </button>
      </CalmCard>

      <CalmCard tone="neutral">
        <KickerLine tone="neutral">what happens next</KickerLine>
        <ol className="mt-3 space-y-3">
          <TimelineStep n={1} title="Cloud Shell opens">
            Azure Cloud Shell loads in a new tab. If it&apos;s your first time, accept the storage prompt.
          </TimelineStep>
          <TimelineStep n={2} title="Paste + run the az command">
            The command creates <code className="font-mono text-zinc-300">axiom-agent-reader</code> in your tenant with the built-in <strong className="text-zinc-100">Reader</strong> role on your active subscription, then prints a JSON block.
          </TimelineStep>
          <TimelineStep n={3} title="Paste the JSON back">
            Copy the entire JSON (including braces) into the field that appears here. You&apos;re connected.
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
          Revoke instantly: <code className="font-mono">az ad sp delete --id axiom-agent-reader</code> in Cloud Shell.
        </p>
      </CalmCard>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Local calm primitives.
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
