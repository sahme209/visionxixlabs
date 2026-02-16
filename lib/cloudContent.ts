export type Solution = {
  id: string;
  title: string;
  description: string;
  bestFor: string;
  href: string;
};

export type SolutionDetailSection = {
  heading: string;
  body: string;
  bullets?: string[];
};

export type SolutionDetail = {
  id: string;
  title: string;
  intro: string;
  sections: SolutionDetailSection[];
  idealFor: string[];
  relatedProviders: ("aws" | "azure" | "gcp" | "multi-cloud")[];
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
  title: "Engineering reliable, scalable cloud platforms.",
  subtitle:
    "We design, automate, optimize, and operate cloud infrastructure across AWS, Azure, and Google Cloud.",
  capabilities: [
    "Cloud Architecture",
    "DevOps Automation",
    "AI/ML Engineering",
    "Kubernetes & Containers",
    "Data Engineering",
    "Serverless Architecture",
    "FinOps",
    "Reliability Engineering",
    "Security & Governance",
    "Multi-Cloud Strategy",
  ],
};

export const cloudSolutionCards: Solution[] = [
  {
    id: "cloud-foundations",
    title: "Cloud Foundations",
    description:
      "Landing zones and baseline architecture that give AWS, Azure, and GCP platforms a secure, scalable starting point.",
    bestFor: "Teams standardizing how new apps land in the cloud.",
    href: "/cloud-solutions/cloud-foundations",
  },
  {
    id: "cicd-release-automation",
    title: "CI/CD & Release Automation",
    description:
      "GitHub-centric pipelines and Octopus Deploy release workflows so changes move from commit to production safely.",
    bestFor: "Teams wanting predictable, low-friction deployments.",
    href: "/cloud-solutions/cicd-release-automation",
  },
  {
    id: "cost-optimization",
    title: "Cost Optimization (FinOps)",
    description:
      "Practical cost optimization on AWS, Azure, and GCP, from right-sizing to storage tuning and budget guardrails.",
    bestFor: "Leaders needing lower, more predictable cloud spend.",
    href: "/cloud-solutions/cost-optimization",
  },
  {
    id: "reliability-observability",
    title: "Reliability & Observability",
    description:
      "Monitoring, alerting, and dashboards tuned to business impact so issues are found and fixed quickly.",
    bestFor: "Teams owning uptime and on-call.",
    href: "/cloud-solutions/reliability-observability",
  },
  {
    id: "security-governance",
    title: "Security & Governance",
    description:
      "IAM and policy guardrails that keep access controlled without slowing engineering teams down.",
    bestFor: "Organizations with compliance and audit needs.",
    href: "/cloud-solutions/security-governance",
  },
  {
    id: "migration-modernization",
    title: "Migration & Modernization",
    description:
      "Structured migrations into AWS or Azure and modernization paths that reduce risk and technical debt.",
    bestFor: "Teams moving from data centers or legacy platforms.",
    href: "/cloud-solutions/migration-modernization",
  },
  {
    id: "backup-dr",
    title: "Backup, DR & Business Continuity",
    description:
      "Backup strategy, recovery objectives, and DR patterns matched to your business tolerance and budget.",
    bestFor: "Systems that must be available when it matters most.",
    href: "/cloud-solutions/backup-dr",
  },
  {
    id: "platform-operations",
    title: "Platform Operations",
    description:
      "Runbooks, on-call readiness, and operating models so your cloud platform can be run with confidence.",
    bestFor: "Teams formalizing SRE and platform operations.",
    href: "/cloud-solutions/platform-operations",
  },
  {
    id: "data-storage-strategy",
    title: "Data & Storage Strategy",
    description:
      "High-level guidance for choosing storage patterns that balance performance, durability, and cost.",
    bestFor: "Product and data teams planning their next phase.",
    href: "/cloud-solutions/data-storage-strategy",
  },
  {
    id: "networking-connectivity",
    title: "Networking & Connectivity",
    description:
      "VPCs/VNets, connectivity, and routing models that keep services talking securely and predictably.",
    bestFor: "Hybrid and multi-environment architectures.",
    href: "/cloud-solutions/networking-connectivity",
  },
  {
    id: "ai-ml-engineering",
    title: "AI/ML Engineering & MLOps",
    description:
      "Design and operate ML infrastructure, model deployment pipelines, and MLOps practices for production AI workloads.",
    bestFor: "Teams deploying and operating ML models at scale.",
    href: "/cloud-solutions/ai-ml-engineering",
  },
  {
    id: "kubernetes-containers",
    title: "Kubernetes & Container Orchestration",
    description:
      "Design, deploy, and operate Kubernetes clusters on AWS EKS, Azure AKS, or GCP GKE with production-ready patterns.",
    bestFor: "Teams containerizing applications and scaling container workloads.",
    href: "/cloud-solutions/kubernetes-containers",
  },
  {
    id: "data-engineering-analytics",
    title: "Data Engineering & Analytics",
    description:
      "Build data pipelines, data lakes, and analytics platforms on cloud-native services for real-time and batch processing.",
    bestFor: "Organizations needing scalable data infrastructure and analytics capabilities.",
    href: "/cloud-solutions/data-engineering-analytics",
  },
  {
    id: "serverless-architecture",
    title: "Serverless Architecture",
    description:
      "Design and implement serverless applications using AWS Lambda, Azure Functions, and Cloud Functions for cost-effective scaling.",
    bestFor: "Teams building event-driven applications or optimizing compute costs.",
    href: "/cloud-solutions/serverless-architecture",
  },
  {
    id: "cloud-native-development",
    title: "Cloud-Native Application Development",
    description:
      "Architect and build applications specifically designed for cloud platforms using microservices, APIs, and cloud-native patterns.",
    bestFor: "Teams building new applications or modernizing legacy systems.",
    href: "/cloud-solutions/cloud-native-development",
  },
];

export const engagementPackages: Package[] = [
  {
    id: "assessment",
    name: "Cloud Assessment",
    duration: "1–2 weeks",
    includes: [
      "Current-state review of AWS, Azure, and/or GCP",
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
      "Baseline AWS, Azure, and/or GCP landing zone",
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
  "Production-ready architecture diagrams for AWS, Azure, and GCP environments",
  "Infrastructure-as-Code repositories (Terraform, Bicep, or CloudFormation where applicable)",
  "CI/CD automation pipelines and deployment workflows",
  "Monitoring and alerting baselines",
  "Security guardrails and access model recommendations",
  "Cost optimization report and action plan",
  "Operational runbooks and handover session for your team",
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
  "Security-first delivery with least-privilege access by default",
  "Infrastructure as Code for reproducible, reviewable changes",
  "Audit-ready configurations and clear change control",
  "Repeatable automation over one-off changes",
  "Documentation and handover included as part of delivery",
  "Measurable outcomes for reliability, performance, and cost",
];

export const toolsWeWorkWith =
  "AWS • Azure • Google Cloud (GCP) • Kubernetes (EKS/AKS/GKE) • GitHub • Octopus Deploy • Terraform • AI/ML Platforms (SageMaker/Azure ML/Vertex AI) • monitoring and logging tools";

export const cloudFAQ: FAQ[] = [
  {
    question: "Do you do migrations?",
    answer:
      "Yes. We help plan and execute migrations into AWS, Azure, and GCP using an incremental, low-risk approach that aligns to your release and change-management processes.",
  },
  {
    question: "Can you optimize an existing cloud bill?",
    answer:
      "Yes. We review your current AWS, Azure, and/or GCP usage, identify waste and right-sizing opportunities, and provide a focused action plan with estimated impact.",
  },
  {
    question: "Do you support multi-cloud?",
    answer:
      "Yes. We work with AWS, Azure, and GCP. Where multi-cloud or hybrid makes sense, we help you standardize patterns while respecting provider differences.",
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
    question: "How do you handle security?",
    answer:
      "Security is treated as a first-class concern. We design least-privilege access models, use Infrastructure as Code for changes, and align with your existing security and compliance processes.",
  },
  {
    question: "What access do you need?",
    answer:
      "We work with least-privilege principles. Typically we start with read-only access and work with your team to grant additional permissions as needed for implementation.",
  },
  {
    question: "Do you work with internal teams or as an external function?",
    answer:
      "We prefer to work alongside your internal teams, pairing on design and implementation so knowledge, patterns, and ownership stay with you after the engagement.",
  },
  {
    question: "Can you help if we already have a cloud platform?",
    answer:
      "Yes. Many engagements focus on improving an existing AWS, Azure, or GCP platform—addressing reliability, cost, security, or delivery friction rather than starting from scratch.",
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

export const gcpSummaryBullets = [
  "Design GCP project structures and network layouts that scale with your organization.",
  "Shape compute and storage usage for balanced performance, resilience, and cost.",
  "Integrate CI/CD workflows that target GCP services safely and predictably.",
  "Establish logging, metrics, and access patterns that support day-to-day operations.",
];

export const solutionDetails: SolutionDetail[] = [
  {
    id: "cloud-foundations",
    title: "Cloud Foundations",
    intro:
      "Establish a secure, scalable baseline on AWS, Azure, and GCP with clear patterns for accounts, projects, and networking.",
    sections: [
      {
        heading: "Architecture and account structure",
        body:
          "We define high-level landing zone patterns, account and project structures, and environment boundaries so teams have a consistent place to build.",
        bullets: [
          "Landing zone concepts tailored to your organization and constraints",
          "Environment separation for dev, test, staging, and production",
          "Baseline guardrails for logging, security, and cost visibility",
        ],
      },
      {
        heading: "Network and connectivity",
        body:
          "We design VPCs, VNets, and VPC networks with routing and connectivity approaches that support current and future workloads.",
        bullets: [
          "Consistent subnet layout across environments",
          "Options for hybrid connectivity where needed",
          "Network security considerations aligned to least-privilege access",
        ],
      },
    ],
    idealFor: [
      "Teams standardizing how new workloads land in the cloud",
      "Organizations moving from ad-hoc to structured cloud usage",
    ],
    relatedProviders: ["aws", "azure", "gcp"],
  },
  {
    id: "cicd-release-automation",
    title: "CI/CD & Release Automation",
    intro:
      "Design and implement CI/CD workflows so code moves from commit to production safely and repeatably across cloud environments.",
    sections: [
      {
        heading: "CI pipelines around GitHub",
        body:
          "We structure GitHub-based CI pipelines that fit your branching model and quality requirements.",
        bullets: [
          "Build, test, and artifact stages driven from pull requests",
          "Policy-friendly checks before code merges",
          "Reusable workflows for teams and services",
        ],
      },
      {
        heading: "Release orchestration with Octopus Deploy",
        body:
          "We configure Octopus Deploy pipelines to promote releases across environments with clear visibility and control.",
        bullets: [
          "Environment-specific configurations and approvals",
          "Promotion flows from non-production through to production",
          "Integration with infrastructure and application deployments",
        ],
      },
    ],
    idealFor: [
      "Engineering teams looking to reduce deployment risk",
      "Organizations standardizing release practices across services",
    ],
    relatedProviders: ["aws", "azure", "gcp"],
  },
  {
    id: "cost-optimization",
    title: "Cost Optimization (FinOps)",
    intro:
      "Bring structure to cloud spending with practical FinOps practices that keep costs predictable without sacrificing performance.",
    sections: [
      {
        heading: "Usage and spend analysis",
        body:
          "We review how resources are used across AWS, Azure, and GCP to identify waste and right-sizing opportunities.",
        bullets: [
          "Highlight under-utilized or idle resources",
          "Identify storage and data transfer patterns that drive cost",
          "Map spend to teams, environments, or products where possible",
        ],
      },
      {
        heading: "Guardrails and reporting",
        body:
          "We set up basic budgets, alerts, and simple reporting so finance and engineering share the same view of cloud spend.",
        bullets: [
          "Budgets and alerts aligned to your review cadence",
          "Lightweight reports for leadership and engineering leads",
          "Clear backlog of optimization actions with estimated impact",
        ],
      },
    ],
    idealFor: [
      "Teams looking to control or reduce cloud spend",
      "Organizations needing better visibility into where money goes",
    ],
    relatedProviders: ["aws", "azure", "gcp"],
  },
  {
    id: "reliability-observability",
    title: "Reliability & Observability",
    intro:
      "Give teams the signals they need to detect and resolve issues quickly, without over-complicating monitoring.",
    sections: [
      {
        heading: "Monitoring and alerting strategy",
        body:
          "We define what should be monitored and alerted on, tied to business impact rather than just infrastructure noise.",
        bullets: [
          "Service- and platform-level SLI/SLO thinking",
          "Alert routing and on-call readiness patterns",
          "Dashboards for key services and environments",
        ],
      },
      {
        heading: "Logs, metrics, and traces",
        body:
          "We align log and metric collection with your tools so teams can investigate issues without wading through unnecessary data.",
        bullets: [
          "Structured logging approaches that support troubleshooting",
          "Metrics that reflect user experience and system health",
          "Integration with existing observability tooling where practical",
        ],
      },
    ],
    idealFor: [
      "Teams responsible for uptime and incident response",
      "Organizations maturing SRE and platform operations practices",
    ],
    relatedProviders: ["aws", "azure", "gcp"],
  },
  {
    id: "security-governance",
    title: "Security & Governance",
    intro:
      "Shape identity, access, and policy patterns that keep systems secure and auditable without blocking delivery.",
    sections: [
      {
        heading: "Access and identity design",
        body:
          "We design IAM, Entra ID, and GCP IAM patterns grounded in least privilege and team workflows.",
        bullets: [
          "Role patterns for engineers, automation, and services",
          "Separation of duties where required by compliance",
          "Guidance for integrating with existing identity providers",
        ],
      },
      {
        heading: "Guardrails and policy",
        body:
          "We define guardrails that catch risky configurations early, ideally through policy-as-code and CI integration.",
        bullets: [
          "Baseline policies and configuration standards",
          "Checks wired into CI/CD where feasible",
          "Documentation that explains intent and usage to teams",
        ],
      },
    ],
    idealFor: [
      "Organizations with regulatory or audit requirements",
      "Teams needing clearer, enforceable security practices",
    ],
    relatedProviders: ["aws", "azure", "gcp"],
  },
  {
    id: "migration-modernization",
    title: "Migration & Modernization",
    intro:
      "Move workloads into the cloud or modernize existing deployments without unnecessary disruption to teams or users.",
    sections: [
      {
        heading: "Assessment and planning",
        body:
          "We start by understanding your current applications, constraints, and timelines to shape a realistic migration or modernization plan.",
        bullets: [
          "Inventory of workloads and dependencies at a practical level",
          "Identification of quick wins vs. deeper modernization work",
          "Risk assessment and mitigation options",
        ],
      },
      {
        heading: "Incremental execution",
        body:
          "We plan and support migrations in small, reversible steps where possible, aligned to your release processes.",
        bullets: [
          "Runbooks for each migration step",
          "Testing and validation guidance for teams",
          "Observation of platform behavior during and after cutovers",
        ],
      },
    ],
    idealFor: [
      "Teams moving from on-premises systems",
      "Organizations re-platforming or consolidating cloud usage",
    ],
    relatedProviders: ["aws", "azure", "gcp"],
  },
  {
    id: "backup-dr",
    title: "Backup, DR & Business Continuity",
    intro:
      "Design backup and recovery approaches that align with realistic recovery time and recovery point objectives.",
    sections: [
      {
        heading: "Backup and retention patterns",
        body:
          "We help you decide what to back up, how often, and how long to retain it, using provider-native capabilities where appropriate.",
        bullets: [
          "Backups for critical data and configuration",
          "Retention choices based on regulatory and business needs",
          "Alignment with storage and cost considerations",
        ],
      },
      {
        heading: "Recovery planning",
        body:
          "We create practical recovery plans and runbooks that can be executed during incidents without guesswork.",
        bullets: [
          "Documented recovery paths for key services",
          "Playbooks for regional or service-level disruptions",
          "Opportunities for game days and testing where feasible",
        ],
      },
    ],
    idealFor: [
      "Systems with clear availability or recovery expectations",
      "Teams formalizing incident response and continuity planning",
    ],
    relatedProviders: ["aws", "azure", "gcp"],
  },
  {
    id: "platform-operations",
    title: "Platform Operations",
    intro:
      "Define how your cloud platform is operated day to day, from on-call readiness to change management.",
    sections: [
      {
        heading: "Runbooks and operating model",
        body:
          "We work with your teams to define how the platform is supported, who does what, and how changes are coordinated.",
        bullets: [
          "Runbooks for common operational tasks and incidents",
          "Clear delineation between platform and product responsibilities",
          "Lightweight governance that keeps delivery moving",
        ],
      },
      {
        heading: "On-call readiness",
        body:
          "We help teams prepare for on-call with appropriate tooling, visibility, and processes.",
        bullets: [
          "Alerting tuned to reduce noise while catching real issues",
          "Guidance for handoffs and escalation paths",
          "Integration with incident tooling where applicable",
        ],
      },
    ],
    idealFor: [
      "Teams formalizing SRE or platform engineering functions",
      "Organizations scaling the number of cloud-hosted services",
    ],
    relatedProviders: ["aws", "azure", "gcp", "multi-cloud"],
  },
  {
    id: "data-storage-strategy",
    title: "Data & Storage Strategy",
    intro:
      "Shape how data is stored and accessed so performance, durability, and cost stay in balance as systems grow.",
    sections: [
      {
        heading: "Selecting storage patterns",
        body:
          "We provide high-level guidance on when to use different storage options based on access patterns and requirements.",
        bullets: [
          "Understanding trade-offs between block, object, and database storage",
          "Retention and lifecycle approaches that avoid uncontrolled growth",
          "Patterns for analytics and reporting workloads",
        ],
      },
      {
        heading: "Data access and governance",
        body:
          "We consider how data is accessed, secured, and audited across teams and environments.",
        bullets: [
          "Approaches for securing sensitive data in transit and at rest",
          "High-level governance considerations for shared datasets",
          "Alignment with existing data management and privacy practices",
        ],
      },
    ],
    idealFor: [
      "Product and data teams planning the next phase of a platform",
      "Organizations consolidating data across systems or providers",
    ],
    relatedProviders: ["aws", "azure", "gcp"],
  },
  {
    id: "networking-connectivity",
    title: "Networking & Connectivity",
    intro:
      "Design networks that connect services and environments predictably while keeping security and operations manageable.",
    sections: [
      {
        heading: "Environment and service connectivity",
        body:
          "We plan how environments and services connect to each other and, where needed, to on-premises locations.",
        bullets: [
          "Baseline patterns for environment isolation and communication",
          "Options for hybrid connectivity where required",
          "Routing approaches that avoid unnecessary complexity",
        ],
      },
      {
        heading: "Network security",
        body:
          "We help define high-level network security controls that support least-privilege access without blocking delivery.",
        bullets: [
          "Use of security groups, firewall rules, and network policies",
          "Segmentation strategies appropriate to your risk profile",
          "Visibility into network flows for troubleshooting and audit needs",
        ],
      },
    ],
    idealFor: [
      "Teams connecting multiple environments or networks",
      "Organizations with hybrid or multi-cloud architectures",
    ],
    relatedProviders: ["aws", "azure", "gcp", "multi-cloud"],
  },
  {
    id: "ai-ml-engineering",
    title: "AI/ML Engineering & MLOps",
    intro:
      "Design and operate production ML infrastructure, model deployment pipelines, and MLOps practices for reliable AI workloads.",
    sections: [
      {
        heading: "ML infrastructure and compute",
        body:
          "We design ML training and inference infrastructure using cloud-native services like AWS SageMaker, Azure ML, or GCP Vertex AI.",
        bullets: [
          "GPU and specialized compute for training workloads",
          "Model serving infrastructure for real-time and batch inference",
          "Cost optimization for ML workloads through right-sizing and spot instances",
        ],
      },
      {
        heading: "MLOps pipelines and automation",
        body:
          "We build CI/CD pipelines for ML models, including data validation, model training, testing, and deployment workflows.",
        bullets: [
          "Automated model training pipelines with versioning",
          "Model registry and artifact management",
          "A/B testing and gradual rollout patterns for model deployments",
        ],
      },
      {
        heading: "Monitoring and governance",
        body:
          "We establish monitoring for model performance, data drift, and infrastructure health to maintain production ML systems.",
        bullets: [
          "Model performance monitoring and alerting",
          "Data quality and drift detection",
          "Governance patterns for model lifecycle and compliance",
        ],
      },
    ],
    idealFor: [
      "Teams deploying ML models to production",
      "Organizations building AI capabilities and need reliable infrastructure",
    ],
    relatedProviders: ["aws", "azure", "gcp"],
  },
  {
    id: "kubernetes-containers",
    title: "Kubernetes & Container Orchestration",
    intro:
      "Design, deploy, and operate Kubernetes clusters on AWS EKS, Azure AKS, or GCP GKE with production-ready patterns.",
    sections: [
      {
        heading: "Cluster design and networking",
        body:
          "We design Kubernetes clusters with appropriate node groups, networking, and security configurations for your workloads.",
        bullets: [
          "Multi-AZ cluster architecture for high availability",
          "VPC/network integration and pod networking",
          "RBAC and security policies aligned to least-privilege access",
        ],
      },
      {
        heading: "Container orchestration patterns",
        body:
          "We help teams adopt Kubernetes patterns for deployments, scaling, service discovery, and resource management.",
        bullets: [
          "Deployment strategies (rolling updates, blue-green, canary)",
          "Horizontal Pod Autoscaling and resource requests/limits",
          "Service mesh and ingress patterns where appropriate",
        ],
      },
      {
        heading: "CI/CD for Kubernetes",
        body:
          "We integrate Kubernetes deployments into CI/CD pipelines with GitOps patterns and deployment automation.",
        bullets: [
          "Container image builds and registry integration",
          "GitOps workflows using ArgoCD, Flux, or similar",
          "Environment promotion and release automation",
        ],
      },
    ],
    idealFor: [
      "Teams containerizing applications and moving to Kubernetes",
      "Organizations scaling container workloads and need orchestration",
    ],
    relatedProviders: ["aws", "azure", "gcp"],
  },
  {
    id: "data-engineering-analytics",
    title: "Data Engineering & Analytics",
    intro:
      "Build data pipelines, data lakes, and analytics platforms on cloud-native services for real-time and batch processing.",
    sections: [
      {
        heading: "Data pipeline architecture",
        body:
          "We design data ingestion, transformation, and storage patterns using services like AWS Glue, Azure Data Factory, or GCP Dataflow.",
        bullets: [
          "Batch and streaming data pipeline patterns",
          "Data lake architecture (S3, ADLS, GCS) with partitioning strategies",
          "ETL/ELT workflows and data transformation logic",
        ],
      },
      {
        heading: "Analytics and data warehousing",
        body:
          "We help teams set up analytics platforms using services like Redshift, Synapse, or BigQuery for reporting and BI.",
        bullets: [
          "Data warehouse design and optimization",
          "Integration with BI tools and reporting platforms",
          "Cost optimization for data storage and query performance",
        ],
      },
      {
        heading: "Data governance and quality",
        body:
          "We establish data quality checks, cataloging, and governance patterns to ensure reliable analytics.",
        bullets: [
          "Data quality validation and monitoring",
          "Metadata management and data cataloging",
          "Access controls and compliance for sensitive data",
        ],
      },
    ],
    idealFor: [
      "Organizations building data platforms and analytics capabilities",
      "Teams needing scalable data infrastructure for business intelligence",
    ],
    relatedProviders: ["aws", "azure", "gcp"],
  },
  {
    id: "serverless-architecture",
    title: "Serverless Architecture",
    intro:
      "Design and implement serverless applications using AWS Lambda, Azure Functions, and Cloud Functions for cost-effective scaling.",
    sections: [
      {
        heading: "Serverless compute patterns",
        body:
          "We design serverless architectures using functions, event-driven patterns, and managed services to reduce operational overhead.",
        bullets: [
          "Function design and optimization for cold starts and performance",
          "Event-driven architectures using SQS, EventBridge, or Pub/Sub",
          "API Gateway patterns for serverless APIs",
        ],
      },
      {
        heading: "Integration and orchestration",
        body:
          "We help teams integrate serverless functions with databases, storage, and other cloud services.",
        bullets: [
          "Serverless database patterns (DynamoDB, Cosmos DB, Firestore)",
          "Step Functions or Logic Apps for workflow orchestration",
          "Integration patterns with existing systems and APIs",
        ],
      },
      {
        heading: "Cost optimization and monitoring",
        body:
          "We optimize serverless costs through right-sizing, reserved capacity where applicable, and monitoring for cost anomalies.",
        bullets: [
          "Function memory and timeout optimization",
          "Cost monitoring and alerting for serverless workloads",
          "Performance tuning and observability for serverless applications",
        ],
      },
    ],
    idealFor: [
      "Teams building event-driven or API-first applications",
      "Organizations looking to reduce infrastructure management overhead",
    ],
    relatedProviders: ["aws", "azure", "gcp"],
  },
  {
    id: "cloud-native-development",
    title: "Cloud-Native Application Development",
    intro:
      "Architect and build applications specifically designed for cloud platforms using microservices, APIs, and cloud-native patterns.",
    sections: [
      {
        heading: "Application architecture",
        body:
          "We design cloud-native application architectures using microservices, API-first design, and cloud-native patterns.",
        bullets: [
          "Microservices decomposition and service boundaries",
          "API design and API Gateway patterns",
          "Stateless application design for horizontal scaling",
        ],
      },
      {
        heading: "Cloud-native services integration",
        body:
          "We help teams leverage managed cloud services (databases, queues, storage) to reduce operational complexity.",
        bullets: [
          "Managed database selection and integration patterns",
          "Message queues and event streaming (SQS, Service Bus, Pub/Sub)",
          "Object storage and CDN integration for static assets",
        ],
      },
      {
        heading: "Development and deployment practices",
        body:
          "We establish development workflows, testing strategies, and deployment patterns optimized for cloud-native applications.",
        bullets: [
          "Local development environments and tooling",
          "Testing strategies for distributed systems",
          "Deployment patterns and feature flagging",
        ],
      },
    ],
    idealFor: [
      "Teams building new applications from scratch",
      "Organizations modernizing legacy applications to cloud-native patterns",
    ],
    relatedProviders: ["aws", "azure", "gcp"],
  },
];



