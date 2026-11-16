import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";
import { SITE_URL } from "@/lib/seo";
import { PageHero } from "@/components/marketing/PageHero";

export const metadata: Metadata = {
  title: "Press and brand — Vision XIX Labs",
  description: "Approved V19 description, links, and brand assets.",
  alternates: { canonical: `${SITE_URL}/press` },
};

export default function PressPage() {
  return (
    <div className="axiom-canvas min-h-screen bg-[#0a0908] text-zinc-100">
      <Navigation />
      <main className="public-reading-marketing-page">
        <PageHero
          eyebrow="Press and brand"
          title="Describe V19"
          muted="accurately."
          lead={<>Use the language and assets below. Product availability should always
            follow the current download and integration pages.</>}
        />

        <div className="mt-16 divide-y divide-white/8 border-y border-white/8">
          <section className="grid gap-5 py-8 md:grid-cols-[220px_1fr]">
            <h2 className="text-lg font-medium">Approved description</h2>
            <p className="max-w-2xl text-sm leading-7 text-zinc-400">
              V19 is a desktop-first deployment-governance workspace that
              turns plain-English requests into risk-checked, approval-gated,
              auditable repository and deployment actions.
            </p>
          </section>
          <section className="grid gap-5 py-8 md:grid-cols-[220px_1fr]">
            <h2 className="text-lg font-medium">Canonical links</h2>
            <div className="space-y-2 text-sm">
              <p><Link href="/" className="text-zinc-300 underline decoration-white/20 underline-offset-4 hover:text-white">{SITE_URL}</Link></p>
              <p><Link href="/product" className="text-zinc-300 underline decoration-white/20 underline-offset-4 hover:text-white">{SITE_URL}/product</Link></p>
              <p><Link href="/download" className="text-zinc-300 underline decoration-white/20 underline-offset-4 hover:text-white">{SITE_URL}/download</Link></p>
            </div>
          </section>
          <section className="grid gap-5 py-8 md:grid-cols-[220px_1fr]">
            <h2 className="text-lg font-medium">Logo</h2>
            <div className="flex items-center gap-5">
              <Image src="/vision-xix-logo.png" alt="Vision XIX Labs" width={72} height={72} className="rounded-2xl" />
              <p className="text-sm leading-6 text-zinc-500">
                Keep clear space around the mark. Do not recolor, distort, or
                imply certification or partnership.
              </p>
            </div>
          </section>
          <section className="grid gap-5 py-8 md:grid-cols-[220px_1fr]">
            <h2 className="text-lg font-medium">Product boundary</h2>
            <p className="max-w-2xl text-sm leading-7 text-zinc-400">
              Do not describe V19 as an autonomous multi-cloud operator. The
              released production path is approval-gated GitHub and AWS ECS
              delivery, with additional integrations identified by their actual
              connection status.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
