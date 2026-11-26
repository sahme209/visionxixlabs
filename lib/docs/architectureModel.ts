/** Shared architecture map data for the website docs and the desktop Documentation view. Each line mirrors an existing guide. */
export type NodeId = "desktop" | "cockpit" | "agents" | "service" | "github" | "cloud" | "tickets" | "batch" | "ai";
export interface MapNode { id: NodeId; x: number; y: number; title: string; sub: string; detail: string; guide: { href: string; label: string } }

export const ARCHITECTURE_NODES: MapNode[] = [
  { id: "desktop", x: 110, y: 70, title: "Desktop app", sub: "Operational work", detail: "Plan, review, approve and inspect releases, tickets, batches and saved tasks. Paired to your workspace; sessions can be revoked.", guide: { href: "/docs/desktop-install", label: "Install the desktop app" } },
  { id: "cockpit", x: 110, y: 170, title: "Cockpit", sub: "Workspace administration", detail: "Members, roles, usage and billing, API keys, integrations, governance and audit, in the browser at /control.", guide: { href: "/docs/workspaces", label: "Workspaces and administration" } },
  { id: "agents", x: 110, y: 270, title: "External agents", sub: "Cursor, Claude Code, others", detail: "AI agents call V19 through the MCP gateway with scoped API keys. They can request approval and read policy; a key holder cannot approve its own requests.", guide: { href: "/docs/agent-gateway", label: "Agent gateway" } },
  { id: "service", x: 360, y: 170, title: "V19 service", sub: "Records, policy, approvals", detail: "Holds workspace records, permissions, approvals and audit evidence, and makes provider calls with scoped, encrypted credentials. Every write keeps its own approval gate.", guide: { href: "/docs/permissions-model", label: "Permissions model" } },
  { id: "github", x: 630, y: 50, title: "GitHub", sub: "Repos, PRs, workflows", detail: "Repository context and pull-request evidence, and dispatch of the governed GitHub workflow for an exact release version. Dispatch acknowledgement is not proof of application health.", guide: { href: "/docs/releaseops", label: "Release operations" } },
  { id: "cloud", x: 630, y: 125, title: "Cloud accounts", sub: "AWS · Azure · GCP", detail: "Read-oriented discovery and evidence from your cloud accounts through scoped connections.", guide: { href: "/docs/aws-setup", label: "AWS setup" } },
  { id: "tickets", x: 630, y: 200, title: "Tickets and chat", sub: "Jira · ServiceNow · Slack", detail: "Change tickets and incidents linked to exact releases, and governed notifications. Ticket actions follow each provider's own approvals.", guide: { href: "/docs/integration-setup", label: "Integration setup" } },
  { id: "batch", x: 630, y: 275, title: "Batch orchestration", sub: "Airflow · Prefect · Dagster", detail: "DAG and run observations and saved dependencies for releases. Prefect, Dagster and Argo are read-only; nothing is started, retried or cancelled from them.", guide: { href: "/docs/batch-providers", label: "Batch providers" } },
  { id: "ai", x: 360, y: 300, title: "AI models", sub: "Gateway or your own server", detail: "Cloud AI through the AI Gateway with prepaid, metered usage, or a customer-hosted model server in offline installations with no cloud fallback.", guide: { href: "/docs/offline-ai", label: "Offline AI" } },
];
export const ARCHITECTURE_EDGES: Array<[NodeId, NodeId, string]> = [
  ["desktop", "service", "signed-in session"], ["cockpit", "service", "browser session"], ["agents", "service", "MCP + scoped key"],
  ["service", "github", "repo reads, governed dispatch"], ["service", "cloud", "scoped reads"], ["service", "tickets", "linked tickets, notices"],
  ["service", "batch", "run observations"], ["service", "ai", "metered model calls"],
];
