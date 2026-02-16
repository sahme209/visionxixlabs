/**
 * Centralized engineering-grade content for Cloud + AI consultancy pages.
 * Used across Cloud Solutions, AWS, Azure, GCP, and AI Solutions.
 */

export type TechnicalSubsection = {
  title: string;
  items: string[];
};

export type TechnicalSection = {
  title: string;
  intro?: string;
  subsections: TechnicalSubsection[];
};

export type UseCase = {
  title: string;
  problem: string;
  approach: string;
  outcome: string;
};

export type ComparisonRow = {
  dimension: string;
  aws: string;
  azure: string;
  gcp: string;
};

// ——— Engineering Principles ———
export const engineeringPrinciples = [
  "Infrastructure is code, not clicks — declarative, version-controlled, reviewable.",
  "Automation over manual processes — repeatable pipelines and patterns.",
  "Least-privilege by default — access scoped to what is required.",
  "Observability as a first-class concern — metrics, logs, and alerts from day one.",
  "Cost awareness at design time — right-sizing and lifecycle built into architecture.",
  "Secure-by-design architecture — security and governance embedded, not bolted on.",
];

// ——— What We Do / Do Not Do ———
export const whatWeFocusOn = [
  "Cloud platform engineering (AWS, Azure, GCP)",
  "DevOps and CI/CD automation (e.g. GitHub, Octopus Deploy)",
  "FinOps and cost engineering",
  "Reliability, observability, and SRE practices",
  "Security and governance (IAM, policy, audit)",
  "AI systems integration and production AI deployment",
];

export const whatWeDoNotDo = [
  "Resell or bundle random SaaS tools",
  "Build generic marketing or WordPress sites",
  "Provide unmanaged outsourcing or body-shop staffing",
  "Claim certifications or metrics we cannot substantiate",
  "Deliver infrastructure as one-off clicks without code or documentation",
];

// ——— Deliverables (tangible outputs) ———
export const coreDeliverables = [
  "Architecture diagrams (current and target state)",
  "Infrastructure repository (IaC: Terraform, Bicep, or CloudFormation as applicable)",
  "Pipeline configuration and deployment workflows",
  "Monitoring dashboard setup and alerting rules",
  "Security baseline and access model documentation",
  "Cost optimization report and prioritized action plan",
  "Operational runbooks and escalation paths",
  "Handover workshop and knowledge transfer session",
];

// ——— Cloud Architecture & Platform Engineering ———
export const cloudArchitectureSection: TechnicalSection = {
  title: "Cloud Architecture & Platform Engineering",
  intro: "Structured design of accounts, networking, compute, and infrastructure-as-code so platforms are repeatable and maintainable.",
  subsections: [
    {
      title: "Account & Environment Strategy",
      items: [
        "Multi-environment isolation (dev, test, staging, production)",
        "Naming conventions and resource tagging standards",
        "Access control patterns and boundary policies",
      ],
    },
    {
      title: "Networking Design",
      items: [
        "Segmentation principles (VPC/VNet, subnets, security groups)",
        "Routing strategy and traffic flow",
        "Secure connectivity patterns (VPN, private link, peering)",
      ],
    },
    {
      title: "Compute & Storage Strategy",
      items: [
        "Workload classification and placement",
        "Scaling patterns (horizontal, vertical, scheduled)",
        "Lifecycle management and retention policies",
      ],
    },
    {
      title: "Infrastructure as Code",
      items: [
        "Declarative provisioning (Terraform, Bicep, CloudFormation)",
        "Version-controlled infrastructure and change review",
        "Environment reproducibility and drift detection",
      ],
    },
  ],
};

// ——— DevOps & CI/CD Engineering ———
export const devOpsSection: TechnicalSection = {
  title: "DevOps & CI/CD Engineering",
  intro: "Pipeline design, release governance, and artifact management with GitHub and Octopus Deploy where applicable.",
  subsections: [
    { title: "Pipeline Design", items: ["Build, test, and package stages", "Environment-specific deployment flows", "Quality gates and approval steps"] },
    { title: "Branching & Promotion Strategy", items: ["Branch strategy aligned to release model", "Promotion from non-prod to production", "Feature flags and safe rollouts"] },
    { title: "Release Governance", items: ["Controlled release process", "Audit trail for deployments", "Change approval where required"] },
    { title: "Artifact Management", items: ["Container and package registries", "Versioning and retention", "Supply-chain and vulnerability scanning"] },
    { title: "Environment Parity", items: ["Consistent configuration across environments", "Secrets and config management", "Database and dependency alignment"] },
    { title: "Rollback & Recovery Strategy", items: ["Rollback procedures and runbooks", "Data and state considerations", "Post-rollback verification"] },
  ],
};

// ——— FinOps & Cost Engineering ———
export const finOpsSection: TechnicalSection = {
  title: "FinOps & Cost Engineering",
  intro: "Resource analysis, right-sizing, and cost visibility so spend is predictable and optimized.",
  subsections: [
    { title: "Resource Utilization Analysis", items: ["CPU, memory, and storage utilization review", "Idle and underused resource identification", "Reserved vs on-demand usage patterns"] },
    { title: "Rightsizing & Scheduling Strategy", items: ["Instance and workload right-sizing", "Start/stop and scheduling where appropriate", "Spot and preemptible use where suitable"] },
    { title: "Storage Lifecycle Policies", items: ["Tiering and archival rules", "Retention and deletion policies", "Data transfer cost awareness"] },
    { title: "Cost Visibility Architecture", items: ["Cost allocation and tagging strategy", "Dashboard and reporting setup", "Chargeback or showback where needed"] },
    { title: "Budget Guardrails", items: ["Budgets and forecast alerts", "Quotas and limits", "Anomaly and threshold monitoring"] },
    { title: "Cost Anomaly Monitoring", items: ["Spend anomaly detection", "Alerting and review process", "Actionable cost optimization backlog"] },
  ],
};

// ——— Reliability & Observability ———
export const reliabilitySection: TechnicalSection = {
  title: "Reliability & Observability",
  intro: "Metrics, logging, alerting, and incident practices aligned to SLAs and business impact.",
  subsections: [
    { title: "Metrics Strategy", items: ["Key metrics and SLI/SLO alignment", "Dashboard design for operations", "Trend and capacity visibility"] },
    { title: "Centralized Logging", items: ["Log aggregation and retention", "Structured logging and correlation", "Search and troubleshooting workflow"] },
    { title: "Alerting Threshold Design", items: ["Alert criteria and severity", "Noise reduction and routing", "On-call and escalation paths"] },
    { title: "SLA / SLO Alignment", items: ["Service-level objectives definition", "Error budget and review", "Reporting for stakeholders"] },
    { title: "Incident Response Playbooks", items: ["Runbooks for common failures", "Communication and escalation", "Post-incident review process"] },
  ],
};

// ——— Security & Governance ———
export const securitySection: TechnicalSection = {
  title: "Security & Governance",
  intro: "Identity, policy, secrets, and audit so access is controlled and changes are traceable.",
  subsections: [
    { title: "Identity & Access Patterns", items: ["IAM roles and least-privilege design", "Federation and SSO where applicable", "Service accounts and automation identity"] },
    { title: "Policy Enforcement", items: ["Guardrails and policy-as-code", "Pre-deployment checks", "Compliance and standard baselines"] },
    { title: "Secrets Management", items: ["Secrets storage and rotation", "Pipeline and runtime access", "No secrets in code or config"] },
    { title: "Audit Logging", items: ["Audit trails for access and changes", "Log retention and integrity", "Review and compliance use"] },
    { title: "Change Management Controls", items: ["Controlled change process", "Review and approval where required", "Rollback and remediation path"] },
  ],
};

// ——— AI Technical Depth (Production AI, not demos) ———
export const aiTechnicalSection: TechnicalSection = {
  title: "Production AI systems, not AI demos",
  intro: "We focus on deployable, secure, and maintainable AI systems inside your cloud—with clear use cases, model choices, and operational controls.",
  subsections: [
    { title: "AI use case design", items: ["Clear success criteria and scope", "Data requirements and availability", "Integration points with existing systems", "Boundaries and guardrails for AI behavior"] },
    { title: "Model selection strategy", items: ["Off-the-shelf vs fine-tuned vs custom", "Latency, cost, and accuracy trade-offs", "Vendor and API choices (e.g. OpenAI, Azure OpenAI, Bedrock, Vertex)", "Fallback and degradation behavior"] },
    { title: "Secure API integration", items: ["API keys and credentials in secrets management", "Network isolation and private endpoints", "Rate limiting and abuse prevention", "API versioning and compatibility"] },
    { title: "Data access controls", items: ["Least-privilege access to data sources", "No training on sensitive data unless agreed", "Data residency and retention alignment", "Audit of what data AI can access"] },
    { title: "Logging & monitoring of AI usage", items: ["Request/response logging for audit and debugging", "Token and cost usage visibility", "Error and latency metrics", "Alerts for anomalies or policy breaches"] },
    { title: "Cost control for AI workloads", items: ["Model and tier selection for cost", "Caching and batching where appropriate", "Budget and quota guardrails", "Ongoing cost review and optimization"] },
    { title: "Deployment inside existing cloud", items: ["Deploy in your AWS, Azure, or GCP account", "Use your identity and networking", "Integrate with your CI/CD and pipelines", "Handover and runbooks for your team"] },
  ],
};

// ——— AI-specific deliverables ———
export const aiDeliverables = [
  "Use-case and architecture document",
  "Model selection and API integration design",
  "Deployed AI endpoints or apps in your cloud",
  "Access control and data governance documentation",
  "Monitoring dashboards and alerting for AI usage",
  "Cost visibility and optimization recommendations",
  "Runbooks and handover session",
];

// ——— Tech Stack (structured) ———
export const techStack = {
  cloudPlatforms: ["AWS", "Azure", "GCP"],
  automation: ["GitHub", "Octopus Deploy", "CI/CD pipelines"],
  infrastructure: ["IaC (Terraform, Bicep, CloudFormation)", "Containers (Docker, Kubernetes where used)", "Version control (Git)"],
  monitoring: ["Metrics and dashboards", "Centralized logging", "Alerting and on-call tooling"],
  ai: ["Model integration and APIs", "Cloud-hosted inference", "API-driven AI systems"],
};

export const techStackGroups = [
  { label: "Cloud platforms", items: techStack.cloudPlatforms },
  { label: "Automation", items: techStack.automation },
  { label: "Infrastructure", items: techStack.infrastructure },
  { label: "Monitoring", items: techStack.monitoring },
  { label: "AI (when applicable)", items: techStack.ai },
];

// ——— Use Cases (Problem → Approach → Outcome) ———
export const useCases: UseCase[] = [
  {
    title: "SaaS companies scaling infrastructure",
    problem: "Growth is straining ad-hoc infrastructure; deployments are manual and risky.",
    approach: "Structured landing zone, IaC, and CI/CD with GitHub and Octopus Deploy; monitoring and cost visibility.",
    outcome: "Repeatable deployments, better reliability, and controlled cost growth.",
  },
  {
    title: "Enterprises modernizing CI/CD",
    problem: "Releases are manual, slow, and inconsistent across teams.",
    approach: "Pipeline design, branching strategy, and release governance; integration with existing tooling.",
    outcome: "Faster, safer releases and a clear audit trail.",
  },
  {
    title: "Businesses implementing internal AI assistants",
    problem: "Need to deploy AI on company data without losing control or security.",
    approach: "Use-case design, model selection, secure deployment in existing cloud, access control and logging.",
    outcome: "Production AI systems that fit existing governance and infrastructure.",
  },
  {
    title: "Teams reducing cloud spend",
    problem: "Cloud bills are high and hard to attribute or optimize.",
    approach: "Cost visibility setup, utilization review, right-sizing and lifecycle policies, budget guardrails.",
    outcome: "Lower spend, predictable costs, and an ongoing optimization backlog.",
  },
  {
    title: "Organizations needing governance structure",
    problem: "Compliance and audit requirements; access and change control are unclear.",
    approach: "Identity and access design, policy guardrails, audit logging, and change management.",
    outcome: "Clear access model, audit trail, and compliance-ready posture.",
  },
];

// ——— Provider comparison (high-level) ———
export const providerComparison: ComparisonRow[] = [
  { dimension: "Landing zone / org model", aws: "Accounts, OUs, SCPs", azure: "Management groups, subscriptions", gcp: "Organization, folders, projects" },
  { dimension: "Networking", aws: "VPC, security groups", azure: "VNets, NSGs", gcp: "VPC, firewall rules" },
  { dimension: "Compute", aws: "EC2, ECS, EKS, Lambda", azure: "VMs, AKS, App Service, Functions", gcp: "GCE, GKE, Cloud Run, Functions" },
  { dimension: "IaC", aws: "CloudFormation, CDK, Terraform", azure: "Bicep, ARM, Terraform", gcp: "Deployment Manager, Terraform" },
  { dimension: "CI/CD", aws: "CodePipeline, GitHub Actions, Octopus", azure: "Azure DevOps, GitHub Actions, Octopus", gcp: "Cloud Build, GitHub Actions" },
];

// ——— Implementation methodology (short, for provider/AI pages) ———
export const implementationMethodologyShort =
  "We follow a structured, outcome-focused approach: discovery and scope, design and review, implementation in iterations, and handover with documentation and knowledge transfer. Delivery is phased so you have visibility at each step.";

// ——— Ideal clients (for consistent "Ideal Clients" section) ———
export const idealClientsCloud = [
  "Teams with existing AWS, Azure, or GCP usage who want to standardize and optimize.",
  "Engineering organizations ready to adopt or mature IaC and CI/CD.",
  "Leaders who need cost visibility, governance, and reliability without hype.",
  "Companies that want hands-on engineering delivery and knowledge transfer.",
];

export const idealClientsAI = [
  "Teams that need AI deployed inside their own cloud with clear security and governance.",
  "Businesses with defined use cases (internal assistants, automation, apps) and data in place.",
  "Organizations that want production AI systems, not one-off demos.",
  "Engineering teams that need integration with existing tools and CI/CD.",
];

// ——— How We Work (5-phase engagement) ———
export type HowWeWorkPhase = {
  phase: number;
  title: string;
  items: string[];
};

export const howWeWorkPhases: HowWeWorkPhase[] = [
  {
    phase: 1,
    title: "Discovery & Architecture Planning",
    items: [
      "Understand current environment and constraints",
      "Review goals and success criteria",
      "Define scope and success metrics",
    ],
  },
  {
    phase: 2,
    title: "Secure Access Setup",
    items: [
      "Role-based access configuration",
      "Time-bound permissions",
      "Least-privilege model",
      "Activity logging enabled",
    ],
  },
  {
    phase: 3,
    title: "Architecture & Implementation",
    items: [
      "Infrastructure as Code",
      "Pipeline-based deployments",
      "Controlled environment promotion",
    ],
  },
  {
    phase: 4,
    title: "Validation & Hardening",
    items: [
      "Security review",
      "Cost review",
      "Reliability validation",
    ],
  },
  {
    phase: 5,
    title: "Handover & Ongoing Optimization",
    items: [
      "Documentation delivery",
      "Knowledge transfer session",
      "Continuous improvement model",
    ],
  },
];

// ——— Security & Access Model ———
export const securityAccessWeDoNot = [
  "We do not require root credentials.",
  "We do not use shared passwords.",
];

export const securityAccessWeOperateUsing = [
  "Role-based IAM access",
  "Federated identity (SSO where available)",
  "Auditable activity logging",
  "Infrastructure-as-Code deployments",
  "Pipeline-based execution",
];

export type SecurityAccessBlock = {
  title: string;
  items: string[];
};

export const securityAccessBlocks: SecurityAccessBlock[] = [
  {
    title: "Access Control",
    items: [
      "Least privilege",
      "Scoped permissions",
      "Temporary elevation if required",
    ],
  },
  {
    title: "Deployment Methodology",
    items: [
      "Version-controlled infrastructure",
      "CI/CD-driven changes",
      "Change visibility",
    ],
  },
  {
    title: "Governance & Auditability",
    items: [
      "Logged access",
      "Change traceability",
      "Cost and usage monitoring",
    ],
  },
];

// ——— Client Collaboration Model ———
export const clientCollaborationItems = [
  "We work alongside internal teams.",
  "We integrate with existing GitHub workflows.",
  "We align with internal security policies.",
  "We provide clear documentation.",
];
