/**
 * /admin/growth/linkedin — internal LinkedIn integration cockpit.
 *
 * - Connection status (env configured? token expiry? owner?)
 * - Draft queue (drafted + in_review + approved + scheduled)
 * - Recent publish runs (audit-log slice)
 * - Copy-post / Open-LinkedIn fallback when API is not connected
 *
 * Reads /api/admin/growth/linkedin/status + /api/admin/growth/drafts
 * server-side so the page renders fully without client JS.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  LinkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentIcon,
  ArrowTopRightOnSquareIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  CloudIcon,
} from "@heroicons/react/24/outline";
import { prisma } from "@/lib/db";
import { loadLinkedInConfig, isPostingEnabled } from "@/lib/growth/linkedin/oauth";
import { loadAutopilotPolicy } from "@/lib/growth/autopilot";

export const metadata: Metadata = {
  title: "LinkedIn integration · VisionXIXLabs internal",
  description: "Connect LinkedIn, review drafts, see scheduled posts.",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ connected?: string; error?: string }>;
}

export default async function LinkedInAdminPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const cfg = loadLinkedInConfig();
  const configured = cfg.kind === "configured";
  const missing = cfg.kind === "missing" ? cfg.missing : [];
  const postingEnabled = isPostingEnabled();
  const autopilotPolicy = loadAutopilotPolicy();

  const [connection, drafts, recentRuns, recentAutopilot] = await Promise.all([
    prisma.linkedInAccountConnection.findFirst({
      where: { status: { in: ["connected", "expired", "error"] } },
      orderBy: { updatedAt: "desc" },
    }).catch(() => null),
    prisma.linkedInPostDraft.findMany({
      where: { status: { in: ["drafted", "in_review", "approved", "scheduled", "failed"] } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 25,
    }).catch(() => [] as Awaited<ReturnType<typeof prisma.linkedInPostDraft.findMany>>),
    prisma.linkedInPostPublishRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
    }).catch(() => [] as Awaited<ReturnType<typeof prisma.linkedInPostPublishRun.findMany>>),
    prisma.growthAutopilotDecision.findMany({
      orderBy: { ranAt: "desc" },
      take: 7,
    }).catch(() => [] as Awaited<ReturnType<typeof prisma.growthAutopilotDecision.findMany>>),
  ]);

  const expired = connection ? connection.expiresAt.getTime() < Date.now() : false;
  const isConnected = Boolean(connection) && connection?.status === "connected" && !expired;

  return (
    <div className="relative">
      <div className="mb-6">
        <Link href="/admin/growth" className="text-[11px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1">
          <ArrowRightIcon className="h-3 w-3 rotate-180" />
          Back to Growth
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <CloudIcon className="h-4 w-4 text-violet-400" />
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">LinkedIn integration</p>
          <span className="text-[9px] font-mono uppercase tracking-wider text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-full px-2 py-0.5">
            internal-only
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          Connect, review, publish — with humans in the loop.
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          Uses LinkedIn's official OAuth 2.0 + Posts API. No scraping. No browser automation. Nothing publishes externally unless you connect LinkedIn, approve a draft, and enable posting via env.
        </p>
      </div>

      {/* Result banner from the OAuth round-trip */}
      {sp.connected === "1" && (
        <ResultBanner tone="ok" title="LinkedIn connected" detail="Token stored. You can now publish approved drafts." />
      )}
      {sp.error && (
        <ResultBanner tone="error" title="LinkedIn connect failed" detail={`Reason: ${sp.error}`} />
      )}

      {/* 1 · Configuration & connection */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-4">
        <header className="flex items-center gap-2 mb-3">
          <LinkIcon className="h-4 w-4 text-violet-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">Connection</p>
        </header>

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <StatusPill label="Env configured"     ok={configured} hint={configured ? "all env vars present" : `missing: ${missing.join(", ")}`} />
          <StatusPill label="Posting enabled"    ok={postingEnabled} hint={postingEnabled ? "LINKEDIN_POSTING_ENABLED=true" : "draft-only mode (set LINKEDIN_POSTING_ENABLED=true to publish)"} />
          <StatusPill label="Account connected"  ok={isConnected} hint={
            !connection ? "no connection row" :
            connection.status !== "connected" ? `status=${connection.status}` :
            expired ? "token expired — reconnect" : `as ${connection.linkedinName ?? connection.linkedinUrn}`
          } />
          <StatusPill label="Company page"       ok={Boolean(cfg.kind === "configured" && cfg.config.organizationId)} hint={
            cfg.kind === "configured" && cfg.config.organizationId
              ? `urn:li:organization:${cfg.config.organizationId}`
              : "personal feed only (set LINKEDIN_ORGANIZATION_ID for page posts)"
          } />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {configured ? (
            <a
              href="/api/admin/growth/linkedin/connect"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-100 border border-violet-500/30 hover:bg-violet-500/25"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              {isConnected ? "Reconnect LinkedIn" : "Connect LinkedIn"}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-zinc-700/30 text-zinc-300 border border-white/[0.08]">
              <ExclamationTriangleIcon className="h-3.5 w-3.5" />
              Set LinkedIn env vars to enable connect
            </span>
          )}
          {isConnected && (
            <form action="/api/admin/growth/linkedin/disconnect" method="post" className="inline">
              <button type="submit" className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-200 border border-rose-500/30 hover:bg-rose-500/20">
                Disconnect
              </button>
            </form>
          )}
        </div>

        {!configured && (
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
            <p className="text-[11px] text-amber-100/90 leading-relaxed">
              Add to <span className="font-mono text-amber-200">.env.local</span>:
            </p>
            <pre className="mt-2 text-[10.5px] font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap">
{`LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_REDIRECT_URI=https://<host>/api/admin/growth/linkedin/callback
LINKEDIN_ORGANIZATION_ID=         # optional, only for company-page posts
LINKEDIN_POSTING_ENABLED=false    # flip to true ONLY when you're ready`}
            </pre>
          </div>
        )}
      </section>

      {/* 2 · Draft queue */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-4">
        <header className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ClipboardDocumentIcon className="h-4 w-4 text-cyan-300" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">Draft queue · {drafts.length}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/growth/post-drafts"
              className="text-[11px] text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
            >
              All drafts <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
        </header>

        {drafts.length === 0 ? (
          <EmptyState
            title="No drafts yet"
            detail="Generate some on the content page or wait for the daily cron at /api/cron/linkedin-daily-drafts."
          />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {drafts.map((d) => (
              <DraftRow key={d.id} draft={d} isConnected={isConnected} postingEnabled={postingEnabled} />
            ))}
          </ul>
        )}
      </section>

      {/* 2.5 · Autopilot */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-4">
        <header className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              {autopilotPolicy.enabled && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />}
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${autopilotPolicy.enabled ? "bg-rose-300" : "bg-zinc-500"}`} />
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-300">
              Autopilot · {autopilotPolicy.enabled ? "ON" : "OFF"}
            </p>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              threshold {autopilotPolicy.confidenceThreshold} · {String(autopilotPolicy.postHourUtc).padStart(2, "0")}:00 UTC
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            Kill switch: <span className="text-rose-300">LINKEDIN_AUTOPILOT_ENABLED=false</span>
          </span>
        </header>

        {recentAutopilot.length === 0 ? (
          <EmptyState
            title="Autopilot hasn't run yet"
            detail="The daily cron writes one decision row per run. When it fires (weekdays 09:00 UTC), you'll see what it picked and why."
          />
        ) : (
          <ul className="space-y-2">
            {recentAutopilot.map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-3 text-[11.5px]">
                <div className="min-w-0">
                  <p className="text-zinc-200 truncate">
                    <span className="font-mono text-zinc-500">{d.ranAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                    {"  "}
                    {d.draftId && (
                      <>
                        draft <span className="font-mono text-zinc-400">{d.draftId.slice(0, 10)}</span>
                        {"  "}
                      </>
                    )}
                    {d.scheduledFor && (
                      <>
                        → posts <span className="text-violet-300 font-mono">{d.scheduledFor.toISOString().slice(0, 16).replace("T", " ")}</span>
                      </>
                    )}
                  </p>
                  {d.reason && <p className="text-zinc-500 mt-0.5 truncate">{d.reason}</p>}
                </div>
                <span className={`text-[9.5px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px shrink-0 ${autopilotChip(d.decision)}`}>
                  {d.decision}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3 · Publish runs */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-4">
        <header className="flex items-center gap-2 mb-3">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">Recent publish runs</p>
        </header>
        {recentRuns.length === 0 ? (
          <EmptyState title="No publish runs yet" detail="When the publisher runs (manual or cron), each attempt logs here." />
        ) : (
          <ul className="space-y-2">
            {recentRuns.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 text-[11.5px]">
                <div className="min-w-0">
                  <p className="text-zinc-200 truncate">
                    <span className="font-mono text-zinc-500">{r.startedAt.toISOString().slice(0, 19).replace("T", " ")}</span>
                    {"  "}
                    draft <span className="font-mono text-zinc-400">{r.draftId.slice(0, 10)}</span>
                    {"  "}
                    by <span className="font-mono text-zinc-400">{r.triggeredBy}</span>
                  </p>
                  {r.errorDetail && (
                    <p className="text-rose-300/90 mt-0.5 truncate">{r.errorDetail}</p>
                  )}
                </div>
                <span className={`text-[9.5px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px shrink-0 ${outcomeChip(r.outcome)}`}>
                  {r.outcome}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4 · Safety rules */}
      <section className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5">
        <header className="flex items-center gap-2 mb-2">
          <ShieldCheckIcon className="h-4 w-4 text-rose-300" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-300">Hard rules</p>
        </header>
        <ul className="text-[12.5px] text-rose-100/85 leading-relaxed space-y-1.5 list-disc list-inside marker:text-rose-400/80">
          <li>Official LinkedIn OAuth + Posts API only. No scraping, no DOM automation, no cookie hacks.</li>
          <li>Posting refuses to run unless <span className="font-mono text-rose-200">LINKEDIN_POSTING_ENABLED=true</span>.</li>
          <li>No automated DMs. No mass outreach. No publishing without an approved draft.</li>
          <li>Every action (connect / approve / schedule / publish / disconnect) writes a <span className="font-mono text-rose-200">GrowthAuditLog</span> row.</li>
        </ul>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local presentational components
// ---------------------------------------------------------------------------

function StatusPill({ label, ok, hint }: { label: string; ok: boolean; hint: string }) {
  return (
    <div className={`rounded-xl border p-3 ${ok ? "border-emerald-500/20 bg-emerald-500/[0.04]" : "border-amber-500/20 bg-amber-500/[0.04]"}`}>
      <div className="flex items-center gap-2 mb-0.5">
        {ok ? <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-300" /> : <ExclamationTriangleIcon className="h-3.5 w-3.5 text-amber-300" />}
        <p className={`text-[11px] font-semibold ${ok ? "text-emerald-200" : "text-amber-200"}`}>{label}</p>
      </div>
      <p className="text-[10.5px] text-zinc-400 leading-relaxed">{hint}</p>
    </div>
  );
}

function ResultBanner({ tone, title, detail }: { tone: "ok" | "error"; title: string; detail: string }) {
  const palette = tone === "ok"
    ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-100"
    : "border-rose-500/30 bg-rose-500/[0.06] text-rose-100";
  return (
    <div className={`rounded-xl border ${palette} p-3 mb-4`}>
      <p className="text-[12px] font-semibold">{title}</p>
      <p className="text-[11px] opacity-85 mt-0.5">{detail}</p>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="text-center py-6">
      <p className="text-[13px] font-semibold text-white mb-1">{title}</p>
      <p className="text-[11px] text-zinc-400 max-w-md mx-auto">{detail}</p>
    </div>
  );
}

function statusChip(s: string): string {
  if (s === "drafted")        return "text-cyan-300 bg-cyan-500/10 border-cyan-500/30";
  if (s === "in_review")      return "text-amber-300 bg-amber-500/10 border-amber-500/30";
  if (s === "approved")       return "text-emerald-300 bg-emerald-500/10 border-emerald-500/30";
  if (s === "scheduled")      return "text-violet-300 bg-violet-500/10 border-violet-500/30";
  if (s === "published")      return "text-emerald-200 bg-emerald-700/10 border-emerald-500/30";
  if (s === "rejected")       return "text-rose-300 bg-rose-500/10 border-rose-500/30";
  if (s === "failed")         return "text-rose-200 bg-rose-700/10 border-rose-500/40";
  return                            "text-zinc-300 bg-white/[0.04] border-white/[0.08]";
}

function outcomeChip(s: string): string {
  if (s === "success")              return "text-emerald-300 bg-emerald-500/10 border-emerald-500/30";
  if (s.startsWith("skipped"))      return "text-amber-300 bg-amber-500/10 border-amber-500/30";
  if (s === "failed")               return "text-rose-300 bg-rose-500/10 border-rose-500/30";
  return                                   "text-zinc-300 bg-white/[0.04] border-white/[0.08]";
}

function autopilotChip(s: string): string {
  if (s === "published" || s === "scheduled")  return "text-emerald-300 bg-emerald-500/10 border-emerald-500/30";
  if (s === "queued_for_review")               return "text-cyan-300 bg-cyan-500/10 border-cyan-500/30";
  if (s === "killed")                          return "text-rose-300 bg-rose-500/10 border-rose-500/30";
  if (s === "disabled")                        return "text-zinc-300 bg-white/[0.04] border-white/[0.08]";
  return                                              "text-amber-300 bg-amber-500/10 border-amber-500/30";
}

function DraftRow({
  draft, isConnected, postingEnabled,
}: {
  draft: { id: string; title: string; hook: string; body: string; cta: string | null; hashtags: string[]; status: string; scheduledFor: Date | null };
  isConnected: boolean;
  postingEnabled: boolean;
}) {
  const preview = (draft.hook || draft.body).slice(0, 180);
  const fullText = [draft.hook, draft.body, draft.cta ?? "", draft.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")].filter(Boolean).join("\n\n");
  // We can't run client JS without a "use client" wrapper, so the "Copy"
  // button is a server-rendered <a> that opens a `mailto:`-style helper
  // — we keep this server-only by linking to a dedicated copy-helper page.
  const canPublishNow = (draft.status === "approved" || draft.status === "scheduled") && isConnected && postingEnabled;

  return (
    <li className="py-3 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px whitespace-nowrap ${statusChip(draft.status)}`}>
            {draft.status}
          </span>
          {draft.scheduledFor && (
            <span className="text-[9.5px] font-mono uppercase tracking-wider text-zinc-500">
              scheduled · {draft.scheduledFor.toISOString().slice(0, 16).replace("T", " ")}
            </span>
          )}
        </div>
        <p className="text-[12.5px] text-zinc-200 leading-snug truncate">{preview}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Copy + Open LinkedIn fallback always available */}
        <a
          href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(fullText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-1 rounded-lg bg-white/[0.04] text-zinc-200 border border-white/[0.08] hover:bg-white/[0.08]"
          title="Open LinkedIn with this draft pre-filled"
        >
          <ArrowTopRightOnSquareIcon className="h-3 w-3" />
          Open LinkedIn
        </a>
        <Link
          href={`/admin/growth/post-drafts#${draft.id}`}
          className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-200 border border-cyan-500/20 hover:bg-cyan-500/15"
        >
          Review
        </Link>
        {canPublishNow && (
          <form action={`/api/admin/growth/drafts/${draft.id}/publish`} method="post" className="inline">
            <button type="submit" className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/25">
              Publish now
            </button>
          </form>
        )}
      </div>
    </li>
  );
}
