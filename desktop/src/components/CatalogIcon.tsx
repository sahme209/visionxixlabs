import { Fingerprint, Layers, Puzzle, ShieldCheck } from "lucide-react";
const logos = {
  servicenow: new URL("../assets/providers/servicenow.png", import.meta.url).href,
  github: new URL("../assets/providers/github.svg", import.meta.url).href,
  slack: new URL("../assets/providers/slack.svg", import.meta.url).href,
  teams: new URL("../assets/providers/teams.svg", import.meta.url).href,
  linear: new URL("../assets/providers/linear.svg", import.meta.url).href,
  aws: new URL("../assets/providers/aws.svg", import.meta.url).href,
  azure: new URL("../assets/providers/azure.svg", import.meta.url).href,
  gcp: new URL("../assets/providers/gcp.svg", import.meta.url).href,
  airflow: new URL("../assets/providers/airflow.svg", import.meta.url).href,
  jira: new URL("../assets/providers/jira.svg", import.meta.url).href,
};
export type CatalogProvider = keyof typeof logos;
export function ProviderLogo({provider}: {provider: CatalogProvider}) {
  return <img src={logos[provider]} data-catalog-provider={provider} alt="" aria-hidden="true" width={20} height={20} className="h-5 w-5 object-contain" />;
}
/** Decorative marks accompany visible provider names; they do not indicate connection status. */
export function ProviderLogoGroup({providers}:{providers:readonly CatalogProvider[]}){
  return <span aria-hidden="true" className="inline-flex items-center gap-1.5">{providers.map(provider=><ProviderLogo key={provider} provider={provider}/>)}</span>;
}
export function SkillIcon({id, category}: {id: string; category: string}) {
  if (id === "airflow-diagnostics") return <ProviderLogo provider="airflow" />;
  if (id === "microsoft-learn-docs") return <ProviderLogo provider="azure" />;
  if (id === "aws-ecs-release") return <ProviderLogo provider="aws" />;
  if (category === "GitHub") return <ProviderLogo provider="github" />;
  const Icon = category === "Identity" ? Fingerprint : category === "Deployments" ? Layers : category === "Governance" ? ShieldCheck : Puzzle;
  return <Icon aria-hidden="true" className="h-5 w-5 text-zinc-300" />;
}
