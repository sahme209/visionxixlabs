"use client";

/**
 * Credibility belongs to inspectable product evidence, not invented logos or
 * attributed quotations. These cards link to public, reproducible surfaces.
 */

import { motion } from "framer-motion";
import Link from "next/link";

const EVIDENCE = [
  {
    title: "Public release history",
    body: "Installer filenames, platform targets, publication dates, checksums, and detached signatures are visible on the release record.",
    href: "https://github.com/sahme209/axiom-releases/releases",
    label: "Inspect releases",
    tone: "from-indigo-500/20 to-transparent border-indigo-500/30",
    external: true,
  },
  {
    title: "Isolated workflow sandbox",
    body: "Explore fictional deployment records without cloud credentials, production connections, or private tenant data.",
    href: "/demo",
    label: "Explore the sandbox",
    tone: "from-fuchsia-500/20 to-transparent border-fuchsia-500/30",
    external: false,
  },
  {
    title: "Documented operating model",
    body: "Review installation, permissions, workflow boundaries, and known limitations before connecting an environment.",
    href: "/docs",
    label: "Read documentation",
    tone: "from-cyan-500/20 to-transparent border-cyan-500/30",
    external: false,
  },
] as const;

export function SocialProofRail() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-16 md:px-10" aria-labelledby="product-evidence-heading">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Product evidence</p>
        <h2 id="product-evidence-heading" className="mt-3 text-2xl font-semibold tracking-tight text-white">
          Verify the product before you trust the claim.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          No customer logos, testimonials, adoption figures, or certifications are presented without documented permission and evidence.
        </p>
      </motion.div>

      <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
        {EVIDENCE.map((item, index) => (
          <motion.article
            key={item.title}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.18) }}
            className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 md:p-6 ${item.tone}`}
          >
            <h3 className="text-sm font-semibold text-white">{item.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">{item.body}</p>
            {item.external ? (
              <a href={item.href} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex text-xs font-medium text-violet-200 hover:text-white">
                {item.label} →
              </a>
            ) : (
              <Link href={item.href} className="mt-5 inline-flex text-xs font-medium text-violet-200 hover:text-white">
                {item.label} →
              </Link>
            )}
          </motion.article>
        ))}
      </div>
    </section>
  );
}
