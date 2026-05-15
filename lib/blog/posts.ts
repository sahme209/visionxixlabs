/**
 * Blog data layer.
 *
 * Static typed post list — Vision XIX Labs ships product updates +
 * engineering essays directly from the codebase so authoring stays in
 * version control. Replace with a CMS when post volume warrants.
 */

export type BlogCategory = "Product Updates" | "Engineering" | "Industry Insights" | "Trust & Security";

export interface BlogAuthor {
  name: string;
  role: string;
  avatar?: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  /** ISO date string. */
  publishedAt: string;
  category: BlogCategory;
  author: BlogAuthor;
  /** Estimated read time in minutes. */
  readMinutes: number;
  /** Featured post pinned to the top of the index. */
  featured?: boolean;
  /** Markdown-ish content blocks. Each block is a paragraph or heading. */
  body: string[];
}

// ---------------------------------------------------------------------------
// Authors
// ---------------------------------------------------------------------------

const TEAM: Record<string, BlogAuthor> = {
  samir:   { name: "Samir Ahmed",       role: "Founder, Vision XIX Labs" },
  axiom:   { name: "Axiom Engineering", role: "Vision XIX Labs Engineering" },
};

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "introducing-axiom-agent",
    title: "Introducing Axiom Agent — an autonomous operations system for every cloud",
    excerpt: "We're shipping the first AGI-oriented cloud operations OS. AWS, Azure, GCP, GitHub, security, simulation, governance — one control plane, one desktop app, one honest source of truth.",
    publishedAt: "2026-05-15",
    category: "Product Updates",
    author: TEAM.samir,
    readMinutes: 6,
    featured: true,
    body: [
      "## Why we built Axiom",
      "Cloud operations is fragmented. AWS for the cloud. Datadog for monitoring. PagerDuty for incidents. GitHub Actions for releases. Linear or Jira for tracking what to do next. Slack threads for approvals. Every team builds the same wiring from scratch and every team gets it wrong in the same places — drift, missing rollback, no audit, no real governance.",
      "Axiom Agent is the operating system underneath all of that. One typed control plane reads from every provider, every signal — security, releases, validation, compliance — and projects a single, honest state into one dashboard. Every action moves through the same governed flow: observe → reason → simulate → policy check → approval → preflight → execute → verify → audit.",
      "## What ships today",
      "**Control plane:** `/api/control-plane/state` aggregates multi-cloud overview, security posture, release readiness, validation matrix, remediation candidates, orchestration, approvals, and memory feedback into one typed envelope. Every value carries source mode (live / preview / planned / blocked) and confidence.",
      "**Remediation pipeline:** every security finding becomes a typed remediation candidate paired with Terraform preview, CLI preview, rollback plan, verification checklist, and an execution-readiness decision. No fake fixes. No silent applies.",
      "**Simulation:** every candidate runs through a digital twin before any approval can land. Before/after diff with redaction. Blast radius (3-hop BFS over dependencies). Risk delta, blockers, rollback feasibility, verification readiness.",
      "**Orchestration + approvals:** typed state machine over 19 stages. Hard ordering rules. Approval policy with 10 strict rules → role + quorum + TTL. Execution locks + idempotency. The Terraform plan/apply boundary is its own typed decision per provider.",
      "**Desktop workstation:** Tauri 2 + React, signed + notarized on macOS, GPG-signed on every platform. Projects the same control plane locally. Local apply remains intentionally blocked until governance + signed binaries + audit pipeline are all green.",
      "## Honest about what isn't ready",
      "Live cloud apply is intentionally disabled. Live Azure + GCP credential validation is preview-mode until @azure/identity and google-auth-library are wired. Windows binaries are unsigned (no free path bypasses SmartScreen). Cost telemetry is partial. Reliability scoring is a placeholder until backup + replica + multi-region signals are integrated. The Trust Center says all of that in plain English — every value is labelled with its real source mode.",
      "## Try it",
      "Open https://visionxixlabs.com/dashboard for the web app. Or download the desktop app at https://visionxixlabs.com/download — macOS Apple Silicon + Intel ship signed and notarized, Windows ships unsigned with a one-time SmartScreen prompt, Linux ships GPG-signed across AppImage, .deb, and .rpm.",
    ],
  },

  {
    slug: "the-agi-operations-loop",
    title: "The AGI operations loop — observe, reason, plan, approve, verify, remember",
    excerpt: "Most 'AI for ops' products are chatbots that hallucinate Terraform. Axiom is structurally different. Here's the typed reasoning + safety contract the operations brain runs under.",
    publishedAt: "2026-05-14",
    category: "Engineering",
    author: TEAM.axiom,
    readMinutes: 8,
    body: [
      "## What the loop actually does",
      "Every iteration of Axiom's autonomous loop has the same shape: observe the platform state, identify gaps + risks, classify impact, pick the highest-leverage safe action, check policy + security boundaries, dispatch to a typed runner, validate the output, write a trace + audit + memory event, then continue. The dispatch step is intentionally paused — the brain never runs a destructive action without explicit operator approval.",
      "## Hard safety contract",
      "The loop refuses to escalate. No destructive autonomy. No secret exposure. No silent execution. No fake live state. Every audit event records the policy decision and the readiness factors that allowed the step. Preview-mode sources are physically prevented from reaching execution-only stages.",
      "## Composition over chat",
      "The brain doesn't generate Terraform from a prompt. It composes typed signals — capability coverage map, validation report, command center state, security reasoning, release readiness, planning candidates — into a structured BrainOperationsResult with explicit evidence references. No hidden chain-of-thought; every conclusion pins to a source id.",
      "## What this unlocks",
      "Trustable automation. The operator can ask 'why' and get a citation, not a hallucination. The auditor can replay every decision against the same typed inputs. The brain knows what it can and cannot do — the capability coverage map is the single source of truth for which actions are live, preview, or planned across every provider.",
    ],
  },

  {
    slug: "closed-loop-remediation",
    title: "Closed-loop remediation — Terraform, rollback, verification, approval, audit",
    excerpt: "Most security scanners surface findings and leave the rest to humans. Axiom converts every finding into a typed governed remediation candidate with a real Terraform preview, rollback plan, and verification checklist.",
    publishedAt: "2026-05-13",
    category: "Engineering",
    author: TEAM.axiom,
    readMinutes: 7,
    body: [
      "## Findings aren't fixes",
      "A scanner that says 'your S3 bucket is public' is half the job. The other half is: what's the safe fix? Can it be rolled back? How will we verify it? Who has to approve it? What audit record gets written?",
      "## The full bundle",
      "Every Axiom remediation candidate ships with: a Terraform preview that you can review locally, a CLI preview (aws/az/gcloud/gh) with dry-run availability and required permissions, a rollback plan with complexity classification + data-loss/downtime risk, a verification checklist with concrete expected-state lines, and an execution-readiness decision that maps to the orchestration state machine.",
      "## Honest manual-review fallback",
      "When the generator can't safely express a remediation as Terraform — e.g. a remediation requires customer-specific CIDR ranges, or a key rotation that touches dependent systems — the bundle is honestly labelled `manualReviewRequired: true` rather than fabricating fake HCL. No fake fixes.",
      "## Built on the digital twin",
      "Every candidate runs through the simulation center before approval can advance the orchestration. The twin computes blast radius (3-hop BFS over recorded dependencies), risk delta, and field-level diff with forbidden-key redaction. The simulation result is the evidence the approver sees.",
    ],
  },

  {
    slug: "shipping-the-desktop-app",
    title: "Shipping the desktop app — Tauri 2, signed + notarized on macOS, GPG everywhere else",
    excerpt: "Notes from building a signed cross-platform desktop release pipeline that publishes from CI without leaking secrets and without lying about what's actually signed.",
    publishedAt: "2026-05-15",
    category: "Engineering",
    author: TEAM.axiom,
    readMinutes: 5,
    body: [
      "## What it took",
      "Apple Developer ID Application certificate + app-specific password for notarytool, configured as 6 GitHub repository secrets. macOS DMGs now ship signed + notarized — double-click installs cleanly with no Gatekeeper prompt.",
      "## What we couldn't do for free",
      "Windows EV code signing costs $300–700/yr. We're shipping unsigned Windows binaries today — SmartScreen shows a one-time 'More info → Run anyway' prompt. The workflow is pre-wired to flip to signed automatically when an EV cert is configured.",
      "## What was free",
      "GPG signing. Every binary in every release ships with a detached `.asc` signature alongside it. Users who want strict origin verification can `gpg --import` the public key (published at the public release repo) and `gpg --verify <file>.asc <file>`.",
      "## Honest distribution",
      "We split into two repos — `visionxixlabs` (private, all code) and `axiom-releases` (public, only binaries). CI in the private repo builds, signs (where certs are configured), and pushes artefacts to the public repo via a cross-repo PAT. The `/download` page reads the public release manifest live; no rebuilds when a new release lands.",
      "## What's labelled honestly",
      "Every download tile on the website carries its real install friction note. macOS: 'Signed + notarized — double-click to install'. Windows: 'Unsigned — SmartScreen → More info → Run anyway'. Linux: 'GPG-signed; chmod +x for AppImage'. No platform claims signed when it isn't.",
    ],
  },

  {
    slug: "approval-policy-design",
    title: "Designing an approval operating system — 10 strict rules, 6 approver roles, TTL by risk",
    excerpt: "If automation can't be trusted to wait for approval, it can't be trusted in production. Here's the typed policy engine that gates every Axiom remediation.",
    publishedAt: "2026-05-12",
    category: "Trust & Security",
    author: TEAM.axiom,
    readMinutes: 6,
    body: [
      "## The 10 rules",
      "1. High-risk changes require approval. 2. Production-impacting changes require approval. 3. IAM/security changes require approval. 4. Public-exposure changes require approval. 5. Cost-impacting changes may require finance approval. 6. ReleaseOps production changes require approval. 7. Desktop local execution requires approval. 8. Unknown impact requires manual review. 9. Preview-mode operations cannot be approved for live execution. 10. Rejected approvals cannot be reused.",
      "## Six approver roles",
      "Operator, Approver, Security Reviewer, Finance Reviewer, Production Owner, Two-Approver Quorum. The policy engine maps every change automatically — security_hardening always pulls in Security Reviewer; cost_optimization above low-risk pulls in Finance Reviewer; production touches pull in Production Owner.",
      "## TTL by risk",
      "Critical = 12h. High = 24h. Medium = 48h. Low = 72h. Expired approvals cannot be decided — only superseded by a fresh request. This is the simplest typed defence against stale approvals being silently re-used.",
      "## What it isn't",
      "A workflow tool. The approval engine doesn't try to be Linear or Jira. It's the structured decision record that gates the orchestration state machine — approve, reject, expire, supersede. The UI surfaces are deliberately minimal so the policy stays auditable.",
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getAllPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getPostsByCategory(category: BlogCategory): BlogPost[] {
  return getAllPosts().filter((p) => p.category === category);
}

export function listCategories(): BlogCategory[] {
  return ["Product Updates", "Engineering", "Industry Insights", "Trust & Security"];
}
