"use client";

/**
 * /dashboard/integrations/github
 *
 * A focused GitHub integration page. Replaces a 9-link dead route that
 * canonical state builders + onboarding troubleshooter had been pointing
 * to since the connector registry was wired up.
 *
 * Renders the real GitHub provider posture from /api/axiom-os/state —
 * mode (live/preview), headline, missing requirements, safeNextAction —
 * plus pointers to setup docs and back to the parent integrations index.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, CodeBracketIcon } from "@heroicons/react/24/outline";

interface ProviderPostureLite {
  provider: string;
  mode: string;
  headline: string;
  connectionStatus: string;
  missingRequirements: string[];
  findingCount?: number;
  lastScannedAt?: string;
  safeNextAction?: { label: string; href: string };
}

interface AxiomOSStateLite {
  sourceMode: string;
  generatedAt: string;
  providers: ProviderPostureLite[];
}

export default function GithubIntegrationPage() {
  const [github, setGithub] = useState<ProviderPostureLite | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/axiom-os/state", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: AxiomOSStateLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) {
          const gh = json.data.providers.find((p) => p.provider === "github") ?? null;
          setGithub(gh);
          setGeneratedAt(json.data.generatedAt);
        } else {
          setError(json.error?.userMessage ?? "GitHub state unavailable.");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const modeTone =
    github?.mode === "live"         ? { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", dot: "bg-emerald-400 animate-pulse" } :
    github?.mode === "partial_live" ? { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    dot: "bg-cyan-400 animate-pulse"    } :
    github?.mode === "blocked"      ? { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    text: "text-rose-300",    dot: "bg-rose-400"                  } :
                                       { border: "border-amber-500/[0.18]",  bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   dot: "bg-amber-400"                 };

  return (
    <div className="relative">
      {/* Hero */}
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(139,92,246,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(45,212,191,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <CodeBracketIcon className="h-3.5 w-3.5 text-violet-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">GitHub · ReleaseOps connector</span>
          </span>
          {generatedAt && (
            <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(generatedAt).toLocaleTimeString()}</span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          GitHub <span className="text-gradient">integration.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Live read-only access to repos, workflows, deployment environments, and branch protection. <span className="text-zinc-500">Approval-gated. No mutations. No PR commits.</span>
        </p>
      </div>

      {/* Status card */}
      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing github posture…</p>
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// github state unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}
      {!loading && !error && github && (
        <div className={`rounded-2xl border ${modeTone.border} ${modeTone.bg} p-6 mb-6`}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2 h-2 rounded-full ${modeTone.dot}`} />
            <span className={`text-[10px] font-semibold uppercase tracking-widest ${modeTone.text}`}>
              {github.mode.replace(/_/g, " ")}
            </span>
            <span className="text-[10px] font-mono text-zinc-500 ml-auto">
              {github.connectionStatus.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-base font-semibold text-white mb-1 tracking-tight">{github.headline}</p>
          {typeof github.findingCount === "number" && (
            <p className="text-[12px] text-zinc-400">
              {github.findingCount} attention-required signals · last scan {github.lastScannedAt ? new Date(github.lastScannedAt).toLocaleTimeString() : "—"}
            </p>
          )}

          {github.missingRequirements.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-500/[0.18] bg-amber-500/[0.04] p-3">
              <p className="text-[10px] font-mono text-amber-300/80 uppercase tracking-wider mb-2">// missing requirements</p>
              <ul className="space-y-1">
                {github.missingRequirements.map((req, i) => (
                  <li key={i} className="text-[12px] text-zinc-300 font-mono">{req}</li>
                ))}
              </ul>
            </div>
          )}

          {github.safeNextAction && (
            <Link
              href={github.safeNextAction.href}
              className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white transition-colors"
            >
              {github.safeNextAction.label}
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}

      {/* Setup pointers */}
      <div className="grid md:grid-cols-2 gap-3 mb-6">
        <Link
          href="/docs/architecture#github-connector"
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.18] transition-colors group"
        >
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">// authentication</p>
          <p className="text-sm font-semibold text-white mb-1">GitHub App or PAT</p>
          <p className="text-[12px] text-zinc-400 leading-relaxed">
            GitHub App is the recommended enterprise path (JWT + installation token). PAT path is shipping for dev / preview.
          </p>
          <span className="inline-flex items-center gap-1.5 mt-3 text-[11px] text-zinc-300 group-hover:text-white">
            Read auth architecture <ArrowRightIcon className="h-3 w-3" />
          </span>
        </Link>
        <Link
          href="/dashboard/releaseops"
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.18] transition-colors group"
        >
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">// outputs</p>
          <p className="text-sm font-semibold text-white mb-1">ReleaseOps Command Center</p>
          <p className="text-[12px] text-zinc-400 leading-relaxed">
            Once connected, GitHub state flows into the ReleaseOps state aggregator — readiness score, failing workflows, branch protection gaps, deployment env reviewers.
          </p>
          <span className="inline-flex items-center gap-1.5 mt-3 text-[11px] text-zinc-300 group-hover:text-white">
            Open ReleaseOps <ArrowRightIcon className="h-3 w-3" />
          </span>
        </Link>
      </div>

      <div className="text-center">
        <Link
          href="/dashboard/integrations"
          className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-white border border-dashed border-white/[0.1] hover:border-white/[0.2] rounded-xl px-4 py-2 transition-colors"
        >
          ← All integrations
        </Link>
      </div>
    </div>
  );
}
