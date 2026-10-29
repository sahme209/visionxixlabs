/** Shared navigation data; no React or native runtime dependencies. */
export const CUSTOMER_NAVIGATION = [
  {
    kind: "deployment",
    label: "Workspace",
    items: [
      { id: "agent", label: "Agent" },
      { id: "axiom-bot", label: "Axiom Bot" },
      { id: "deployment-requests", label: "Releases", title: "Release workspace" },
    ],
  },
  {
    kind: "workspace",
    label: "Resources",
    items: [
      { id: "repository-workspace", label: "Repositories", title: "GitHub repositories" },
      { id: "airflow-automation", label: "Batches", title: "Batch automation" },
      { id: "plugins-skills", label: "Plugins & Skills" },
    ],
  },
  {
    kind: "utility",
    label: "Utilities",
    items: [
      { id: "docs", label: "Documentation" },
      { id: "settings", label: "Settings" },
    ],
  },
] as const;
