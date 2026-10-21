# Axiom Agent release readiness

Status: **not ready for customer release**. This separates implementation and isolated acceptance from installed-app/live-provider evidence. No deployment, release publication, billing change or production action is authorized.

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
