/** Shared navigation data; no React or native runtime dependencies. */
export const CUSTOMER_NAVIGATION = [
  {
    kind: "deployment",
    label: "Deployment",
    items: [
      { id: "agent", label: "Agent" },
      { id: "deployment-requests", label: "Release workspace" },
      { id: "airflow-automation", label: "Batch automation" },
    ],
  },
  {
    kind: "workspace",
    label: "Workspace",
    items: [
      { id: "repository-workspace", label: "GitHub repositories" },
      { id: "plugins-skills", label: "Plugins & Skills" },
      { id: "docs", label: "Documentation" },
      { id: "settings", label: "Settings" },
    ],
  },
] as const;
