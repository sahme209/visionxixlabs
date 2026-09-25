export type CapabilityState = "working_tested" | "demo_sandbox" | "planned_blocked";

export interface TauriCapability {
    id: string;
    name: string;
    state: CapabilityState;
    publicDescription: string;
    evidence: readonly string[];
    limitation: string;
}

export const capabilityStateLabel: Record<CapabilityState, string> = {
    working_tested: "Working and tested",
    demo_sandbox: "Demo / sandbox",
    planned_blocked: "Planned or blocked",
};

/**
 * Public source of truth for TAURI claims.
 *
 * A capability must not be promoted to working_tested without a tenant-scoped
 * product route and automated test evidence. UI-only prototypes belong in
 * demo_sandbox, even when their local interactions are complete.
 */
export const tauriCapabilities: readonly TauriCapability[] = [
    {
        id: "deployment-intake",
        name: "Deployment intake",
        state: "demo_sandbox",
        publicDescription: "A guided form captures change scope, timing, repository, approval, validation, and rollback facts.",
        evidence: ["app/dashboard/tauri/page.tsx", "lib/tauri/__tests__/deploymentOperations.test.ts"],
        limitation: "The current TAURI intake is a sanitized in-browser sandbox and is not persisted as a tenant deployment record.",
    },
    {
        id: "playbook-generation",
        name: "Requests become playbooks",
        state: "demo_sandbox",
        publicDescription: "Validated intake can generate a deterministic, versioned sequence of approval, execution, validation, evidence, and closure steps.",
        evidence: ["lib/tauri/deploymentOperations.ts", "lib/tauri/__tests__/deploymentOperations.test.ts"],
        limitation: "Generation is tested, but the TAURI screen does not yet persist or dispatch a production playbook.",
    },
    {
        id: "approval-change-tracking",
        name: "Approval and change tracking",
        state: "working_tested",
        publicDescription: "Authenticated workspaces can review approval queues and preserve decisions and change context in tenant-scoped records.",
        evidence: ["app/dashboard/approvals/page.tsx", "lib/approvals/__tests__/quorumCalculator.test.ts", "app/api/workforce/approvals/[id]/decide/route.ts"],
        limitation: "TAURI intake is not yet automatically linked to every external change-management system.",
    },
    {
        id: "guided-execution",
        name: "Guided execution",
        state: "demo_sandbox",
        publicDescription: "The sandbox walks an operator through one controlled step at a time and records completed or blocked status.",
        evidence: ["app/dashboard/tauri/page.tsx", "lib/tauri/__tests__/deploymentOperations.test.ts"],
        limitation: "The TAURI flow does not execute production commands or deployments.",
    },
    {
        id: "validation-evidence",
        name: "Validation and evidence",
        state: "working_tested",
        publicDescription: "Authenticated workspaces provide evidence records, exports, and audit-linked validation artifacts.",
        evidence: ["app/dashboard/evidence-library/page.tsx", "app/api/evidence/library/route.ts", "lib/compliance/__tests__/evidencePacketBuilder.test.ts"],
        limitation: "The TAURI sandbox demonstrates evidence requirements but does not upload production evidence from its local form.",
    },
    {
        id: "audit-history",
        name: "Audit history",
        state: "working_tested",
        publicDescription: "Tenant-scoped audit events and correlation-based bundles provide a durable history of governed actions.",
        evidence: ["app/dashboard/audit/page.tsx", "app/api/audit/bundle/[correlationId]/route.ts", "lib/audit/auditBundle.ts"],
        limitation: "History begins when actions occur inside the authenticated workspace; the public demo is fictional and isolated.",
    },
    {
        id: "runbooks",
        name: "Runbooks",
        state: "working_tested",
        publicDescription: "Authenticated teams can view staged runbooks and approval queues, with prerequisite and step validation covered by tests.",
        evidence: ["app/dashboard/runbooks/page.tsx", "app/api/autonomy/runbooks/route.ts", "lib/runbooks/__tests__/runbookStepValidator.test.ts"],
        limitation: "Execution remains approval-gated and depends on configured providers and credentials.",
    },
    {
        id: "integrations",
        name: "Supported integrations",
        state: "working_tested",
        publicDescription: "AWS, Azure, GCP, and GitHub have authenticated connector paths. Slack and Linear action dispatch require workspace configuration.",
        evidence: ["lib/integrations/integrationCatalog.ts", "lib/integrations/__tests__/integrationCatalog.test.ts", "lib/workforce/__tests__/integrationRegistry.test.ts"],
        limitation: "Unconfigured connectors, generic catalog entries, and demo adapters are not live integrations and are labeled accordingly.",
    },
    {
        id: "desktop-distribution",
        name: "Desktop installer",
        state: "planned_blocked",
        publicDescription: "The customer product is currently accessed as a web application.",
        evidence: ["app/dashboard/page.tsx", "app/auth/signin/page.tsx"],
        limitation: "A historical unsigned developer release exists, but no current desktop build has been verified for customer distribution.",
    },
] as const;

export const integrationInventory = [
    { name: "AWS", level: "Configured live connector", note: "Read-only role or customer-supplied credentials; availability depends on workspace configuration." },
    { name: "Azure", level: "Configured live connector", note: "Service-principal validation; feature availability depends on workspace configuration." },
    { name: "Google Cloud", level: "Configured live connector", note: "Service-account validation; feature availability depends on workspace configuration." },
    { name: "GitHub", level: "Configured live connector", note: "Repository access and governed action paths require installation or token setup." },
    { name: "Slack", level: "Optional action dispatch", note: "Works only after a workspace administrator configures a valid webhook or app connection." },
    { name: "Linear", level: "Optional action dispatch", note: "Works only after a workspace administrator configures team and credential references." },
    { name: "ServiceNow and other catalog entries", level: "Planned / adapter only", note: "No general live connector is advertised from the public site." },
] as const;
