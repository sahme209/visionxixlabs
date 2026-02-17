/**
 * Production AI Systems — structured offerings.
 * Positioning: "Production AI Systems, not AI demos."
 */

export type AIOffering = {
  id: string;
  title: string;
  tagline: string;
  problem: string;
  technicalApproach: string;
  deploymentModel: string;
  securityModel: string;
  deliverables: string[];
  idealClient: string;
};

export const aiOfferings: AIOffering[] = [
  {
    id: "internal-ai-assistant",
    title: "Internal AI Assistant Deployment",
    tagline: "Company knowledge and tools, in one place.",
    problem:
      "Teams waste time searching docs, tickets, and tools. Generic chatbots don’t know your systems or policies, and off-the-shelf AI can’t be trusted with internal data.",
    technicalApproach:
      "We deploy assistants that connect to your approved data sources (wiki, docs, ticketing, CRM) via secure APIs. We use RAG over your data with guardrails, and optional fine-tuning where it adds value. All running inside your cloud with no data sent to public training.",
    deploymentModel:
      "Hosted in your AWS/Azure/GCP account. Optional Slack/Teams integration with scoped OAuth. Updates and model refreshes follow your change process.",
    securityModel:
      "Data stays in your tenant. No training on your data. Access controlled by your IdP. Audit logging for all queries and actions. Optional PII redaction and content filters.",
    deliverables: [
      "Deployed assistant with defined scope and data sources",
      "Documentation and runbook",
      "Access and guardrail configuration",
      "Optional integration (Slack/Teams) and training for your team",
    ],
    idealClient:
      "Teams of 10–200 with existing docs and tools who want a single, secure internal assistant instead of ad‑hoc ChatGPT or scattered tools.",
  },
  {
    id: "ai-workflow-automation",
    title: "AI Workflow Automation Systems",
    tagline: "Classify, enrich, and route — without manual triage.",
    problem:
      "Repetitive workflows (support triage, email routing, CRM enrichment, report drafting) consume time and don’t scale. Manual rules are brittle; fully manual work doesn’t scale.",
    technicalApproach:
      "We design pipelines that use AI for classification, extraction, and light generation where it’s reliable, and hand off to rules or humans where it’s not. Integrations with your existing tools (email, ticketing, CRM) via APIs. Retries, fallbacks, and human-in-the-loop for edge cases.",
    deploymentModel:
      "Runs in your cloud (Lambda, Functions, or containers). Triggered by events or schedules. We deliver IaC and CI/CD so your team can own and extend it.",
    securityModel:
      "Credentials and secrets in your vault. Logs and PII in your tenant. No data sent to external training. We define data retention and access per your policy.",
    deliverables: [
      "Working automation pipeline with defined inputs/outputs",
      "IaC and deployment pipeline",
      "Runbook and monitoring/alerting",
      "Documentation for extending or modifying flows",
    ],
    idealClient:
      "Operations or support teams with clear, repeatable workflows that want to reduce manual triage and speed up routing or enrichment without replacing existing tools.",
  },
  {
    id: "secure-llm-integration",
    title: "Secure LLM Integration",
    tagline: "Private and vendor APIs — integrated safely.",
    problem:
      "You need LLM capability (summarization, Q&A, code assist) but can’t send sensitive data to public APIs. Self-hosted or vendor LLMs need consistent auth, logging, and governance.",
    technicalApproach:
      "We design and implement a single integration layer: auth, routing, prompt templates, and response handling. We support private models (e.g. in your VPC or approved vendor VPC) and/or approved vendor APIs with no-training terms. Rate limits, retries, and fallbacks are built in.",
    deploymentModel:
      "API layer in your cloud (e.g. API Gateway + Lambda or containerized service). Clients call your endpoint; we handle model selection and routing. You own the infra and credentials.",
    securityModel:
      "All traffic stays within your boundary or to approved vendors. No data used for training. Logging and access control aligned with your compliance. Optional PII filtering and content policies.",
    deliverables: [
      "Deployed LLM integration API with documentation",
      "Auth and usage controls",
      "Logging and monitoring setup",
      "Runbook and guidance for adding models or use cases",
    ],
    idealClient:
      "Engineering teams that need to use LLMs in production (internal or customer-facing) and want one secure, auditable integration pattern instead of ad‑hoc API keys and scripts.",
  },
  {
    id: "ai-governance-monitoring",
    title: "AI Governance & Monitoring",
    tagline: "Visibility, guardrails, and audit trail for AI in production.",
    problem:
      "AI systems go live without clear ownership, usage visibility, or rollback. When something goes wrong, you can’t answer who used what, when, or what changed.",
    technicalApproach:
      "We add logging, metrics, and alerting for AI workloads: request/response sampling, latency and error rates, cost per use, and optional PII/quality checks. We define retention and access so you can audit and debug. Dashboards and alerts go to the right owners.",
    deploymentModel:
      "Logging and metrics in your existing observability stack (CloudWatch, Azure Monitor, GCP, or third-party). We provide configs, dashboards, and alert rules as code.",
    securityModel:
      "Logs and metrics stay in your tenant. Access follows your IAM. Sensitive data can be redacted or excluded. Retention and deletion follow your policy.",
    deliverables: [
      "Logging and metrics pipeline for AI usage",
      "Dashboards and alert rules",
      "Retention and access documentation",
      "Runbook for investigating incidents and reviewing usage",
    ],
    idealClient:
      "Teams that already have AI in production (or are about to) and need governance, cost visibility, and auditability for compliance or internal policy.",
  },
  {
    id: "ai-cost-management",
    title: "AI Cost Management Setup",
    tagline: "Predictable spend and guardrails for AI usage.",
    problem:
      "AI costs can spike with usage or model changes. Without allocation and limits, teams can’t attribute spend or prevent runaway usage.",
    technicalApproach:
      "We implement allocation (by team, project, or environment), quotas and budgets, and alerts when thresholds are hit. We use native cloud billing and, where needed, application-level metering. Recommendations for reserved capacity or model choices when they reduce cost.",
    deploymentModel:
      "Uses your cloud billing and tagging; we add budgets, alerts, and optional metering in your account. No external cost aggregation required unless you already use it.",
    securityModel:
      "Financial data stays in your tenant. Access to cost dashboards and alerts follows your IAM. We don’t store raw billing data elsewhere.",
    deliverables: [
      "Tagging and allocation strategy for AI-related spend",
      "Budgets and alert rules",
      "Dashboard for AI cost by team/project",
      "Short guide on interpreting alerts and optimizing spend",
    ],
    idealClient:
      "Teams scaling AI usage who need to control cost, attribute it to teams or products, and avoid surprises at bill time.",
  },
];
