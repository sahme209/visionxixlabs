"use client";

/**
 * GCP one-click connect — calm, single-action Cloud Shell flow.
 *
 * Phases:
 *   loading_url → ready → deploying (Cloud Shell open) →
 *                 paste_key → validating → connected
 *                                       ↘ failed → restart
 *
 * Customer clicks Open Cloud Shell → tutorial walks them through
 * creating a read-only service account → they copy the JSON key out
 * of Cloud Shell, paste it back here. We validate the JSON shape and
 * advance.
 */

import { useEffect, useState } from "react";

type Phase =
  | "loading_url"
  | "ready"
  | "deploying"
  | "paste_key"
  | "validating"
  | "connected"
  | "failed";

interface ValidationOk {
  ok: true;
  projectId: string;
  clientEmail: string;
}
interface ValidationErr {
  ok: false;
  error: string;
  hint?: string;
}

export function GcpDeployConnect({
  onValidated,
}: {
  onValidated?: (info: { projectId: string; serviceAccountJson: string; clientEmail: string }) => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading_url");
  const [shellUrl, setShellUrl] = useState<string | null>(null);
  const [keyJson, setKeyJson] = useState("");
  const [result, setResult] = useState<ValidationOk | ValidationErr | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/gcp/quick-deploy-url")
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
      const res = await fetch("/api/gcp/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceAccountJson: keyJson }),
      });
      const data = (await res.json()) as ValidationOk | ValidationErr;
      setResult(data);
      if (data.ok) {
        setPhase("connected");
        if (onValidated) onValidated({
          projectId: data.projectId,
          clientEmail: data.clientEmail,
          serviceAccountJson: keyJson,
        });
      } else {
        setPhase("paste_key");
      }
    } catch (err) {
      setResult({ ok: false, error: "network_error", hint: err instanceof Error ? err.message : String(err) });
      setPhase("paste_key");
    }
  }

  // ─── Connected ────────────────────────────────────────────────────
  if (phase === "connected" && result?.ok) {
    return (
      <CalmCard tone="emerald">
        <KickerLine tone="emerald">gcp · connected</KickerLine>
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">GCP is verified.</h3>
        <p className="text-[13px] text-zinc-300 leading-relaxed mt-2">
          Project <code className="font-mono text-emerald-200">{result.projectId}</code> is connected through the service account <code className="font-mono text-emerald-200 break-all">{result.clientEmail}</code>. We&apos;ll start the inventory in a moment.
        </p>
      </CalmCard>
    );
  }

  // ─── Validating ───────────────────────────────────────────────────
  if (phase === "validating") {
    return (
      <CalmCard tone="indigo">
        <KickerLine tone="indigo">gcp · finalizing</KickerLine>
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">Confirming the key…</h3>
        <div className="mt-4 flex items-center gap-2.5">
          <span className="w-4 h-4 rounded-full border-2 border-indigo-300/70 border-t-transparent animate-spin" />
          <span className="text-[13px] text-zinc-300">Validating the service-account JSON…</span>
        </div>
      </CalmCard>
    );
  }

  // ─── Failed ───────────────────────────────────────────────────────
  if (phase === "failed") {
    return (
      <CalmCard tone="amber">
        <KickerLine tone="amber">gcp · needs another try</KickerLine>
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">Couldn&apos;t open Cloud Shell.</h3>
        <p className="text-[13px] text-zinc-300 leading-relaxed mt-2">
          Check your connection and try again, or run the gcloud setup commands from the GCP setup guide directly.
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

  // ─── Paste key (after Cloud Shell deploy) ─────────────────────────
  if (phase === "paste_key") {
    return (
      <div className="space-y-4">
        <CalmCard tone="indigo">
          <KickerLine tone="indigo">gcp · finish connecting</KickerLine>
          <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">
            Paste the JSON key from Cloud Shell.
          </h3>
          <p className="text-[13px] text-zinc-300 leading-relaxed mt-2 max-w-2xl">
            At the end of the tutorial, Cloud Shell prints a service-account JSON key. Copy the entire block (including the <code className="font-mono text-zinc-100">{"{"}</code> and <code className="font-mono text-zinc-100">{"}"}</code>) and paste it below.
          </p>

          <textarea
            value={keyJson}
            onChange={(e) => setKeyJson(e.target.value)}
            placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}'}
            rows={8}
            className="mt-4 w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-[12.5px] font-mono placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none transition-colors resize-y"
            spellCheck={false}
            autoComplete="off"
          />

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleValidate}
              disabled={!keyJson.trim()}
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

  // ─── Ready / loading_url / deploying ──────────────────────────────
  return (
    <div className="space-y-4">
      <CalmCard tone="indigo">
        <KickerLine tone="indigo">gcp · one click connect</KickerLine>
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">
          Connect GCP through Cloud Shell.
        </h3>
        <p className="text-[13px] text-zinc-300 leading-relaxed mt-2 max-w-2xl">
          We&apos;ll open Google Cloud Shell with a guided tutorial that creates a read-only service account in your project. Cloud Shell prints a JSON key at the end — paste it back here and you&apos;re connected.
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
              Open Cloud Shell
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
                onClick={() => setPhase("paste_key")}
                className="block text-[13px] text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                I finished the tutorial — paste my key →
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
        <KickerLine tone="neutral">what happens next</KickerLine>
        <ol className="mt-3 space-y-3">
          <TimelineStep n={1} title="Cloud Shell opens with a tutorial">
            Google&apos;s in-browser shell loads. The tutorial pane walks you through six gcloud commands. Click <strong className="text-zinc-100">Run</strong> for each.
          </TimelineStep>
          <TimelineStep n={2} title="Service account + roles are created">
            The script creates <code className="font-mono text-zinc-300">axiom-agent-reader</code> in your project and binds <strong className="text-zinc-100">Security Reviewer</strong>.
          </TimelineStep>
          <TimelineStep n={3} title="Paste the JSON key back">
            The last step prints a service-account key. Copy the JSON block and paste it here to finish.
          </TimelineStep>
        </ol>
      </CalmCard>

      <CalmCard tone="neutral">
        <KickerLine tone="neutral">what we can see</KickerLine>
        <p className="text-[13px] text-zinc-400 leading-relaxed mt-2">
          The service account&apos;s role grants read-only access to inventory and IAM policy — never to your data, never to write actions.
        </p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5">
          <ScopeRow>Compute · GCE instances, MIGs, disks</ScopeRow>
          <ScopeRow>Storage · GCS buckets, IAM bindings</ScopeRow>
          <ScopeRow>Networking · VPCs, firewalls, load balancers</ScopeRow>
          <ScopeRow>Identity · IAM policies and service accounts</ScopeRow>
          <ScopeRow>Cost · billing summary (read-only)</ScopeRow>
          <ScopeRow>Labels · resource labels across the project</ScopeRow>
        </div>
        <p className="text-[12px] text-zinc-500 leading-relaxed mt-4">
          Revoke instantly: delete the <code className="font-mono">axiom-agent-reader</code> service account from your project.
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
