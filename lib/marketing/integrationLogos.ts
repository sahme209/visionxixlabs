/**
 * Integration logos for the home strip and the Integrations flow.
 *
 * Honest by construction: every entry is an integration that exists in the
 * product, its status comes from the public catalog (PUBLIC_AVAILABILITY), and
 * planned items never appear in the home strip. Logos are shown as "works
 * with", never as customers; trademarks belong to their owners. Logo SVGs are
 * from Simple Icons (CC0). Brands not in Simple Icons are shown as text.
 */
import { PUBLIC_AVAILABILITY } from "@/lib/integrations/publicIntegrationCatalog";

export type IntegrationGroup = "source" | "cloud" | "orchestration" | "signals" | "data" | "work";
export interface IntegrationLogo { id: string; name: string; logo: string | null; group: IntegrationGroup; status: string; onHome: boolean }

const L = (file: string) => `/logos/integrations/${file}.svg`;
const status = (id: string, fallback: string) => PUBLIC_AVAILABILITY[id]?.label ?? fallback;

const RAW: ReadonlyArray<Omit<IntegrationLogo, "status" | "onHome"> & { statusId?: string; fallback?: string }> = [
  { id: "github", name: "GitHub", logo: L("github"), group: "source" },
  { id: "gitlab", name: "GitLab", logo: L("gitlab"), group: "source" },
  { id: "aws", name: "AWS", logo: L("amazonwebservices"), group: "cloud" },
  { id: "azure", name: "Azure", logo: null, group: "cloud" },
  { id: "gcp", name: "Google Cloud", logo: L("googlecloud"), group: "cloud" },
  { id: "airflow", name: "Apache Airflow", logo: L("apacheairflow"), group: "orchestration" },
  { id: "prefect", name: "Prefect", logo: L("prefect"), group: "orchestration", fallback: "preview" },
  { id: "dagster", name: "Dagster", logo: null, group: "orchestration", fallback: "preview" },
  { id: "argo_workflows", name: "Argo Workflows", logo: L("argo"), group: "orchestration", fallback: "preview" },
  { id: "cloudwatch", name: "CloudWatch", logo: L("amazoncloudwatch"), group: "signals" },
  { id: "grafana", name: "Grafana", logo: L("grafana"), group: "signals" },
  { id: "dynatrace", name: "Dynatrace", logo: L("dynatrace"), group: "signals" },
  { id: "pagerduty", name: "PagerDuty", logo: L("pagerduty"), group: "signals" },
  { id: "postgres", name: "PostgreSQL", logo: L("postgresql"), group: "data" },
  { id: "mysql", name: "MySQL", logo: L("mysql"), group: "data" },
  { id: "slack", name: "Slack", logo: L("slack"), group: "work" },
  { id: "linear", name: "Linear", logo: L("linear"), group: "work" },
];

export const INTEGRATION_LOGOS: readonly IntegrationLogo[] = Object.freeze(RAW.map(({ fallback, ...r }) => {
  const s = status(r.id, fallback ?? "planned");
  return { ...r, status: s, onHome: s !== "planned" };
}));

export const GROUP_LABEL: Readonly<Record<IntegrationGroup, string>> = { source: "Source", cloud: "Cloud", orchestration: "Orchestration", signals: "Signals", data: "Data", work: "Work" };
