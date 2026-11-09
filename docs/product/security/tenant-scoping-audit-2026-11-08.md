# Tenant-scoping (IDOR) audit — app/api route handlers

Date: 2026-11-08
Follows: `consolidated-threat-model-2026-11-08.md` (finding: tenant scoping is added by hand per query, no RLS)

## Method and limits

- **Static review only.** Nothing was exploited and nothing was run against a database. **SUSPECT means "no tenant check was found in the route or in the helper it calls one level deep". It does not mean confirmed vulnerable.** A check can exist in middleware, a deeper helper or a data invariant that this pass did not follow.
- Scope: the 735 `app/api/**/route.ts` files. I grepped for `findUnique`, `findFirst`, `update`, `delete`, `upsert`, `updateMany` and `deleteMany` on the 129 Prisma models that have an `organizationId` column (from `prisma/schema.prisma`). I also checked `Lead` and `TerraformExecutionJob`, which have no `organizationId` and are keyed by `userId` or a token, and the child models `AxiomAgentTask` and `AxiomFinding`, which get their tenant only through a parent `AxiomAgentRun`.
- Filter used: calls whose `where` did not contain `organizationId` (about 92 hits outside `cron/`, `admin/` and `internal/`). Each was read in context. A second pass looked for routes that take `organizationId` **from the request body or query string**. Every high-risk finding below came from that second pass.
- A `where` that does contain `organizationId` was treated as safe only when the value comes from the session, desktop session or API-key context. I did not trace every one of those back to its origin. The second pass covers the obvious body and query sources.
- `cron/`, `admin/` and `internal/` routes were not audited in depth.

## SUSPECT findings

**Status 2026-11-08:** all ten findings below are fixed in PR #222 (`authorizedForOrganization` membership re-check, admin for mutations).

All findings are in `app/api/axiom/*`. That route family authenticates the user with `getServerSession` and a plan/entitlement check, and **trusts the `organizationId`, run id or account id that the client sends**. The newer siblings (`axiom/scheduler`, `axiom/autopilot`, `axiom/approvals`) were already hardened with `authorizedForOrganization` / `acceptedMembership` / `ctx.organizationId`. The ones below were not.

| # | Risk | File:line | Model | Op | Id source | Why suspect | Suggested fix |
|---|---|---|---|---|---|---|---|
| 1 | High | `app/api/axiom/preferences/route.ts:46` (GET) and `:66` → `lib/axiom/agent/preferences.ts:47`, `:89` | AxiomOrgPreferences | findUnique / **upsert** | `?organizationId=` query and body `organizationId` | No membership check. Any signed-in user on an entitled plan can read or **overwrite** another workspace's Axiom preferences (risk tolerance, approval policy). | Use the org from `currentContext()`, reject a mismatched supplied org, or call the `authorizedForOrganization(userId, org, mutation)` pattern from `axiom/scheduler`. |
| 2 | High | `app/api/axiom/operations/route.ts:20` (queries from line 27) | AxiomAgentRun, schedules, approvals, audit, CloudAccount | findMany | `?organizationId=` query | Reads another tenant's runs, schedules, approvals and cloud-account list using only an org id the caller supplies. No membership check found. | Same as #1, read-only variant. |
| 3 | High | `app/api/axiom/chat/route.ts:51` → `lib/axiom/chat/handlers.ts:37-42`, `:426`, `:574`, `:790`, `:1072`; `lib/axiom/chat/router.ts:120` | AxiomAgentRun, CloudAccount, AxiomMonitorAlert, AxiomMessage | findFirst / findMany | body `organizationId`, `conversationId`, `activeRunId`, `activeAccountId` | Every handler is scoped to the body-supplied org, which is never checked for membership. `conversationId` is not checked for ownership before messages are loaded by `conversationId` alone (`router.ts:120`). This could leak another user's chat history. `activeAccountId` is passed into a `trigger_scan` action (`handlers.ts:608`). | Use the context org. Load the conversation with `{ id, userId }` (and org) before use. Check that `activeRunId` and `activeAccountId` belong to the org. |
| 4 | High | `app/api/axiom/agent/onboard/route.ts:45` → `lib/axiom/agent/onboarding.ts:78` | CloudAccount | findUnique `{ id }` | body `connectedAccountId`, `organizationId` | Loads the cloud account by id only. No `account.organizationId` comparison found before validating credentials and starting a first scan. | Check `account.organizationId === ctx.organizationId` and membership. Return 404 on mismatch. |
| 5 | Medium-High | `app/api/axiom/tasks/route.ts:76` (POST) → `enqueueTasks` (`lib/axiom/taskQueue/runner.ts`) | AxiomAgentTask (via run / cloud account) | create, then processing | body `organizationId`, `cloudAccountId`, `agentRunId` | Queues scan/plan tasks against a supplied org, account and run with no membership or ownership check found in the route. The runner was not traced past `enqueueTasks`. | Resolve the org from context. Check that the run and the account belong to it. |
| 6 | Medium | `app/api/axiom/agent/run/route.ts:43` → `lib/axiom/agent/runAgent.ts:70-80` | CloudAccount | findUnique `{ id }`, then compare | body `organizationId`, `connectedAccountId` | `runAgent` does compare `account.organizationId !== organizationId`, but that `organizationId` comes from the body and is never checked for membership. An attacker who knows both ids of another tenant can start a scan of their account. | Same as #4. |
| 7 | Medium | `app/api/axiom/tasks/route.ts:47` (GET) | AxiomAgentTask | findMany `{ agentRunId }` | `?runId=` query | Lists the tasks of any run by id. No check that the run belongs to the caller. | Join through the run: `where: { agentRunId, run: { organizationId: ctx.organizationId } }`. |
| 8 | Medium | `app/api/axiom/tasks/retry/route.ts:39` → `lib/axiom/taskQueue/runner.ts:240` | AxiomAgentTask | findUniqueOrThrow `{ id }`, then re-execution | body `taskId` | Retries (re-runs) any task by id. No owner or org check found in the route or in `retryTask`. | Load the task with `run: { organizationId }` and verify it before retrying. |
| 9 | Medium | `app/api/axiom/diff/route.ts:45` → `lib/axiom/diffEngine.ts:455` | AxiomAgentRun | findUniqueOrThrow `{ id }` | `?previousRunId=`, `?currentRunId=` | Returns a diff of resources and findings for any two run ids. No org check found. | Require both runs to have `organizationId === ctx.organizationId`. |
| 10 | Medium | `app/api/axiom/explain/route.ts:72` → `lib/axiom/explainEngine.ts:136` | AxiomFinding (via run) | findUniqueOrThrow `{ id }` | `?findingId=` | Returns a grounded explanation, including finding details, for any finding id. No org check found. | Scope through `run: { organizationId: ctx.organizationId }`. |

Notes on likelihood: ids look like cuids, so exploiting these needs a leaked or guessed id. That lowers the risk but is not a control. Findings #1–#3 take an **organization id**, which is much easier to learn (URLs, invites, support screenshots) than a row id.

## Observations (not IDOR, flagged for follow-up)

- `app/api/axiom/execution/apply/route.ts:370` sets `organizationId: userId`. This is a legacy user-as-org convention. The value is session-derived, so it does not leak, but it is inconsistent with the real workspace model.
- `lib/starterToken.ts:31-32` accepts a "legacy" two-part `leadId.hmac` token that appears to have no expiry. Every `leads/[id]/*`, `terraform/*`, `cloud-operator/*` and `connectors/*` route that uses a token relies on it as a bearer capability. They do correctly compare `result.leadId` with the route id or the `job.leadId`. **Resolved 2026-11-08:** legacy two-part tokens are now rejected as `expired` (the format was replaced 2026-02-25, so none is within the 7-day limit).
- `app/api/axiom/cloud/snapshot/route.ts:42` and `cloud/validate/route.ts:40` pass a body `connectedAccountId` to the provider adapter together with the session `userId` (`awsAdapter.ts:64`, `azureAdapter.ts:99-103`). **Checked 2026-11-08: safe.** `getOwnedConnector` (`lib/plugins/credentials.ts:42-43`) loads the record and returns null unless its `userId` matches the session user.

## SAFE patterns observed

About 60 of the about 92 candidate calls were confirmed safe by reading them, using one of these patterns:

1. **Load by id, then compare org before use (404 on mismatch):** `app/api/desktop/environments/deploy/route.ts:86-88`, `dashboard/release-create/route.ts:53-55`, `dashboard/release-evidence-export/[id]/route.ts:47-49`, `approvals/decide/route.ts:50-56`, `account/cloud-accounts/[id]/route.ts:43-50`, the three `dashboard/*-rationale-enrich` routes, and `dashboard/release-playbook/[id]/route.ts:158` (checked at `:222`).
2. **Scoped `findFirst`, then an unscoped write by the same id:** `desktop/airflow/automations/[id]/route.ts:14-16`, `:33-36`. This is safe as written. A compound `where: { id, organizationId }` on the write would be more robust.
3. **Compound unique key that includes the org:** `workforce/[id]/notes`, `workforce/[id]/toggle`, `workforce/share-link`, `desktop/workspace-members/route.ts:69-78` (`userId_organizationId`).
4. **Conditional `updateMany` / `deleteMany` with org and optimistic-concurrency guards:** `team/role/route.ts:111`, `approvals/decide/route.ts:62`, `control/audit-security/sessions/route.ts:61`, `desktop/environments/deployments/[id]/route.ts:47`.
5. **Membership resolved from the loaded record's org:** `axiom/scheduler/route.ts:137-140`, `:158-160` and `axiom/autopilot/route.ts:68-69`, `:131-135`. The suspect routes above should copy this pattern.

Also safe: `v1/pipelines/runs/[id]` (API-key org in the `where`), `desktop/agent/conversations/[id]` (org and `userId` in the `where`), `dashboard/github-installation-transition/route.ts:72` (id taken from the org-scoped responder result), `leads/[id]/{publish,deploy-preview,upgrade-tier,generate}` (`requireAdmin`), and `terraform/*` (token `leadId` compared with `job.leadId`).

## Could not assess

- `app/api/axiom/cloud/snapshot`, `app/api/axiom/cloud/validate`: depends on how `getCredentialProvider().get*Credentials(userId, credentialRef)` scopes the lookup. Not traced.
- `app/api/axiom/tasks` POST past `enqueueTasks`, and the background task handlers (`runner.ts:204`, `:259`), which act on `run.cloudAccountId`.
- `app/api/axiom/execute-fixes`, `app/api/axiom/execution-logs`: token and lead based. Only partly read.
- Repository-pattern calls through `repo.<model>` aliases and `lib/*` responders with names other than the ones listed above. Only the helpers named in this report were followed.
- Every `findMany` or `count` whose `where` contains `organizationId`. The origin of that org value was spot-checked, not proven for every call.
- `cron/`, `admin/`, `internal/` routes. Not audited for authentication in this pass.
- Server actions and `app/**/page.tsx` server components that query Prisma directly. Out of scope (route handlers only).
