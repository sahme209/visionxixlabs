/**
 * Solutions for Growing Teams — SMB/startup packages and copy.
 * Outcome-focused, fixed-scope, no buzzwords.
 */

export type GrowingTeamsPackage = {
  id: string;
  name: string;
  description: string;
  includes: string[];
  bestFor: string;
};

export const growingTeamsPackages: GrowingTeamsPackage[] = [
  {
    id: "cloud-health-check",
    name: "Cloud Health Check",
    description: "A structured review of your cloud environment with actionable improvements.",
    includes: [
      "Cost analysis",
      "IAM & security review",
      "Infrastructure review",
      "Deployment process review",
      "Written improvement roadmap",
    ],
    bestFor: "Startups or small teams unsure about their current cloud setup.",
  },
  {
    id: "devops-cicd-setup",
    name: "DevOps & CI/CD Setup",
    description: "Move from manual deployments to structured release automation.",
    includes: [
      "GitHub workflow setup",
      "Octopus-based deployment strategy (if applicable)",
      "Environment separation",
      "Rollback configuration",
      "Documentation",
    ],
    bestFor: "Teams deploying manually or with unstable releases.",
  },
  {
    id: "ai-automation-starter",
    name: "AI Automation Starter",
    description: "Deploy secure AI-powered workflows inside your cloud.",
    includes: [
      "Internal AI assistant setup",
      "Workflow automation",
      "Secure API integration",
      "Usage monitoring",
      "Access control configuration",
    ],
    bestFor: "Teams looking to reduce repetitive manual tasks.",
  },
  {
    id: "cloud-cost-optimization-sprint",
    name: "Cloud Cost Optimization Sprint",
    description: "Reduce unnecessary cloud spend and improve cost visibility.",
    includes: [
      "Resource utilization analysis",
      "Storage optimization plan",
      "Budget guardrails",
      "Cost dashboard configuration",
    ],
    bestFor: "Businesses experiencing rising cloud bills.",
  },
];

export type ProcessStepItem = {
  step: number;
  title: string;
  description: string;
};

export const growingTeamsProcessSteps: ProcessStepItem[] = [
  { step: 1, title: "Quick Assessment Call", description: "We discuss your goals and current setup to confirm fit and scope." },
  { step: 2, title: "Clear Scope & Timeline", description: "You receive a fixed scope, deliverables, and timeline before we start." },
  { step: 3, title: "Structured Implementation", description: "We work through the plan with clear checkpoints and communication." },
  { step: 4, title: "Documentation & Handover", description: "You get documentation and a handover so your team can maintain the work." },
];

export const growingTeamsTrustItems = [
  "Role-based access only",
  "No shared credentials",
  "Documented changes",
  "Clear communication",
];

export const growingTeamsPricingCopy = {
  line1: "Fixed-scope engagements available.",
  line2: "Clear deliverables and timeline.",
  line3: "Transparent pricing after initial consultation.",
};

export const growingTeamsHero = {
  title: "Cloud & AI Solutions for Growing Teams",
  subtitle: "Outcome-focused packages for startups and small businesses. Fixed scope, clear deliverables, no hype.",
};
