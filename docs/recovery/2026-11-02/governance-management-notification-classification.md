# Management and notification mutation classification

November 2, 2026 · base `faae08a2fa46b9601756a4fb3487c03a1a632ebd` plus exact hashes below. Source-qualified named caller audit, **not exhaustive coverage, activation readiness or a new permission/exception design**. No provider calls or tests ran for this classification. Preserve pause, revoke, stop, safety alerts and read/recovery behavior under their existing authority. Related: [coverage queue](governance-execution-coverage-current.md), [drain integration gates](governance-drain-integration-gates.md).

## F17: actual notification call graphs

| Named caller → actual write | Server organization/authority source | Classification and existing containment |
| --- | --- | --- |
| `/api/notifications/dispatch-test` POST **and GET alias** → `sendOutboundNotification` → Slack/Teams/generic HTTP POST | `currentContext` authenticated organization only; no owner/admin/origin check in this route | Discretionary external test send, not read-only despite `notification_read_only` response label. GET actually writes. First containment target: GET405, deliberate same-origin POST/current accepted administrator, initial/final unenrolled/non-draining checks. Do not apply this restriction globally to halt alerts. |
| `autonomyScheduler` approval/halt producers, `runbookQueueStore` human-wait producer, `criticalTelemetryDispatcher` → same outbound lane | Scheduler iterated tenant; persisted runbook organization; telemetry caller `opts.tenantId` | Mixed proposal-ready and critical halt/policy/telemetry alerts. They cannot all inherit discretionary-post classification. Existing opt-in/redaction/dedupe/cap controls supply no admission; preserve safety notifications pending an explicit safety-management policy. |
| `feedbackStore` → outbound lane; weekly digest route → lane; retry queue → lane | Feedback input organization or literal `anonymous`; weekly iterated tenant; retry persisted `row.organizationId` | Platform feedback mirror is not necessarily tenant execution. Digests are discretionary summaries; retries are actual later sends. Destination is resolved again, not an exact original target receipt. Dynamic/unmapped provider/tenant class remains open. |
| `persistScanRun` → `notifyScanComplete` → outbound lane **plus separate fire-and-forget** tenant Slack/Teams POSTs | Persisted scan run/input tenant; `TenantNotificationPreference` lookup by tenant | Critical findings and routine clean scans share plumbing. Central-lane fencing alone misses the extra per-tenant posts. Email is declared TODO, not implemented in this notifier. Preserve finding alerts; classify routine summaries separately. |
| council-generate route and releaseops-autonomous-tick → `sendSlackSignalBestEffort` → `dispatchSlackPayload` | Current browser org for council; iterated organization for cron; stored `SlackNotificationConfig` by org | Existing enabled/kind filters, formatting and best-effort logs; no shared Governance org lock/refusal. Some signal kinds are safety-relevant. Actual transport is injected fetch, not the durable explicit Slack notification executor. |
| workforce-daily-digest → `readSlackConfig` → `postSlackMessage` | `CloudAccount.groupBy(organizationId)` active population; optional CRON_SECRET check when configured; persisted per-org workforce Slack config | Real external digest send; enabled/severity filters. No enrolled/drain protocol. Optional-secret deployment state is not inspected here. Separate from `/api/dashboard/slack-config` and explicit Slack action stores. |
| `dispatchWebhookEvent` → queued `WebhookDelivery` → `deliverWebhookDelivery`; retry cron → same delivery function | Producer organization; endpoint selection by org; persisted delivery/endpoint organization | Generic signed callback effects include connector health, billing alerts, workforce/pipeline/eval and Airflow completion producers. Real CAS claim and URL/revoked checks, persistent retry/deadletter exist, but no Governance org barrier. Endpoint snapshot can precede later writes; no atomic revoke/network guarantee. Remote callback may trigger arbitrary external work; HTTP200 is not effect quiescence. |

The outbound lane's daily-cap lookup deliberately fails open on error and tenant Slack override read may fall back to global environment URL. Those are availability/routing choices, **not authoritative unenrollment or a tenant-bound notification manifest**. Teams/generic destinations come from global environment; email lane is explicitly pending. Fire-and-forget persistence/retry is not a durable pre-send intent. Critical alerts must not disappear because this audit finds the generic lane incomplete.

## M01: membership and outstanding invitation authority

| Actual mutation | Existing organization/current authority | Increase versus reduction; lock/refusal |
| --- | --- | --- |
| Desktop workspace-members PATCH → `OrgMembership.update` | Exact paired principal org, `members:manage`; accepted target and protected owner/self checks | Role replacement can add capability; roles are a **capability-set partial order**, not a simple rank. Only a proven capability subset is a pure reduction. No org-first enrollment/drain transaction. |
| Browser team/role POST → update/delete membership | `requireContext` org, current accepted persisted owner/admin; target-org/owner/self checks; navigation-intent path adds refreshed authority/CAS | Removal is safety reduction; role replacement needs capability difference. Preserve removal/demotion; do not blanket-fence the endpoint. Legacy non-intent branch is a separate current-authority/CAS path to strengthen. |
| team/invite POST → `createInviteToken` | `requireContext` org plus persisted accepted owner/admin | Authority artifact issuance: HMAC token contains org/email/role/inviter/expiry/nonce, default seven days. No durable consumed nonce or org barrier. Mint refusal alone cannot contain existing invitations. |
| accept-invite page → `claimOrganizationSeat` → existing member role update/new membership create | Signed token org, matching authenticated email, currentContext user; seat entitlement/quota | Stateless token acceptance can update an **existing** member back to the invite role. No current inviter-admin or consumed-nonce validation at redemption. Seat transaction is Serializable; public billing's organization lock is separate from Governance advisory lock. Outstanding replay/lifetime remains a source-confirmed blocker after demotion/removal. |

Minimal containment: compare exact old/new capability sets under locked current membership; serialize increases and invitation redemption/mint against the same Governance org barrier. Preserve reductions. Invitation lifetime/replay/revocation needs an explicit accepted protocol; do not invent a seven-day grace wait or treat a signed old token as current administrator authority.

## M02: policy, autonomy, budget and branch authority

- `/api/control/ai-governance` PATCH uses same-origin/currentContext + existing admin/owner policy, then independently saves provider policy, agent identity (`enabled`, `allowedTools`), autonomy charter or budget. `/api/account/ai-policy` and `/api/autonomy/charter` are real alternate setters. Actual helpers persist organization-scoped rows; no shared enrollment/drain lock. Adding tools/providers, enabling identity, increasing permitted autonomous work or budget (`null` means unlimited) expands authority. Disabling tools/identity or lowering a proven effective bound may reduce it; mixed payloads, provider/default routing and inherited defaults require comparison of **resolved old/new** policy, not field names. Preserve observer/stop and explicit safe rollback/recovery.
- Charter DELETE falls back to the source's observer default, but restoration/default semantics must remain explicit; deletion is not generically a reduction for every policy family.
- Desktop branch-policy POST → `buildBranchEnvironmentPolicyCreateResponse` → `branchEnvironmentPolicy.create`, paired `policy:manage`, owned environment/repository checks and production PR/tests/promotion requirements. Deployment guard enforces **first matching policy by priority**; creating a weaker/higher-priority match can change effective authority. “Only create” does not prove stronger policy. No shared Governance transaction.

Minimal containment: one transactional old/new effective-policy comparator and current accepted admin scope shared across alternate setters; unknown/incomparable edits treated as increases. Initial provider catalog reads stay outside locks, then exact validated bindings rechecked inside the mutation transaction. Do not reinterpret the existing administrator capability as baseline activation or introduce a management action vocabulary without design approval.

## M03: integration consent/configuration and reactivation

| Actual named lane | Authority and saved target | Classification / next containment |
| --- | --- | --- |
| Teams/Linear action consent HTTP → `connectedActionConsentRuntime` → OAuth exchange/identity verification → scoped credential replacement | Current browser user=session user, accepted persisted owner/admin; original authorization state, exact provider/account/connection/revision/credential digest | Capability-bearing OAuth flow. Runtime transaction/CAS and member lock exist, **not Governance org lock**. Fence start and final grant persistence, track consequential credential exchange/lifetime separately; preserve decline/disconnect/recovery. |
| Outlook browser read/actions start/callback → `outlookRuntime` | Current browser admin/owner + exact org/session-user; purpose-bound state/account/registration | Read consent and actions consent are distinct; browser label is not a paired desktop session grant. Future grant boundary must preserve purpose/source/current checks. OAuth success is not resource mutation or full coverage. |
| Slack OAuth start/callback → tenant authorization consume → scope validation → encrypted connection create/CAS | CurrentContext org/admin, exact initiating user/state/redirect; callback rechecks current actor; requires channels:read/chat:write | Adds real notification capability. State consumption and CAS do not establish drain; old/unacknowledged token exchange still needs exposure classification. |
| Jira activate → `activateJiraReadConnection`; write/reporter consent routes | Browser admin, current actor callback, exact connection revision/site; read activation reports read validation separately from issue-write proof | Read activation is not write permission; write/reporter consent is separate. Preserve exact scope distinction, no generic “active means write” exception. Broader refresh/callback credential lifetime remains open, not exhaustively qualified here. |
| ServiceNow configure/refresh routes → `serviceNowConnectionRuntime`/refresh HTTP | Current actor + exact registration/instance/connection revision, feature/rate/body controls; refresh result is connected_read_only | Credential and control-plane change, not proof of incident write grant. No generic enrollment coverage. Full provider-specific old-token and refresh/drain treatment remains unknown. |
| Airflow connection PUT → provider validate/auth → active create/update CAS; automation POST/PATCH → actual rule create/update | Current exact paired `connections:manage` or `policy:manage`; tenant connection and target binding | Enables/replaces credentials or schedules real future work. Current authority/revision/CAS exist; no org drain boundary. Disabled automation/connection DELETE are safety operations; DELETE preserves execution audit history (pause instead when needed). Provider validation/auth must remain outside DB locks; track credential exposure before mint. |
| Workforce GitHub/Linear/Slack-action config → `integrationMutationContext` → registry save | Same-origin browser current session org; tenant-admin gate; accepted current context | Configured repo/team/webhook/credential reference expands/repoints capability. `enabled:false` is reduction only if no collateral expansion. Existing dispatch now refuses enrollment, but saved config/credentials still need management classification. |
| `/api/dashboard/slack-config` POST → `buildSlackConfigUpsertResponse` → org config upsert | **Only authenticated currentContext organization**, unlike workforce config's explicit admin gate | Concrete authority repair target: require same-origin/current accepted owner/admin; exact config upsert under org lock with positive unenrolled/non-draining absence. `enabled:false` pause must remain reachable; destination/kind additions are increases. GET masked config remains read-only. |

## M04 and separate platform/service writers

| Actual lane | Scope / authorization | Classification and minimal target |
| --- | --- | --- |
| Admin API-key POST → `mintApiKeyRecord` → `ApiKey.create`; DELETE → CAS revoke | Platform ADMIN_EMAILS browser session. Mint org is validated request body, **not current tenant context**; revoke resolves key by ID | Explicit platform credential issuer over selected tenant. Mint/scopes/no expiry are authority exposure; preserve revoke. Requires server-resolved target org/current platform authority and barrier at issuance; do not call platform-selected org an authenticated tenant claim. Key expiry/revocation cannot prove earlier effect quiescence. |
| Admin webhook endpoint POST/create; endpoint DELETE/revoke | Platform ADMIN_EMAILS session; org supplied for registration, persisted endpoint org for revoke | Destination/event filters and secret create future external send capability. Preserve revoke/read delivery history. Separate platform issuer target-org decision and actual delivery protocol; do not blanket-suppress billing/health/security alerts. |
| account/cloud-accounts PATCH → `CloudAccount.update` | Same-origin current browser admin/owner; persisted account org checked | `enabled:false` pause is reduction; true resume increase. Scoped cloud-v2 re-enable already refuses Agent execution with explicit unavailable response. Preserve that refusal, pause and disconnect. No generic Governance org lock. |
| connectors/link POST → lead credential encrypt/persist + AWS dashboard bridge | Starter lead-token authentication; lead-owned credential input; bridge derives personal workspace from User/Lead email | Cross-scope legacy onboarding: actual lead linkage plus possible tenant setup state. Not authenticated selected-tenant administration. Requires explicit lead→user→tenant target mapping before manifest inclusion. Existing provider validation is not provider mutation coverage. |
| on-prem register/delete → rationale enrichment upsert/delete | `requireContext` organization; no explicit admin role gate in these routes | Currently metadata registration, not proof an agent executes network commands through it. Register/repoint versus delete distinguishable; privilege and runtime reachability mapping remains open. Do not invent a provider executor from registry declarations. |
| Lead preview/publish → `previewDeploy` → Vercel deployment POST | Starter lead tokens on trigger/update variants; platform requireAdmin on publish/deploy-preview | Platform/lead resource, no tenant release mapping. Separate service boundary and actual owner resolution; pending URLs are not deployment success. |
| AWS quick-deploy GET → `ensureTemplatePublished` → S3 CreateBucket/PutObject | Platform broker/default account and static-template publishing, no tenant organization in call | Bootstrap platform side effect via read-shaped endpoint. Separate approved platform service policy; not customer deployment authority. No live account/provider qualification made. |
| Growth LinkedIn publish/upload | Platform admin/cron routes, platform social credentials | Separate platform publisher population. Not traced exhaustively in this audit; stays unqualified. Support/contact/billing email and other candidate POSTs likewise retain explicit unknown classification. |

## Minimal next implementation sequence (no runtime changes in this audit)

1. Repair the two concrete existing-function authorization/GET issues first: discretionary dispatch-test and dashboard Slack config. Verify UI already uses explicit POST; GET must not send. Preserve safety producers and config pause. Add accepted persisted administrator/current scope, same-origin, org-first transaction/positive absence and final current-authority checks. For actual provider sends, recheck outside locks at each transport boundary; no network inside configuration transaction. These are refusal increments, not durable drain/effect coverage.
2. M01 needs all three mint/redemption/role setters together, locked capability-set comparison and current actor; old stateless invites prevent claiming closure from mint guard alone. Preserve reductions without weakening protected-owner/self rules.
3. M02 needs alternate setters and effective-policy priority/default comparison, then M03 credential/config increases. Do not quietly block disconnect, revoke, observer, cancel/recovery, halt alerts or previously approved human escalation.
4. Centralize discretionary notification send admission at actual transport boundaries **including** tenant secondary scan sends, retries and workforce digest. Before adding durable intent/observation, classify critical safety versus discretionary event profiles and global/platform destinations. No model severity string or client “critical” flag alone grants a safety exception. Existing generic callback remote effects remain unknown until supported quiescence profiles exist.
5. API keys, webhook endpoints, lead bridge/bootstrap and platform publishing require explicit target-ownership/service decisions; cannot be folded into a tenant manifest from imports, caller strings or global flags. Old/mixed issuers and outstanding artifacts remain blockers.

Required tests: real two-connection org-barrier races and rollback; exact current actor/tenant/session after waits; cross-origin/GET zero send; real read-only member denied; safe pause/revoke/removal still works while enrolled/draining; incomparable-role/policy and existing-invite redemption cases; changing notification destination and failed metadata never become absence; signal/deadline after final await; no provider lock held; unknown callback acknowledgment/retries retain original identity. Local fixed-provider tests must be labeled simulated; existing route/helper tests are source evidence only until run. No new test results are asserted here.

## Exact source hashes

Named paths below were inspected at handler/helper mutation boundaries. Search discovered candidates for follow-up; regex/import presence did not establish reachability, auth or complete coverage. This is a finite source snapshot; unknown/dynamic producers and unlisted management/platform callers remain unqualified.

| File | SHA-256 |
| --- | --- |
| `app/api/notifications/dispatch-test/route.ts` | `8283337e64ab1a48d48cab1e7c8962297ecacd8683c1a7750372d4720cea5d71` |
| `app/api/dashboard/slack-config/route.ts` | `5f827bb0669b6739281bfe05ccda4d5fff86658a946dd480a03a6910b48f6763` |
| `lib/notifications/outboundNotificationLane.ts` | `6f347a3110eee78b3c20d5cdf72a68859c7053329e34177f18cb17e7c586a4b7` |
| `lib/notifications/scanCompleteNotifier.ts` | `696e20e74da303949d55b03c6722e178e26a06ae7db074ec62059e02b913f73f` |
| `lib/notifications/outboundRetryQueue.ts` | `6ef9ca7f9a21133ad3697ba8a6d2ca926f68f5bfa196f46044602b3ecd6a5b2d` |
| `lib/notifications/criticalTelemetryDispatcher.ts` | `7ad8b6eb3c6807e9793d69c540e03b563c5696217b667bb3d2b1f1c54cfee995` |
| `lib/scan/persistScanRun.ts` | `e76bc952e8d57e0667d58cc5f90ea244c94f88a5d685648dcf48af4cb44c09f0` |
| `lib/autonomy/autonomyScheduler.ts` | `12a1a2f1a187cc3f05f866c1ba27add0f55bc69db28fc449c155612ef11b49b8` |
| `lib/autonomy/runbookQueueStore.ts` | `aed3c078e12adc7396444e062dfaa013c6215ecfda466f24d3af19b6cdcf8e98` |
| `lib/feedback/feedbackStore.ts` | `29480180b18aa8be35a647f78db2806af95558311fec04922d2fd96717afa44a` |
| `app/api/notifications/cron-weekly-digest/route.ts` | `c85428f93d4278c8242f54c24c1451c8d1c22ea6df7b1bb3f86cce20d54c61f7` |
| `lib/releaseops/slackNotificationResponder.ts` | `3d597d3e27205231dc81c9e696996e2362178e267e27a4fb3223db80b47040b5` |
| `lib/releaseops/slackNotificationEngine.ts` | `987e5c9592a6e54ca8a73f9098dd89fee5b73505493be080f8b37ef052bf45ce` |
| `app/api/dashboard/council-generate/route.ts` | `d9706db89b8549ffa44961e6d3e24bf002a2f80c32e8c255c37abd2cedec3a5a` |
| `app/api/cron/releaseops-autonomous-tick/route.ts` | `6a7395706e2f71229576576d86ca761207f33b2ecc75e3bc31ad69a8e271f0b9` |
| `app/api/cron/workforce-daily-digest/route.ts` | `edba6e624e6ea6e698eb584d25b5bb1deabb9bab114a43219db88bb8675c0942` |
| `lib/workforce/domains/slackNotify.ts` | `1a04df58c5886182058b586938f7456d14706e6896d191cb631d89aac63bb973` |
| `lib/webhooks/dispatchWebhookEvent.ts` | `0652af057e755a7e90590bd99e65a55c52194b231179c58447028c78da89b03e` |
| `lib/webhooks/deliverWebhook.ts` | `1fc58d22632764f3519b5d655df172c85b0b5d60b0d3d8400b3939c0420e1fb9` |
| `lib/webhooks/processWebhookRetryQueue.ts` | `efdd0d1b0a5c0d65beb76e906679e45cdfb1a92325f1099daf4e4e5640b50627` |
| `app/api/desktop/workspace-members/route.ts` | `833d0d1cc3c374c4bc36d82999a35a649e1a1d7d8b6a6df13bd4cd8c051538c3` |
| `app/api/team/role/route.ts` | `1d35022d39564afceb7cea1aca64ed7c1bf744fd52f6f80d21a531c7d65794a4` |
| `app/api/team/invite/route.ts` | `67fba9907586d8b746b05a5a4d62f465b8dee73b188fb8723f488469fa639222` |
| `app/accept-invite/[token]/page.tsx` | `35151c6d2737b89685a1beebd92e7cc06d722d6472da740bfc95013d95238c47` |
| `lib/workforce/domains/inviteLinks.ts` | `09001e25408ef80fdd7168d7741b6c51fc61f9344c597a378d413c1b79a32174` |
| `lib/billing/organizationSeatClaim.ts` | `3a25fe47cee65a9c2fdeeed90f896e331467cf8d57c8de7b5e8d253876978a96` |
| `app/api/control/ai-governance/route.ts` | `fc7ca4696e567f1c1d2dc591bd64fdcb0f914022f771e67be47f51744e5c2008` |
| `app/api/account/ai-policy/route.ts` | `383e2da96ce9a655d105740e5138b065e955495d4da390aec4d2070eeb125b92` |
| `app/api/autonomy/charter/route.ts` | `ead4aaa5608e488a06ca8fc69d187db3d159f3da038211aa7e1308d5d41bdd53` |
| `app/api/desktop/branch-policies/route.ts` | `1761124859440ba325df7f8f7c1d758efddeeb2a495fdd56a1061b20afc5d835` |
| `lib/releaseops/branchEnvironmentPolicyResponder.ts` | `60a16993a477b2b4a58e151f49e36dfe47fdebfaec491515b8d21e3a7e2dc60b` |
| `lib/releaseops/deploymentPolicyGuard.ts` | `e09fd3e8586914855110d3d4d03f16f46db48129671e080978cade96abe43b7d` |
| `lib/integrations/connectedActionConsentHttp.ts` | `7ddf06d878350e5e1d995f6649aa14e42042901865834e47ac7d34b4fb90327e` |
| `lib/integrations/connectedActionConsentRuntime.ts` | `dd50577f700beaa8cfc0d0b1b73779f4a0f92946ab75ad827d3b066dfd3a3015` |
| `lib/integrations/outlook/outlookBrowserHttp.ts` | `a882d47f12f388e053d0b40c19ec664c64c5660c4c4b21531393f14f6e4543ce` |
| `app/api/account/integrations/slack/start/route.ts` | `6c53a29a2204743db64c8d9e4b2c66448b872824ae48a54a95f93ec8939fb65b` |
| `app/api/integrations/slack/callback/route.ts` | `2f4116648aa2e6cd7d6e86dc1616842773c781ca071abb8d5a17705d02d04fab` |
| `app/api/account/integrations/jira/activate/route.ts` | `174f53a395d972a7c56ff2461b037db0a8178e3938abe6670512335f8b30ddbe` |
| `app/api/account/integrations/servicenow/configure/route.ts` | `7bfacc8bdfc8be9179a62fffbfed37e15c181f70e80e230519aa51bacbc7e85d` |
| `app/api/account/integrations/servicenow/refresh/route.ts` | `217ad26f56bb6a3e719ece46f5452b142a072aca3d07df3d9d41b09931510844` |
| `lib/integrations/servicenow/serviceNowRefreshHttp.ts` | `619f660bb3726d0b696fb43ccc0e9a3f37e05136a04ee0310921041b374e70cb` |
| `app/api/desktop/airflow/connection/route.ts` | `6f6960b0a88c3a6d4bbfa56b7b6a61f8b4eac28b273bfeb834148a1c51c13cbd` |
| `app/api/desktop/airflow/automations/route.ts` | `f143544c825ff98a3761a700d08b93d33cc7ea2fa62912e345b18e6f6aa2b326` |
| `app/api/desktop/airflow/automations/[id]/route.ts` | `b6631cc0ced7b095a5ac9c615e3b798e137a19bb95006107b5ceee8c92e9c50b` |
| `app/api/workforce/integrations/github/route.ts` | `b51d43f06a98a78454c42d58115ab46c2b6e4938dbc8c670293fb66da4338035` |
| `app/api/workforce/integrations/linear/route.ts` | `6350e3869594add2925b490335a6fde3af73d0af2c361f3f66a2d3d982545344` |
| `app/api/workforce/integrations/slack-actions/route.ts` | `e23be39f753910a1b3d605495d2cf7f2cf2388abb67a8b45e8769af3ff53f853` |
| `lib/auth/integrationMutationContext.ts` | `6a32de28d28440fe76e747e18270a966c9668c8a0275be9ff405c41598dbfd42` |
| `app/api/admin/api-keys/route.ts` | `15ca29b88d9794c89a3bf160e5d678e86126dee631ffa187d57224a5bfe32fc0` |
| `app/api/admin/api-keys/[id]/route.ts` | `920bc26af55812a9f09a12d4fa98c05fdfa4d933f746fc688d7179d5558c4372` |
| `lib/security/mintApiKeyRecord.ts` | `282da6617b58a00d79603579e07f2ab74dbe29bff7187a53c32573953ae066db` |
| `app/api/admin/webhook-endpoints/route.ts` | `fa4bf3f77112a89906b0ffdb32bc0210a302152af0469f0e452e321ce17417a2` |
| `app/api/admin/webhook-endpoints/[id]/route.ts` | `9a3f21591b3ec15bed838ff2feb5a605493bc077b15401f98222d5a5f1dc0097` |
| `app/api/account/cloud-accounts/[id]/route.ts` | `01b332880fd97439012159cc60b58cf907e7c1d5dc26031c1ef16bb1b40df9a4` |
| `app/api/connectors/link/route.ts` | `ca5a8f1fbc9e922306690e72843e20d3c5131e9447158d9d1c87a9257e27ce5a` |
| `app/api/workforce/on-prem-connectors/register/route.ts` | `3faee1c694b68cda92c6216a14c6413b4481764650668137964422e1c2136883` |
| `app/api/workforce/on-prem-connectors/delete/route.ts` | `41a40ce17771189519867e1200e9a3396ba3a56224d1c8437a24e7e7153a469a` |
| `lib/workforce/domains/onPremConnectors.ts` | `3aead5f6693ad1ddbb4cc2875f28afb842db020f4bbc82891d19297f21510bbd` |
| `app/api/leads/[id]/publish/route.ts` | `4a1b86bc2ea14cc0452255d40d89f6617faa19d998a36d3c0d5058fd2de985b6` |
| `app/api/leads/[id]/deploy-preview/route.ts` | `c0dbb2b5272ac765bfb5eb8794bfb7ab15bb498f29354a891dfb261f3e882335` |
| `app/api/aws/quick-deploy-url/route.ts` | `53bcf73ffe874dc9288a3629d4f4e111884b01dc18db628eb4a4ee04879be05f` |
| `lib/cloud/aws/templateHosting.ts` | `653c46d56540a64145c168eea78abe7d112c27295f0ffc4cf09895e63706ee17` |
| `app/dashboard/notifications-outbound/page.tsx` | `b8b17b5b2370690aed3d8bbcef984d0114139cdd55ca13d3ceefa050f63c539c` |
| `app/dashboard/slack-notifications/page.tsx` | `765dcf0a6397668d7521ccec93b9a4e25f32b7d9f809c0735f9fcb99a6cc2ea0` |
| `desktop/src/views/SlackNotificationsView.tsx` | `5af5e9d4f01da68e84b252c322a0e4b4e7c09c50ab58c689f03b847c1837ede9` |


## Local containment delta after the audit snapshot

The source hashes above intentionally preserve the pre-repair audit. A later authorized local repair changes only discretionary dispatch-test, dashboard Slack configuration and their explicit callers; it does not close other rows or register coverage. GET dispatch-test now returns405/AllowPOST with zero fanout. Deliberate POST requires strict same-origin and exact current browser identity, finite actual NextAuth session expiry and accepted persisted owner/admin membership. The helper retains the initial expiry rather than renewing it during later checks. Configuration increases and each actual explicit test-channel send require positive unenrolled and non-draining metadata under the same organization lock; unknown metadata refuses. The lock ends before provider fetch, so in-flight enrollment/network atomicity remains unclaimed.

Pure pause accepts only `{enabled:false}` and updates the stored enabled field only. The existing destination, raw kind filter and channel are retained; added webhook/filter fields cannot enter this reduction path. Web/desktop Save now sends only that pause payload when disabled. Reads remain read-only. The optional request-bound lane hook is omitted by all existing safety producers; explicit guarded test failures cannot enqueue an unguarded background retry, while default safety sends/retries keep their prior behavior. No other halt, stop, critical telemetry or notification lane was gated.

TDD: old route/unit behavior failed14of15 initial cases. Four actual socket PostgreSQL cases also failed against an isolated old-source archive (cached role bypass, enrollment lock race, expiry rollback and pure pause). Current focused regression:172passed/4skipped across11passing/1skipped files, including21new actual-route/fixed-transport unit cases; current actualPG4passed; scoped production types and changed-file diff check passed. External browser identity/provider responses are simulated; persisted membership/configuration/locks are real in the PG cases. Separate independent source review found no important issues. No live provider calls, publication, production flags/schema/roles or activation occurred.

Receipts: `/private/tmp/axiom-web-notification-red.log`, `/private/tmp/axiom-web-notification-red-pg.log`, `/private/tmp/axiom-web-notification-regression.log`, `/private/tmp/axiom-web-notification-pg.log`, `/private/tmp/axiom-web-notification-types.log`. Owned PG fixture `/private/tmp/axiom-ticket-governance-pg-9qbqgzak` stopped; `pg_ctl status` independently returned no server running.

New repair source hashes (separate from historical audit):

| File | SHA-256 |
| --- | --- |
| `lib/notifications/webNotificationMutationAuthority.ts` | `5d400fd3ac1c0cc7353fb255a0500d00a57042c3af16480e4f69f6a2429857e8` |
| `lib/notifications/outboundNotificationLane.ts` | `8417ba00559c5551e5cfb4a356ced7c222e0987b5d10cdc60a1efc901722ae8c` |
| `app/api/notifications/dispatch-test/route.ts` | `00e6fb958fa0b0a7ad35c846847cb111b590c05204406b8f83eedab05b0728c6` |
| `app/api/dashboard/slack-config/route.ts` | `cf5ffe3e9c1fa6c11bd919bc729e9e8cdc0ef60142d34bc42f48914f5a18ca20` |
| `app/dashboard/slack-notifications/page.tsx` | `786d6f7cc3cb02fd70d06b256d00e7b8d5baf8316908c488277d489fcb4ddb7d` |
| `desktop/src/views/SlackNotificationsView.tsx` | `57228152b73a7a793ad55449e7c81d1735088d72f900b5d016bb0b539f062d8e` |
| `lib/notifications/__tests__/webNotificationRoutes.test.ts` | `16f36fdbcf44e8b7f6ec84affbe647b275536743ca7760ad71afb30b92948d69` |
| `lib/notifications/__tests__/webNotificationMutationAuthority.pg.test.ts` | `63bf53ff2aab6c5fe9733c85021718337e58b56125b13ccdd1f909b2db886b65` |
