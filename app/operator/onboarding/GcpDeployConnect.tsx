"use client";

/**
 * GCP one-click connect — calm, single-action Cloud Shell flow.
 *
 * Phases:
 *   loading_url → ready → deploying (Cloud Shell open) →
 *                 paste_key → validating → connected
 *                                       ↘ failed → restart
 *
 * Customer clicks Open Cloud Shell → pastes one `gcloud` command that
 * creates the read-only service account + emits a JSON key → pastes
 * the JSON key back here. No external tutorial repo — Google's
 * Cloud Shell URL used to point at a private application repo and
 * the clone always failed.
 */

import { useEffect, useState } from "react";

const GCP_SETUP_COMMAND = `PROJECT_ID=$(gcloud config get-value project) && \\
gcloud iam service-accounts create axiom-agent-reader \\
  --description="Axiom read-only inventory access" \\
  --display-name="Axiom Agent Reader" --project="$PROJECT_ID" && \\
gcloud projects add-iam-policy-binding "$PROJECT_ID" \\
  --member="serviceAccount:axiom-agent-reader@$PROJECT_ID.iam.gserviceaccount.com" \\
  --role="roles/iam.securityReviewer" --quiet && \\
gcloud iam service-accounts keys create /tmp/axiom-key.json \\
  --iam-account="axiom-agent-reader@$PROJECT_ID.iam.gserviceaccount.com" --project="$PROJECT_ID" && \\
cat /tmp/axiom-key.json`;

/**
 * Client mirror of the server's brace walker. We use this to
 * preview the paste state inline — "JSON detected" vs targeted
 * hints — so the customer never clicks Finish on a doomed submit.
 */
function looksParseable(raw: string): { ok: boolean; reason: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  try { const j = JSON.parse(trimmed); if (j && typeof j === "object") return { ok: true, reason: "strict_json" }; } catch { /* try walker */ }
  let depth = 0; let start = -1; let inString = false; let escapeNext = false;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (ch === "\\" && inString) { escapeNext = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") { if (depth === 0) start = i; depth++; }
    else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = trimmed.slice(start, i + 1);
        try { const j = JSON.parse(candidate); if (j && typeof j === "object") return { ok: true, reason: "extracted_block" }; } catch { /* keep walking */ }
        start = -1;
      }
    }
  }
  if (/gcloud\s+iam\s+service-accounts\s+create/i.test(trimmed)) {
    return { ok: false, reason: "command_not_output" };
  }
  if (trimmed.includes("{") && trimmed.includes("}")) {
    return { ok: false, reason: "braces_but_unparseable" };
  }
  return { ok: false, reason: "no_braces" };
}

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
  const [copied, setCopied] = useState(false);
  const [pasteHint, setPasteHint] = useState<string | null>(null);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(GCP_SETUP_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — customer can still hand-copy */ }
  }

  async function pasteFromClipboard() {
    setPasteHint(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setPasteHint("Clipboard is empty. Copy the JSON from Cloud Shell first (select it, then ⌘C / Ctrl+C).");
        return;
      }
      setKeyJson(text);
    } catch {
      setPasteHint("Browser blocked clipboard read. Click in the box below and press ⌘V / Ctrl+V to paste.");
    }
  }

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
        <h3 className="text-xl font-semibold text-white tracking-tight mt-1.5">Validating GCP access…</h3>
        <p className="text-[13px] text-zinc-400 leading-relaxed mt-2">
          Authenticating the service account and confirming Viewer access on the project. Usually takes a few seconds.
        </p>
        <div className="mt-4 flex items-center gap-2.5">
          <span className="w-4 h-4 rounded-full border-2 border-indigo-300/70 border-t-transparent animate-spin" />
          <span className="text-[13px] text-zinc-300">Calling Google Cloud Resource Manager…</span>
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
            The gcloud command prints a JSON service-account key at the
            end. You can paste either just that block <strong>or</strong> the
            entire Cloud Shell output — we&apos;ll find the JSON
            automatically.
          </p>

          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[12px] font-mono uppercase tracking-wider text-zinc-400">paste the cloud shell JSON here ↓</span>
            <button
              type="button"
              onClick={pasteFromClipboard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-[12px] font-medium transition-colors"
              title="Read the JSON from your clipboard"
            >
              Paste from clipboard
            </button>
          </div>
          <textarea
            value={keyJson}
            onChange={(e) => { setKeyJson(e.target.value); setPasteHint(null); }}
            placeholder={`Click here, then press ⌘V (Mac) or Ctrl+V (Windows) to paste the JSON\n\n{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}`}
            rows={8}
            className="mt-2 w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-[12.5px] font-mono placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none transition-colors resize-y"
            spellCheck={false}
            autoComplete="off"
          />
          {pasteHint && (
            <p className="mt-2 text-[12px] text-amber-300/90">{pasteHint}</p>
          )}
          {(() => {
            const v = looksParseable(keyJson);
            if (v.ok) return <p className="mt-2 text-[12px] text-emerald-300/90">✓ JSON detected — Finish connection will validate against Google Cloud Resource Manager.</p>;
            if (v.reason === "command_not_output") return <p className="mt-2 text-[12px] text-amber-300/90">That&apos;s the gcloud command, not its output. Run it in Cloud Shell, then copy the JSON block it prints.</p>;
            if (v.reason === "braces_but_unparseable") return <p className="mt-2 text-[12px] text-amber-300/90">Found {"{ }"} braces but couldn&apos;t parse the JSON. Make sure the closing <code className="font-mono">{"}"}</code> is included.</p>;
            if (v.reason === "no_braces" && keyJson.trim()) return <p className="mt-2 text-[12px] text-amber-300/90">No JSON found yet. Paste the Cloud Shell output (the block wrapped in <code className="font-mono">{"{ }"}</code>).</p>;
            return null;
          })()}

          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleValidate}
              disabled={!keyJson.trim() || !looksParseable(keyJson).ok}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 disabled:cursor-not-allowed text-white text-[14px] font-medium shadow-sm transition-colors"
            >
              Finish connection
              <span aria-hidden className="opacity-70">→</span>
            </button>
            {!keyJson.trim() && (
              <span className="text-[12px] text-amber-300/85">
                Paste your JSON above to enable the button.
              </span>
            )}
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
          We&apos;ll open Google Cloud Shell in a new tab. Paste one
          <code className="font-mono text-zinc-100"> gcloud </code>
          command to create a read-only service account in your project
          — then paste the JSON key it prints back here. No tutorial
          repo, no portal wizard.
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
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <a
                  href={shellUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-[13px] font-medium transition-colors"
                >
                  Re-open Cloud Shell
                </a>
                <span className="inline-flex items-center gap-2 text-[12.5px] text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  Cloud Shell open — paste the JSON when ready
                </span>
              </div>

              {/* Inline paste form — visible as soon as Cloud Shell has
                  been opened so the operator can paste without hunting
                  for a 'paste my key' link. */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-[12px] font-mono uppercase tracking-wider text-zinc-400">paste the cloud shell JSON here ↓</span>
                <button
                  type="button"
                  onClick={pasteFromClipboard}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-[12px] font-medium transition-colors"
                  title="Read the JSON from your clipboard"
                >
                  Paste from clipboard
                </button>
              </div>
              <textarea
                value={keyJson}
                onChange={(e) => { setKeyJson(e.target.value); setPasteHint(null); }}
                placeholder={`Click here, then press ⌘V (Mac) or Ctrl+V (Windows) to paste the JSON\n\n{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}`}
                rows={8}
                className="mt-1 w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-[12.5px] font-mono placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none transition-colors resize-y"
                spellCheck={false}
                autoComplete="off"
              />
              {pasteHint && (
                <p className="text-[12px] text-amber-300/90">{pasteHint}</p>
              )}
              {(() => {
                const v = looksParseable(keyJson);
                if (v.ok) return <p className="text-[12px] text-emerald-300/90">✓ JSON detected — Finish connection will validate against Google Cloud Resource Manager.</p>;
                if (v.reason === "command_not_output") return <p className="text-[12px] text-amber-300/90">That&apos;s the gcloud command, not its output. Run it in Cloud Shell, then copy the JSON block it prints.</p>;
                if (v.reason === "braces_but_unparseable") return <p className="text-[12px] text-amber-300/90">Found {"{ }"} braces but couldn&apos;t parse the JSON. Make sure the closing <code className="font-mono">{"}"}</code> is included.</p>;
                if (v.reason === "no_braces" && keyJson.trim()) return <p className="text-[12px] text-amber-300/90">No JSON found yet. Paste the Cloud Shell output (the block wrapped in <code className="font-mono">{"{ }"}</code>).</p>;
                return null;
              })()}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={!keyJson.trim() || !looksParseable(keyJson).ok}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 disabled:cursor-not-allowed text-white text-[14px] font-medium shadow-sm transition-colors"
                >
                  Finish connection
                  <span aria-hidden className="opacity-70">→</span>
                </button>
                {!keyJson.trim() && (
                  <span className="text-[12px] text-amber-300/85">
                    Paste your JSON above to enable the button.
                  </span>
                )}
              </div>

              {result?.ok === false && (
                <div className="mt-1 rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-3 text-[12.5px] text-amber-100/90 leading-relaxed">
                  {result.hint ?? "Couldn't validate that JSON."}
                </div>
              )}
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
          One command. Creates <code className="font-mono text-zinc-300">axiom-agent-reader</code> in your active project, binds it to the built-in <strong className="text-zinc-100">Security Reviewer</strong> role, generates a key, and prints the JSON.
        </p>
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-[12px] text-zinc-200 leading-relaxed whitespace-pre overflow-x-auto">
          {GCP_SETUP_COMMAND}
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
            Google&apos;s in-browser shell loads in a new tab. If it&apos;s your first time, accept the storage prompt.
          </TimelineStep>
          <TimelineStep n={2} title="Paste + run the gcloud command">
            The command creates <code className="font-mono text-zinc-300">axiom-agent-reader</code> in your active project with the built-in <strong className="text-zinc-100">Security Reviewer</strong> role, generates a key, and prints the JSON.
          </TimelineStep>
          <TimelineStep n={3} title="Paste the JSON back">
            Copy the JSON output (or the whole terminal — we extract the JSON automatically) into the field above. You&apos;re connected.
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
