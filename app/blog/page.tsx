/**
 * /blog — the public blog index, Huly-style.
 *
 * Featured post pinned at the top with a hero card, then a category tab
 * row, then a list of remaining posts. Server-rendered from
 * `lib/blog/posts.ts`.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { getAllPosts, listCategories } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "Blog | Vision XIX Labs",
  description: "Product updates, engineering essays, trust & security notes from the Axiom Agent team.",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const CAT_TONE: Record<string, string> = {
  "Product Updates":    "text-zinc-300",
  "Engineering":        "text-violet-300",
  "Industry Insights":  "text-cyan-300",
  "Trust & Security":   "text-emerald-300",
};

export default function BlogIndex() {
  const all = getAllPosts();
  const featured = all.find((p) => p.featured) ?? all[0];
  const rest = all.filter((p) => p.slug !== featured.slug);
  const categories = listCategories();

  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      {/* Coral × violet × cyan aurora — Huly atmosphere */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="ambient-drift absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-brand-violet/[0.07] blur-[160px]" />
        <div className="ambient-drift absolute top-[20%] -right-40 w-[520px] h-[460px] rounded-full bg-brand-coral/[0.06] blur-[140px]" style={{ animationDelay: "-9s" }} />
        <div className="ambient-drift absolute top-[60%] -left-40 w-[420px] h-[340px] rounded-full bg-cyan-500/[0.04] blur-[120px]" style={{ animationDelay: "-15s" }} />
      </div>

      <Navigation />

      <main className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24">
        {/* Page header — Huly numbered + coral underline */}
        <header className="mb-16">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-4 inline-flex items-center gap-3">
            <span className="text-brand-coral/90 tabular-nums">B1</span>
            <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
            Blog
          </p>
          <h1 className="text-5xl md:text-6xl font-bold tracking-[-0.045em] leading-[1.05] mb-4">
            Building the autonomous
            <br />
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-brand-coral via-fuchsia-400 to-brand-violet bg-clip-text text-transparent">
                cloud operating system.
              </span>
              <span aria-hidden className="absolute left-0 -bottom-1 h-[3px] w-[92%] rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400 to-transparent opacity-80" />
            </span>
          </h1>
          <p className="text-base md:text-lg text-zinc-400 max-w-2xl leading-relaxed">
            Product updates, engineering essays, and trust + security notes from the team building Axiom Agent.
          </p>
        </header>

        {/* Featured */}
        <section className="mb-20">
          <Link
            href={`/blog/${featured.slug}`}
            className="group block relative rounded-3xl border border-white/[0.07] bg-gradient-to-br from-[#0d0d12] via-[#0a0a0f] to-[#08080c] p-8 md:p-12 overflow-hidden hover:border-violet-500/30 transition-all"
          >
            <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-violet-500/15 blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-32 -left-32 w-72 h-72 rounded-full bg-fuchsia-500/10 blur-[120px] pointer-events-none" />

            <div className="relative grid lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7">
                <div className="flex items-center gap-3 mb-4 text-[11px] font-mono uppercase tracking-[0.18em]">
                  <span className={CAT_TONE[featured.category] ?? "text-zinc-400"}>{featured.category}</span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-zinc-500">{fmtDate(featured.publishedAt)}</span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-zinc-500">{featured.readMinutes} min read</span>
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-[-0.04em] leading-[1.05] mb-4 group-hover:text-violet-100 transition-colors">
                  {featured.title}
                </h2>
                <p className="text-base text-zinc-400 leading-relaxed mb-6 max-w-2xl">
                  {featured.excerpt}
                </p>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-violet-300 group-hover:text-white transition-colors">
                  Read more →
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-white/[0.08] bg-axiom-bg-elev/60 p-6 relative overflow-hidden">
                  <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-violet-500/20 blur-[40px] pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-sm font-bold">
                        {featured.author.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{featured.author.name}</p>
                        <p className="text-[11px] text-zinc-500">{featured.author.role}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-[11px] font-mono text-zinc-500">
                      <div className="flex items-center justify-between">
                        <span>slug</span>
                        <span className="text-zinc-300">{featured.slug}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>category</span>
                        <span className={CAT_TONE[featured.category]}>{featured.category}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>published</span>
                        <span className="text-zinc-300">{fmtDate(featured.publishedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </section>

        {/* Category tabs */}
        <section className="mb-10">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-200 text-xs font-semibold">All posts</span>
            {categories.map((cat) => (
              <span key={cat} className="inline-flex items-center px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] text-zinc-400 text-xs font-medium">
                {cat}
              </span>
            ))}
          </div>
        </section>

        {/* Remaining posts grid */}
        <section className="grid md:grid-cols-2 gap-5">
          {rest.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 hover:border-violet-500/30 hover:bg-white/[0.025] transition-all"
            >
              <div className="flex items-center gap-3 mb-3 text-[10px] font-mono uppercase tracking-[0.18em]">
                <span className={CAT_TONE[post.category] ?? "text-zinc-400"}>{post.category}</span>
                <span className="text-zinc-700">·</span>
                <span className="text-zinc-500">{fmtDate(post.publishedAt)}</span>
              </div>
              <h3 className="text-xl font-bold tracking-[-0.03em] leading-snug mb-3 group-hover:text-violet-100 transition-colors">
                {post.title}
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed mb-4 line-clamp-3">
                {post.excerpt}
              </p>
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500/40 to-fuchsia-500/40 flex items-center justify-center text-[9px] font-bold text-white">
                    {post.author.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                  </div>
                  <span className="text-zinc-400">{post.author.name}</span>
                </div>
                <span className="text-zinc-500 font-mono">{post.readMinutes} min</span>
              </div>
            </Link>
          ))}
        </section>
      </main>

      <Footer />
    </div>
  );
}
