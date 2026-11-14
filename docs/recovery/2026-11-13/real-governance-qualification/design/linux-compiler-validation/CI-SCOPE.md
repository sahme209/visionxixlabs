# One PR / Linux compiler checkpoint — local CI scope audit

Candidate inspected: f8bf76cbb0f75a413a1f875b28bf63f908dfd710 on codex/governance-live-qualification-setup. Comparison base: PR330 merged ece70e38bffa068f7ea73cd8f904da9eba28fe3e. This is LOCAL source inspection only: no remote repository/public-status/check query, push, PR, workflow dispatch or compiler run occurred. Existing remote checks, protection, visibility and billing state have NOT been refreshed.

## Existing triggers for the complete current batch

No .github workflow changes exist between that base and candidate. Application changes are lib/demo/demoScenarios.ts and lib/governance/platform/nativeTime/**, plus packages/verified-issuer-runtime/linux/** and documentation/receipts. No desktop/**, app/demo/page.tsx, components/Footer.tsx, prisma/**, billing paths, root/desktop lockfiles or existing workflow files changed.

| Workflow | Feature branch push | One PR for this batch | Eventual main merge |
| --- | --- | --- | --- |
| test.yml | No (push main only) | YES unfiltered; Type check, three Vitest shards, Build/offline checks, required Typecheck + Vitest gate | YES same six jobs |
| website-visual.yml | No | YES lib/** matches; one ubuntu-24.04 isolated browser/build job | No main trigger |
| design-screenshots.yml | No | Trigger may match lib/marketing only, app/components/scripts/design/workflow; none changed here, so NO. Job additionally requires design/ branch | No |
| desktop-ci.yml | No | NO current batch paths match; Linux/macOS native jobs not triggered | NO unless relevant paths added |
| dependency-audit.yml | No | NO lockfile/workflow changes; its independent weekly schedule is not caused by this PR | No push trigger |
| auth-recovery-rehearsal.yml | No | NO recovery/prisma/script filter match | NO current paths |
| owned-commercial-acceptance.yml | No | NO billing/AI/prisma/gate filter match | NO current paths |
| auth-recovery-preflight, production-db-migrate, AWS deploy/validate, dependency-fix, desktop-export-v121 | No | Manual/reusable only; do NOT dispatch | No automatic main action |
| desktop-release.yml | No ordinary branch trigger | No PR trigger | No ordinary main trigger; desktop-v* tag WOULD start release matrix, so create no tag |

If paths change before pushing, recalculate filters; do not reuse this table blindly. A new compiler workflow's own path must be included in its proposed trigger inventory. Test/website workflows already install dependencies and build; they do not deploy or load production credentials. Website evidence upload uses short-retention sanitized artifacts. Reusable release gate only executes if separately called; no such new call exists.

## Free-CI conditions and mandatory gates

CODEX_HANDOFF.md sections0/1/3 require a branch+PR, all checks green including exact required Typecheck + Vitest, no admin/bypass/direct main push, standard hosted runners only, no private repository/fork, no paid storage/add-on or spending prompt, and Vercel Git deploymentEnabled=false. The current tracked vercel.json preserves false. Public standard-runner execution is documented as free in the handoff; live public visibility/account limits must still be confirmed before execution, not assumed from historical status.

Retain existing local strict types/ordinary suites/living-doc and source-pin review receipts. Current PR330 SQL/build acceptance remains historical; ordinary CI's production compile is no deployment or database verification. Do not rerun unchanged actual SQL/native/resource acceptance as a prerequisite invented by this audit. Check exact current candidate's required existing CI commands rather than weaken the gate.

## Proposed single new compiler lane (NOT implemented or authorized here)

Candidate workflow path: `.github/workflows/linux-time-compile.yml`, one path-filtered pull_request job using exactly ubuntu-24.04, contents:read, checkout persist-credentials:false, no secrets/environment/id-token/write permission, opened-only PR event, exact reviewed head branch/run_attempt1 guard, no synchronize/push/tag/schedule/dispatch trigger and no deployment/preview/release/upload/publication. Bind the checked-out PR head to the reviewed source/packet. Explicit finite timeout and stop on first failed stage; no automatic retry or fallback runner. Do not modify existing required checks or trigger all branches.

Two distinctly labeled deliverables must not be confused:

1. **Actual Linux C compiler check:** compile the real time_publication.c/.h against the runner's actual Linux headers and pinned reviewed compiler command, producing an owned object or syntax diagnostic. Do not run the artifact, clock/syscall qualification, worker, daemon or test host. This can expose genuine C/ABI-header problems but does NOT establish Rust/daemon linking or functionality.
2. **Actual patched Rust/daemon build:** apply the frozen precise-origin patch to the complete verified pinned source, compile/link the real module and C object under one selected daemon/private-binary configuration with locked dependencies. No synthetic Rust stubs can count as this result. This needs a concrete source/dependency/toolchain input recipe and explicit authorization to execute dependency build scripts/proc macros/compiler. The 322-file inspection source currently lives outside Git in /private/tmp/axiom-pinned-clockbound-source-371058f8-inspection-1; remote CI cannot access that directory. Do not silently refetch the consumed archive, invoke Cargo network resolution, add an unreviewed action/toolchain download or commit an incomplete fixture as a buildable full crate.

A minimal first compiler proposal may select deliverable1 honestly, while listing Rust as unverified. If the goal is one complete C+Rust build in this PR, freeze the complete input/transport/dependency recipe before asking for that conditional execution grant. Existing ordinary green CI does not authorize new foreign-source execution or native compilation. No live runtime, provider, SQL, credential, resource, clock or security/API calls belong in either compile-only lane.

## Before an actual push/PR/run

Review exact candidate+new workflow, current live public repository and absence of other open overlapping PRs; confirm actual branch-base/main currentness and required protection; obtain the specific new compiler/source/dependency execution authority and no-spend conditions. Push only the feature branch and create ONE PR. Wait for every actual exact-head check and the additional compiler outcome; never infer success from this document. Merge normally only after green and authorized repository procedure. The owner still clicks every production deploy, and every DB/settings/flag/provider/credential/resource gate remains held.

## Root follow-up observation

After this source-only audit, the root agent made one fresh GitHub repository metadata read: sahme209/visionxixlabs remains public, default main, archivedfalse. No CI/push/PR/deploy action accompanied it. This narrow observation supersedes only the historical-visibility caveat above; exact-main/current checks and future candidate guards still need current verification before the eventual PR. PLAN.md now selects actual complete Rust+C compilation/linkage using the already saved licensed source archive; there is no new upstream fetch or separate C-only completion claim.
