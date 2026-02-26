import type { CicdForm, CostForm, SecurityForm, ArchitectureForm, NetworkingForm } from "./types";

export function buildCicdPrompt(form: CicdForm, fullOutput: boolean): string {
  const base = `You are a DevOps expert. Generate CI/CD pipeline setup for:
- Git provider: ${form.gitProvider}
- Language/framework: ${form.languageFramework}
- Deployment target: ${form.deploymentTarget}
${form.repoUrl ? `- Repo URL: ${form.repoUrl}` : ""}
${form.envVars ? `- Environment variables (summary): ${form.envVars}` : ""}`;

  if (fullOutput) {
    return `${base}

Provide a JSON object with:
{
  "summary": "2-3 sentence overview",
  "githubActionsYaml": "complete GitHub Actions workflow YAML (if Git is GitHub)",
  "dockerfile": "Dockerfile content if needed for the stack",
  "deploymentSteps": ["step 1", "step 2", ...]
}

Output only valid JSON.`;
  }
  return `${base}\n\nProvide only a short "summary" (2-4 sentences) of the recommended CI/CD approach. Output plain text only.`;
}

export function buildCostPrompt(form: CostForm, fullOutput: boolean): string {
  const base = `You are a FinOps expert. Generate cloud cost optimization for:
- Cloud provider: ${form.cloudProvider}
- Services used: ${form.servicesUsed}
- Estimated monthly spend: ${form.estimatedMonthlySpend}
- Region: ${form.region}
${form.billingExportNote ? `- Note: ${form.billingExportNote}` : ""}`;

  if (fullOutput) {
    return `${base}

Provide a JSON object with:
{
  "summary": "2-3 sentence overview",
  "optimizationReport": "detailed markdown report",
  "reservedInstanceSuggestions": ["suggestion 1", ...],
  "storageTierSuggestions": ["suggestion 1", ...],
  "estimatedSavings": "percentage or range and rationale"
}

Output only valid JSON.`;
  }
  return `${base}\n\nProvide only a short "summary" (2-4 sentences) with top 2-3 optimization ideas. Output plain text only.`;
}

export function buildSecurityPrompt(form: SecurityForm, fullOutput: boolean): string {
  const base = `You are a cloud security expert. Generate security hardening for:
- Cloud provider: ${form.cloudProvider}
- Public-facing services: ${form.publicServices}
- Compliance goal: ${form.complianceGoal}`;

  if (fullOutput) {
    return `${base}

Provide a JSON object with:
{
  "summary": "2-3 sentence overview",
  "hardeningChecklist": ["item 1", "item 2", ...],
  "iamRoleSuggestions": "markdown or list of IAM role recommendations",
  "networkSegmentationPlan": "short markdown plan"
}

Output only valid JSON.`;
  }
  return `${base}\n\nProvide only a short "summary" (2-4 sentences) with key hardening priorities. Output plain text only.`;
}

export function buildArchitecturePrompt(form: ArchitectureForm, fullOutput: boolean): string {
  const base = `You are a solutions architect. Generate infrastructure architecture for:
- Cloud provider: ${form.cloudProvider}
- App type: ${form.appType}
- Traffic estimate: ${form.trafficEstimate}
- Data storage needs: ${form.dataStorageNeeds}`;

  if (fullOutput) {
    return `${base}

Provide a JSON object with:
{
  "summary": "2-3 sentence overview",
  "mermaidDiagram": "Mermaid diagram code (e.g. flowchart or C4 style)",
  "serviceBreakdown": "markdown list of services and roles",
  "scalingStrategy": "markdown scaling strategy"
}

Output only valid JSON.`;
  }
  return `${base}\n\nProvide only a short "summary" (2-4 sentences) and a brief Mermaid diagram. Output in format: SUMMARY:\\n...\\n\\nMERMAID:\\n...`;
}

export function buildNetworkingPrompt(form: NetworkingForm, fullOutput: boolean): string {
  const base = `You are a cloud networking expert. Generate networking setup for:
- Cloud provider: ${form.cloudProvider}
- VPC requirements: ${form.vpcRequirements}
- Connectivity (peering, VPN, etc.): ${form.connectivity}
- Region: ${form.region}`;

  if (fullOutput) {
    return `${base}

Provide a JSON object with:
{
  "summary": "2-3 sentence overview",
  "networkDiagram": "Mermaid diagram of network layout",
  "vpcDesign": "markdown VPC/subnet design",
  "connectivitySteps": ["step 1", ...]
}

Output only valid JSON.`;
  }
  return `${base}\n\nProvide only a short "summary" (2-4 sentences). Output plain text only.`;
}
