/**
 * Engineering case studies & reference architectures.
 * Representative engagements only. No fabricated clients, logos, or metrics.
 */

export type CaseStudy = {
  id: string;
  title: string;
  context: string;
  technicalChallenge: string[];
  architectureApproach: string[];
  implementationStrategy: string[];
  operationalModel: string[];
  deliverables: string[];
  outcome: string[];
};

export type ReferenceArchitecture = {
  id: string;
  title: string;
  coreComponents: string;
  accessModel: string;
  deploymentMethod: string;
  observabilityLayer: string;
  costControlApproach: string;
};

export const caseStudiesHero = {
  title: "Representative Engineering Engagements",
  subtitle:
    "Examples of cloud, DevOps, and AI systems we design and implement for modern teams.",
};

export const caseStudies: CaseStudy[] = [
  {
    id: "cloud-platform-modernization",
    title: "Cloud Platform Modernization with CI/CD Automation",
    context:
      "Growing SaaS team with manual deployments and inconsistent environments.",
    technicalChallenge: [
      "Environment drift",
      "Release instability",
      "Lack of audit visibility",
    ],
    architectureApproach: [
      "Environment separation strategy",
      "Version-controlled infrastructure",
      "Role-based access control",
      "CI/CD standardization",
    ],
    implementationStrategy: [
      "GitHub workflow integration",
      "Octopus-based deployment orchestration",
      "Environment promotion model",
      "Rollback strategy",
    ],
    operationalModel: [
      "Observability baseline",
      "Cost visibility dashboards",
      "Security review",
    ],
    deliverables: [
      "Infrastructure repository",
      "CI/CD pipeline configuration",
      "Documentation & runbooks",
      "Deployment governance model",
    ],
    outcome: [
      "Structured release model",
      "Improved reliability",
      "Clear operational visibility",
    ],
  },
  {
    id: "cost-optimization-governance",
    title: "Cloud Cost Optimization & Governance Framework",
    context:
      "Organization with growing cloud spend and limited visibility into usage and allocation.",
    technicalChallenge: [
      "Unattributed and underutilized resources",
      "No storage lifecycle or tiering",
      "Missing budget and alert guardrails",
      "Limited cost reporting",
    ],
    architectureApproach: [
      "Resource tagging and allocation model",
      "Storage lifecycle and archival strategy",
      "Budget and forecast alerts",
      "Cost dashboards by team or project",
    ],
    implementationStrategy: [
      "Resource utilization analysis",
      "Rightsizing and scheduling recommendations",
      "Budget and quota configuration",
      "Monitoring and anomaly detection",
    ],
    operationalModel: [
      "Regular cost review cadence",
      "Prioritized optimization backlog",
      "Chargeback or showback where applicable",
    ],
    deliverables: [
      "Cost optimization report",
      "Tagging and allocation documentation",
      "Budget and alert configuration",
      "Runbooks for cost governance",
    ],
    outcome: [
      "Predictable cost visibility",
      "Reduced waste and overprovisioning",
      "Governance framework for ongoing control",
    ],
  },
  {
    id: "secure-internal-ai",
    title: "Secure Internal AI Assistant Deployment",
    context:
      "Business needed AI-based document search and internal automation with strict data and access controls.",
    technicalChallenge: [
      "Secure integration with internal data sources",
      "Controlled model access and usage",
      "Audit and cost visibility for AI workloads",
    ],
    architectureApproach: [
      "Cloud-hosted AI integration",
      "Secure API-based model access",
      "Logging & usage monitoring",
      "Access control enforcement",
    ],
    implementationStrategy: [
      "Controlled inference endpoints",
      "Internal system integration",
      "Governance configuration",
      "Data access boundaries",
    ],
    operationalModel: [
      "Usage and cost dashboards",
      "Access review process",
      "Incident and degradation handling",
    ],
    deliverables: [
      "AI integration architecture document",
      "Access and governance documentation",
      "Monitoring and alerting setup",
      "Runbooks for operations",
    ],
    outcome: [
      "Reduced manual workflows",
      "Secure AI deployment in client environment",
      "Cost-controlled AI usage",
    ],
  },
  {
    id: "ai-workflow-automation",
    title: "AI Workflow Automation for Support & Operations",
    context:
      "Team with high-volume, repetitive support and internal operations tasks, exploring AI for triage and enrichment while keeping existing tools in place.",
    technicalChallenge: [
      "Manual triage and routing of support and ops tickets",
      "Inconsistent enrichment of records across tools",
      "Limited visibility into AI-related cost and performance",
    ],
    architectureApproach: [
      "Event-driven workflows triggered from existing systems (e.g. ticketing, email, or CRM)",
      "Centralized AI integration layer calling managed or hosted models",
      "Retrieval and context injection for domain-specific responses",
      "Logging and metrics for AI calls and outcomes",
    ],
    implementationStrategy: [
      "Design of classification and enrichment flows that feed back into existing tools",
      "Guardrails for when to use AI vs hand off to humans",
      "Rate limiting and quotas for AI usage per environment",
      "Dashboards for monitoring accuracy indicators and cost",
    ],
    operationalModel: [
      "Runbooks for reviewing and adjusting prompts and thresholds",
      "Regular review of classification performance using sample tickets",
      "Cost and usage review with owners of affected workflows",
    ],
    deliverables: [
      "Workflow and integration diagrams for AI-assisted paths",
      "Configuration and code for AI orchestration layer",
      "Monitoring and alerting configuration for AI workflows",
      "Runbooks for support and operations teams",
    ],
    outcome: [
      "Reduced manual triage effort",
      "More consistent enrichment and routing decisions",
      "Controlled and observable AI usage integrated into existing operations",
    ],
  },
  {
    id: "multi-environment-infrastructure",
    title: "Multi-Environment Infrastructure Engineering",
    context:
      "Engineering organization required consistent dev, test, and production environments with clear isolation and promotion paths.",
    technicalChallenge: [
      "Inconsistent environments and configuration drift",
      "Unclear access boundaries",
      "Manual provisioning and weak audit trail",
    ],
    architectureApproach: [
      "Dev/Test/Prod isolation strategy",
      "IAM and role design per environment",
      "Network segmentation",
      "Infrastructure-as-Code provisioning",
    ],
    implementationStrategy: [
      "Pipeline-driven deployments",
      "Environment-specific parameter management",
      "Secrets and config management",
      "Promotion and rollback procedures",
    ],
    operationalModel: [
      "Environment parity checks",
      "Change and release governance",
      "Observability per environment",
    ],
    deliverables: [
      "Infrastructure repository (IaC)",
      "Environment and access model documentation",
      "Pipeline and promotion runbooks",
      "Baseline monitoring configuration",
    ],
    outcome: [
      "Reproducible environments",
      "Clear promotion and rollback path",
      "Auditable infrastructure changes",
    ],
  },
];

export const referenceArchitectures: ReferenceArchitecture[] = [
  {
    id: "saas-blueprint",
    title: "SaaS Cloud Platform Blueprint",
    coreComponents:
      "Multi-tenant or single-tenant landing zone, environment separation (dev/staging/prod), compute and storage patterns, networking and security baselines.",
    accessModel:
      "Role-based access per environment; CI/CD identity for deployments; least-privilege scoping.",
    deploymentMethod:
      "Infrastructure as Code (Terraform, Bicep, or CloudFormation); pipeline-driven apply and promotion.",
    observabilityLayer:
      "Centralized logging, metrics, and alerting; dashboards per environment; cost and usage visibility.",
    costControlApproach:
      "Tagging and allocation; budgets and alerts; rightsizing and lifecycle policies.",
  },
  {
    id: "enterprise-cicd",
    title: "Enterprise CI/CD Deployment Model",
    coreComponents:
      "Source control integration (e.g. GitHub), build and test pipelines, artifact management, deployment orchestration (e.g. Octopus Deploy), environment promotion gates.",
    accessModel:
      "Pipeline service identities with scoped permissions; approval steps where required; audit trail for releases.",
    deploymentMethod:
      "Branching and promotion strategy; automated deploy per environment; rollback and verification steps.",
    observabilityLayer:
      "Pipeline and release visibility; deployment history and audit; integration with incident tooling.",
    costControlApproach:
      "Efficient build and cache usage; controlled pipeline and agent cost; visibility into deployment-related spend.",
  },
  {
    id: "ai-integrated-cloud",
    title: "AI-Integrated Cloud Architecture",
    coreComponents:
      "Cloud-hosted inference (managed or self-hosted), secure API layer, integration with existing data sources and applications, identity and network controls.",
    accessModel:
      "Scoped access to AI endpoints; no broad root or shared credentials; logging of requests and usage.",
    deploymentMethod:
      "Versioned API and model configuration; CI/CD for AI service updates; controlled rollout and rollback.",
    observabilityLayer:
      "Request/response logging for audit; token and cost usage; error and latency metrics; alerting on anomalies.",
    costControlApproach:
      "Model and tier selection; quotas and budgets; usage review and optimization.",
  },
  {
    id: "multi-account-governance",
    title: "Multi-Account Governance Framework",
    coreComponents:
      "Account or subscription structure (e.g. per environment or team), central identity and policy, network and security baselines, shared services where appropriate.",
    accessModel:
      "Centralized identity (e.g. federation/SSO); role-based access per account; policy guardrails (SCPs, Azure Policy, or GCP org policy).",
    deploymentMethod:
      "IaC for account and baseline provisioning; pipeline-driven updates; change review and approval.",
    observabilityLayer:
      "Centralized logging and audit; compliance and drift reporting; cost and usage aggregation across accounts.",
    costControlApproach:
      "Cost allocation by account/tag; consolidated billing and budgets; guardrails and anomaly detection.",
  },
];

export const caseStudiesDisclaimer =
  "These examples represent typical engineering engagements and architectural approaches. Specific implementations vary based on client requirements.";
