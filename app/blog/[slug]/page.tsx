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
  "Product Updates":    "text-zinc-300",
  "Engineering":        "text-zinc-300",
  "Industry Insights":  "text-zinc-400",
  "Trust & Security":   "text-zinc-300",
};

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const others = getAllPosts().filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="axiom-canvas min-h-screen text-white relative">
      <Navigation />

      <main className="relative mx-auto max-w-[1240px] px-5 pt-32 pb-20 sm:px-10">
        {/* Back link */}
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-[12px] font-mono text-zinc-400 hover:text-white transition-colors mb-10">
          ← Back to blog
        </Link>

        {/* Article header */}
        <header className="mx-auto mb-12 max-w-[70ch]">
          <div className="flex flex-wrap items-center gap-3 mb-5 text-xs font-mono uppercase tracking-[0.18em]">
            <span className={CAT_TONE[post.category] ?? "text-zinc-400"}>{post.category}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-400">{fmtDate(post.publishedAt)}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-400">{post.readMinutes} min read</span>
          </div>
          <h1 className="text-[clamp(2.5rem,4.2vw,3.5rem)] font-normal tracking-[-0.045em] leading-[1.05] mb-6 [overflow-wrap:anywhere]">
            {post.title}
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed mb-8">
            {post.excerpt}
          </p>
          <div className="flex items-center gap-3 pb-8 border-b border-white/6">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold">
              {post.author.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{post.author.name}</p>
              <p className="text-xs text-zinc-400">{post.author.role}</p>
            </div>
          </div>
        </header>

        {/* Body */}
        <article className="article-body mx-auto max-w-[70ch] [overflow-wrap:anywhere]">
          {post.body.map((block, i) => {
            if (block.startsWith("## ")) {
              return (
                <h2 key={i} className="text-2xl font-medium tracking-tight text-white mt-12 mb-4">
                  {block.replace(/^##\s+/, "")}
                </h2>
              );
            }
            if (block.startsWith("### ")) {
              return (
                <h3 key={i} className="text-lg font-medium tracking-tight text-white mt-8 mb-3">
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
                    return <code key={j} className="px-1.5 py-0.5 rounded-sm bg-white/6 text-zinc-300 text-[13px] font-mono">{seg.slice(1, -1)}</code>;
                  }
                  return <span key={j}>{seg}</span>;
                })}
              </p>
            );
          })}
        </article>

        {/* Product CTA */}
        <section className="mx-auto mt-16 max-w-[70ch] rounded-xl border border-white/8 bg-[var(--public-surface)] p-6 text-center sm:p-10">
          <p className="mono-label inline-flex items-center gap-3 mb-4">
            <span className="text-zinc-400 tabular-nums">AX</span>
            Try V19
          </p>
          <h3 className="text-2xl md:text-3xl font-medium mb-3 leading-[1.04]">
            <span className="relative inline-block">
              See the governed desktop workflow.
            </span>
          </h3>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto mb-6">
            Explore a scripted, clearly labeled workflow or download the current
            desktop release. Live actions remain approval-gated.
          </p>
          <div className="inline-flex gap-3 flex-wrap justify-center">
            <Link href="/demo" className="public-feature-action">
              Explore web demo
            </Link>
            <Link href="/download" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-medium tracking-tight hover:bg-white/5">
              Download desktop
            </Link>
          </div>
        </section>

        {/* Other posts */}
        {others.length > 0 && (
          <section className="mt-20">
            <p className="mono-label inline-flex items-center gap-3 mb-6">
              <span className="text-zinc-400 tabular-nums">→</span>
              Keep reading
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              {others.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group block rounded-xl border border-white/8 bg-[var(--public-surface)] p-5 hover:border-white/20 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2 text-xs font-mono uppercase tracking-[0.18em]">
                    <span className={CAT_TONE[p.category]}>{p.category}</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-zinc-400">{p.readMinutes} min</span>
                  </div>
                  <p className="text-sm font-semibold text-white leading-snug group-hover:text-white transition-colors">
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
