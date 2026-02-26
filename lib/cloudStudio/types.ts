export const CLOUD_STUDIO_SERVICE_TYPES = [
  "cicd",
  "cost",
  "security",
  "architecture",
  "networking",
] as const;

export type CloudStudioServiceType = (typeof CLOUD_STUDIO_SERVICE_TYPES)[number];

export type CicdForm = {
  gitProvider: string;
  languageFramework: string;
  deploymentTarget: string;
  repoUrl?: string;
  envVars?: string;
};

export type CostForm = {
  cloudProvider: string;
  servicesUsed: string;
  estimatedMonthlySpend: string;
  region: string;
  billingExportNote?: string;
};

export type SecurityForm = {
  cloudProvider: string;
  publicServices: string;
  complianceGoal: string;
};

export type ArchitectureForm = {
  cloudProvider: string;
  appType: string;
  trafficEstimate: string;
  dataStorageNeeds: string;
};

export type NetworkingForm = {
  cloudProvider: string;
  vpcRequirements: string;
  connectivity: string;
  region: string;
};

export type CloudStudioForm =
  | { serviceType: "cicd"; form: CicdForm }
  | { serviceType: "cost"; form: CostForm }
  | { serviceType: "security"; form: SecurityForm }
  | { serviceType: "architecture"; form: ArchitectureForm }
  | { serviceType: "networking"; form: NetworkingForm };

export type CloudStudioOutput = {
  summary?: string;
  fullOutput?: string;
  artifacts?: { name: string; content: string; type: string }[];
  generatedAt?: string;
};

export type CloudStudioTier = "free" | "professional" | "enterprise";

export const CLOUD_STUDIO_TIERS = {
  free: {
    id: "free" as const,
    name: "Free Preview",
    description: "Limited summary output",
    price: 0,
    fullOutput: false,
    downloadable: false,
  },
  professional: {
    id: "professional" as const,
    name: "Professional",
    description: "Full detailed output, downloadable files",
    priceMin: 99,
    priceMax: 299,
    fullOutput: true,
    downloadable: true,
  },
  enterprise: {
    id: "enterprise" as const,
    name: "Enterprise",
    description: "Implementation support, cloud account automation",
    price: 0,
    fullOutput: true,
    downloadable: true,
    implementation: true,
  },
} as const;
