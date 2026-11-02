# Orchestrator and on-prem dependency inventory

November 2, 2026 · **Internal architecture foundation; unimplemented A9 program.**

Scope: [master A9](axiom-master-action-plan.md), preserving A1–A8/B1–B6 and core Governance priority. This is a source-backed initial inventory, not exhaustive runtime egress discovery, an air-gap certification or customer support promise. No environment values, private endpoints, credentials or tenant records were read. No provider, model, installation or service was invoked. Source hashes below bind the inspected snapshot; changed bytes require re-review. Companion: [contract design](orchestrator-contract-design.md).

## Classification and current facts

**Hard for the current path** means the inspected production path cannot perform that function without it. **Configurable** means source exposes a choice, not that all alternate configurations work offline. **Feature-specific** means the dependency follows a selected integration/action. **Unknown** means coverage/operational acceptance has not established absence or removability. A hosted default is not always a hard dependency; an unused local class is not implemented offline support.

| ID / area | Source evidence (hash ledger below) | Current dependency / classification | Customer-controlled target, ownership and missing qualification |
|---|---|---|---|
| D01 Desktop API origin | `desktop/src/lib/desktopClient.ts`, native `http.rs`, `config.rs`, `computer_input_authority.rs`, Tauri config | JS has hosted default and configurable API base, but native HTTP/computer authority pin hosted origin and CSP names it. **Hard for those native paths**, not solved by changing JS settings. Loopback test transport is not enterprise deployment. | Desktop/security owner: explicit signed deployment identity, tenant endpoint profile, TLS trust and issuer/session binding shared across bridges. Test every native caller, redirects, wrong-origin/session recovery and upgrades. Never globally relax CSP/origin restrictions. |
| D02 Identity/paired sessions | `resolveRequestDesktopSession.ts`, `desktopSessionStore.prisma.ts`, `auth.ts` | Current paired identity/current membership and permissions remain required. Credentials login exists; Google/GitHub/Cognito providers register conditionally. **Auth hard; external IdP conditional.** Email verification, pairing, reset and admin bootstrap offline lifecycle remain unqualified. | Identity owner: local SSO/IdP and secure emergency administration, session revocation/current membership, trusted local time and recovery. No `skipAuth`, fake reviewer, default privileged identity or role expansion. |
| D03 Commercial access/licensing | `desktopCommercialAccess.ts`, `desktopCommercialAccessPolicy.ts`, `tenantBillingStore.ts` | Current access consults stored plan state; Stripe identifiers can be absent. **Commercial decision hard on applicable paths; hosted Stripe not proven per-request hard dependency.** Store fallback/availability semantics differ by caller and need full audit. | Product/licensing/security: a real offline entitlement verifier/distribution/revocation policy preserving explicit eligibility checks. No blanket license bypass, forged plan row or test isolated-runtime escape. Offline grace, time rollback, expiration and recovery decisions required. |
| D04 Orchestrator transport | Airflow `airflowClient.ts`, `connection.ts`, `automationTick.ts`, `scheduledRunId.ts` | Airflow `/api/v2` API path, HTTPS/auth, public DNS validation and rejection of private/local addresses. Allowlist does not override private-host rejection. Scheduled identity and 409 GET reconciliation exist. **Engine/host policy hard for Airflow path.** | Integration/security: adapter seam and a separately reviewed customer-scoped network policy/trust profile. Explicit private engine addresses, DNS/certificate validation, rebinding/proxy/redirect tests and network segmentation. No global private-host allow switch. Preserve current public-host SSRF defenses until equivalent policy is accepted. |
| D05 GitHub source/token/actions | `githubAppAuth.ts`, `resolveTenantScopedToken.ts`, `githubWriteClient.ts` | Fixed GitHub cloud API/token issuance and exact scoped installation credentials. **Feature-specific hard external provider** for current GitHub-backed workflows. Expiry-aware token lookup does not eliminate issuance egress. | Source/provider owner: decide GitHub Enterprise/internal repository support versus explicitly unavailable external workflows offline; separate origin/app identity/cert trust and exact permission validation. Never substitute PAT/global token or cached expired credentials to make an offline demo pass. |
| D06 Other provider origins | Airflow auth/host, `integrationRegistry.ts`, `actionExecutor.ts`, `releaseDeploymentTransportGithub.ts` | Configurable Airflow host; workload actions include GitHub/Linear/Slack; deployment transport uses GitHub workflow dispatch. **Feature-specific**, not needed for every local read. Cloud deployment/template source is not evidence of an internal target. | Connector owners: manifest of enabled operations and approved destinations, disabled unavailable connectors, actual customer-internal deployment target. Inventory all OAuth/token/refresh/webhook/export callbacks; internal connector equivalents need separate reviews. |
| D07 Vault/encryption | `credentialVault.ts`, tenant `connection` loader | Local AES-256-GCM and scoped associated-data protection use configured secret material. **Encryption/key availability hard; hosted vault not established by this module.** “Vault” naming does not prove KMS/HSM, rotation or custody. | Security/platform: customer-managed key hierarchy, custody/rotation, encrypted backup, restore and key-loss procedure. Preserve tenant/provider/connection associated data; no plaintext fallback or copying encrypted records across scopes. External secret reference resolvers need their own inventory. |
| D08 Database/schema | `lib/db.ts`, `prisma/schema.prisma` | Prisma/PostgreSQL is current authoritative persistence for sessions, policy, approval, operations/history. `DATABASE_URL` identifies deployment target; not intrinsically hosted. **PostgreSQL/schema hard; hosting configurable.** | Platform/data: supported local Postgres version, migrations, HA/backup/PITR/restore, tenant isolation and transaction semantics. Do not replace locked stores with in-memory/file mocks. Isolated acceptance fixture configuration is not production install support. |
| D09 Governance/approvals | `requestService.ts`, revision/execution policy stores, deployment/merge approval/execution stores | Current session/roles, exact sources, independent approval, numeric policy, claim and final freshness are separate authorities. Production mutation coverage is incomplete/empty and activation refuses. **Core hard invariant, not an engine capability.** | Governance owner: complete unresolved original-session/last-transport/coverage/credential transition/drain gates first. Local engine deployment cannot manufacture authority or bypass OFF/refused state. Genuine independent human and customer installation acceptance remain missing. |
| D10 Audit/events | `secureAudit.ts`, `auditStore.prisma.ts`, durable store | Local audit persistence adapter appends records; operation events participate in state transitions. Adapter-level append-only behavior is not cryptographic tamper-proof retention. **Persistence hard for accountable actions; export integration separate.** | Security/data: customer-owned audit storage, sequence/integrity checks, retention/legal deletion policy, restricted export and independent verification/restore. Explicit handling when audit unavailable; never silently report unaudited successful work. |
| D11 Queues/scheduling | `durableWorkflowStore.ts`, `scheduler.ts`, `taskQueue/runner.ts`, webhook retry queue | Multiple queue/scheduler abstractions exist; durable statuses include retrying and leases. **Feature-specific persistence/scheduler requirements; single scheduler/worker topology not established.** | Runtime owner: trace every producer/consumer, lock/lease/duplicate and crash behavior before migration; no assumed Redis/Bull dependency without source proof. Retry notifications separately from consequential execution; do not reuse generic retrying state as provider-write permission. |
| D12 AI inference | `AIProviderManager.ts`, `VercelGatewayProvider.ts`, `openaiCompat.ts` | Current production manager registers/selects Gateway-only and fails without configuration. OpenAI-compatible/local-capable classes alone are **not active production local-model support**. **Gateway hard for current manager inference, optional inference at product deployment level only after no-model workflows qualify.** | AI/security/product: explicit local-provider selection, model artifacts/licensing/resources, input minimization, no fallback to external model, quality/structured-output/cost tests and provider-specific safety. No model download, install or benchmark authorized by this document. |
| D13 Telemetry/analytics | `PrivacyConsent.tsx`, `browserConsent.ts`, `AIUsageLogger.ts` | Optional public analytics is consent-gated; AI usage logging is a distinct accounting path. **Optional measurement vs required local accountability must be separated.** Full desktop/server external telemetry inventory remains **unknown**. | Privacy/platform: customer-owned metrics/logs, zero outbound exporter mode, no hidden SDK/crash/update calls. Keep useful local audit/accounting; do not equate analytics off with all egress disabled. Verify from denied-egress traces. |
| D14 Install/update/supply chain | `releaseManifest.ts`, `DownloadContent.tsx`, Tauri config, `package.json` | Published release metadata/download presentation and package tooling exist. Current signing/version history and incomplete release gates remain unchanged. Schema/build/font/package hosts may be build-time, not installed-runtime dependencies. **Artifact supply hard; updater completeness unknown.** | Release/platform: reproducible signed offline bundle, SBOM/hashes/dependency provenance, trusted offline verification, artifact import, migration compatibility and downgrade/rollback policy. No claim of Store certification, completed v0.1.22 release or existing enterprise updater. |
| D15 Web assets/help/support | `app/layout.tsx`, `app/globals.css`, public docs/support design | Google-font build/import references and public help destinations exist. **Build-time vs runtime fetch requires measurement.** Internal draft docs do not supply offline customer help or support AI. | Web/docs: vendored reviewed assets/fonts, local docs/status/help, no remote embeds; inspect generated build and actual network requests. Retain media provenance/version/recovery; support retrieval remains separately unimplemented. |

## Dependency closure process and evidence

For each D-ID maintain an implementation follow-up with owner, enabled feature/surface, exact caller and destination, credential/data classes, current trust decision, offline replacement/explicitly unsupported state, failure/recovery, source hash, test receipt and actual operator acceptance. Proposed owner roles above are recommendations, not assignments to named humans. Never store token values or real internal customer topology in this public-facing source inventory.

1. Static trace all native/browser/server/background paths, including token refresh, OAuth discovery, webhooks, model fallback, email/reset, license periodic work, DNS/NTP/CA/OCSP and package/update tasks. This initial ledger is not exhaustive and asserts no runtime absence of these dependencies.
2. Establish a reviewed dependency manifest for a specific offline feature profile. Every required service must have a customer-controlled implementation or a documented unavailable feature. “Offline deployment” must include a real internal target and engine, not externally backed GitHub Actions behind an offline landing page.
3. Prove startup/normal/recovery/upgrade with internet routes/firewall denied, observable DNS/egress logs and local identity/entitlement/key/database/engine services. Denial must not silently select permissive auth, stale evidence or cloud fallbacks.
4. Qualify clocks, revocation propagation, backup/restore and uncertain operation recovery. A restored old database cannot reset a consumed external action; reconcile externally under approved read authority before admitting new actions. Require offline operator instructions and evidence export that stays within customer control.
5. Record exact version/digest of bundle, local images/models, deployment manifests and verification tools. Offline custody/signature validation and upgrade provenance are prerequisites, not proof supplied by an SBOM alone.

## Decisions before implementation

- Supported initial topology/OS/architecture, scale/availability and internal target: recommend one customer-controlled server profile plus supported desktop client first; no concrete support matrix approved yet.
- Offline entitlement issuer, term/refresh/revocation and secure-time/grace behavior: product/security decision; no skip flag permitted.
- Local IdP/SSO, account verification/recovery, first administrator and independent reviewer bootstrap.
- Customer-managed encryption/key backup/rotation, audit retention/integrity and time service trust.
- Separate internal-host policy and TLS/CA trust per deployment, without weakening hosted public-URL SSRF defenses.
- Local AI optionality, allowed model/license/hardware, and fully deterministic non-AI workflows; current Gateway-only production selection requires real implementation.
- Which connectors are available offline, and whether external-provider operations are disabled or replaced with separately qualified internal equivalents.
- Engine contract/version/capabilities and migration compatibility, after core Governance acceptance. No Airflow-to-Temporal migration is approved by this inventory.

## Exact source snapshot

The hashes below were calculated offline from current repository files. They prove byte binding only, not semantic correctness, clean-build identity, shipped availability or completed egress coverage. Runtime source may include local changes beyond HEAD; do not label the whole snapshot a released artifact.

Base HEAD at capture: `1cc97a0837501cd95af9114993f4598148a4951c` plus exact worktree bytes.

| Source path | SHA-256 |
|---|---|
| `desktop/src/lib/desktopClient.ts` | `aac1fe7952cf3b672af45f5784080dd86df52dc7efcfabb455318f3389ca49a4` |
| `desktop/src-tauri/src/http.rs` | `f9731fe0266be2eaf110b0d8b26334849aa1bd56c64fcbe8f5995578eab59f90` |
| `desktop/src-tauri/src/config.rs` | `fe00e5c0bba8fb47c50a87694999a705521940c427f75cfefc580151e731673a` |
| `desktop/src-tauri/src/computer_input_authority.rs` | `7e934e50a327b7054e6603b89ab1435b8b8cd4f6874ae1ed55757dfc68798319` |
| `desktop/src-tauri/tauri.conf.json` | `2efd354e646a792c4dbe271f767251721decf0feac8a254cb94371f2e3ecd95b` |
| `lib/desktop/resolveRequestDesktopSession.ts` | `0fb446513d3f9facdc87dd7609c06c4fd91ba131796741c85bcd3909caf5c326` |
| `lib/desktop/desktopSessionStore.prisma.ts` | `5490ac9aa797ee97fd91c4f8f0e76c12a2410f4ab811ea346495efc7b436f31d` |
| `lib/auth.ts` | `e1bc7aa3b9143459e6c3e6d41cbedf3ce69d71d1a7303645d0d30202c3c2fe91` |
| `lib/desktop/desktopCommercialAccess.ts` | `13929ea1ed70f2a1dab78063fc8ae2c87f0922caea719b6cc167ab4759781300` |
| `lib/desktop/desktopCommercialAccessPolicy.ts` | `1291e31d5481a3392c9546db1033fe90a13c95b1f91e8e69fbbacaf3b45239ff` |
| `lib/billing/tenantBillingStore.ts` | `0253c03d93cea8d37aa8491a30a9b1b3964ca635c6a613febec9a34b05187608` |
| `lib/integrations/airflow/airflowClient.ts` | `bbb996a1f06950359d7377a00263f480ec3de57bbc9b4d3de41674a81ea2494e` |
| `lib/integrations/airflow/connection.ts` | `2d25a4c1672d7656bb1e6193c2161028fa923ed637302e1781e902785963b73e` |
| `lib/integrations/airflow/automationTick.ts` | `de89a9cf9809500309ebc63cf3f9c38d8a5c41db50b073f760d9b5fe1f9b06ff` |
| `lib/integrations/airflow/scheduledRunId.ts` | `2e1f250429e05de5ee1ebe7427c4aa781de28defacfbd2daa86b1689cf6c0954` |
| `lib/connectors/github/githubAppAuth.ts` | `1259f5149344e34610b5ee760d07d22573a575d429bdfc395a7a163b832851ad` |
| `lib/connectors/github/resolveTenantScopedToken.ts` | `ec529c5297fe1da125ff4a02571552b4659f9da2849658292e73b287f0351cba` |
| `lib/connectors/github/githubWriteClient.ts` | `7e89495e38f9be0d459754839f11212b360ab17436d6016c8889da47afd7258c` |
| `lib/workforce/domains/integrationRegistry.ts` | `6e3ec766df1ba6cdd5434e3369e29a85cf95f68cf9aab76eec20438a0d41ac7c` |
| `lib/workforce/domains/actionExecutor.ts` | `9e91b65cffa3c9cd0f90a36367a6d2cbe733eb5000c973621c2fa50f5c97c4ff` |
| `lib/security/credentialVault.ts` | `4a83e24129610e7c4872fac512f847828152691e1723ad21b8877bcdd3486c33` |
| `lib/db.ts` | `c03c925e7154dadcef4b1e6ea8e29fdb257fa02b95768f23e3cb7c6be5671bf4` |
| `prisma/schema.prisma` | `4e35ea3c8645656dbdae19c1ee6427bf526d9b82527de6ef046048dcdb6e617a` |
| `lib/governance/intelligence/requestService.ts` | `1360311802f6f2a0214bb29f4db3ca40c9da360ffa8f787c95c62de904b693a8` |
| `lib/governance/intelligence/revisionStore.ts` | `2a2180c78ec88a96347786baf2f5d2ab5adbf1abc64e7327ad54687e30eb7525` |
| `lib/governance/intelligence/executionPolicyStore.ts` | `78bab2e5335738bac8ffab7ee232de72483d32641cfcbc648abcbef2c09b5f97` |
| `lib/tauri/releaseDeploymentApprovalStore.ts` | `a2bcb5f5b87679430ea83a6a43c920b0d5fbdac118a5486bb3508861b2da3551` |
| `lib/tauri/releaseDeploymentExecutionStore.ts` | `63a6f87b9a1a82f83fb686cb89d1159a4ecf90ca9348723d3d1769ba7e21e86d` |
| `lib/tauri/releaseProviderMergeApprovalStore.ts` | `50aefd553326346ac88a9f8754427c67c0d2bff3ffe5a98b197d7572c4c337f3` |
| `lib/tauri/releaseProviderMergeStore.ts` | `d9c252dbfb39598737aaeb4c292f3d479d68d515e95fbdc5e924b5474a65e72e` |
| `lib/tauri/releaseDeploymentTransportGithub.ts` | `7d76f02f86257057e05479b7bb1dec9d42cf7bd1bb71180bda6468d4b4f1f634` |
| `lib/audit/secureAudit.ts` | `80e79deec8031b0ed95365f37eba440f648f17db39056790c9ba494b06e296c6` |
| `lib/audit/auditStore.prisma.ts` | `106ea7ee13546a04e702a900ee96ddc2f2ad8378da163cf02fc60574e1273b4f` |
| `lib/agent/workflows/durableWorkflowStore.ts` | `09de646d47aa9b530edf5de0d13cc6f9f27e7ae708a0a115709d20485e3ed8d9` |
| `lib/agent/workflows/scheduler.ts` | `22932d81a842365175bdbec7ad942d211214d44f58c224c2a6f5965f80b5c824` |
| `lib/axiom/taskQueue/runner.ts` | `95ae179ffce67ec1a4c9e1ea0f2b853962f680655696f1ccabeadb79a2c558cb` |
| `lib/webhooks/processWebhookRetryQueue.ts` | `efdd0d1b0a5c0d65beb76e906679e45cdfb1a92325f1099daf4e4e5640b50627` |
| `lib/ai/AIProviderManager.ts` | `8f02474994771c223ef714bd7f005290d9476914332c358a4447c67be7aa779e` |
| `lib/ai/providers/VercelGatewayProvider.ts` | `2aafa6fbd4ae1e2ea91da2994a71f0b586c95c297093bdd8ff01f6e43aad93cf` |
| `lib/ai/providers/openaiCompat.ts` | `76224675a3f1c29a0c5600cdab841081bfa3424d275c75fcd0d03d62e1b23825` |
| `lib/ai/AIUsageLogger.ts` | `977b306bce917783e28c889d8093389f124d8af0b8df58dd7089e634757362d0` |
| `components/PrivacyConsent.tsx` | `5a221d9b8a50d3847fe469a3bc60423d70d3055789808ba4f178fdc93aabf520` |
| `lib/privacy/browserConsent.ts` | `e959656358044964dfc5f5e836444cfb1fc67686faacf63d765b48dace5d768a` |
| `lib/desktop/releaseManifest.ts` | `5a84a42e1514f7f45bfa1e25c4769ff7a44e8886332e4cdc65fcc42b68ab1b25` |
| `components/cockpit/DownloadContent.tsx` | `ff55e8f84a37373c2d6a58efeb7f49e9886725579f44e593480f230ba39ff562` |
| `package.json` | `fd506614605d00bd02029a4da18f392233b72bfb6f266d8e5eb237ef4917382b` |
| `app/layout.tsx` | `eb6105697871b6f1a25d6562633a989f8ababec820510823c12de9d2a44a0a82` |
| `app/globals.css` | `684c012b9a58fbc38cc3cd7a2c98af2eb31c7acf28584f1ce7e7cc996abb3dfb` |

