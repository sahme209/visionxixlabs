/**
 * /admin/growth/launch-kit — internal-only.
 *
 * The "I'm an AI, c'mon" page. Everything you'd manually paste into
 * X.com + the axiom-releases repo, ready to copy in one click.
 *
 * - X.com bio (160-char limit honored)
 * - X.com pinned tweet
 * - First 12 tweets to schedule
 * - LICENSE.md content for the axiom-releases repo (source-available)
 * - README.md content for the axiom-releases repo
 *
 * Click "Copy" on any block. Done.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import { CopyButton } from "./CopyButton";

export const metadata: Metadata = {
  title: "Launch kit · VisionXIXLabs internal",
  description: "X.com brand kit + axiom-releases repo templates. Internal-only.",
};

export const dynamic = "force-dynamic";

// ─── X.com brand kit ─────────────────────────────────────────────────

const X_BIO_160 =
  "Vision XIX Labs · AI cloud operations agent. Scan, reason, plan, execute — with human approval at every step. Approval-only-no-execution. visionxixlabs.com";

const X_LOCATION = "New York";
const X_WEBSITE = "visionxixlabs.com";
const X_DISPLAY_NAME = "Vision XIX Labs";

const X_PINNED_TWEET =
  "We built an AI that operates clouds the way a careful engineer would.\n\n" +
  "It scans your AWS / Azure / GCP. Reasons about what to fix. Drafts a Terraform plan with a verified rollback. Asks you to approve.\n\n" +
  "Approval-only. No execution. Every action audited.\n\n" +
  "visionxixlabs.com";

const FIRST_TWEETS: ReadonlyArray<{ idx: string; category: string; body: string }> = [
  {
    idx: "01",
    category: "Manifesto",
    body:
      "Seven things we believe about AI-assisted cloud operations:\n\n" +
      "1. Humans approve. Always.\n" +
      "2. Closed-union types > runtime checks.\n" +
      "3. Honesty is the first feature.\n" +
      "4. Audit is not optional.\n" +
      "5. Bounded blast radius.\n" +
      "6. Repetition refined into a system.\n" +
      "7. Connect once. Stay connected.\n\n" +
      "visionxixlabs.com/manifesto",
  },
  {
    idx: "02",
    category: "Product",
    body:
      "Axiom scans your cloud, reasons about what to fix, generates an execution plan, and asks for approval.\n\n" +
      "It does NOT auto-deploy. It does NOT auto-rollback. It does NOT phone home asking for more access than the IAM role you set up on day one.\n\n" +
      "AI that respects your production. visionxixlabs.com",
  },
  {
    idx: "03",
    category: "Thought leadership",
    body:
      "An AI that can ship to production without you is a problem you can't undo.\n\n" +
      "Every change we propose passes a human approval gate — even when the agent is certain.\n\n" +
      "Certainty is not authority.",
  },
  {
    idx: "04",
    category: "Cloud ops",
    body:
      "Most AWS bills have ~25% of waste hiding in plain sight:\n\n" +
      "· Idle EBS volumes attached to terminated instances\n" +
      "· Provisioned IOPS on dev databases\n" +
      "· Hot S3 storage on never-read logs\n" +
      "· EIPs holding addresses for nothing\n\n" +
      "Axiom finds them in 60 seconds. Asks before fixing.",
  },
  {
    idx: "05",
    category: "Technical",
    body:
      "Closed-union TypeScript is a runtime safety mechanism.\n\n" +
      "`type DraftStatus = \"drafted\" | \"approved\" | \"scheduled\" | \"published\" | \"rejected\"`\n\n" +
      "If a switch doesn't cover every case, the build fails. The cheapest insurance against the most common production bug: the category we forgot.",
  },
  {
    idx: "06",
    category: "Engineering",
    body:
      "Our engineering handbook is public. Seven practices a small team uses to ship serious AI-ops software:\n\n" +
      "Pure kernels + thin IO. Best-effort audit. Two-switch deploy. Safe defaults. Migrations as truth. Closed unions everywhere.\n\n" +
      "visionxixlabs.com/handbook",
  },
  {
    idx: "07",
    category: "Founder voice",
    body:
      "We don't list headshots on our team page.\n\n" +
      "We do list how we work: small team, async-first, closed-union types, approval-only-no-execution applied to ourselves too.\n\n" +
      "The work speaks. visionxixlabs.com/team",
  },
  {
    idx: "08",
    category: "Case-study style",
    body:
      "A platform engineering team we worked with had 14 dashboards across their cloud + CI.\n\n" +
      "They replaced 11 of them with one approval queue.\n\n" +
      "Fewer surfaces. More signal. Less drift.",
  },
  {
    idx: "09",
    category: "Multi-cloud",
    body:
      "AWS + Azure + GCP — same closed-union types, same approval flow, same audit trail.\n\n" +
      "We don't ship a different product for each cloud. We ship one product with three connectors.",
  },
  {
    idx: "10",
    category: "Security",
    body:
      "We use assume-role. We do not store credentials.\n\n" +
      "The IAM role you set up on day one is the role we use forever. We never ask for more.\n\n" +
      "Revoke us from your own console any time — we will not phone home asking why.",
  },
  {
    idx: "11",
    category: "Product education",
    body:
      "Blast radius is the most important number in your deployment pipeline.\n\n" +
      "Axiom caps it. Default: 5 resources per approved plan. Production accounts: 1.\n\n" +
      "We'd rather ship a smaller fix today than a larger one we can't reverse tomorrow.",
  },
  {
    idx: "12",
    category: "Launch announcement",
    body:
      "Shipped this week:\n\n" +
      "· LinkedIn marketing automation (internal — drafts auto-generated daily, approval-gated publish)\n" +
      "· Apple-grade design system (coral × violet, tactile press buttons, frosted-glass materials)\n" +
      "· /manifesto, /principles, /handbook — values surfaces\n\n" +
      "Phase 492 on the changelog. visionxixlabs.com/changelog",
  },
];

// ─── axiom-releases repo files ────────────────────────────────────────

const LICENSE_MD =
  `Vision XIX Labs LLC — Source-Available License (v1)
====================================================

Copyright (c) ${new Date().getFullYear()} Vision XIX Labs LLC. All rights reserved.

This source code is published for transparency. It is not open source.

You may:
  · Read the source code
  · Reference it in articles, blog posts, and presentations with proper
    attribution to Vision XIX Labs LLC
  · Inspect it as part of a security or due-diligence review

You may NOT, without prior written permission from Vision XIX Labs LLC:
  · Copy, fork, redistribute, sublicense, or modify any portion of
    this source code
  · Use this source code (in whole or in part) in any commercial or
    open-source product
  · Train machine-learning models on this source code or any derivative
  · Remove or alter this notice in any reproduction of any portion of
    the source code

Permission requests: support@visionxixlabs.com

THIS SOURCE CODE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL VISION XIX LABS LLC BE LIABLE FOR ANY CLAIM, DAMAGES,
OR OTHER LIABILITY ARISING FROM THE USE OF OR INABILITY TO USE THIS
SOURCE CODE.

Inspired by the source-available licenses Sentry, Plausible, and
Hashicorp use. Not OSI-approved. Reuse is by permission, not by default.
`;

const README_MD =
  `# Axiom — Releases

Source archive for the **Axiom** AI cloud-operations agent built by
[Vision XIX Labs](https://visionxixlabs.com).

This repository is published **for transparency**, not as an open
source project. Read the [LICENSE](./LICENSE) before doing anything
with this code.

## What this repo is

Axiom is the AI agent that scans your cloud, reasons about what to
fix, drafts execution plans with verified rollback, and asks for
human approval before applying any change. It runs on AWS, Azure, and
GCP through assume-role / RBAC / service-account connectors.

This repo holds the production source — same code that powers
[axiom on visionxixlabs.com](https://visionxixlabs.com).

## What this repo is not

- **Not an open source project.** See LICENSE for what you can and
  cannot do.
- **Not a sample / template.** Forking it for your own product is
  expressly prohibited.
- **Not a place to file bugs.** Use [support@visionxixlabs.com](mailto:support@visionxixlabs.com)
  or your private Slack channel if you're a customer.

## Documentation

The product docs live on the marketing site, not here:

- [Quickstart checklist](https://visionxixlabs.com/docs/quickstart-checklist)
- [Architecture overview](https://visionxixlabs.com/docs/architecture)
- [Security model](https://visionxixlabs.com/docs/security-model)
- [Engineering handbook](https://visionxixlabs.com/handbook)

## License

Source-Available. See [LICENSE](./LICENSE). Reuse, fork, or
redistribution requires written permission. Contact
[support@visionxixlabs.com](mailto:support@visionxixlabs.com).

## Contact

- Website: [visionxixlabs.com](https://visionxixlabs.com)
- LinkedIn: [Vision XIX Labs](https://www.linkedin.com/company/vision-xix-labs/)
- X (Twitter): [@visionxixlabs](https://x.com/VisionXIXLabs)
- Support: support@visionxixlabs.com

---

© ${new Date().getFullYear()} Vision XIX Labs LLC. All rights reserved.
`;

export default function LaunchKitPage() {
  return (
    <div className="relative">
      <div className="mb-6">
        <Link
          href="/admin/growth"
          className="text-[11px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1"
        >
          <ArrowLeftIcon className="h-3 w-3" />
          Back to Growth
        </Link>
      </div>

      <div className="mb-8">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-4 inline-flex items-center gap-3">
          <span className="text-rose-300/90 tabular-nums">LK</span>
          <span className="h-px w-6 bg-gradient-to-r from-rose-400/60 to-transparent" />
          Launch kit · internal
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-3">
          Copy-paste this into X.com + the Axiom repo.
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          Everything you need to set up the brand externally. I can&apos;t sign
          into your X account or push to <span className="font-mono text-zinc-300">sahme209/axiom-releases</span> from here,
          so here&apos;s the next-best thing: every word, every link,
          ready to paste. <strong className="text-zinc-200">No drafting on your end.</strong>
        </p>
      </div>

      {/* X.com — profile basics */}
      <section className="surface-glass rounded-2xl p-6 mb-6">
        <header className="flex items-center gap-2 mb-4">
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-400">X · profile</span>
          <span className="text-zinc-700">·</span>
          <span className="text-[10.5px] font-mono text-zinc-500">@visionxixlabs</span>
        </header>
        <div className="space-y-4">
          <Field label="Display name" value={X_DISPLAY_NAME} max={50} />
          <Field label="Bio" value={X_BIO_160} max={160} multiline />
          <Field label="Location" value={X_LOCATION} max={30} />
          <Field label="Website" value={X_WEBSITE} max={100} />
        </div>
      </section>

      {/* Pinned tweet */}
      <section className="surface-glass rounded-2xl p-6 mb-6">
        <header className="flex items-center gap-2 mb-4">
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-400">X · pinned tweet</span>
          <span className="text-zinc-700">·</span>
          <span className="text-[10.5px] font-mono text-zinc-500">{X_PINNED_TWEET.length} / 280 chars</span>
        </header>
        <Block value={X_PINNED_TWEET} />
      </section>

      {/* First 12 tweets */}
      <section className="mb-6">
        <header className="flex items-center gap-2 mb-4">
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-400">X · first 12 posts</span>
          <span className="text-zinc-700">·</span>
          <span className="text-[10.5px] font-mono text-zinc-500">paste one per day</span>
        </header>
        <div className="space-y-3">
          {FIRST_TWEETS.map((t) => (
            <article key={t.idx} className="surface-glass rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-[10px] font-mono tabular-nums text-rose-300/85">{t.idx} / 12</span>
                <span className="text-zinc-700">·</span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300/80">{t.category}</span>
                <span className="text-zinc-700">·</span>
                <span className="text-[10px] font-mono text-zinc-500">{t.body.length} / 280</span>
              </div>
              <Block value={t.body} />
            </article>
          ))}
        </div>
      </section>

      {/* axiom-releases · LICENSE + README */}
      <section className="surface-glass rounded-2xl p-6 mb-6">
        <header className="mb-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-400 mb-2">
            sahme209/axiom-releases · repo files
          </p>
          <p className="text-[13px] text-zinc-300 leading-relaxed">
            Two files to add at the root of the Axiom repo. <strong>Source-available license</strong> — people
            can read the code but cannot fork/redistribute without permission.
            Repo is already public ({" "}
            <a href="https://github.com/sahme209/axiom-releases" target="_blank" rel="noopener noreferrer" className="text-brand-coral hover:underline">
              github.com/sahme209/axiom-releases
            </a>
            {" "}), so adding these locks down reuse without going private.
          </p>
        </header>

        <div className="mb-5">
          <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-2">LICENSE</p>
          <Block value={LICENSE_MD} />
        </div>

        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-2">README.md</p>
          <Block value={README_MD} />
        </div>
      </section>

      {/* Instructions */}
      <section className="surface-frost rounded-2xl p-6 mb-6">
        <h2 className="font-display text-xl font-bold text-white mb-4">Manual steps (~10 min)</h2>
        <ol className="space-y-3 text-[14px] text-zinc-300 leading-relaxed">
          <li><strong className="text-brand-coral">1.</strong> Open <a href="https://x.com/VisionXIXLabs" target="_blank" rel="noopener noreferrer" className="text-brand-coral hover:underline">x.com/VisionXIXLabs</a> → Profile → Edit profile. Paste display name, bio, location, website from the section above.</li>
          <li><strong className="text-brand-coral">2.</strong> Post the pinned tweet from above. Long-press → Pin to profile.</li>
          <li><strong className="text-brand-coral">3.</strong> Schedule the 12 daily posts. X has native scheduling — Tweet composer → calendar icon → pick time.</li>
          <li><strong className="text-brand-coral">4.</strong> Open <a href="https://github.com/sahme209/axiom-releases" target="_blank" rel="noopener noreferrer" className="text-brand-coral hover:underline">github.com/sahme209/axiom-releases</a>. Add file → name it <code className="font-mono text-brand-coral/90 bg-white/[0.04] px-1 rounded">LICENSE</code> → paste the LICENSE block above.</li>
          <li><strong className="text-brand-coral">5.</strong> Same repo → Add file → <code className="font-mono text-brand-coral/90 bg-white/[0.04] px-1 rounded">README.md</code> → paste the README block above.</li>
          <li><strong className="text-brand-coral">6.</strong> Done. Marketing site already points to <code className="font-mono text-brand-coral/90 bg-white/[0.04] px-1 rounded">github.com/sahme209/axiom-releases</code> in Nav + Footer.</li>
        </ol>
      </section>
    </div>
  );
}

function Field({ label, value, max, multiline }: { label: string; value: string; max: number; multiline?: boolean }) {
  const over = value.length > max;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">{label}</p>
        <p className={`text-[10px] font-mono tabular-nums ${over ? "text-rose-400" : "text-zinc-500"}`}>
          {value.length} / {max}
        </p>
      </div>
      <div className={`relative ${multiline ? "" : "inline-block w-full"}`}>
        <pre className="font-mono text-[12.5px] text-zinc-100 bg-black/30 border border-white/[0.06] rounded-lg p-3 whitespace-pre-wrap break-words leading-relaxed">{value}</pre>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

function Block({ value }: { value: string }) {
  return (
    <div className="relative">
      <pre className="font-mono text-[12px] text-zinc-100 bg-black/30 border border-white/[0.06] rounded-lg p-4 whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto">
        {value}
      </pre>
      <CopyButton value={value} />
    </div>
  );
}

