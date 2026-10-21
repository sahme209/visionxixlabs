# Axiom Agent release readiness

## Native acceptance progress — October 21, 2026

- Current local source now binds OS credential storage to the configured app identifier. Production retains its exact existing identifier; development reads, writes, deletion and legacy migration use a separate namespace. Actual production config compatibility is covered by a native regression.
- Validation: 39 default native Mac tests passed; one additional explicitly invoked real macOS Keychain test passed, recreating and deleting a unique nonproduction sentinel entry. The Keychain test is opt-in to avoid unattended vault writes in CI. No production credentials were queried.
- Real local Git commands published the reviewed refspec to an owned bare repository and fetched/fast-forwarded its update. Native guards rejected a rewritten origin and unreviewed branch. HTTPS transport is prohibited in this fixture and assertions check the specific guard errors. This does not establish live GitHub acceptance.
- A separate local ad-hoc-signed Axiom Acceptance app was built and launched with a different app identifier, deep-link scheme and restrictive webview connection policy. An actual 1280×800 native window was observed. Its owned process was then stopped. Production app-data root metadata remained unchanged; this is not a comprehensive audit of all filesystem or credential activity.
- Screen Recording is denied and UI automation is not authorized for the remote agent. Therefore rendered content, clicks, authenticated workspaces and installed-customer journeys remain unverified. No security permission was bypassed, production sign-in initiated, installer published or installed app replaced.
- Independent review found no blocking findings. Remaining limits: namespace separation is not a same-user security sandbox; vault round-trip does not prove Tauri IPC or migration; local Git mechanisms do not prove remote GitHub; native window creation is not GUI acceptance.
- Next acceptance gate: authorize the Mac inspection/automation permissions or provide an operator-observed current-app test, plus isolated account/provider/Stripe/cloud test access for the respective real journeys. Production recovery and all paid/release operations keep their existing approval gates.

## Verified execution update — October 21, 2026

This update supersedes older runtime/deployment availability statements below; historical evidence is retained.

- Production website/backend: `a841a7cb6dca2a9bc0939cc923d0a8056066bb62`, deployment `dpl_8XZzbgE3ZwciuLJ9XJuii5eWosWa`, verified at https://visionxixlabs.com. Source is backed up on `codex/website-production-menu-release`; main remains `568110c239684dcca9bbd18a082ac8c3a45988cf`. No claim that the entire mission is complete.
- New local implementation: repository synchronization requires the reviewed repository and branch, rejects mismatched local origin/credential repository, pins explicit push refs, and revalidates pull context after fetch. Airflow readiness resolves independently of general integration inventory; Azure/GCP cards reuse existing settings and status APIs.
- Research and sequence: confirmed checkout/credential-wait mismatch in native HEAD-based push; first reproduced two native guard failures and three frontend argument failures, then implemented guards and reviewed all command callers. Independent source review found no blocking findings.
- Mac validation of this batch: 35 native Rust tests passed on arm64, native debug compilation passed, 81 focused frontend tests passed, desktop TypeScript, affected-file lint and frontend build passed. Existing bundle-size/dynamic-import warnings remain. No repeated hosted CI.
- Real isolated Airflow 3.3.2 acceptance: actual client authenticated, discovered the local DAG, triggered a run, observed queued → running → success, read both successful tasks and history, and preserved duplicate-trigger identity. Invalid credentials returned 401; production HTTPS validation remained unchanged. All ten owned server processes were stopped. This is local API-contract acceptance, not a tenant/desktop/governed-cloud journey.
- Installed app is older 0.1.13 and its existing signature/notarization was verified. Current 0.1.20 native source compiles; current installed GUI, keychain/pairing, actual-provider requests, Stripe TEST lifecycle, cloud execution and installer/update acceptance remain unverified. No installer was published.
- Safety limits: guards do not lock external Git writers or prove an exact commit snapshot. Authenticated Git URL process-argument handling is unchanged. Native tests establish guards/refspecs, not real remote push/fetch. Process tests establish direct-child behavior, not descendant termination.
- Production recovery remains gated by database binding/PITR/restore readiness and exact migration approval. GitHub webhook configuration lacks GITHUB_WEBHOOK_SECRET and fails closed; coordinated secret/hook changes require approval.
- This batch is local only. No new push, deployment, paid provider/cloud call, production database/secret/billing change or installer publication occurred.

Status: **not ready for customer release**. This separates implementation and isolated acceptance from installed-app/live-provider evidence. No deployment, release publication, billing change or production action is authorized.

## Current consolidated baseline — October 21, 2026

Main `568110c239684dcca9bbd18a082ac8c3a45988cf` merged #199, including #195/#196/#198 and the previously merged #197. Post-merge Test39607098765 and Desktop39607098847 passed. Integration Test39603073511 passed 8,959 tests (34 skipped), offline authentication and production website build; Desktop39603073537 passed 32 native tests on each Linux/macOS plus clippy; website39603073564 and ready-transition39605832551 passed 12 gates. No repeat CI is needed for this baseline. The historical baseline below is retained as provenance, not the current source state.

Consented new-file creation, direct OpenAI/xAI streaming, verification cancellation, optional-storage crash recovery and Airflow selection/recovery changes are now incorporated. Their inclusion does not establish installed-Mac, actual-provider, Stripe TEST or cloud acceptance. Historical navigation/pointer/preflight intermittency remains unresolved; retain receipts without speculative fixes.

The active complete remaining execution plan is in `AXIOM_COMPLETE_MISSION_TRACKER.md`; GitHub issue #200 is the shared status. Preview is blocked by incomplete environment metadata and unverified current spending/Pause state. Visible Production/Preview shared credentials include GitHub, AI and cloud integrations; no safe isolation or zero-cost claim can yet be made. No deployment or settings change has occurred.

## Source and acceptance baseline

Consolidated main: `0c32b6fdab8de2e4a72c10f22b45cf2fbc5d8e4c`; tested PR194 head: `755b9189ae760ee113440acbf05c3cf554c38c14`. Their trees match. Original187/191/192/193 histories are included. Latest inspected published distribution: `desktop-v0.1.20`; an installed build of current main has not been verified.

| Workflow | Verified evidence | Remaining gate |
| --- | --- | --- |
| Main stability | PR-head six checks passed:8,887 tests,16 offline-auth tests,293-page build; post-merge Desktop39523641970 and SQL/HTTP39523642003 passed | Post-merge Test39523642029 passed; all three main workflows are green. Installed/live acceptance is not inferred from CI |
| Native application | Linux/macOS command tests and clippy passed in existing CI | Build/install/launch actual macOS app, signed/notarized identity, keychain persistence, first-run/pairing and updates on owned Mac |
| Repository/Agent | Existing-file/multi-file review, explicit application, context/credential fences and terminal verification implemented; local candidate passed135 focused cases | Real GitHub connection, repo/environment selection, chat-to-edit-to-check journey in installed app |
| Local new files | Main lacks creation command; reuse of previously prepared6c348cfc integrated into isolated candidate, with exclusive descriptor-relative creation, no overwrite, existing parents and explicit per-file consent | Candidate native CI and installed-Mac creation, cancellation/error recovery. Partial failed writes are retained; no multi-file atomicity claim |
| AI providers/streaming | Credential policy, streaming and metering implementations exist; no provider credentials configured in current runtime | Authorized real requests, tools, cancellation, provider errors, cost reconciliation and end-to-end editor application per provider |
| Terminal/deployment | Native CI validates existing synthetic process/security cases; proposal/approval boundaries implemented | Installed native processes, cancellation/cleanup, stale receipts and actual approved sandbox deployment/rollback; no production action |
| Billing | Isolated SQL/HTTP accounting/auth acceptance passed. Targeted credit/allowance/anniversary and GitHub/download contracts passed53 cases | Actual Stripe TEST checkout → signed provider event → account credits/entitlements and renew/cancel/fail journey; live billing remains prohibited |
| GitHub connection fees | Installation start/callback, scoped token resolution and installation persistence source inspected: no billing/metering/Stripe operation for connecting. Authenticated owner/tenant/state/repository checks remain | Real connection acceptance. Do not add an Axiom connection surcharge; separately disclose GitHub Actions/storage/provider charges and Axiom AI usage |
| Website/downloads | Instrumented website39522171971 passed12 gates: correct trusted click, prevention, Next Link intent, one2xx RSC request, main-frame transition, destination content and cleanup | Intermittent navigation root cause unconfirmed; retain diagnostics/gates and inspect any naturally occurring failure. Pricing/onboarding/download installed-client journey remains unverified |

## Candidate investigation and risks

Reuse the existing unpublished local creation implementation rather than duplicate it. Source review found Apple `libc::mode_t` is `u16`; passing it directly through `openat` C varargs risks Rust E0617. Promote fixed0600 permissions to `libc::c_uint`; native CI must verify actual macOS/Linux compilation. Repository/branch checks are point-in-time, not an external-Git lock. Windows fails closed for this creation path.

## Current execution blockers

This host is Linux x86_64 with no cargo/rustc/Xcode or macOS UI. Existing managed subprocess restrictions also prevent the local owned-browser supervisor before startup. No AI-provider/Gateway keys, DATABASE_URL or Stripe key is configured in this runtime. Do not copy production credentials to work around these limitations, strip isolation, substitute renderer tests for native acceptance, or claim CI proves the installed customer workflow.

The next real-environment acceptance needs an authorized Mac execution session with Xcode/Rust, an isolated paired test workspace and existing authorized provider/test-billing credentials configured securely there. No credentials should be pasted into chat. Sandbox cloud permissions and any chargeable work retain separate scope/approval requirements.

## Release gates

1. Required candidate CI and independent review; no merge without owner authorization.
2. Actual installed-Mac checklist covering GitHub, environments, models/settings, pairing, streaming/cancellation, coding, file creation, terminal and approved sandbox deployment/rollback.
3. Real-provider and Stripe TEST evidence with tenant/cost/credit reconciliation. No new fee for connecting GitHub.
4. Resolve critical defects and clearly retain unverified/intermittent risks before selecting the release SHA.
5. Separate approvals for installer publication, production database work, billing activation and the final Vercel release. Vercel spending restrictions remain intact; create no project or deployment.
