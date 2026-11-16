/**
 * /blog — the public product and engineering journal.
 *
 * Featured post pinned at the top with a hero card, then a category tab
 * row, then a list of remaining posts. Server-rendered from
 * `lib/blog/posts.ts`.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { PageHero } from "@/components/marketing/PageHero";
import { Footer } from "@/components/Footer";
import { getAllPosts, listCategories } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "Blog | Vision XIX Labs",
  description: "Product updates, engineering essays, trust & security notes from the V19 team.",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const CAT_TONE: Record<string, string> = {
  "Product Updates":    "text-zinc-300",
  "Engineering":        "text-zinc-300",
  "Industry Insights":  "text-zinc-400",
  "Trust & Security":   "text-zinc-300",
};

export default function BlogIndex() {
  const all = getAllPosts();
  const featured = all.find((p) => p.featured) ?? all[0];
  const rest = all.filter((p) => p.slug !== featured.slug);
  const categories = listCategories();

  return (
    <div className="axiom-canvas min-h-screen text-white relative">
      <Navigation />

      <main className="relative mx-auto max-w-[1240px] px-5 pb-24 pt-32 sm:px-10">
        <PageHero
          eyebrow="Blog"
          title="Product and engineering"
          muted="notes from V19."
          lead="Product updates, engineering essays, and trust + security notes from the team building V19 Agent."
        />
        <div className="h-12 sm:h-16" aria-hidden="true" />

        {/* Featured */}
        <section className="mb-20">
          <Link
            href={`/blog/${featured.slug}`}
            className="group block relative rounded-xl border border-white/[0.07] bg-[var(--public-surface)] p-8 md:p-12 overflow-hidden hover:border-white/20 transition-all"
          >

            <div className="relative grid lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7">
                <div className="flex flex-wrap items-center gap-3 mb-4 text-xs font-mono uppercase tracking-[0.18em]">
                  <span className={CAT_TONE[featured.category] ?? "text-zinc-400"}>{featured.category}</span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-zinc-400">{fmtDate(featured.publishedAt)}</span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-zinc-400">{featured.readMinutes} min read</span>
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-[-0.04em] leading-[1.05] mb-4 group-hover:text-white transition-colors">
                  {featured.title}
                </h2>
                <p className="text-base text-zinc-400 leading-relaxed mb-6 max-w-2xl">
                  {featured.excerpt}
                </p>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 group-hover:text-white transition-colors">
                  Read more →
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="rounded-xl border border-white/8 bg-axiom-bg-elev/60 p-6 relative overflow-hidden">
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold">
                        {featured.author.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{featured.author.name}</p>
                        <p className="text-xs text-zinc-400">{featured.author.role}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs font-mono text-zinc-400">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>slug</span>
                        <span className="min-w-0 break-words text-zinc-300">{featured.slug}</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>category</span>
                        <span className={CAT_TONE[featured.category]}>{featured.category}</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
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
            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-zinc-300 text-xs font-semibold">All posts</span>
            {categories.map((cat) => (
              <span key={cat} className="inline-flex items-center px-3 py-1.5 rounded-full border border-white/6 bg-white/2 text-zinc-400 text-xs font-medium">
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
              className="group block rounded-xl border border-white/6 bg-white/1.5 p-6 hover:border-white/20 hover:bg-white/2.5 transition-all"
            >
              <div className="flex flex-wrap items-center gap-3 mb-3 text-xs font-mono uppercase tracking-[0.18em]">
                <span className={CAT_TONE[post.category] ?? "text-zinc-400"}>{post.category}</span>
                <span className="text-zinc-700">·</span>
                <span className="text-zinc-400">{fmtDate(post.publishedAt)}</span>
              </div>
              <h3 className="text-xl font-bold tracking-[-0.03em] leading-snug mb-3 group-hover:text-white transition-colors">
                {post.title}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4 line-clamp-3">
                {post.excerpt}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-bold text-white">
                    {post.author.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                  </div>
                  <span className="text-zinc-400">{post.author.name}</span>
                </div>
                <span className="text-zinc-400 font-mono">{post.readMinutes} min</span>
              </div>
            </Link>
          ))}
        </section>
      </main>

      <Footer />
    </div>
  );
}
