export type SecurityService = {
  id: string;
  name: string;
  description: string;
  includes: string[];
  bestFor: string;
};

export const cloudSecurityHero = {
  title: "Cloud Security That Ships With Your Infrastructure",
  subtitle:
    "Security baseline enforcement, zero-trust deployment, AI workload isolation, and measurable risk reduction — built into your cloud from day one.",
};

export const cloudSecurityServices: SecurityService[] = [
  {
    id: "security-baseline",
    name: "Security Baseline Enforcement",
    description:
      "Pre-configured security controls that enforce governance across every account and region automatically.",
    includes: [
      "IAM role audit and least-privilege enforcement",
      "Root account lockdown with hardware MFA",
      "Service Control Policies across organization",
      "CloudTrail and GuardDuty enablement",
      "Automated guardrail configuration via IaC",
      "Security Hub baseline with auto-remediation",
    ],
    bestFor: "Teams building foundational cloud security practices.",
  },
  {
    id: "devops-hardening",
    name: "CI/CD & Deployment Hardening",
    description:
      "Pipelines that enforce security by default — role-based access, secret rotation, immutable artifacts, and full change traceability.",
    includes: [
      "Pipeline permission model with role-based gates",
      "Secret management with rotation enforcement",
      "Infrastructure-as-Code with drift detection",
      "Immutable artifact signing and verification",
      "Change traceability with approval audit trail",
    ],
    bestFor: "Teams moving from console deploys to automated, auditable releases.",
  },
  {
    id: "ai-security-review",
    name: "AI & LLM Security Architecture",
    description:
      "Secure AI workloads in production — model isolation, prompt injection defense, cost guardrails, and data classification enforcement.",
    includes: [
      "Model endpoint isolation and access control",
      "Prompt injection and data exfiltration defense",
      "AI-specific logging and anomaly detection",
      "Per-model cost guardrails and budget alerts",
      "Data classification enforcement for training data",
      "Incident response runbooks for AI-specific failures",
    ],
    bestFor: "Teams deploying LLMs, RAG pipelines, or AI-assisted workflows in production.",
  },
  {
    id: "visibility-monitoring",
    name: "Security Observability & Incident Response",
    description:
      "Centralized security visibility with actionable alerts, automated response, and incident runbooks that reduce MTTR.",
    includes: [
      "Centralized logging with correlation and search",
      "SLO-driven alert thresholds — zero noise, only signal",
      "Budget anomaly detection with auto-notification",
      "Incident response playbooks and escalation paths",
      "Secrets exposure monitoring and rotation triggers",
    ],
    bestFor: "Teams scaling beyond ad-hoc monitoring into structured security operations.",
  },
];

export const accessModelItems = [
  "Cross-account IAM role assumption — revoke anytime",
  "Federated authentication with SSO integration",
  "Zero stored credentials — validated and encrypted in transit",
  "Immutable audit trail for every action",
  "Infrastructure-as-Code deployments with approval gates",
];

export const whatWeAreNot = [
  "We specialize in infrastructure-level security, not penetration testing",
  "We implement controls that support compliance — certification audits require specialized firms",
  "We harden your cloud posture; we don't replace your security team",
];

export const whatWeFocusOnSecurity = [
  "Security baseline enforcement across accounts and regions",
  "Zero-trust deployment with immutable infrastructure",
  "AI workload isolation and cost containment",
  "Measurable risk reduction with before/after metrics",
];

export const securityPrinciples = [
  "Security is enforced by architecture, not documentation.",
  "Every action is logged, attributable, and reversible.",
  "Changes are version-controlled, reviewed, and reproducible.",
  "Access follows least privilege with automatic expiration.",
];

export type FAQItem = { question: string; answer: string };

export const cloudSecurityFAQ: FAQItem[] = [
  {
    question: "Do you perform penetration testing?",
    answer:
      "We focus on infrastructure-level security: IAM hardening, deployment pipelines, network segmentation, and AI workload isolation. For penetration testing, we work alongside specialized firms and ensure your infrastructure is hardened before they test.",
  },
  {
    question: "How do you access our cloud environment?",
    answer:
      "Cross-account IAM role assumption with least privilege. No stored credentials — we validate and encrypt in transit. All access is logged via CloudTrail. Revoke access anytime from your AWS console; active sessions self-terminate within 60 seconds.",
  },
  {
    question: "Can you help with SOC2 or compliance readiness?",
    answer:
      "We implement the security controls that compliance frameworks require: IAM governance, logging, change management, encryption, and access auditing. For certification itself, you work with an audit firm — but the infrastructure they evaluate is what we build.",
  },
  {
    question: "What if we already have security controls in place?",
    answer:
      "We audit what exists, quantify gaps with a risk-weighted scorecard, and implement improvements in priority order. Existing controls are preserved and strengthened, not replaced.",
  },
  {
    question: "How do you secure AI workloads specifically?",
    answer:
      "Model endpoint isolation, prompt injection defense, per-model cost guardrails, data classification for training data, and AI-specific incident response runbooks. Every AI workload gets the same governance as your core infrastructure.",
  },
];
