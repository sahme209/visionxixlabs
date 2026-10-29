# Azure guided desktop implementation plan

Approved design: workspace outputs/axiom-azure-simple-connect-blueprint.md. Implement only the desktop transport and primary card; backend owned by storage agent. No registration, provider calls, deployment or native restart.

1. Agree exact browser-safe server DTO with backend owner. Add transport tests for fixed first-party paired endpoint, bounded response/timeout, strict Microsoft authorization destination, no raw error reflection, attempt/subscription response binding and current credential context. Watch RED then implement new azureGuidedConnectionClient.ts.
2. Add component tests for explicit Connect, real server-returned subscription names, separate exact target review, no automatic completion, read-only connection label, uncertain hold + explicit GET, expiry/cancel, permission limits, stale/unmounted completion and old Reader preservation message. Watch RED then implement AzureGuidedConnection.tsx with official mark/current neutral tokens. No technical identity or secret inputs.
3. Minimal agreed SettingsView import/mount beside AWS/GCP; preserve Advanced. Run focused tests and desktop TypeScript only; request independent review and freeze exact paths. No commit/build/restart/deploy.
