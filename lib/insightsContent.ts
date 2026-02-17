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
