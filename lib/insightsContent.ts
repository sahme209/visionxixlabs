export type InsightArticle = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  body: string[];
};

export const insightsArticles: InsightArticle[] = [
  {
    slug: "cloud-security-hardening",
    title: "Cloud security hardening: a practical baseline",
    excerpt:
      "A no-hype baseline for hardening cloud environments: identity, network segmentation, encryption, and logging.",
    date: "2025-02-01",
    readTime: "8 min",
    body: [
      "Most security incidents in the cloud trace back to a small set of recurring issues: overprivileged identities, weak network boundaries, data in transit or at rest left unprotected, and lack of audit trails. Hardening does not require silver-bullet tools; it requires consistent application of a few controls.",
      "Start with identity. Use a single identity provider (IdP) and federate into the cloud. Avoid long-lived access keys; prefer short-lived credentials and roles. Enforce least privilege by scoping IAM policies to resources and actions that are actually needed for the role. Regular access reviews and removal of unused roles reduce blast radius.",
      "Network segmentation matters. Isolate environments (e.g. dev, staging, prod) with separate VPCs or equivalent and control traffic with explicit rules. Use private subnets for workloads and restrict egress. A WAF and DDoS protections at the edge are standard; the real gain is limiting lateral movement inside the account.",
      "Encrypt sensitive data at rest (KMS-managed keys) and in transit (TLS). Enable and centralize logging: cloud trail / activity logs, VPC flow logs, and application logs. Retain logs in a separate account or tenant where possible so a compromise of the main environment does not erase evidence.",
      "None of this is exotic. The gap is usually execution: doing it consistently, documenting it, and revisiting it as the environment grows. We help teams implement this baseline and then iterate with automation and guardrails.",
    ],
  },
  {
    slug: "iam-mistakes-startups-make",
    title: "IAM mistakes startups make (and how to fix them)",
    excerpt:
      "Common identity and access misconfigurations in early-stage cloud setups and how to correct them without blocking velocity.",
    date: "2025-01-28",
    readTime: "6 min",
    body: [
      "Startups often begin with a single AWS (or Azure/GCP) account and one or two people using root or admin-equivalent access. That’s acceptable for a proof of concept; it becomes a liability as the team and surface area grow.",
      "The first mistake is treating IAM as an afterthought. Early on, create separate IAM users or, better, use IdP federation so there are no long-lived passwords or keys in the cloud. Assign humans to groups (e.g. developers, admins) and grant permissions to groups, not individuals. When someone leaves, you remove them from the IdP; no need to hunt for keys or inline policies.",
      "The second is overprivilege. Broad policies like s3:* or ec2:* on production resources are convenient but dangerous. Start with a small set of roles (e.g. read-only, deploy, admin) and attach policies that only include the actions those roles truly need. Use policy conditions (e.g. MFA, source IP) where it matters.",
      "The third is mixing automation and human access. CI/CD and scripts should use dedicated roles (e.g. a deployment role) with scoped permissions, not a developer’s credentials. That way you get clear audit trails and can rotate or revoke automation credentials without affecting people.",
      "The fourth is ignoring cross-account and cross-service access. As you add accounts (e.g. for prod vs. dev), define how roles are assumed across accounts and avoid sharing root or long-lived keys. Use OIDC or SAML for GitHub/Azure DevOps so pipelines assume roles without stored secrets.",
      "Fixing this does not require a big-bang rewrite. Introduce an IdP and one or two roles, migrate one team or pipeline, then expand. We help teams design and implement this path so security improves without slowing delivery.",
    ],
  },
  {
    slug: "ai-integration-risks",
    title: "AI integration risks: what to control before going to production",
    excerpt:
      "Data leakage, prompt injection, cost drift, and compliance: what to address when moving from AI demos to production systems.",
    date: "2025-01-20",
    readTime: "7 min",
    body: [
      "AI demos are low-friction: call an API, show a result. Production AI systems require the same discipline as any system that handles sensitive data or affects business outcomes.",
      "Data leakage is the top concern. Sending PII or confidential data to a third-party LLM API can violate policy and regulation. Mitigations include using APIs that do not train on your data, filtering or redacting inputs, or running models in your own VPC. Define a clear data boundary and enforce it in code and architecture.",
      "Prompt injection and misuse are real. Validate and constrain user input; don’t pass raw user text directly into prompts that control actions. Use structured outputs and guardrails where the model’s response triggers workflows or access. Log prompts and responses for debugging and audit.",
      "Cost can spiral if usage is ungoverned. Set quotas, budgets, and alerts per environment or team. Prefer fixed-scope or capacity-based patterns where possible so new features don’t silently multiply API cost.",
      "Compliance (GDPR, HIPAA, SOC2) applies to AI like any other processing. Document where data flows, how long it’s retained, and who can access it. If you use a vendor, ensure BAA or DPA and that your usage fits their compliance scope.",
      "We help teams design production AI with these controls in place: secure integration patterns, governance, and monitoring so AI delivers value without introducing undue risk.",
    ],
  },
  {
    slug: "devops-automation-maturity",
    title: "DevOps automation maturity: from manual to repeatable",
    excerpt:
      "A simple maturity lens for deployment and operations: where you are and what to improve next without over-engineering.",
    date: "2025-01-15",
    readTime: "6 min",
    body: [
      "Teams often ask “how mature is our DevOps?” without a clear yardstick. A useful way to think about it is in stages: manual, scripted, pipeline-driven, and then optimized.",
      "Manual means changes are made in the console or via one-off scripts. It’s fine for very small environments but does not scale and is hard to audit. The first step up is to script repeatable tasks (e.g. deploy this app, apply this config) and run them from a single place.",
      "Scripted automation becomes pipeline-driven when every change goes through a defined path: code in a repo, build and test in CI, deploy via a pipeline with approvals where needed. Environments are provisioned or updated from code (IaC). This is the stage most teams should aim for: consistent, traceable, and reversible.",
      "Optimized adds things like canaries, feature flags, automated rollback, and tighter feedback (e.g. deployment metrics, error budgets). Not every team needs this immediately; it depends on release frequency and risk tolerance.",
      "The biggest trap is skipping steps. Going from manual to “full GitOps with 10 tools” in one go usually fails. Pick one pain point (e.g. “we want every deploy to go through a pipeline”) and fix it, then add the next. We help teams assess where they are and design the next step so automation supports delivery instead of blocking it.",
    ],
  },
  {
    slug: "production-ai-vs-demos",
    title: "Production AI vs. demos: what it takes to ship",
    excerpt:
      "Why most AI demos never become production systems—and what separates teams that ship from those that stall.",
    date: "2025-02-10",
    readTime: "6 min",
    body: [
      "A demo is easy: call an API, show a result. Production AI requires integration with your systems, security and compliance controls, monitoring and alerting, cost management, and clear ownership. Most companies discover this gap only after the demo works.",
      "Start with use-case clarity. Define what success looks like in business terms (e.g. reduce support ticket volume by 20%, cut document processing time by half). Without that, you cannot decide whether a model, architecture, or deployment strategy is good enough.",
      "Design for operations from day one. Who monitors the system? Who gets paged? What happens when the model returns nonsense or the API is down? Production AI needs runbooks, fallbacks, and escalation paths.",
      "Cost visibility is non-negotiable. LLM APIs charge per token. A chatbot that goes viral can multiply spend overnight. Set quotas, alerts, and budgets before launch—not after the first surprise bill.",
      "We help teams bridge the demo-to-production gap: secure deployment patterns, operational readiness, and governance so AI delivers value without becoming a liability.",
    ],
  },
  {
    slug: "choosing-ai-models-for-production",
    title: "Choosing AI models for production: a practical framework",
    excerpt:
      "How to select models based on use case, cost, latency, and data sensitivity—without chasing the latest release.",
    date: "2025-02-08",
    readTime: "7 min",
    body: [
      "New models ship every few months. The best choice for production is rarely the newest one—it's the one that fits your constraints and delivers consistent results.",
      "Consider latency. Customer-facing chat needs sub-second response; internal summarization can batch and wait. Match model size and routing (e.g. fast model for routing, larger model for complex queries) to your SLA.",
      "Consider cost. Token pricing varies widely. A cheap model that needs 10x more tokens may cost more than a premium one. Run experiments with real traffic patterns before committing.",
      "Consider data sensitivity. PII, health data, or trade secrets may require private deployment (your VPC, your keys) rather than third-party APIs. Document where data flows and who can access it.",
      "Consider vendor lock-in. Proprietary APIs are convenient but tie you to one provider. Open models and standard interfaces (e.g. OpenAI-compatible endpoints) give flexibility to switch or self-host later.",
      "We help teams evaluate and select models for production: benchmarking, cost modeling, and architecture decisions so you choose confidently.",
    ],
  },
  {
    slug: "internal-ai-assistants-when-they-make-sense",
    title: "Internal AI assistants: when they make sense",
    excerpt:
      "Company knowledge copilots, document search, and workflow assistants—when they add value and when they don't.",
    date: "2025-02-05",
    readTime: "6 min",
    body: [
      "Internal AI assistants can unlock knowledge scattered across docs, wikis, and tickets. But they only work when the underlying content is structured enough and the use case is well-defined.",
      "Start with a narrow scope. A copilot that answers 'anything about our product' usually fails—too broad, too many edge cases. A copilot that answers 'how do we onboard enterprise customers?' or 'what's our refund policy?' can deliver immediate value.",
      "Quality of source data matters. Garbage in, garbage out. If your docs are stale or contradictory, the assistant will reflect that. Invest in content hygiene before scaling the assistant.",
      "Define the human handoff. When should the assistant escalate to a human? For compliance, policy, or sensitive topics, build explicit boundaries. Don't let the AI make decisions it shouldn't.",
      "Measure adoption and usefulness. Track queries, resolution rate, and feedback. Iterate on prompts, retrieval, and scope based on real usage—not assumptions.",
      "We build internal AI assistants with clear scope, secure deployment, and measurable outcomes. We help you avoid the trap of 'AI for everything' and focus where it matters.",
    ],
  },
  {
    slug: "ai-cost-management-in-production",
    title: "AI cost management in production",
    excerpt:
      "Quotas, caching, model routing, and governance patterns to keep LLM spend predictable and under control.",
    date: "2025-02-03",
    readTime: "6 min",
    body: [
      "LLM APIs charge per token. A single misconfigured integration can generate thousands of dollars in a day. Cost management is not optional for production AI.",
      "Set quotas per environment and per team. Dev and staging should have tight limits; production needs guardrails that prevent runaway usage. Use cloud billing alerts and custom dashboards to catch spikes early.",
      "Cache aggressively. Many queries are repetitive—FAQ answers, common document lookups, similar prompts. Cache responses (with appropriate TTL and invalidation) to cut API calls and cost.",
      "Route intelligently. Use small, fast models for classification and routing; reserve larger models for complex tasks. Tiered routing can cut cost by 50–70% without sacrificing quality for most requests.",
      "Monitor cost per use case. Break down spend by feature, team, or endpoint. Without visibility, you cannot optimize. We help teams implement cost tracking, quotas, and optimization strategies so AI remains cost-effective at scale.",
    ],
  },
  {
    slug: "rag-vs-fine-tuning-when-to-use-which",
    title: "RAG vs. fine-tuning: when to use which",
    excerpt:
      "Retrieval-augmented generation and fine-tuning solve different problems. Here's a practical guide to choosing.",
    date: "2025-01-25",
    readTime: "7 min",
    body: [
      "RAG (retrieval-augmented generation) fetches relevant context at query time and passes it to the model. Fine-tuning adjusts model weights on your data. Both improve output quality—but for different reasons.",
      "Use RAG when knowledge changes frequently. Product docs, policies, support tickets—content that updates often. RAG lets you add or change documents without retraining. Vector search + LLM is the standard pattern.",
      "Use fine-tuning when you need consistent style, format, or domain terminology. If your outputs must follow a specific schema or tone, fine-tuning can help. It's more effort to maintain (retraining when data evolves) but can reduce prompt engineering.",
      "Often you need both. RAG for knowledge retrieval, fine-tuning for output formatting or task-specific behavior. Start with RAG; add fine-tuning only if RAG alone is insufficient.",
      "We help teams choose and implement RAG, fine-tuning, or hybrid approaches—with clear evaluation criteria and operational practices for each.",
    ],
  },
  {
    slug: "cost-optimization-strategies",
    title: "Cost optimization strategies that don’t rely on guesswork",
    excerpt:
      "Right-sizing, reservations, waste detection, and governance: a structured approach to cloud cost without hype.",
    date: "2025-01-10",
    readTime: "7 min",
    body: [
      "Cloud cost optimization is often reactive: a bill spike triggers a scramble. A better approach is to build visibility and governance first, then apply targeted actions.",
      "Start with allocation. Tag resources by team, project, and environment so you can see who spends what. Without tags, you’re optimizing in the dark. Enforce tagging via policy or deny untagged resources in non-dev accounts.",
      "Right-sizing is next. Review compute and storage for over-provisioning: oversized instances, unattached volumes, old snapshots. Use cloud cost and usage reports plus recommendations (e.g. AWS Cost Explorer, Azure Cost Management) to find low-hanging fruit. Schedule non-prod resources to turn off when not needed.",
      "Reserved capacity and savings plans can cut compute cost significantly if you have stable baseline usage. Run a reservation coverage report and consider 1-year commitments for predictable workloads; leave variable or short-term workloads on demand.",
      "Waste detection should be ongoing. Idle load balancers, unused IPs, orphaned disks, and abandoned test resources add up. Automate checks (e.g. “no traffic in 30 days”) and route findings to the right team.",
      "Governance prevents backsliding. Set budgets and alerts per account or team. Use quotas and service controls so new projects don’t accidentally spin up expensive resources. We help teams put this in place: tagging strategy, reporting, and incremental optimization so cost stays predictable as you grow.",
    ],
  },
];

export function getInsightBySlug(slug: string): InsightArticle | undefined {
  return insightsArticles.find((a) => a.slug === slug);
}

export function getAllInsightSlugs(): string[] {
  return insightsArticles.map((a) => a.slug);
}
