/**
 * Cloud Security & Infrastructure Hardening — content.
 * Secure-by-design positioning. No exaggerated claims.
 */

export type SecurityService = {
  id: string;
  name: string;
  description: string;
  includes: string[];
  bestFor: string;
};

export const cloudSecurityHero = {
  title: "Secure-by-Design Cloud Engineering",
  subtitle:
    "We build security into your cloud infrastructure and deployment process — practical hardening, not compliance theater.",
};

export const cloudSecurityServices: SecurityService[] = [
  {
    id: "security-baseline",
    name: "Cloud Security Baseline",
    description:
      "Establish foundational security controls within your cloud environment.",
    includes: [
      "IAM role review",
      "Least privilege access configuration",
      "Root account lockdown strategy",
      "MFA enforcement guidance",
      "Logging enablement",
      "Basic guardrail configuration",
    ],
    bestFor: "Startups and growing teams lacking structured security.",
  },
  {
    id: "devops-hardening",
    name: "Deployment & DevOps Hardening",
    description: "Reduce risk in your release and deployment process.",
    includes: [
      "CI/CD access review",
      "Role-based pipeline permissions",
      "Secret management review",
      "Infrastructure-as-Code enforcement",
      "Change traceability setup",
    ],
    bestFor: "Teams deploying via console or lacking audit visibility.",
  },
  {
    id: "ai-security-review",
    name: "AI Infrastructure Security Review",
    description: "Secure AI integrations and prevent data exposure.",
    includes: [
      "API access control review",
      "Model endpoint access policy",
      "AI logging configuration",
      "Cost monitoring setup",
      "Governance recommendations",
    ],
    bestFor: "Businesses implementing AI features.",
  },
  {
    id: "visibility-monitoring",
    name: "Cloud Visibility & Monitoring Setup",
    description: "Improve operational and security visibility.",
    includes: [
      "Centralized logging configuration",
      "Alert threshold setup",
      "Budget anomaly detection",
      "Basic monitoring framework",
    ],
    bestFor: "Teams without structured observability.",
  },
];

export const accessModelItems = [
  "Role-based IAM access",
  "Federated authentication where possible",
  "No shared credentials",
  "Auditable activity logging",
  "Infrastructure-as-Code deployments",
];

export const whatWeAreNot = [
  "A SOC2 audit firm",
  "A penetration testing service",
  "A compliance-only consultancy",
];

export const whatWeFocusOnSecurity = [
  "Practical cloud security hardening",
  "Infrastructure-level protection",
  "Deployment discipline",
  "Secure architecture design",
];

export const securityPrinciples = [
  "Security is embedded in architecture decisions.",
  "Access is always controlled and auditable.",
  "Changes are documented and reproducible.",
  "Infrastructure is version-controlled.",
];

export type FAQItem = { question: string; answer: string };

export const cloudSecurityFAQ: FAQItem[] = [
  {
    question: "Do you perform penetration testing or security audits?",
    answer:
      "No. We focus on building and hardening cloud infrastructure and deployment practices. For pentests or formal compliance audits, we recommend specialized firms and can work alongside them.",
  },
  {
    question: "How do you access our cloud environment?",
    answer:
      "We use role-based IAM access with least privilege, federated auth where available, and never use shared credentials. All access is logged and auditable. We deploy via Infrastructure as Code, not manual console changes.",
  },
  {
    question: "Can you help us get SOC2 or other certifications?",
    answer:
      "We are not a compliance audit firm. We can help you implement security controls and practices that support compliance goals (e.g., IAM, logging, change management). For certification itself, you would work with an audit or compliance specialist.",
  },
  {
    question: "What if we already have some security in place?",
    answer:
      "We often work with teams that have partial controls. We review what you have, identify gaps and priorities, and implement improvements in a structured way without disrupting existing workflows.",
  },
];
