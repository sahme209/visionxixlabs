/** Public catalog presentation only; never connection state or admission authority. */
import { INTEGRATIONS, type Integration } from "./integrationRegistry";
export type PublicAvailability = {label:string;detail:string;href:string;enabled:boolean};
export type CatalogJob = "cloud" | "source" | "work" | "communication" | "operations" | "data";
export type CatalogOperation = "read" | "change" | "events";
export const CATALOG_JOBS: ReadonlyArray<{id:CatalogJob;label:string}> = [
 {id:"cloud",label:"Cloud delivery"},{id:"source",label:"Source & CI"},{id:"work",label:"Work tracking"},
 {id:"communication",label:"Communication"},{id:"operations",label:"Orchestration & observability"},{id:"data",label:"Data"},
];
const JOB_BY_CATEGORY: Record<Integration["category"],CatalogJob> = {cloud:"cloud",vcs:"source",ide:"source",incidents:"work",communications:"communication",orchestration:"operations",monitoring:"operations",db:"data"};
export type PublicCatalogEntry = {id:string;name:string;job:CatalogJob;availability:PublicAvailability;operations:CatalogOperation[]};
export const PUBLIC_AVAILABILITY: Readonly<Record<string, PublicAvailability>> = {
  aws: { label: "configuration required", detail: "Assume-role connection code is implemented. Live validation requires broker credentials and customer IAM setup; inventory/security analysis remains preview-grade and write execution is not released.", href: "/docs/aws-setup", enabled: true },
  azure: { label: "preview", detail: "Credential-format validation and preview inventory are implemented. Live Azure SDK validation and provider-specific execution are not released.", href: "/cloud-solutions/azure", enabled: true },
  gcp: { label: "preview", detail: "Credential-format validation and preview inventory are implemented. Live Asset Inventory validation and provider-specific execution are not released.", href: "/cloud-solutions/gcp", enabled: true },
  github: { label: "available", detail: "Read repository context and inspect source/workflow evidence through a repository-scoped GitHub connection. Branch, pull-request and workflow actions have their own permissions and review requirements; this catalog does not establish execution readiness.", href: "/docs/oauth-setup", enabled: true },
  gitlab: { label: "planned", detail: "No customer-ready activation path is published.", href: "/docs", enabled: false },
  cloudwatch: { label: "implementation review", detail: "Inbound event code exists; a released customer setup and end-to-end delivery path have not been verified.", href: "/docs", enabled: true },
  grafana: { label: "implementation review", detail: "Inbound event code exists; a released customer setup and end-to-end delivery path have not been verified.", href: "/docs", enabled: true },
  dynatrace: { label: "planned", detail: "No verified customer activation path is published.", href: "/docs", enabled: false },
  slack: { label: "implementation review", detail: "Notification code must not be confused with workflow synchronization. Customer OAuth and message delivery are not release-verified.", href: "/docs", enabled: true },
  linear: { label: "planned", detail: "Issue creation/update is not advertised as available until OAuth and write behavior are release-verified.", href: "/docs", enabled: false },
  airflow: { label: "available", detail: "Validate the configured Airflow instance before browsing DAGs and monitoring runs. Triggers, retries and scheduling depend on the enabled workflow and exact operation checks; no run is started from this page.", href: "/docs", enabled: true },
  pagerduty: { label: "planned", detail: "No released paging connection is available.", href: "/docs", enabled: false },
  vscode: { label: "preview", detail: "Extension code is tracked separately; marketplace installation and the shared authentication path require release verification.", href: "/docs", enabled: true },
  postgres: { label: "implementation review", detail: "DDL generation exists. A released connection, permissions test, and revocation journey are not end-to-end verified.", href: "/docs", enabled: true },
  mysql: { label: "implementation review", detail: "DDL generation exists. A released connection, permissions test, and revocation journey are not end-to-end verified.", href: "/docs", enabled: true },
};

export function publicCatalogEntries():PublicCatalogEntry[]{
 return INTEGRATIONS.map(i=>({id:i.id,name:i.name,job:JOB_BY_CATEGORY[i.category],
  availability:PUBLIC_AVAILABILITY[i.id]??{label:"planned",detail:"No verified customer path is published.",href:"/docs",enabled:false},
  operations:i.category==="monitoring"?["events"]:i.writeAccess==="none"?["read"]:["read","change"],
 }));
}
