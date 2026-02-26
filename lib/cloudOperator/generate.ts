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

function buildOperatorPrompt(profile: OperatorProfile): string {
  return `
You are the AI Cloud Operator™ for a modern cloud platform.
You orchestrate infrastructure, CI/CD, cost, and security into a single automation plan.

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

Generate a single JSON object with this shape:
{
  "launch": {
    "architecturePlan": "clear architecture description and key components",
    "ciCdYaml": "CI/CD pipeline YAML (GitHub Actions preferred when GitHub)",
    "dockerfile": "Dockerfile content if relevant",
    "deploymentSteps": ["step 1", "step 2", "..."],
    "cliCommands": ["command 1", "command 2", "..."],
    "terraformTemplates": ["high-level Terraform snippet or module outline"]
  },
  "optimize": {
    "costBreakdown": "markdown summary of current cost drivers",
    "estimatedAnnualSavings": 12345,
    "reservedInstanceSuggestions": ["suggestion 1", "..."],
    "storageTierChanges": ["suggestion 1", "..."],
    "scalingAdjustments": ["suggestion 1", "..."]
  },
  "secure": {
    "riskSummary": "plain-language risk overview",
    "iamRecommendations": "IAM hardening recommendations",
    "networkSegmentation": "short network segmentation plan",
    "hardeningChecklist": ["item 1", "item 2", "..."],
    "publicAttackSurfaceFindings": ["finding 1", "..."]
  },
  "business": {
    "businessImpactSummary": "2-3 sentence business summary",
    "implementationEffortHoursLow": 40,
    "implementationEffortHoursHigh": 80,
    "recommendedNextAction": "most important next action"
  },
  "detections": {
    "infrastructureAntiPatterns": ["pattern 1", "..."],
    "overprovisioningSignals": ["signal 1", "..."],
    "idleResources": ["resource 1", "..."],
    "publicAttackSurface": ["surface 1", "..."],
    "deploymentBottlenecks": ["bottleneck 1", "..."],
    "ciCdInefficiencies": ["inefficiency 1", "..."]
  },
  "recommendedImprovements": ["top improvement 1", "top improvement 2", "..."]
}

Rules:
- Output ONLY valid JSON.
- Keep descriptions concise but specific.
- Do NOT include any explanatory text outside the JSON.
`;
}

export async function generateOperatorEngineOutput(
  profile: OperatorProfile,
  tier: OperatorTier
): Promise<OperatorEngineOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");

  const openai = new OpenAI({ apiKey });

  const prompt = buildOperatorPrompt(profile);

  const completion = await openai.chat.completions.create({
    model: process.env.MODEL_NAME || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are the AI Cloud Operator™. You produce deterministic, structured JSON outputs for cloud automation planning. Never execute changes.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
  });

  const text = completion.choices[0]?.message?.content?.trim() || "";
  const parsed = parseJSON<{
    launch?: LaunchModule;
    optimize?: OptimizeModule;
    secure?: SecureModule;
    business?: BusinessModule;
    detections?: DetectionSignals;
    recommendedImprovements?: string[];
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
    scores,
    generatedAt: new Date().toISOString(),
  };

  return output;
}

