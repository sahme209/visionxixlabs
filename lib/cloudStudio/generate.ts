import { generateCompletion } from "@/lib/ai/provider";
import type { CloudStudioForm, CloudStudioOutput, CloudStudioTier } from "./types";
import { isFreeTier } from "./pricing";
import {
  buildCicdPrompt,
  buildCostPrompt,
  buildSecurityPrompt,
  buildArchitecturePrompt,
  buildNetworkingPrompt,
} from "./prompts";

function parseJSON<T>(text: string): Partial<T> {
  const s = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(s) as Partial<T>;
  } catch {
    return {};
  }
}

export async function generateCloudStudioOutput(
  request: CloudStudioForm,
  tier: CloudStudioTier
): Promise<CloudStudioOutput> {
  const fullOutput = !isFreeTier(tier);

  let prompt: string;
  switch (request.serviceType) {
    case "cicd":
      prompt = buildCicdPrompt(request.form as import("./types").CicdForm, fullOutput);
      break;
    case "cost":
      prompt = buildCostPrompt(request.form as import("./types").CostForm, fullOutput);
      break;
    case "security":
      prompt = buildSecurityPrompt(request.form as import("./types").SecurityForm, fullOutput);
      break;
    case "architecture":
      prompt = buildArchitecturePrompt(request.form as import("./types").ArchitectureForm, fullOutput);
      break;
    case "networking":
      prompt = buildNetworkingPrompt(request.form as import("./types").NetworkingForm, fullOutput);
      break;
    default:
      throw new Error("Unknown service type");
  }

  const { text } = await generateCompletion({
    systemPrompt:
      "You are an expert cloud and DevOps consultant. Output valid JSON when asked for JSON; otherwise output plain text. Be professional and concise.",
    userPrompt: prompt,
    temperature: 0.5,
    maxTokens: 4096,
    responseFormat: fullOutput ? "json" : "text",
  });

  if (fullOutput) {
    const parsed = parseJSON<Record<string, unknown>>(text);
    const artifacts: { name: string; content: string; type: string }[] = [];
    if (typeof parsed.githubActionsYaml === "string")
      artifacts.push({ name: "workflow.yml", content: parsed.githubActionsYaml, type: "yaml" });
    if (typeof parsed.dockerfile === "string")
      artifacts.push({ name: "Dockerfile", content: parsed.dockerfile, type: "dockerfile" });
    if (typeof parsed.mermaidDiagram === "string")
      artifacts.push({ name: "diagram.mmd", content: parsed.mermaidDiagram, type: "mermaid" });
    if (typeof parsed.networkDiagram === "string")
      artifacts.push({ name: "network.mmd", content: parsed.networkDiagram, type: "mermaid" });

    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
      fullOutput: text,
      artifacts: artifacts.length > 0 ? artifacts : undefined,
      generatedAt: new Date().toISOString(),
    };
  }

  return {
    summary: text,
    generatedAt: new Date().toISOString(),
  };
}
