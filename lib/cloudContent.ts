export type Solution = {
  id: string;
  title: string;
  description: string;
  bestFor: string;
  href: string;
};

export type Package = {
  id: string;
  name: string;
  duration: string;
  includes: string[];
  bestFor: string;
};

export type FAQ = {
  question: string;
  answer: string;
};

export const cloudSolutionsHero = {
  title: "Cloud solutions that ship faster, run reliably, and cost less.",
  subtitle:
    "We help teams design, automate, optimize, and operate cloud platforms on AWS and Azure.",
  capabilities: [
    "Infrastructure",
    "CI/CD",
    "FinOps",
    "Reliability",
    "Security",
  ],
};

export const cloudSolutionCards: Solution[] = [
  {
    id: "cloud-foundations",
    title: "Cloud Foundations",
    description:
      "Landing zones and baseline architecture that give AWS and Azure platforms a secure, scalable starting point.",
    bestFor: "Teams standardizing how new apps land in the cloud.",
    href: "/cloud-solutions",
  },
  {
    id: "cicd-release-automation",
    title: "CI/CD & Release Automation",
    description:
      "GitHub-centric pipelines and Octopus Deploy release workflows so changes move from commit to production safely.",
    bestFor: "Teams wanting predictable, low-friction deployments.",
    href: "/cloud-solutions",
  },
  {
    id: "cost-optimization",
    title: "Cost Optimization (FinOps)",
    description:
      "Practical cost optimization on AWS and Azure, from right-sizing to storage tuning and budget guardrails.",
    bestFor: "Leaders needing lower, more predictable cloud spend.",
    href: "/cloud-solutions",
  },
  {
    id: "reliability-observability",
    title: "Reliability & Observability",
    description:
      "Monitoring, alerting, and dashboards tuned to business impact so issues are found and fixed quickly.",
    bestFor: "Teams owning uptime and on-call.",
    href: "/cloud-solutions",
  },
  {
    id: "security-governance",
    title: "Security & Governance",
    description:
      "IAM and policy guardrails that keep access controlled without slowing engineering teams down.",
    bestFor: "Organizations with compliance and audit needs.",
    href: "/cloud-solutions",
  },
  {
    id: "migration-modernization",
    title: "Migration & Modernization",
    description:
      "Structured migrations into AWS or Azure and modernization paths that reduce risk and technical debt.",
    bestFor: "Teams moving from data centers or legacy platforms.",
    href: "/cloud-solutions",
  },
  {
    id: "backup-dr",
    title: "Backup, DR & Business Continuity",
    description:
      "Backup strategy, recovery objectives, and DR patterns matched to your business tolerance and budget.",
    bestFor: "Systems that must be available when it matters most.",
    href: "/cloud-solutions",
  },
  {
    id: "platform-operations",
    title: "Platform Operations",
    description:
      "Runbooks, on-call readiness, and operating models so your cloud platform can be run with confidence.",
    bestFor: "Teams formalizing SRE and platform operations.",
    href: "/cloud-solutions",
  },
  {
    id: "data-storage-strategy",
    title: "Data & Storage Strategy",
    description:
      "High-level guidance for choosing storage patterns that balance performance, durability, and cost.",
    bestFor: "Product and data teams planning their next phase.",
    href: "/cloud-solutions",
  },
  {
    id: "networking-connectivity",
    title: "Networking & Connectivity",
    description:
      "VPCs/VNets, connectivity, and routing models that keep services talking securely and predictably.",
    bestFor: "Hybrid and multi-environment architectures.",
    href: "/cloud-solutions",
  },
];

export const engagementPackages: Package[] = [
  {
    id: "assessment",
    name: "Cloud Assessment",
    duration: "1–2 weeks",
    includes: [
      "Current-state review of AWS and/or Azure",
      "Risk and opportunity analysis",
      "Prioritized roadmap with quick wins and longer-term work",
      "Executive-friendly summary of key findings",
    ],
    bestFor: "Teams needing clarity on where to start.",
  },
  {
    id: "foundation-build",
    name: "Foundation Build",
    duration: "2–6 weeks",
    includes: [
      "Baseline AWS and/or Azure landing zone",
      "Infrastructure as Code for core platform",
      "Initial CI/CD pipelines wired to environments",
      "Monitoring, alerting, and security guardrails",
    ],
    bestFor: "Teams building or standardizing a cloud platform.",
  },
  {
    id: "optimization-operations",
    name: "Optimization & Operations",
    duration: "Ongoing",
    includes: [
      "Regular cost optimization and FinOps reviews",
      "Reliability and incident reduction initiatives",
      "Support for platform changes and improvements",
      "Advisory support for roadmap and architecture decisions",
    ],
    bestFor: "Teams investing in continuous improvement.",
  },
];

export const deliverables = [
  "Architecture diagrams for AWS and Azure environments",
  "Infrastructure-as-Code repositories (Terraform, Bicep, or CloudFormation where applicable)",
  "CI/CD pipeline templates and deployment workflows",
  "Monitoring and alerting baselines",
  "Security guardrails and access model recommendations",
  "Cost optimization report and action plan",
  "Runbooks and handover session for your team",
];

export const industries = [
  "SaaS products",
  "Internal enterprise applications",
  "Data platforms and analytics",
  "Ecommerce and digital channels",
  "Fintech-ready patterns",
  "Startups scaling to enterprise",
];

export const trustPrinciples = [
  "Security-first delivery",
  "Documentation and handover included",
  "Least-privilege access approach",
  "Repeatable automation over one-off changes",
  "Clear change management and approvals",
];

export const toolsWeWorkWith =
  "AWS • Azure • GitHub • Octopus Deploy • Terraform • monitoring and logging tools";

export const cloudFAQ: FAQ[] = [
  {
    question: "Do you do migrations?",
    answer:
      "Yes. We help plan and execute migrations into AWS and Azure using an incremental, low-risk approach that aligns to your release and change-management processes.",
  },
  {
    question: "Can you optimize an existing cloud bill?",
    answer:
      "Yes. We review your current AWS and Azure usage, identify waste and right-sizing opportunities, and provide a focused action plan with estimated impact.",
  },
  {
    question: "Do you support both AWS and Azure?",
    answer:
      "Yes. We work with teams on AWS, Azure, or both, helping you standardize patterns while respecting provider differences.",
  },
  {
    question: "Do you provide ongoing support?",
    answer:
      "We offer ongoing optimization and advisory support after initial projects, so your platform continues to improve as your products evolve.",
  },
  {
    question: "How do engagements start?",
    answer:
      "Most engagements start with a discovery call and a short assessment. From there, we agree on scope, outcomes, and an engagement model that fits your needs.",
  },
  {
    question: "What access do you need?",
    answer:
      "We work with least-privilege principles. Typically we start with read-only access and work with your team to grant additional permissions as needed for implementation.",
  },
];

export const awsSummaryBullets = [
  "Design AWS landing zones and VPC patterns tailored to your organization.",
  "Automate deployments with GitHub and Octopus Deploy for safer releases.",
  "Optimize EC2, EBS, and other services for performance and cost.",
  "Establish observability, security, and governance practices that scale.",
];

export const azureSummaryBullets = [
  "Design Azure landing zones and subscription structures for growth.",
  "Implement CI/CD using GitHub Actions or Azure DevOps where appropriate.",
  "Optimize compute, storage, and networking for cost and performance.",
  "Establish monitoring, identity, and policy baselines across environments.",
];

