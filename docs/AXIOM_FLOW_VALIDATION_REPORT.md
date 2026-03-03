# Axiom System Flow Validation Report

**Date:** 2025-03-03  
**Scope:** Full user journey through Cloud Operator (steps 1–10)

---

## VERIFIED Components

| Step | Component | Details |
|------|-----------|---------|
| 1 | AWS Connector Link | `app/api/connectors/link/route.ts` — Token auth, tier gating (canViewTechnicalOutputs), `isCloudConnectorEnabled`, uses `getConnector("aws").validateConnection()`. Stores `verifiedAccountId`, `encryptedCredRef`. |
| 2 | Infrastructure Discovery | `app/cloud-operator/page.tsx` InfraDiscoveryCard — Calls `POST /api/execution/run` with `pluginId: "aws:infra-discovery"`, token. Plugin registered in `lib/plugins/aws/infrastructure-discovery.ts`. Results stored in ExecutionLog. |
| 3 | IAM Exposure Scan | RunScanCard — `pluginId: "aws:iam-exposure-scan"` (registered in `lib/plugins/aws/iam-readonly-scan.ts`). Read-only, always dryRun. |
| 4 | Environment Summary | `app/api/execution/run/route.ts:157-245` — After `aws:infra-discovery` succeeds, calls `generateEnvironmentSummary` and `buildArchitectureGraph`, stores in `fullPayload.environmentSummary` and `fullPayload.architectureGraph`. |
| 6 | DevOps Plan | `lib/agents/axiomAssistantAgent.ts` — Outputs `plan` with `goal` and `steps` for multi-step requests. Valid step actions enforced. |
| 7 | Dry-Run First | `app/api/execution/run/route.ts:77-86` — IAM scan and infra-discovery always dryRun. `aws:disable-unused-access-key` requires `apply: true` to set dryRun=false. RunScanCard shows confirm dialog before apply. |
| 8 | Apply with Confirmation | `app/api/execution/run/route.ts:94-105` — `plugin.modifiesInfrastructure && !dryRun` requires `confirmation` to include "CONFIRM APPLY". RunScanCard passes `confirmation: "CONFIRM APPLY"` and `apply: true`. `lib/execution/pluginEngine.ts:121-127` enforces same check. |
| 9 | ExecutionLog Recording | `lib/execution/pluginEngine.ts:130-145` — `prisma.executionLog.create` before run; update with status/result/finishedAt. All plugin runs recorded. |
| 10 | Execution History Display | `app/api/cloud-operator/execution-history/route.ts` — Returns entries for lead (leadId or userId). CloudTimelinePanel fetches on mount when switching to timeline tab. |
| 10 | Architecture Graph Display | `app/api/cloud-operator/status/route.ts` — Returns `architectureGraph` from `fullPayload`. `ArchitectureGraphView` in overview tab shows nodes/edges. Refreshed via `fetchStatus` after infra-discovery `onSuccess`. |
| UI Refresh | InfraDiscoveryCard / RunScanCard | `onSuccess` triggers `fetchStatus()`, `fetchWorkflowStatus()`. Status and workflow steps update. |
| Token Auth | Execution Run | `app/api/execution/run/route.ts:38-66` — Accepts `body.token`; resolves leadId, userId, userPlan from lead. |

---

## PARTIAL Components

| Component | Issue | File(s) | Notes |
|-----------|-------|---------|-------|
| **Execution Run — Session Path** | When auth is session-only (no token in body), `leadId` is never set. AWS plugins require leadId for credentials lookup. Cloud Operator page always sends token, so token path is used. Session-only API callers would fail for AWS plugins. | `app/api/execution/run/route.ts:29-66` | Session path does not resolve leadId from user's cloud-operator lead. |
| **Execution Entitlement** | `axiomExecution` requires Scale or Enterprise plan (operatorTier growth/enterprise). Growth plan maps to pro tier → no axiomExecution. Error message correctly says "Scale or Enterprise plan required". | `lib/entitlements.ts:72-73`, `lib/pricing/membership.ts` | Growth users can link AWS but cannot run execution plugins — may be intentional. |
| **Execute Plan — No Entitlement Check** | `app/api/cloud-operator/execute-plan/route.ts` does not check `axiomExecution` before running. It passes `userPlan` to `executePlugin`, which validates. So entitlement is enforced by pluginEngine. | `app/api/cloud-operator/execute-plan/route.ts` | VERIFIED via pluginEngine — no bypass. |
| **CloudTimelinePanel Refresh** | Fetches on mount (useEffect [token]). When user runs scan from Connectors tab then switches to Timeline, component remounts and fetches — fresh data. No refetch when staying on Timeline after running from another tab. | `app/cloud-operator/page.tsx:1304-1314` | Acceptable: tab switch causes remount and refetch. |

---

## FAILING Components

| Component | Issue | File(s) | Fix |
|-----------|-------|---------|-----|
| **Plugin ID Mismatch** | `aws:iam-readonly-scan` is accepted in VALID_PLUGIN_IDS but the plugin registers as `aws:iam-exposure-scan`. `getExecutionPlugin("aws:iam-readonly-scan")` returns `undefined` → "Plugin not found". | `lib/plugins/aws/iam-readonly-scan.ts:414` (registers as `aws:iam-exposure-scan`), `app/api/cloud-operator/execute-plan/route.ts:18` (allows `aws:iam-readonly-scan`), `lib/agents/axiomAssistantAgent.ts:220` | Remove `aws:iam-readonly-scan` from execute-plan VALID_PLUGIN_IDS and agent validPluginIds, or add alias in registry. |
| **Execution Run — lead.userId Required** | Token auth path requires `lead.userId` (linked account). Unlinked leads get 403 "Sign in to run scans. Link your account first." | `app/api/execution/run/route.ts:51-56` | Documented; ensures scans run only for linked users. Not a bug for intended flow. |
| **AWS Connector — Feature Flag** | When `ENABLE_CLOUD_CONNECTORS_AWS=false`, connector link returns 503 "AWS connector not yet available." | `lib/featureFlags.ts:7-8` | Env: `ENABLE_CLOUD_CONNECTORS_AWS=true` for AWS connector. |
| **AWS Connector — Broker Credentials** | Real validation requires `AWS_CONNECTOR_BROKER_ACCESS_KEY_ID` and `AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY` (or `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`). Missing → "BROKER_NOT_CONFIGURED". | `lib/connectors/aws.ts:36-41` | Required env vars per `docs/AWS_CONNECTOR_SETUP.md`. |

---

## Environment Variables

| Variable | Required For | Notes |
|----------|--------------|-------|
| `DATABASE_URL` | All | PostgreSQL connection string. |
| `STARTER_TOKEN_SECRET` | Token auth (submit, verify) | Min 32 chars. |
| `ENABLE_CLOUD_CONNECTORS_AWS` | AWS connector link | Must be `true` for AWS. |
| `AWS_CONNECTOR_BROKER_ACCESS_KEY_ID` | AWS connector assume-role | Broker IAM user key. |
| `AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY` | AWS connector assume-role | Broker IAM user secret. |
| `CREDENTIAL_ENCRYPTION_KEY` or `STARTER_TOKEN_SECRET` | Credential vault | Fallback to STARTER_TOKEN_SECRET. |
| `RESEND_API_KEY` | Send report, critical findings email | Optional; 503 if missing for report. |
| `OPENAI_API_KEY` or AI provider | Ask Axiom chat | Required for agent. |
| `CRON_SECRET` | run-recurring | For cron auth. |

---

## Execution Safety

- **Dry-run default:** IAM scan and infra-discovery always dryRun.
- **Apply confirmation:** `aws:disable-unused-access-key` requires `confirmation` to include "CONFIRM APPLY" and `apply: true`.
- **No bypass:** `lib/execution/pluginEngine.ts` enforces read-only and modifiesInfrastructure checks; cannot skip.
- **Audit:** `logAudit` called on successful AWS plugin runs.

---

## Summary

| Category | Count |
|----------|-------|
| VERIFIED | 14 |
| PARTIAL | 4 |
| FAILING | 4 (1 plugin ID mismatch, 2 env/flag, 1 documented behavior) |

**Primary fix:** Resolve `aws:iam-readonly-scan` vs `aws:iam-exposure-scan` inconsistency in `app/api/cloud-operator/execute-plan/route.ts` and `lib/agents/axiomAssistantAgent.ts` so plans using the canonical plugin ID execute correctly.
