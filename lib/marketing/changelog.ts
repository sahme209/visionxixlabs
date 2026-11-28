/**
 * Public changelog. Only changes that are live on visionxixlabs.com or in a published desktop release,
 * dated when they became available. Keep entries short and specific; link to the guide.
 */
export interface ChangelogEntry { date: string; title: string; summary: string; items: string[]; href: string; area: "Desktop" | "Cockpit" | "Agents" | "Plugins" | "Security" }

export const CHANGELOG: readonly ChangelogEntry[] = [
  { date: "2026-11-28", area: "Plugins", title: "Hosted MCP servers, approved tool by tool", href: "/docs/mcp-tools",
    summary: "Add hosted servers from the public MCP registry to your workspace and decide exactly which tools your agents may use.",
    items: ["A connection check lists a server's tools with no credentials and no tool calls.", "A server can be enabled only after a passing check.", "Owners and admins approve individual tools; agents never see the rest.", "Calls go only to the stored https address, with input limits and output marked untrusted."] },
  { date: "2026-11-28", area: "Security", title: "Custom roles", href: "/docs/permissions-model",
    summary: "Start from a built-in role and remove what a member should not do, such as the emergency production bypass.",
    items: ["Enforced on every desktop request.", "Never grants more than the built-in role.", "Refuses the request if a custom role cannot be read.", "Audited, up to 25 per workspace."] },
  { date: "2026-11-28", area: "Cockpit", title: "Delivery health", href: "/docs/releaseops",
    summary: "Services shows each environment's success rate, median run time and runs that look stuck, over 30 days.",
    items: ["Failing when the last three finished runs failed.", "Degraded for stuck or untracked runs, with the reason shown."] },
  { date: "2026-11-27", area: "Desktop", title: "V19 desktop 0.1.26", href: "/download",
    summary: "The latest desktop release with this month's visual and workflow changes, for macOS, Windows and Linux.",
    items: ["macOS builds are signed and notarized.", "Installed apps show when a newer release is available."] },
  { date: "2026-11-27", area: "Cockpit", title: "Check library", href: "/docs/releaseops",
    summary: "Start from reviewed checks such as Trivy, Grype, Checkov, Hadolint, the OWASP ZAP baseline and Lighthouse.",
    items: ["Each GitHub Action is pinned to the commit of a published release.", "Picking one fills the form; nothing is saved until you add it."] },
  { date: "2026-11-27", area: "Cockpit", title: "Deployment freezes and environments as code", href: "/docs/releaseops",
    summary: "Freeze production or every environment during an incident, and keep environments in a reviewable file.",
    items: ["Incident tools can start a freeze with a dedicated API key scope, for at most 24 hours.", "Webhooks for freeze start and end.", "Export, preview and apply environments as a file."] },
  { date: "2026-11-27", area: "Plugins", title: "Public MCP registry and GitHub Actions as checks", href: "/docs/mcp-tools",
    summary: "Browse thousands of MCP servers from the public registry, and use any GitHub Action as a deployment check pinned to a full commit.",
    items: ["Registry listings are shown as untrusted publisher data.", "Plugin manifest format and checker for vendors."] },
];
