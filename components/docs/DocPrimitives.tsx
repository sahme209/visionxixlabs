import type { ReactNode } from "react";
import Link from "next/link";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  LightBulbIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";

type CalloutVariant = "info" | "safe" | "warning" | "tip";

const CALLOUT_CONFIG: Record<
  CalloutVariant,
  { icon: typeof InformationCircleIcon; iconClass: string; bgClass: string; borderClass: string; labelClass: string; label: string }
> = {
  info: { icon: InformationCircleIcon, iconClass: "text-blue-400", bgClass: "bg-blue-500/[0.04]", borderClass: "border-blue-500/15", labelClass: "text-blue-400", label: "Info" },
  safe: { icon: ShieldCheckIcon, iconClass: "text-emerald-400", bgClass: "bg-emerald-500/[0.04]", borderClass: "border-emerald-500/15", labelClass: "text-emerald-400", label: "Safe by default" },
  warning: { icon: ExclamationTriangleIcon, iconClass: "text-amber-400", bgClass: "bg-amber-500/[0.04]", borderClass: "border-amber-500/15", labelClass: "text-amber-400", label: "Heads up" },
  tip: { icon: LightBulbIcon, iconClass: "text-violet-400", bgClass: "bg-violet-500/[0.04]", borderClass: "border-violet-500/15", labelClass: "text-violet-400", label: "Tip" },
};

/** Inline trust/info/warning/tip callout used throughout docs. */
export function Callout({
  variant = "info",
  title,
  children,
}: {
  variant?: CalloutVariant;
  title?: string;
  children: ReactNode;
}) {
  const c = CALLOUT_CONFIG[variant];
  const Icon = c.icon;
  return (
    <div className={`rounded-xl border ${c.borderClass} ${c.bgClass} p-4 my-5`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-4 w-4 ${c.iconClass} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-semibold ${c.labelClass} uppercase tracking-wider mb-1`}>
            {title ?? c.label}
          </p>
          <div className="text-sm text-zinc-300 leading-relaxed [&_a]:text-white [&_a]:underline [&_a:hover]:text-violet-300 [&_code]:font-mono [&_code]:text-[12px] [&_code]:bg-black/40 [&_code]:border [&_code]:border-white/[0.06] [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Section block with anchored h2 heading. */
export function DocSection({ id, title, kicker, children }: { id?: string; title: string; kicker?: string; children: ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-24">
      {kicker && (
        <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest mb-2">{kicker}</p>
      )}
      <h2 className="text-2xl md:text-3xl font-bold text-white tracking-[-0.04em] mb-5">
        {title}
      </h2>
      <div className="space-y-4 text-zinc-300 leading-relaxed">{children}</div>
    </section>
  );
}

/** A step number + title + body, for procedural docs. */
export function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <div className="relative pl-12 mb-6">
      <div className="absolute left-0 top-0 w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center font-mono font-bold text-sm text-violet-400">
        {number}
      </div>
      <h3 className="text-base font-bold text-white mb-2 mt-0.5">{title}</h3>
      <div className="text-sm text-zinc-400 leading-relaxed space-y-3 [&_p]:leading-relaxed">{children}</div>
    </div>
  );
}

/** Mono code block for shell snippets or config examples. */
export function CodeBlock({ language, children }: { language?: string; children: string }) {
  return (
    <pre className="rounded-lg bg-black/40 border border-white/[0.06] p-4 overflow-x-auto text-[12px] leading-relaxed text-zinc-200 my-4">
      {language && (
        <span className="block text-[9px] text-zinc-600 uppercase tracking-widest mb-2 font-sans not-italic">
          {language}
        </span>
      )}
      <code className="font-mono whitespace-pre">{children}</code>
    </pre>
  );
}

/** Standard top of every doc page — kicker, title, summary. */
export function DocHeader({
  kicker,
  title,
  summary,
}: {
  kicker?: string;
  title: string;
  summary: string;
}) {
  return (
    <header className="mb-10">
      {kicker && (
        <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest mb-3">
          {kicker}
        </p>
      )}
      <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.04em] mb-4">
        {title}
      </h1>
      <p className="text-lg text-zinc-400 leading-relaxed max-w-3xl">{summary}</p>
    </header>
  );
}

/** Trust-question grid that appears on most product flow docs. */
export function TrustGrid({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-3 my-6">
      {items.map((item) => (
        <div key={item.question} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
            <CheckCircleIcon className="h-3 w-3" />
            {item.question}
          </p>
          <p className="text-sm text-zinc-300 leading-relaxed">{item.answer}</p>
        </div>
      ))}
    </div>
  );
}

/** Bottom-of-page navigation showing previous and next doc pages. */
export function DocFooterNav({
  prev,
  next,
}: {
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
}) {
  return (
    <nav aria-label="Documentation pagination" className="mt-16 pt-6 border-t border-white/[0.06] grid sm:grid-cols-2 gap-3">
      {prev ? (
        <Link
          href={prev.href}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.12] hover:bg-white/[0.03] transition-all group"
        >
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1 inline-flex items-center gap-1.5">
            <ArrowLeftIcon className="h-3 w-3" /> Previous
          </p>
          <p className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">
            {prev.label}
          </p>
        </Link>
      ) : <span />}
      {next ? (
        <Link
          href={next.href}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.12] hover:bg-white/[0.03] transition-all group text-right sm:text-right"
        >
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1 inline-flex items-center gap-1.5 justify-end w-full">
            Next <ArrowRightIcon className="h-3 w-3" />
          </p>
          <p className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">
            {next.label}
          </p>
        </Link>
      ) : <span />}
    </nav>
  );
}

/** Bottom "Was this page helpful?" + contact card. */
export function DocFeedback() {
  return (
    <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-between flex-wrap gap-3">
      <div>
        <p className="text-sm font-semibold text-white mb-0.5">Need a human?</p>
        <p className="text-xs text-zinc-500">Most flows are documented — but we&apos;ll help if anything is unclear.</p>
      </div>
      <Link
        href="/contact"
        className="inline-flex items-center gap-2 px-4 py-2 border border-white/[0.1] text-zinc-300 rounded-full text-xs font-semibold hover:bg-white/5 hover:border-white/20 transition-colors"
      >
        Talk to Vision XIX Labs
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
