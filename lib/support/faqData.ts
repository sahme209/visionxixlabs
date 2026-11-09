/**
 * Public FAQ, shared by /docs/faq and the Ask Axiom support agent.
 * One source of truth: edit answers here, never in two places.
 */
export const FAQ_GROUPS: ReadonlyArray<{ title: string; items: ReadonlyArray<{ q: string; a: string }> }> = [
  {
    title: "The basics",
    items: [
      {
        q: "What is Axiom Agent?",
        a: "A downloadable deployment-operations workspace for intake, readiness, approvals, plan review, guided execution, validation, evidence, and closure. Connector and execution availability is shown in the installed release.",
      },
      {
        q: "What is the main workflow?",
        a: "A user selects a repository, branch, and environment, then asks the Agent for an outcome. Read-only tools can run inline. Any GitHub write or deployment stops at an explicit proposal, risk check, and admin approval before the real action runs.",
      },
      {
        q: "Does Axiom replace my existing tooling?",
        a: "No. The released path uses your GitHub repository, GitHub Actions workflow, AWS role, ECS target, and optional Airflow installation. Axiom adds selection, governance, approval, and evidence around those systems.",
      },
    ],
  },
  {
    title: "Connections",
    items: [
      {
        q: "Which production deployment path is released?",
        a: "AWS ECS deployment is released through the tenant's own GitHub Actions workflow. GitHub Actions uses OIDC to assume the configured AWS role, waits for ECS steady state, and rolls back to the previous task definition if stabilization fails.",
      },
      {
        q: "What permissions does Axiom need?",
        a: "GitHub access is minted for one selected repository through the installed GitHub App. AWS credentials are not stored by Axiom; the deployment workflow uses GitHub OIDC and the role configured for the selected environment.",
      },
      {
        q: "Are credentials stored?",
        a: "The released AWS deployment path stores no long-lived AWS access key in Axiom. GitHub Actions obtains short-lived AWS credentials through OIDC. Provider tokens and desktop sessions remain tenant-scoped and are handled by the service, not entered into chat.",
      },
      {
        q: "How do I revoke access?",
        a: "Remove the GitHub App installation or repository grant, and remove or disable the configured AWS role trust relationship. The desktop Integration Center shows the server-verified connection state.",
      },
    ],
  },
  {
    title: "Agent and approvals",
    items: [
      {
        q: "Can the Agent change a repository by itself?",
        a: "No. Repository reads can execute inline, but branch creation, file commits, and pull-request creation become persisted action proposals. An authorized workspace admin must approve the proposal before the write function runs.",
      },
      {
        q: "What is recorded?",
        a: "Every Agent tool call receives an audit record, including low-risk reads. Proposed writes record their inputs, risk, status, approval or rejection, execution result, and timestamps.",
      },
      {
        q: "Why might the Agent refuse to run?",
        a: "AI is opt-in per workspace. The runtime checks AI credit and provider policy before calling a model, and fails closed if either check is not satisfied. A model also has to be enabled in workspace settings.",
      },
      {
        q: "Does the Agent remember repository context?",
        a: "The desktop app keeps repository, branch, environment, and conversation context visible and click-selectable. Treat persistent cross-conversation memory as release-dependent; the installed app is the authority for what is available.",
      },
    ],
  },
  {
    title: "Execution & approval",
    items: [
      {
        q: "Does Axiom apply changes automatically?",
        a: "Read-only checks may execute inline. Medium- and high-risk changes require explicit approval, and production context can only increase risk. The Agent cannot approve its own proposal.",
      },
      {
        q: "What if an execution fails?",
        a: "Rollback availability depends on the active adapter, prerequisites, and verified recovery evidence. When automatic rollback is unavailable, the app must keep the failure visible and require an explicit manual recovery path.",
      },
      {
        q: "Can an admin bypass production controls?",
        a: "The product is designed around explicit authority and evidence. Any emergency or direct-production path must be separately permissioned, visibly labeled, and audited; availability depends on the installed release and workspace policy.",
      },
    ],
  },
  {
    title: "Deployment and Airflow",
    items: [
      {
        q: "How does environment selection work?",
        a: "Each environment can map to an AWS region, role ARN, ECS cluster, and ECS service. Selecting an environment gives the Agent and deployment workflow that governed target instead of asking the user to type cloud coordinates into chat.",
      },
      {
        q: "How does Airflow participate?",
        a: "A configured Airflow connection can expose DAGs for click-based selection and dependency checks. Scheduling or triggering a governed action must still pass the configured approval, retry, notification, and audit boundaries.",
      },
      {
        q: "What happens after an ECS dispatch?",
        a: "The tenant workflow captures the previous task definition, performs the deployment, waits on ECS steady-state validation, and automatically restores the previous task definition if the new service does not stabilize.",
      },
    ],
  },
  {
    title: "Desktop",
    items: [
      {
        q: "Is there a desktop app?",
        a: "Yes. The downloadable Tauri desktop app is the product interface. The download page is the authority for currently published, signed platform builds.",
      },
      {
        q: "What does the desktop app do that the web doesn't?",
        a: "The public website explains and demonstrates the product. Signed-in workspace pages in the browser live under /control (members, governance, agent gateway, trust tools, usage and settings). Operational work such as deployments happens in the desktop app with desktop-session authentication.",
      },
      {
        q: "Where do I download?",
        a: "Visit /download for OS-detected install links and the full platform roadmap.",
      },
    ],
  },
  {
    title: "Pricing & access",
    items: [
      {
        q: "How is Axiom priced?",
        a: "Axiom is free to explore. Optional prepaid AI credits are the only paid part: exact per-model rates, the cost shown before each action, and never a charge beyond what you prepaid. Credit purchases are not open yet. See /plans for the rate card.",
      },
      {
        q: "Can I review the product before paying?",
        a: "Yes. The interactive demonstration is labeled as scripted sample data, documentation is public, and every organization gets 10 counted deployments a month at no charge.",
      },
      {
        q: "Which identity options are available?",
        a: "Enterprise identity configuration exists, but a configured provider remains pending until a real OIDC or SAML client and sign-in path are verified. A logo or saved provider record does not mean enterprise sign-in is active.",
      },
    ],
  },
];
