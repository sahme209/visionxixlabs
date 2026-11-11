import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";
import { FAQ_GROUPS } from "@/lib/support/faqData";

export const metadata: Metadata = {
  title: "FAQ — Axiom Documentation",
  description: "Frequently asked questions about Axiom Agent — cloud connections, scanning, execution, approvals, ReleaseOps, desktop, pricing, and security.",
};

export default function FaqPage() {
  return (
    <>
      <DocHeader
        kicker="Reference · FAQ"
        title="Frequently asked questions."
        summary="The questions we see most often, grouped by topic. If something isn't answered here, the troubleshooting guide or product documentation usually has the answer."
      />

      {FAQ_GROUPS.map((group) => (
        <DocSection key={group.title} id={group.title.toLowerCase().replace(/\s+/g, "-")} title={group.title}>
          <div className="space-y-3">
            {group.items.map((item) => (
              <details key={item.q} className="rounded-xl bg-white/2 border border-white/6 p-4 group">
                <summary className="cursor-pointer flex items-center justify-between gap-3 text-sm font-semibold text-white hover:text-orange-300 transition-colors list-none">
                  <span>{item.q}</span>
                  <svg className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>
                <p className="text-sm text-zinc-400 leading-relaxed mt-3">{item.a}</p>
              </details>
            ))}
          </div>
        </DocSection>
      ))}

      <DocSection id="more" title="Need a specific answer?">
        <p className="text-zinc-400">
          See <Link href="/docs/troubleshooting" className="text-orange-300 hover:text-orange-200">troubleshooting</Link> for connection errors,
          review the <Link href="/plans" className="text-orange-300 hover:text-orange-200">plan proposal</Link>, or open the in-product documentation from the desktop app.
        </p>
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/troubleshooting", label: "Troubleshooting" }}
        next={{ href: "/docs/glossary", label: "Glossary" }}
      />
      <DocFeedback />
    </>
  );
}
