/** Shared navigation data; no React or native runtime dependencies. */
export const CUSTOMER_NAVIGATION = [
  {
    kind: "deployment",
    label: "Workspace",
    items: [
      { id: "deployment-requests", label: "Deployments", title: "Plan releases and review their exact actions and evidence" },
      { id: "tickets", label: "Tickets", title: "Review recorded deployment incidents and change tickets" },
      { id: "agent", label: "Agent", title: "Work with code, local files and research" },
      { id: "axiom-bot", label: "Saved Tasks", title: "Saved tasks, AI responses and reviewed app actions" },
    ],
  },
  {
    kind: "workspace",
    label: "Resources",
    items: [
      { id: "repository-workspace", label: "Repositories", title: "GitHub repositories" },
      { id: "airflow-automation", label: "Batches", title: "Batch automation" },
      { id: "plugins-skills", label: "Apps & Skills", title: "Connected apps and reusable skills" },
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
