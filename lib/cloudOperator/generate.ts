import OpenAI from "openai";
import type {
  OperatorProfile,
  OperatorTier,
  OperatorEngineOutput,
  LaunchModule,
  OptimizeModule,
  SecureModule,
  BusinessModule,
  DetectionSignals,
  CustomThirtyDayPlan,
} from "./types";
import { computeCloudOperatorScores } from "@/lib/cloudStudio/scoring";

function parseJSON<T>(text: string): Partial<T> {
  const s = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(s) as Partial<T>;
  } catch {
    return {};
  }
}

const PROVIDER_HINTS: Record<string, string> = {
  AWS: "Use AWS-native services (ECS/EKS, Lambda, RDS). Prefer GitHub Actions for CI/CD if GitHub, otherwise CodePipeline. Include cloudwatch, IAM least-privilege, and cost allocation tags.",
  GCP: "Use GCP-native services (Cloud Run, GKE, Cloud SQL). Prefer Cloud Build or GitHub Actions. Include Cloud Monitoring, VPC-SC for compliance, and cost labels.",
  Azure: "Use Azure-native services (Container Apps, AKS, Cosmos DB). Prefer Azure DevOps or GitHub Actions. Include Azure Monitor, Entra ID, and resource tags for cost management.",
  Vercel: "Focus on serverless, Edge, and static. Prefer Vercel-native CI. Include ISR, Edge middleware, and KV/Blob for state. Optimize for cold starts and bandwidth.",
  Other: "Use cloud-agnostic patterns. Docker/Kubernetes, managed DB, object storage. Prefer GitHub Actions.",
};

const GOAL_HINTS: Record<string, string> = {
  "Launch faster": "Prioritize automation, CI/CD, and deployment velocity. Emphasize quick wins and low-friction tooling.",
  "Reduce costs": "Prioritize right-sizing, reserved capacity, storage tiers, and idle resource cleanup. Be concrete on dollar amounts.",
  "Improve security": "Prioritize IAM least-privilege, network segmentation, secrets management, and compliance controls.",
  "Scale architecture": "Prioritize autoscaling, multi-region readiness, observability, and database scaling.",
};

function buildOperatorPrompt(profile: OperatorProfile): string {
  const provider = profile.hostingProvider.trim() || "Other";
  const goal = profile.primaryGoal.trim() || "Launch faster";
  const providerHint = PROVIDER_HINTS[provider] ?? PROVIDER_HINTS.Other;
  const goalHint = GOAL_HINTS[goal] ?? GOAL_HINTS["Launch faster"];

  return `
You are the AI Cloud Operator™ for a modern cloud platform. You orchestrate infrastructure, CI/CD, cost, and security into a single automation plan. You produce concrete, actionable outputs—not generic advice. Be specific to the provider and goal.

Context:
- What are they building?: ${profile.projectType}
- Where is it hosted?: ${profile.hostingProvider}
- Monthly cloud spend: ${profile.monthlySpend}
- Expected traffic level: ${profile.trafficLevel}
- CI/CD in place?: ${profile.hasCiCd}
- Public exposure: ${profile.publicExposure}
- Compliance needs: ${profile.complianceNeeds}
- Git provider: ${profile.gitProvider}
- Primary goal: ${profile.primaryGoal}

Provider focus: ${providerHint}
Goal priority: ${goalHint}

Generate a single JSON object with this shape (output ONLY valid JSON, no markdown):
{
  "launch": {
    "architecturePlan": "Clear architecture description with specific ${profile.hostingProvider} services and components. Reference actual service names.",
    "ciCdYaml": "Full CI/CD pipeline YAML (GitHub Actions if GitHub, otherwise provider-native). Real, runnable content.",
    "dockerfile": "Dockerfile content—multi-stage if relevant, with proper base images.",
    "deploymentSteps": ["Concrete step 1", "step 2", "..."],
    "cliCommands": ["Actual CLI command 1", "command 2", "..."],
    "terraformTemplates": ["Terraform snippet or module outline for ${profile.hostingProvider}"]
  },
  "optimize": {
    "costBreakdown": "Markdown summary of cost drivers for ${profile.projectType} on ${profile.hostingProvider}. Reference specific services.",
    "estimatedAnnualSavings": <number based on monthlySpend and common savings (10-30%)>,
    "reservedInstanceSuggestions": ["Concrete suggestion 1 for their setup", "..."],
    "storageTierChanges": ["Specific storage tier recommendation", "..."],
    "scalingAdjustments": ["Specific scaling policy", "..."]
  },
  "secure": {
    "riskSummary": "Plain-language risk overview for ${profile.publicExposure} and ${profile.complianceNeeds}.",
    "iamRecommendations": "IAM hardening for ${profile.hostingProvider}. Specific policies or patterns.",
    "networkSegmentation": "Network segmentation plan for their exposure level.",
    "hardeningChecklist": ["Concrete item 1", "item 2", "..."],
    "publicAttackSurfaceFindings": ["Specific finding if public-facing", "..."]
  },
  "business": {
    "businessImpactSummary": "2-3 sentence business summary. Tie to ${profile.primaryGoal}.",
    "implementationEffortHoursLow": <estimate>,
    "implementationEffortHoursHigh": <estimate>,
    "recommendedNextAction": "Single most important next action—specific and actionable."
  },
  "detections": {
    "infrastructureAntiPatterns": ["Specific anti-pattern for ${profile.projectType}", "..."],
    "overprovisioningSignals": ["Concrete signal", "..."],
    "idleResources": ["Common idle resource types for their stack", "..."],
    "publicAttackSurface": ["Specific surface if public", "..."],
    "deploymentBottlenecks": ["Common bottleneck", "..."],
    "ciCdInefficiencies": ["Specific inefficiency", "..."]
  },
  "recommendedImprovements": ["Top improvement 1—specific", "improvement 2", "..."],
  "thirtyDayPlan": {
    "stabilization": {
      "label": "Days 1–3: Stabilization",
      "dayRange": "1-3",
      "category": "Critical",
      "tasks": [
        { "technicalAction": "Specific action", "businessImpact": "Why it matters", "estimatedImprovementEffect": "Expected outcome" }
      ]
    },
    "costOptimization": {
      "label": "Days 4–10: Cost Optimization",
      "dayRange": "4-10",
      "category": "High Impact",
      "tasks": [ { "technicalAction": "...", "businessImpact": "...", "estimatedImprovementEffect": "..." } ]
    },
    "deploymentAcceleration": {
      "label": "Days 11–20: Deployment Acceleration",
      "dayRange": "11-20",
      "category": "Strategic",
      "tasks": [ { "technicalAction": "...", "businessImpact": "...", "estimatedImprovementEffect": "..." } ]
    },
    "scalabilityHardening": {
      "label": "Days 21–30: Scalability Hardening",
      "dayRange": "21-30",
      "category": "Optimization",
      "tasks": [ { "technicalAction": "...", "businessImpact": "...", "estimatedImprovementEffect": "..." } ]
    }
  }
}

Rules:
- Output ONLY valid JSON. No markdown, no code blocks, no extra text.
- Be specific to ${profile.hostingProvider}, ${profile.projectType}, and "${profile.primaryGoal}".
- Each phase in thirtyDayPlan must have at least 2 tasks. Tasks must be concrete and actionable.
- estimatedAnnualSavings: use 15-25% of (monthlySpend * 12) as a reasonable range unless compliance/risk suggests more.
`;
}

const PRO_TIERS: OperatorTier[] = ["pro", "growth", "enterprise"];

export async function generateOperatorEngineOutput(
  profile: OperatorProfile,
  tier: OperatorTier
): Promise<OperatorEngineOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");

  const openai = new OpenAI({ apiKey });
  const useProModel = PRO_TIERS.includes(tier);
  const model =
    useProModel
      ? (process.env.CLOUD_OPERATOR_PRO_MODEL || process.env.MODEL_NAME || "gpt-4o")
      : (process.env.MODEL_NAME || "gpt-4o-mini");

  const prompt = buildOperatorPrompt(profile);

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are the AI Cloud Operator™. You produce concrete, provider-specific, actionable JSON outputs for cloud automation planning. Never execute changes. Output only valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.35,
  });

  const text = completion.choices[0]?.message?.content?.trim() || "";
  const parsed = parseJSON<{
    launch?: LaunchModule;
    optimize?: OptimizeModule;
    secure?: SecureModule;
    business?: BusinessModule;
    detections?: DetectionSignals;
    recommendedImprovements?: string[];
    thirtyDayPlan?: CustomThirtyDayPlan;
  }>(text);

  const scores = computeCloudOperatorScores({
    projectType: profile.projectType,
    hostingProvider: profile.hostingProvider,
    monthlySpend: profile.monthlySpend,
    trafficLevel: profile.trafficLevel,
    hasCiCd: profile.hasCiCd,
    publicExposure: profile.publicExposure,
    complianceNeeds: profile.complianceNeeds,
    gitProvider: profile.gitProvider,
    primaryGoal: profile.primaryGoal,
  });

  const output: OperatorEngineOutput = {
    launch: parsed.launch,
    optimize: parsed.optimize,
    secure: parsed.secure,
    business: parsed.business,
    detections: parsed.detections,
    recommendedImprovements: parsed.recommendedImprovements,
    thirtyDayPlan: parsed.thirtyDayPlan,
    scores,
    generatedAt: new Date().toISOString(),
  };

  return output;
}

