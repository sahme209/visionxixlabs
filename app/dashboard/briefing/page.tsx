/**
 * /dashboard/briefing — your daily briefing.
 *
 * Auto-narrated summary of the tenant's last 24h, composed from real
 * data in the canonical tables. No LLM, no templates — the composer
 * walks the data and emits structured paragraphs with embedded
 * entity links the operator can drill into.
 *
 * The page is intentionally calm and one-column. Read it like a memo;
 * click any cited number to drill in.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentContext } from "@/lib/auth/currentContext";
import { composeDailyBriefing, type BriefingParagraph } from "@/lib/briefing/composeBriefing";

export const dynamic = "force-dynamic";

const CHIP_TONE: Record<NonNullable<BriefingParagraph["chip"]>["tone"], string> = {
  emerald: "text-emerald-300 border-emerald-500/30",
  amber:   "text-amber-300 border-amber-500/30",
  rose:    "text-rose-300 border-rose-500/30",
  neutral: "text-zinc-400 border-white/[0.10]",
};

/** Render `**bold**` and `[label](href)` markers without pulling a Markdown lib. */
function renderInline(body: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > i) nodes.push(body.slice(i, m.index));
    if (m[1] != null) {
      nodes.push(
        <strong key={`b${m.index}`} className="font-semibold text-white">{m[1]}</strong>,
      );
    } else if (m[2] != null && m[3] != null) {
      const href = m[3];
      const isExternal = /^https?:\/\//.test(href);
      nodes.push(
        isExternal ? (
          <a key={`l${m.index}`} href={href} className="text-zinc-200 underline-offset-2 hover:underline hover:text-white transition-colors">
            {m[2]}
          </a>
        ) : (
          <Link key={`l${m.index}`} href={href} className="text-zinc-200 underline-offset-2 hover:underline hover:text-white transition-colors">
            {m[2]}
          </Link>
        ),
      );
    }
    i = m.index + m[0].length;
  }
  if (i < body.length) nodes.push(body.slice(i));
  return nodes;
}

export default async function BriefingPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/briefing");
  }

  const briefing = await composeDailyBriefing(ctx.organizationId);
  const generatedAt = new Date(briefing.generatedAt);

  return (
    <div className="max-w-2xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">briefing</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          The last 24 hours, in prose.
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Composed from your canonical tables — no LLM, no fluff. Every
          number is a deep-link to the surface that explains it.
        </p>
        <p className="text-[11px] font-mono text-zinc-600 mt-3">
          Generated {generatedAt.toISOString()}
        </p>
      </header>

      {briefing.partial && (
        <div className="mb-8 rounded-2xl border border-amber-500/15 bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-300 mb-1">partial data</p>
          <p className="text-[13px] text-zinc-300">
            One or more canonical tables couldn&apos;t be read for this window.
            The paragraphs below reflect the data we could load.
          </p>
        </div>
      )}

      <article className="space-y-9">
        {briefing.paragraphs.map((p) => (
          <section key={p.id}>
            <div className="flex items-baseline gap-3 mb-3 flex-wrap">
              <h2 className="text-[18px] font-semibold text-white tracking-[-0.01em]">{p.title}</h2>
              {p.chip && (
                <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${CHIP_TONE[p.chip.tone]}`}>
                  {p.chip.label}
                </span>
              )}
            </div>
            <p className="text-[14px] text-zinc-400 leading-[1.7]">
              {renderInline(p.body)}
            </p>
          </section>
        ))}
      </article>
    </div>
  );
}
