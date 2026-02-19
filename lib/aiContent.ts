export type AISolutionCard = {
  id: string;
  title: string;
  description: string;
  bullets: string[];
  href: string;
};

export type AIProcessStep = {
  step: string;
  title: string;
  description: string;
};

export type AIPackage = {
  id: string;
  name: string;
  duration: string;
  includes: string[];
  bestFor: string;
};

export type AIFAQ = {
  question: string;
  answer: string;
};

export const aiHero = {
  title: "Practical AI. Deployed Securely. Built for Business.",
  subtitle:
    "We design and deploy AI systems inside your cloud infrastructure — securely, responsibly, and production-ready.",
  ctaPrimary: "Talk to an Engineer",
  ctaSecondary: "Explore AI Capabilities",
};

export const aiWhatWeBuild: AISolutionCard[] = [
  {
    id: "internal-ai",
    title: "Internal AI Assistants",
    description: "AI that works with your company knowledge and tools.",
    bullets: [
      "Company knowledge copilots",
      "Document search systems",
      "Ticket triage assistants",
      "Slack / Teams AI bots",
    ],
    href: "/ai-solutions/internal-ai",
  },
  {
    id: "ai-automation",
    title: "Workflow Automation with AI",
    description: "Automate repetitive workflows with AI-powered classification and enrichment.",
    bullets: [
      "Email classification",
      "Support automation",
      "CRM data enrichment",
      "Report generation",
    ],
    href: "/ai-solutions/ai-automation",
  },
  {
    id: "ai-apps",
    title: "AI-Powered Applications",
    description: "Custom applications with AI chat, recommendations, and LLM integrations.",
    bullets: [
      "AI chat interfaces",
      "Recommendation systems",
      "Custom LLM integrations",
      "AI-enhanced SaaS features",
    ],
    href: "/ai-solutions/ai-infrastructure",
  },
  {
    id: "ai-infrastructure",
    title: "Secure AI Infrastructure",
    description: "Private deployments, API integration, and production-grade hosting.",
    bullets: [
      "Private LLM deployments",
      "API-based AI integration",
      "Cloud-based model hosting",
      "Logging + monitoring AI usage",
    ],
    href: "/ai-solutions/ai-infrastructure",
  },
];

export const aiProcessSteps: AIProcessStep[] = [
  {
    step: "01",
    title: "Discovery & Use Case Design",
    description: "We define clear use cases, success criteria, and data requirements so AI delivers measurable outcomes.",
  },
  {
    step: "02",
    title: "Architecture & Model Selection",
    description: "We choose the right models and architecture—off-the-shelf, fine-tuned, or private—based on your needs and constraints.",
  },
  {
    step: "03",
    title: "Secure Cloud Deployment",
    description: "We deploy AI inside your cloud (AWS, Azure, or GCP) with proper access control, networking, and compliance in mind.",
  },
  {
    step: "04",
    title: "Integration with Existing Systems",
    description: "We integrate AI with your existing tools, APIs, and data sources so it fits into how you already work.",
  },
  {
    step: "05",
    title: "Monitoring, Governance & Optimization",
    description: "We set up monitoring, cost tracking, and governance so you can run and improve AI safely over time.",
  },
];

export const aiCloudExpertise = {
  aws: {
    title: "AI on AWS",
    bullets: [
      "Model hosting (SageMaker, ECS, EKS)",
      "Secure inference endpoints",
      "AI integrated with CI/CD",
    ],
  },
  azure: {
    title: "AI on Azure",
    bullets: [
      "Enterprise AI integration",
      "Secure identity management",
      "Cloud-native AI pipelines",
    ],
  },
  gcp: {
    title: "AI on GCP",
    bullets: [
      "Scalable model hosting (Vertex AI)",
      "Data + AI integration",
      "Observability and cost tracking",
    ],
  },
};

export const aiWhyNow = {
  title: "Why Businesses Need This Now",
  intro:
    "Small and mid-sized businesses need AI that delivers real operational value without hype.",
  points: [
    "Reduces manual workload on repetitive tasks",
    "Improves operational efficiency where it matters",
    "Integrates with existing tools and workflows",
    "Protects sensitive data inside your cloud",
    "Controls AI-related costs with clear visibility",
  ],
};

export const aiGovernance = [
  "Responsible AI deployment with clear use cases and boundaries",
  "Data privacy considerations and where data is processed",
  "Access control and identity integration",
  "Audit logging for AI usage and decisions",
  "Cost visibility and optimization for AI workloads",
];

export const aiPackages: AIPackage[] = [
  {
    id: "readiness",
    name: "AI Readiness Assessment",
    duration: "1–2 weeks",
    includes: [
      "Use-case evaluation and prioritization",
      "ROI estimation and feasibility",
      "Architecture and security proposal",
    ],
    bestFor: "Teams exploring where AI can add value.",
  },
  {
    id: "pilot",
    name: "AI Pilot Deployment",
    duration: "2–6 weeks",
    includes: [
      "Single use-case implementation",
      "Secure deployment in your cloud",
      "Integration with 1–2 existing systems",
    ],
    bestFor: "Teams ready to prove value with one use case.",
  },
  {
    id: "platform",
    name: "AI Platform Build",
    duration: "6–12 weeks",
    includes: [
      "Full internal AI system design and build",
      "Multi-system integration",
      "Monitoring and governance setup",
    ],
    bestFor: "Organizations scaling AI across workflows.",
  },
];

export const aiFAQ: AIFAQ[] = [
  {
    question: "What makes Vision XIX Labs different for AI?",
    answer:
      "We focus on production deployment, not demos. Every engagement includes secure cloud deployment, integration with your existing systems, observability, cost controls, and governance. We design for operations from day one.",
  },
  {
    question: "Do you train custom models?",
    answer:
      "We work with off-the-shelf models, fine-tuned models, and custom training where it makes sense. We recommend the most practical approach for your use case and budget.",
  },
  {
    question: "Do you deploy AI inside our cloud?",
    answer:
      "Yes. We deploy AI inside your existing AWS, Azure, or GCP environment so data stays in your control and integrates with your security and compliance posture.",
  },
  {
    question: "Can AI integrate with GitHub or CI/CD?",
    answer:
      "Yes. We integrate AI with your existing DevOps and CI/CD pipelines—for example, code assistance, PR summaries, or deployment automation—so it fits into how you already ship software.",
  },
  {
    question: "How secure is the data?",
    answer:
      "We design for security by default: data stays in your cloud, access is controlled via your identity provider, and we follow least-privilege and audit logging practices.",
  },
  {
    question: "Can you optimize AI costs?",
    answer:
      "Yes. We help with model selection, right-sizing inference, and cost monitoring so you get value without runaway spend.",
  },
  {
    question: "What cloud providers do you support?",
    answer:
      "We support AWS, Azure, and GCP. We deploy and integrate AI on the provider you already use.",
  },
  {
    question: "How do you handle AI cost management?",
    answer:
      "We design for cost visibility: quotas, budgets, usage dashboards, and alerts. We use caching, model routing, and right-sized inference to keep spend predictable. No surprises.",
  },
  {
    question: "Can you help with RAG and vector search?",
    answer:
      "Yes. We build retrieval-augmented generation (RAG) systems for document search, knowledge bases, and Q&A. We use vector stores (Pinecone, pgvector, OpenSearch) and design for accuracy and latency.",
  },
  {
    question: "Do you offer AI readiness assessments?",
    answer:
      "Yes. Our AI Readiness Assessment covers use-case evaluation, feasibility, architecture, and ROI estimation. It's a 1–2 week engagement to define your path before building.",
  },
];
