/**
 * /blog/[slug] — single post detail. Server-rendered.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { getPostBySlug, getAllPosts } from "@/lib/blog/posts";

interface Params { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Post not found" };
  return {
    title: `${post.title} | Vision XIX Labs Blog`,
    description: post.excerpt,
  };
}

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const CAT_TONE: Record<string, string> = {
  "Product Updates":    "text-amber-300",
  "Engineering":        "text-violet-300",
  "Industry Insights":  "text-cyan-300",
  "Trust & Security":   "text-emerald-300",
};

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const others = getAllPosts().filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-violet-500/[0.05] blur-[160px]" />
      </div>

      <Navigation />

      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        {/* Back link */}
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-[12px] font-mono text-zinc-500 hover:text-violet-300 transition-colors mb-10">
          ← Back to blog
        </Link>

        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-5 text-[11px] font-mono uppercase tracking-[0.18em]">
            <span className={CAT_TONE[post.category] ?? "text-zinc-400"}>{post.category}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-500">{fmtDate(post.publishedAt)}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-500">{post.readMinutes} min read</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-[-0.04em] leading-[1.05] mb-6">
            {post.title}
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed mb-8">
            {post.excerpt}
          </p>
          <div className="flex items-center gap-3 pb-8 border-b border-white/[0.06]">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-sm font-bold">
              {post.author.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{post.author.name}</p>
              <p className="text-xs text-zinc-500">{post.author.role}</p>
            </div>
          </div>
        </header>

        {/* Body */}
        <article className="prose prose-invert max-w-none">
          {post.body.map((block, i) => {
            if (block.startsWith("## ")) {
              return (
                <h2 key={i} className="text-2xl font-bold tracking-tight text-white mt-12 mb-4">
                  {block.replace(/^##\s+/, "")}
                </h2>
              );
            }
            if (block.startsWith("### ")) {
              return (
                <h3 key={i} className="text-lg font-bold tracking-tight text-white mt-8 mb-3">
                  {block.replace(/^###\s+/, "")}
                </h3>
              );
            }
            return (
              <p key={i} className="text-[15.5px] leading-[1.75] text-zinc-300 mb-5">
                {block.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((seg, j) => {
                  if (seg.startsWith("**") && seg.endsWith("**")) {
                    return <strong key={j} className="text-white font-semibold">{seg.slice(2, -2)}</strong>;
                  }
                  if (seg.startsWith("`") && seg.endsWith("`")) {
                    return <code key={j} className="px-1.5 py-0.5 rounded bg-white/[0.06] text-violet-300 text-[13px] font-mono">{seg.slice(1, -1)}</code>;
                  }
                  return <span key={j}>{seg}</span>;
                })}
              </p>
            );
          })}
        </article>

        {/* CTA */}
        <section className="mt-16 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/[0.05] to-cyan-500/[0.05] p-8 text-center">
          <p className="text-xs font-mono text-violet-300 uppercase tracking-[0.22em] mb-3">// try axiom</p>
          <h3 className="text-2xl font-bold tracking-tight mb-3">Run the autonomous cloud operating system.</h3>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto mb-6">
            Open the web app or download the signed desktop binaries for macOS, Windows, and Linux. No demo call required.
          </p>
          <div className="inline-flex gap-3 flex-wrap justify-center">
            <Link href="/dashboard" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-sm font-semibold shadow-[0_0_24px_rgba(139,92,246,0.4)]">
              Open web app
            </Link>
            <Link href="/download" className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-white/[0.12] bg-white/[0.03] hover:bg-white/[0.06] text-zinc-200 text-sm font-semibold">
              Download desktop
            </Link>
          </div>
        </section>

        {/* Other posts */}
        {others.length > 0 && (
          <section className="mt-20">
            <p className="text-[10px] font-mono text-violet-400 uppercase tracking-[0.22em] mb-5">// keep reading</p>
            <div className="grid sm:grid-cols-3 gap-3">
              {others.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group block rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 hover:border-violet-500/30 transition-all"
                >
                  <div className="flex items-center gap-2 mb-2 text-[9px] font-mono uppercase tracking-[0.18em]">
                    <span className={CAT_TONE[p.category]}>{p.category}</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-zinc-500">{p.readMinutes} min</span>
                  </div>
                  <p className="text-sm font-semibold text-white leading-snug group-hover:text-violet-100 transition-colors">
                    {p.title}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
