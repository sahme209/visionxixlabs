# CODEX HANDOFF — VisionXIXLabs / Axiom (read this whole file before doing anything)

Written 2026-11-09 by Claude (Claude Code, Opus) for Codex, at the end of a long working session with the owner (Samir Ahmed, GitHub `sahme209`). This file is the single source of truth for:
- how to run this project from here without breaking what exists;
- what was done;
- what is left and how to do it.

Repo: `sahme209/visionxixlabs` (public), default branch `main`. Production: https://visionxixlabs.com (Vercel). Database: Neon Postgres (production branch `main`).

Production is **build 4**, deployed from `main` at `a344f4f6`. Everything listed in section 9 is live.

---

## 0. The ten rules that matter most

1. **Never push to `main`.** Always use a branch and a PR. `main` is protected by the `main-protection` ruleset: PR required, no force-push, no deletion, and the required check **`Typecheck + Vitest`**.
2. **Never merge a PR that is not fully green.** Never bypass checks. Never use `--admin`. Never deploy failing code.
3. **Do not spend the owner's money.**
   - No paid GitHub runners. No Vercel preview deploys.
   - Vercel auto-build is off on purpose (`vercel.json`: `"git": { "deploymentEnabled": false }`); do not turn it on.
   - The owner clicks every production deploy in the Vercel dashboard.
4. **Every production database write needs the owner's explicit go-ahead**, given in that conversation. Prepare SQL as files (pre-check read-only → apply all-or-nothing → verify read-only). The owner runs them in the Neon SQL Editor. Never run `production-db-migrate.yml` or the AWS deploy workflows yourself.
5. **Never print, log, commit or store secrets.** That includes `.env*` values, tokens, Stripe keys and database URLs.
6. **Payments stay off.** Stripe is only for donations and prepaid AI, and AI credit top-ups are currently paused (the UI says so). Do not enable checkout or billing.
7. **Honest labels only.**
   - No fake claims, metrics, customers or testimonials.
   - Integration logos are shown as **"Works with"**, never as clients.
   - Demo data must never appear in a real workspace (see `CLAUDE.md`, "Workspace-kind rule").
8. **Batch work into fewer, larger PRs, one at a time.** The owner explicitly asked: no stream of tiny PRs. Finish and merge one PR, then start the next. Overlapping PRs that touch the same lockfiles cause conflicts.
9. **Pinned, reviewed files are pinned for a reason** (section 6). If a check fails with `owned_framework_source_pins`, `pinned_ecs_sdk_changed`, `owned_test_child_options_unsupported` or a hash mismatch, do not "fix" it by changing the hash. Re-review what changed (section 6 explains how), then re-pin.
10. **Follow `CLAUDE.md`** (living-docs rule, workspace-kind rule, architecture principles). It applies to you too.

---

## 1. Why CI cost nothing here — and why Codex was asked to add money

**What made it free:**
- The repo is **public**. GitHub-hosted **standard** runners are **free and unlimited for public repositories**; that includes `ubuntu-latest`, `ubuntu-24.04` and `macos-latest` (minutes are not billed).
- Every workflow here uses only standard runners (25× `ubuntu-latest`, 1× `ubuntu-24.04`, 2× `macos-latest`, 1 matrix). None uses larger or GPU runners.
- No paid storage add-ons, Codespaces or Copilot features are used by CI.
- PRs were created and merged with the `gh` CLI under the owner's own GitHub login. That is free; no GitHub App, bot account or paid seat is involved.

**Why you (Codex) may have been asked to add money:** any of these triggers billing prompts.
- **Larger runners** (`runs-on: ubuntu-latest-4-cores`, `*-8-cores`, GPU, or any custom label): these are always billed, even on public repos.
- **Running the same workflows in a private fork or private copy.** Private repos have a limited free monthly quota, then billing; macOS minutes count 10×.
- **Codex Cloud / your own sandbox compute.** That is billed on the OpenAI side, not GitHub.
- **A spending-limit or payment-method prompt** after any of the above. GitHub then blocks jobs with "recent account payments have failed or your spending limit needs to be increased".
- **Vercel:** preview deployments, or turning on Git auto-deploys, use build minutes. Keep auto-deploy off and never create preview deploys. Preview also shares the production database, so it is unsafe as well as costly.

**How to stay free:**
- Only use standard runner labels.
- Never make the repo private without telling the owner about cost.
- Do not add workflows that run on every push to every branch.
- Keep `concurrency` with `cancel-in-progress` on PRs (`test.yml` already does).
- Do not dispatch heavy manual workflows (`owned-commercial-acceptance`, `desktop-release`, `desktop-export-v121`) unless the owner asks.

**If GitHub Actions has an outage:**
- Jobs may never be scheduled, and the required check stays "Expected — waiting". This happened on 2026-11-09; https://www.githubstatus.com showed a major Actions outage.
- Runs in that state "cannot be retried". Push an empty commit (`git commit --allow-empty -m "ci: re-run checks"`) once jobs start running again.
- Do not keep re-running in a loop. Do other work meanwhile.

---

## 2. What the product is (short)

Axiom (VisionXIXLabs) is a governed control plane for AI agents and cloud/release operations.
- Axiom **governs every agent**: its own Agent, Ask Axiom, and external agents (Cursor, Claude Code, Codex, MCP clients) through the agent gateway.
- Humans approve risky actions; everything is audited and tamper-evident.
- Direction from the owner: everything moves toward agents. Priorities: security first, then governance, then AI/engines/cloud.

**Surfaces:**
- **Website and docs** (Next.js App Router): `app/(marketing)`, `app/docs/*`.
- **Signed-in web app:** `app/control/*`. The old `/dashboard/*` routes redirect; 41 dead dashboard dirs were retired in #269.
- **Desktop app:** Tauri plus React/Vite in `desktop/`. Rust lives in `desktop/src-tauri`.
- **Public API:** `app/api/v1/*`, including the MCP server at `/api/v1/mcp` and `/api/v1/governance/*`.
- **SDKs:** `sdk/` (TS, Swift, Python, Go). The Python CLI is `sdk/python/vxl_cli.py` (`vxl ask`, `vxl outcome`).

**Stack:**
- Next.js **16.4.5**, React 19.3, TypeScript 7.0.2 native checks plus retained 5.9.3 compiler API (#320 merged green), Tailwind **4.3.5** (CSS-first migration; customer engine acceptance remains gated), Prisma **7.10.1** (#321 merged green; deployment blocked pending target/schema and adapter compatibility), Vitest **5.1.0** (#322 merged green, not deployed).
- Node 24 in CI; ai 7 requires Node 22+. Node 24 is used for this upgrade’s local checks.
- Desktop: Vite 8, Tauri 2.

---

## 3. How the work was done (the operating method — copy it)

### 3.1 Loop for every change
1. `git checkout main && git pull`, then `git checkout -b <type>/<short-name>`. Types: `feat`, `fix`, `docs`, `deps`, `design`, `ci`.
2. Make the change, plus its living-docs updates (section 5).
3. Verify locally as far as possible (section 4).
4. Commit with a clear message. Push and run `gh pr create` with a body explaining what changed, why, what was checked locally and what was not.
5. Wait for **all** checks: `gh pr checks <n>` until nothing is pending, and the required `Typecheck + Vitest` has a result.
6. If anything fails, read the real error (section 4.3), fix it on the branch and push. Never merge red.
7. `gh pr merge <n> --merge --delete-branch`, then `git checkout main && git pull`.
8. Start the next PR only after the previous one merged.

### 3.2 Reading CI failures (works with the corporate proxy/terminal)
```bash
gh pr checks <n>                                     # summary
JOB=$(gh pr checks <n> --json name,link -q '.[]|select(.name=="Vitest (2/3)").link' | sed 's#.*/##')
gh api --allow-escape-sequences repos/sahme209/visionxixlabs/actions/jobs/$JOB/logs \
  | sed -E 's/\x1b\[[0-9;]*m//g; s/^[^ ]* //' | grep -E "error TS|FAIL |AssertionError|Error:" | sort -u
```
- `gh run view --log` only works after the whole run finishes; the jobs API works per job.
- The required check `Typecheck + Vitest` is a gate job that passes only if `typecheck`, `vitest` (3 shards) and `build` pass. Fix the underlying job.

### 3.3 Dependencies (npm is blocked on the owner's Mac)
**Never** hand-edit `package-lock.json`. Use the manual workflow **`dependency-fix.yml`**:
```bash
gh workflow run dependency-fix.yml -f packages="pkg@1.2.3 other@4.5.6" -f directory=root   # or directory=desktop
# empty packages = non-breaking `npm audit fix` only
```
What the workflow does:
- installs with `--save-exact`, re-locks, and **re-pins the lockfile hash** in `scripts/fixtures/ownedWebsiteFramework.cjs`;
- pushes branch `deps/audit-fix-<runId>`.

GitHub Actions cannot open PRs in this repo, so you open the PR (`gh pr create --head deps/audit-fix-<runId>`). Add code fixes as extra commits on that branch.

**Dependabot** (`.github/dependabot.yml`) opens grouped PRs weekly per ecosystem (web, desktop, cargo, actions).
- Its web lockfile changes **always** fail `owned_framework_source_pins`, because Dependabot cannot re-pin the hash. Re-create the same versions via `dependency-fix.yml` and close the Dependabot PR. The owner may need to close Dependabot PRs; the agent was not allowed to.
- **Held packages** (ignored in `dependabot.yml`, each needs a planned PR — section 10): TypeScript API major, ESLint major, Stripe (all versions), `next`/`eslint-config-next`. AWS updates still require the ECS/S3 contract checks.
- When several Dependabot PRs touch the same lockfile, merging one makes the others conflict. Do them one at a time, re-locked on current `main`.

### 3.4 Delegation and research tools used
- Claude Code built-ins: shell, file edit, `gh` CLI, web search, and read-only "Explore" sub-agents for wide code mapping. No paid plugins, no external MCP servers, no GitHub App.
- The A2 coverage map and the screen-fact surveys came from Explore agents reading the repo. Facts were then checked by hand.
- Package file reviews used the **jsDelivr CDN** with `curl` (`https://cdn.jsdelivr.net/npm/<pkg>@<ver>/<path> | shasum -a 256`), because npm and unpkg are blocked by the corporate proxy (Zscaler). Python `urllib` fails on the proxy certificate; **use curl**.
- Memory notes (Claude-side only) recorded the owner's preferences:
  - batch PRs;
  - design DNA from Cursor, Harness, Claude, ChatGPT and Grok (calm, dense, honest);
  - "everything moves toward agents; Axiom governs every agent".

---

## 4. Local environment limits and how to verify anyway

- **Machine-specific limitation:** npm was blocked on the earlier Claude Mac. On the November 11 Codex Mac, registry access and local installs from workflow-generated lockfiles work. Local tests/types and desktop build ran; CI remains a mandatory merge gate. Do not generalize either machine’s access to another host.
- **Pure TypeScript kernels** run with Node 26 directly:
  ```bash
  node --experimental-strip-types /tmp/check.mts      # import the .ts file by absolute path, assert by hand
  ```
  For files that use `@/` imports or JSON, register a tiny loader that maps `@/` to the repo root, stubs `server-only`, and sets `importAttributes: {type:"json"}` for `.json`. This is how the Ask Axiom eval was run locally.
- **Python CLI tests:** `python3 -m unittest sdk.python.__tests__.test_vxl_cli`.
- `scripts/tests/test_local_next_build.py` has **8 errors even on clean `main`** locally (hard-coded paths such as `/Users/samirahmed/...` and the `governance_local_issuer` module). That is expected; compare against `main` before blaming a change.

---

## 5. Living docs and generated files (CI enforces these)

Follow the table in `CLAUDE.md`. The ones that bite most often:

November 11 AWS/AI SDK batches have no UI or public API changes. The Tailwind batch updates styling, the install guide’s engine requirements, generated heading hashes/corpus, three existing ModuleIntro review dates and the internal Desktop Pairing scenario. Guide count at the Tailwind checkpoint was31 (35 after the workspace batch;36 on the current offline-AI branch); SDK methods and webhook events are unchanged. The TypeScript transition changes build/CI tooling only; no module, product flow, API or guide text changes apply. Evidence: `docs/recovery/2026-11-11/tailwind4-upgrade/README.md`.

| You change | You must also |
|---|---|
| Any `app/docs/**/page.tsx` | Update **`lib/docs/guide-heading-index.json`**: the `sourceSha256` of that page; `fields` (DocHeader title, summary, then DocSection/Callout titles in page order); `navigationSha256` = sha256 of `components/docs/DocsSidebar.tsx`. Normally `node scripts/generate-docs-heading-index.cjs` (needs TypeScript installed). Without deps, compute sha256 with Python and keep the same JSON shape (2-space indent, non-ASCII unescaped). |
| Docs text | Regenerate the Ask Axiom corpus: `node scripts/support/build-docs-corpus.mjs` → `lib/support/docsCorpus.json` (a freshness test enforces it). |
| Add or remove a docs guide | Add it to `DocsSidebar.tsx`, add the index entry in sidebar order, and bump the guide count in `app/docs/__tests__/guide-navigation-search.test.ts` (it is **36** on the current offline-AI branch: four workspace guides plus the offline-AI source-preview guide added after #322). |
| Ask Axiom knowledge or ranking | Keep the eval `lib/support/__tests__/answerEval.test.ts` at ≥ 90%. It is 94.7% now; the 2 known misses are CI-gate and GCP setup. |
| A `/control/*` screen | `<ModuleIntro>` props and `lastReviewed`. |
| A product flow | The matching scenario in `lib/demo/demoScenarios.ts` (≥ 3 steps, unique ids, valid approval values). |
| A `/api/v1/*` endpoint | SDK methods in 4 languages, plus `sdk/README.md`. |
| A webhook event kind | Its producer, plus the `sdk/README.md` event list. |

---

## 6. Pinned and reviewed things — do not break

November12 local platform branch: reviewed current mock-helper schema pin now includes three appended platform models; all175existing model semantics/enums are unchanged. Historical Python packets/qualification remain closed. See `docs/recovery/2026-11-12/platform-governance-scope/SCHEMA-PIN-REVIEW.md` and `BROAD-VALIDATION.md`. No production schema change.

November 11: the synthetic recipe unit helper now binds the current schema after reviewing only the two appended models. See `docs/recovery/2026-11-11/tailwind4-upgrade/current-schema-pin-review.md`. The historical Python packet schema/hash bindings remain unchanged and unavailable for reuse; no qualification/export authority is restored.

- **Owned-website framework pins:** `scripts/fixtures/ownedWebsiteFramework.cjs` pins the hashes of `package-lock.json`, `next.config.ts`, `tsconfig*.json`, `next/package.json` and three Next internals, plus the Next version.
  - So **redirects must be page-level** (not `next.config.ts`).
  - Any lockfile change must be re-pinned; `dependency-fix.yml` does this.
- **Release closure:** `scripts/fixture-producer-runtime-closure.json` pins 20 Next files plus zod. `scripts/build-local-issuer-package-source.py` pins the Next version and the profile `next-16.4.5-darwin-app-default-types/1`.
- **How to bump Next safely** (done for 16.4.5 in #313):
  1. sha256-compare every pinned file between the old and new versions via jsDelivr.
  2. If all are identical except `package.json`, update the version and that hash everywhere: the fixture, the closure JSON, the Python packaging script, 2 owned-website tests and 2 script tests.
  3. If any pinned file differs, it needs a human review of that diff.
  4. Leave historical `docs/recovery/**` records unchanged.
- **Vitest pin:** `lib/billing/__tests__/fixtures/newTestChildEnvironment.ts` requires exact installed/locked version and reviewed `suppress-warnings.cjs` bytes. The merged 5.1.0 hash is `3f415a8b…`; comparison against 4.1.12 shows only a lint-comment change. Keep substitution/extra-preload refusals. See `docs/recovery/2026-11-11/vitest5-upgrade/README.md`; this is not historical issuer qualification.
- **AWS SDK:** `scripts/fixtures/generateEcsTaskSchema.mjs` asserts `@aws-sdk/client-ecs` **3.1166.0** (`pinned_ecs_sdk_changed`). The S3 plan-reader tests (`lib/terraform/__tests__/customerPlanAwsRead.test.ts`) assert exact SDK stream and middleware behaviour.
- **Stripe:** `lib/billing/settleAIUsageToStripe.ts` pins API version `2026-01-28.clover`. Even stripe 20.4.1 moves it, so Stripe is fully held.
- **ai SDK:** v7 moves the AI Gateway URL v3 → v4. PR #317 updated the installed-SDK composition tests to the reviewed v4 endpoint.
- **Governed AI path:** `lib/axiom/agentRuntime/governedAiCall.ts` is the only place the Agent may call a model, and online calls remain Gateway-only. The accepted local offline-AI branch is mutually exclusive, token-admitted and has no fallback; live enablement remains gated (section10, offline ADR).
- **Governance native and issuer code:** never flip these.
  - `AX_OWNER_OPERATIONAL=0` (`packages/verified-issuer-runtime/native/owner_config.h`);
  - the bootstrap flags in `lib/desktop/privateReleaseMergeBootstrap.ts`;
  - the throwing canonical merge issuer (`mergeOutboundIssuer.ts`).
  - Never fake a verified return. Never enable `AXIOM_GOVERNANCE_INTELLIGENCE_ENABLED` without the owner.
- **The desktop release guard test** pins `actions/upload-artifact@v7` for the SBOM upload.
- **Test fixtures and the Governance enrollment table:** routes that now check Governance enrollment read `prisma.durableAgentWorkflow.findMany`.
  - Test mocks of `@/lib/db` must include `durableAgentWorkflow: { findMany: async () => [] }` (not enrolled), or mock `@/lib/governance/intelligence/enrolledRefusal`.
  - Otherwise the check **fails closed** and refuses, which is correct behaviour but breaks old tests.

---

## 7. Production deploys and the database

- **Deploy procedure (owner clicks):**
  1. Make sure `main` CI is green on the exact commit. For AI SDK 7, confirm the Vercel project uses Node >=22 (CI/local validation use Node 24); changing production runtime settings still requires owner approval. Tailwind 4 source builds require Safari 16.4+/Chrome 111+/Firefox 128+; verify supported desktop webviews before publishing installers.
  2. Confirm whether there are new migrations: `git diff --name-only <last-deployed> main -- prisma/`.
  3. If there are migrations, prepare `1-PRECHECK-READ-ONLY.sql`, `2-APPLY-ALL-OR-NOTHING.sql`, `3-VERIFY-READ-ONLY.sql` (see `docs/recovery/2026-11-09/build-3-db/`). The owner runs them in the Neon SQL Editor, and the code deploys only after VERIFY passes.
  4. The owner opens Vercel → project → **Deployments → Create Deployment**, picks branch `main` and checks the commit, then deploys to **Production**.
  5. Smoke-check with `curl`: public pages return 200; new content is present; the API refuses without a key (`/api/v1/governance/check` → 401 `no_bearer_token`; `/api/v1/mcp` with a valid JSON-RPC body → 401); Ask Axiom answers with sources and refuses a pasted secret (`guarded`/`secret_pasted`); `/control/*` → 307 to sign-in with `callbackUrl`.
  6. Record the result in `docs/recovery/<date>/build-N/RESULT.md`.
- **History:**
  - Build 1, build 2 and build 3 (`61c69e65`, after the AgentGatewayRequest and AuditSeal migrations).
  - **Build 4 (`a344f4f6`)**: no database step; all smoke checks passed. See `docs/recovery/2026-11-09/build-4/RESULT.md`.
  - The owner's original cap was 3 builds; build 4 was explicitly approved. **Ask before each new production build.**
- **Historical build-3 latest-applied receipt:** `20261109100000_add_audit_seal`. **November 11 live read of recorded production branch `br-holy-voice-ai303o8m` / compute `ep-small-mountain-ailw0kvt`: latest is `20261108120000_add_pipeline_ai_call_quote_fields`; both November 9 tables/ledger rows are absent.** This discrepancy is unresolved; do not deploy or repair automatically. See `docs/recovery/2026-11-11/prisma7-preflight/OBSERVED-RESULT.json`.
- **Migrations must be additive.** Never reverse-migrate; rollback means the previous bundle plus a backup restore.
- **The Vercel build does not run migrations.** It runs `prisma generate` and `next build` with `NODE_OPTIONS=--max-old-space-size=16384`.
- **Preview environment shares the production database.** Do not create preview deploys until the owner sets up a separate Neon preview branch.

---

## 8. Architecture conventions you must keep

- **Pure kernels** (no I/O, closed-union results) for every decision, with a **narrow I/O boundary** file that composes them with Prisma or fetch. Example: `lib/support/supportActions.ts` (kernel) and `app/api/support/action/route.ts` (I/O).
- **Closed-union TypeScript** for scopes, event kinds, audit kinds and error codes.
- **Best-effort wrap** audit, webhook and usage writes in `try { } catch { /* best-effort */ }`. The exception is where a route deliberately fails on an unconfirmed audit (for example `audit_unconfirmed` on members); keep that.
- **Workspace-kind rule:** `ws_sandbox_*`, `ws_internal_*` and real workspaces. Demo data is guarded by `isSandboxWorkspace` / `assertNotDemoLeak`.
- **Authorization:**
  - `authorizedForOrganization(userId, orgId, mutation?)` (`lib/axiom/workspaceAuthority.ts`); mutation requires owner or admin;
  - desktop routes use `resolveRequestDesktopSession(...)`;
  - API keys use scoped, expiring keys.
- **Security helpers:**
  - `redactSecrets` (`lib/ai/contextRedaction.ts`) on every AI and support text path;
  - `checkRateLimit` and `consumeToken` for rate limits;
  - `validateWebhookUrl` and the bounded HTTP clients for outbound calls (HTTPS only; private hosts refused after DNS).

---

## 9. What was done (2026-11-08 → 2026-11-09), by area, with PR numbers

**Security (A7):**
- Workspace-authority fixes on `/api/axiom/*` (#220–#222).
- Starter-token expiry (#225).
- AI context secret redaction, invite revocation and supply-chain checks (#250).
- Self-service scoped, expiring API keys (#248).
- Every high and moderate npm advisory cleared: msal-node 7.2.1 with an MSAL nonce fix (#285), desktop zod (#288), archiver 8 (#290).
- Dependabot grouped config and a weekly `dependency-audit.yml`.

**Agent governance (A10–A14):**
- MCP and REST agent gateway (#238), with impact preview in decisions (#240).
- Scorecards (#241), discoverability (#242).
- `vxl ask` and `vxl outcome` CLI (#243), webhooks `agent_gateway.*` and `audit.integrity_failed` (#244).

**Trust tools (A11–A13, #239):** tamper-evident audit seals, policy replay, change impact preview.
- **Audit seal anchors** (#307): download a content-free anchor of the latest seal and check it later (`lib/audit/sealAnchorKernel.ts`, `/api/audit/anchor`).

**Ask Axiom support agent (B5/C2):**
- Grounded cited answers (#245), account-aware read-only help (#246), governed AI answers (#249).
- Hand-off to support (#275), request access (#277), read-only diagnostic (#278).
- **Governed actions** (#307, #308): seal and verify the audit log, and list API keys expiring soon. These use a closed action set, per-action roles and exact-action confirmation, re-checked by the server and audited as `support.action_run`.
- Eval of 38 cases at 94.7% in CI.

**Batches (A8):** read-only Prefect, Dagster and Argo clients, connection routes, Agent tools and the desktop form (#228, #230, #231, #236, #237, #287).

**Orchestrator and on-prem (A9):**
- `axiom.orchestrator/1` contract (#280) and the A9 ADR (#281).
- **Offline-AI ADR** (#312) in `docs/product/adr/2026-11-09-a9-offline-governed-local-models.md`. It is **proposed only; no code.**

**Governance Intelligence (A2):**
- Readiness read (#308): `POST /api/desktop/governance-intelligence/readiness`, off by default, always `executionAuthorized:false`. It lists uncovered families from `lib/governance/intelligence/uncoveredFamilies.ts`.
- **Enrolled-workspace refusal** (#309–#312). The owner-approved rule: *while enrolled, refuse anything that increases access or reach; reductions always work; unreadable enrollment refuses (fail closed).*
  - Kernel: `lib/governance/intelligence/enrolledRefusalPolicy.ts`. I/O: `lib/governance/intelligence/enrolledRefusal.ts`.
  - **F17 notifications:** discretionary sends refused; safety alerts always delivered (autonomy halts, critical incidents/signals, any critical severity or critical digest).
  - **F18 webhooks:** non-security deliveries stay queued untouched; `audit.integrity_failed`, `api_key.created` and `api_key.revoked` always deliver.
  - **M01:** promotions, new invitations and accepting older invitations refused; demote and remove work.
  - **M02:** autonomy loosening and AI provider policy widening refused. Branch policies only add requirements, so they need no refusal.
  - **M03:** new connections refused before any consent: Slack, Teams, Linear (web and desktop), Outlook (including added send access), ServiceNow, Airflow, batch providers, AWS and Azure enrollment, guided Azure and GCP. Re-authorize and disconnect still work; GitHub is excluded (F03 already refuses writes).
  - **M04:** new API keys (workspace and platform admin) and new webhook endpoints refused; revocation works.
  - **Remaining uncovered:** only **P01**, the platform's own deploy, template hosting and growth publishing. This is an owner scope decision.
  - Coverage record: `docs/recovery/2026-11-02/governance-execution-coverage-current.md` (delta sections dated 2026-11-09).

**Website and docs (B2/B4):**
- Balanced design across pages, a wording pass, and CI full-page screenshots on `design/*` branches (`design-screenshots.yml`).
- Logic-audit fixes (#247).
- Honest "Works with" logo strip and Integrations flow (#283); Simple Icons SVGs in `public/logos/integrations` (Azure and Dagster as text).
- Legal additions (#271).
- Guides: Agent gateway, Trust tools, API keys, Batch providers, Ask Axiom (#267, #279), and **Members and roles, Governance approvals, Usage and billing** (#308).

**CI:**
- Parallel type check, 3 Vitest shards and build (~6 min) (#229).
- Build memory fixed by retiring 41 dead dashboard pages (#269).
- `dependency-fix.yml` takes exact upgrades for root or desktop (#284, #286).

**Dependency upgrades merged:**
- Desktop majors: lucide 1, framer-motion 14, vite 8, plugin-react 6 (#299). These needed one-React fixes in `desktop/vite.config.ts` (dedupe) and `vitest.config.ts` (lucide-react resolved to the root copy).
- Web minor/patch (#301), web majors (#303): AI and cloud SDKs, jose 6, lucide 1, motion 14. The Anthropic SDK 1 dropped `temperature`, and the arm-resources 8 test was rewritten.
- AWS 3.1166.0 (#315) and ai 7.0.170 (#317) merged green November 11; not production-deployed.
- ai 6.0.323 (#306), Vitest 4.1.12 (#312), Next.js 16.4.5 (#313).
- Actions updates (#252, #253, #272, #294), cargo (#254, #273, #293), desktop minor (#296).

---

## 10. What is left — and exactly how to do it

### 10.1 Code you can do (one PR each, in this order)
1. **AWS SDK upgrade: DONE, PR #315 merged green (3.1166.0). Not deployed.** Evidence: `docs/recovery/2026-11-11/aws-sdk-upgrade/README.md`. Re-lock via `dependency-fix.yml`, then:
   - **ECS:** regenerate the schema with `scripts/fixtures/generateEcsTaskSchema.mjs` (update its pinned version) and review the diff of generated fields.
   - **S3:** the plan-reader tests (`customerPlanAwsRead.test.ts`) failed on stream/tee and middleware behaviour in the newer SDK. Debug against those tests and keep the security properties: byte budget charged once, abort retained, no leaked body values, fixed version-pinned SSE-KMS objects only. Do not loosen assertions to make them pass.
   - Then remove `@aws-sdk/*` from the Dependabot ignore list.
2. **ai 7: DONE, PR #317 merged green (7.0.170). Not deployed.** Evidence: `docs/recovery/2026-11-11/ai7-upgrade/README.md`. Gateway URL v3 → v4. Update the pinned dispatch URL in the installed-SDK composition tests only after confirming the v4 endpoint is the reviewed Vercel AI Gateway. Run the governed-call tests.
3. **Platform migrations, one PR each, in a branch with CI as the judge:**
   - ESLint 10: HOLD on ESLint 9 by owner decision November 11. Published React/import/accessibility plugins still reject 10; the normal install emits peer conflicts and `npm ls eslint --all` reports ELSPROBLEMS. Do not force or disable rules. Diagnostic: `docs/recovery/2026-11-11/tailwind4-upgrade/eslint10-hold.json`.
   - Tailwind 4: DONE, PR #319 merged green as `77d932c5`; CSS-first 4.3.5 for web and desktop, not deployed or installer-qualified. Evidence: `docs/recovery/2026-11-11/tailwind4-upgrade/README.md`.
   - TypeScript 7: DONE, PR #320 merged green as `a99c053f`; native 7.0.2 side-by-side checks. Keep exact API 5.9.3 and its reviewed pins for Next/ESLint/fixture emitters; use explicit native checks for root, production source and desktop builds. Direct replacement reproduced missing API and invalid peers; never force them. API-major Dependabot holds remain deliberate. See `docs/recovery/2026-11-11/typescript7-upgrade/README.md`.
   - **Prisma 7: source DONE, PR #321 merged green as `54c0f1c5` (7.10.1). Not deployed.** Exact head `6a4fdb59` passed all applicable checks, including actual owned HTTP/PG acceptance and website/macOS checks. No migration SQL changed. Production target/schema discrepancy and pool/TLS compatibility remain deployment gates; historical issuer qualification is not renewed. See `docs/recovery/2026-11-11/prisma7-preflight/MERGED-RESULT.md`.
   - **Vitest 5.1.0: DONE, PR #322 merged green as `a10730ca`.** All applicable CI passed on exact head `2ecb082f`; unchanged 17,851-test suite, reviewed exact preload/lock guard, no relaxed defaults/assertions. Not deployed or historically qualified. See `docs/recovery/2026-11-11/vitest5-upgrade/MERGED-RESULT.md`.
   - Remove each package's Dependabot ignore line after its PR merges.
4. **Flaky `lib/governance/qualification/__tests__/privateFixtureJoined.test.ts`.**
   - Not reproduced in 60 failed runs.
   - When it fails, capture the `fixed_fixture_scenario_unavailable:<site>` code from the log and fix that race. Do not guess.
5. **Offline AI: ADR accepted and all three v1 choices confirmed November 11. Local source implementation and validation are complete on the current branch; mandatory PR/CI/merge remain.** OpenAI-compatible vLLM/Ollama/LM Studio only; operator-set per-workspace caps with no default; missing caps refuse; online customer-hosted disabled. Production/live/spending gates remain.
   - implement the `customer_hosted` governed branch exactly as the ADR says;
   - offline mode excludes the gateway; operator-only endpoint; same redaction and admission; configured output bounds; a token budget instead of a price; an audit record per call;
   - kernel tests first.
6. **Docs coverage (B4):** **DONE source batch: PR #323 merged green as `9decdb28`** (Apps and skills, Workspaces, MCP documentation tools, Settings and sessions); navigation/count35, heading index and support corpus updated. Every applicable check passed on exact head `29989733`; not deployed. Customer screenshots/recordings and comprehensive B4 acceptance remain separate. See `docs/recovery/2026-11-11/workspace-guides/README.md`.

### 10.2 Owner decisions (ask; do not decide)
- **P01 scope resolved November12:** include Axiom own deploys, template hosting and growth publishing. Local design/implementation approved; managed workflow/enforcement is in progress on the platform branch. This is not deployment/provider/production authority.
- **Offline-AI ADR: resolved November 11 for local v1 implementation.** Exact choices recorded in the ADR; do not ask again or treat them as production/live authority.
- **A9 on-prem:** KMS/HSM key custody, offline sign-in, offline licence, and the audit retention default (suggested 400 days).
- **Earlier holds:**
  - Vercel secret fallbacks;
  - Neon preview integration (a separate preview DB);
  - Agent identity seed for the 2 organizations without one;
  - `Lead.phone`;
  - admin MFA;
  - an API key expiry policy for admin-minted keys;
  - the coding-run budget design (A7.18).
- **Stripe** upgrade: changes the billing API version.
- **C1–C6:** not authorized.
- **Each new production build.**

### 10.3 Real-world steps (not code)
- A1: signed installer.
- A2: live Governance trials (never enable the flag yourself).
- A3: ServiceNow CHG0030002 closure, by genuine human reviewers only. Never decide for them; never resend the note.
- A4: real-app walkthroughs.
- A5: Store/Windows (deferred).
- A7.14: independent security assessment.
- A8: live provider acceptance against real Prefect, Dagster and Argo.
- B3: recorded demos.

Status details live in `docs/product/remaining-work.md` and `docs/product/execution-strategy-2026-11.md`. Keep both updated after every PR.

---

## 11. Before you finish any task — checklist
- [ ] Branch, not `main`; one PR; focused but batched.
- [ ] Living docs updated (section 5); generated files refreshed (heading index, corpus, guide count).
- [ ] No secrets, no demo data in real workspaces, honest labels.
- [ ] Pinned files untouched, or re-reviewed and re-pinned with evidence (section 6).
- [ ] New enrollment checks: test mocks include `durableAgentWorkflow` or mock `enrolledRefusal`.
- [ ] Every CI check green, including `Typecheck + Vitest`; merged with `--merge --delete-branch`.
- [ ] `docs/product/remaining-work.md` updated.
- [ ] Anything touching production (database, deploy, flags, billing, external posts) waits for the owner's explicit yes.

## 12. Supplemental future technology assessment — gap-time research only

The owner added `docs/product/future-technology-deployment-assessment.md` on November 11 and clarified “During gaps, without delaying current priorities.” This timing supersedes only the attached original's after-completion timing. Do not interrupt section 10.1, replace unfinished requirements, create a mandatory feature backlog or implement recommendations. Research the full preserved brief against actual source/existing plans during genuine gaps, then present recommendations for owner review. The first source-backed owner-review draft is now prepared at `docs/research/2026-11-11/future-technology-assessment.md`; qualification/adoption remain open, no implementation tickets were created and no additional paid/provider/production authority is granted.

## 13. Token-efficiency and useful tooling

Owner added `docs/product/token-efficiency-and-tooling-assessment.md`: discover relevant repositories/libraries/plugins/skills, prioritize measured token/cost efficiency and project value, and reuse current facilities before adding dependencies. Source-checked candidates remain uninstalled/unqualified. Preserve quality, tenant/data boundaries, exact approvals, gateway-only policy and all spending/production controls; distinguish runtime accounting from development-assistant usage. No current-sequence reprioritization or automatic adoption is authorized.


## November 11 — Prisma 7 application compatibility progress (not merged/deployed)

The modern generated client, explicit PostgreSQL adapter factory and application constructor/import migration are implemented locally. Root native types pass; full first migration suite observed 17,803 passing tests, 30 failures across six files, 893 skipped and one expected failure. Generated-model guards retain full required-field checks and reject stale generation. The old datasource/cache/proxy assertions and reviewed framework source pin were subsequently repaired; 95 tests across those ten focused files now pass in the recorded split runs. Two old synthetic recipe tests remain incompatible with the Prisma 5 schema/engine profile; they are not skipped or declared qualified. Ordinary script sources retain exact targets and operations through the adapter, but were not executed. Historical issuer/recipe authority is not renewed. Full rerun, production/desktop builds, remaining recipe compatibility, independent final review and mandatory green PR CI remain. No production change or deployment. See [metadata evidence](docs/recovery/2026-11-11/prisma7-preflight/GENERATED-METADATA-PROGRESS.md) and [Node/driver review](docs/recovery/2026-11-11/prisma7-preflight/NODE-SOURCE-COMPATIBILITY.md). The live schema discrepancy and unverified Vercel target remain deployment blockers.


### Subsequent Prisma 7 validation — local candidate ready for mandatory PR CI

The two recipe failures above are resolved by the reviewed current-source `/2` helper and mocked tests, with old-driver refusal retained. Full rerun: 17,835 passed, 893 skipped, one expected failure; no unexpected failures. Three additional actual fresh isolated-PG tests passed (P2002, atomic workflow/event rollback, Serializable P2034); server stopped. Production build/299 pages, desktop types/frontend build and Python 36 tests pass; independent source review found no important issues. [Full evidence and explicit limits](docs/recovery/2026-11-11/prisma7-preflight/README.md). Not merged, deployed or historically issuer-qualified. Live target/schema reconciliation and driver compatibility remain deployment gates.


### PR #321 — deeper CI compatibility repair, not merged

Required Typecheck + Vitest, production/offline build, desktop/macOS, audit and auth recovery passed on the prior head; actual opt-in AWS/PG and HTTP/website acceptance found remaining failures. Raw-SQL conflict compatibility is now repaired locally with exact own-data driver evidence; transaction scopes/retry caps/authority are unchanged. Full local suite 17,850 pass / 897 skip / one expected failure, four actual fresh PG tests and complete AWS enrollment/revocation rehearsal pass; owned servers stopped. Bounded secret-free startup categories are prepared for the still-unconfirmed HTTP/website startup failures. [Evidence and limits](docs/recovery/2026-11-11/prisma7-preflight/CI-SECOND-ROUND.md). Do not merge pending/failing checks, deploy or equate this with live Governance acceptance.


### Prisma startup compiler boundary — source correction, CI pending

Actual Next Webpack compilation of the real instrumentation hook reproduced 17 Edge errors with the early-return form. The Node store-factory import is now enclosed in a positive Node-only condition: Edge excludes the real PostgreSQL adapter graph, Node retains it, and the original Node store/logging/error behavior is unchanged. Implemented source review passes; no emitted application was executed by this regression. [Evidence](docs/recovery/2026-11-11/prisma7-preflight/INSTRUMENTATION-COMPILER-BOUNDARY.md). Actual HTTP/website CI success remains mandatory; no startup/deployment acceptance is claimed yet. No Next config/hash, authority, timeout, flag, credentials or native dependency changed.

## November11 — offline AI branch in final validation (not merged/deployed)

Accepted v1 choices and protected evidence-supplier design are implemented locally: token ledger, private transport, default Agent/Prisma/decision-loop composition, mode-aware policy controls and client selection. No default token allowance; operator-only endpoint/caps; unknown liabilities retained. Current public navigation36guides/corpus123sections includes a clearly labeled offline source-preview operation matrix. Existing on-prem/native/Governance, live model/OS qualification and production gates remain. Independent source review found an omitted isolated-provider guard and a terminal-admission race; both are corrected and re-reviewed. Final full local suite17,966pass/914skip/one expected failure, production build304pages, desktop types/build and Python36pass. Exact-head PR checks/merge remain required. [Evidence and explicit limits](docs/recovery/2026-11-11/offline-ai-v1/README.md). Do not call this feature complete or change production.

## Offline-AI v1 source merged — PR #325

PR #325 merged normally at 2026-11-12T03:28:08Z as `0caaaaab6c809f2188d1a4c8fdd64980e6ef35f0`. Exact head `4845eda54b26599b299fdf1557e599561a71883b` passed every applicable check: required Typecheck + Vitest, all three shards, types, production/offline build, frontend/native security, macOS transport/policy, owned PG accounting, owned HTTP authentication/billing and isolated website. Screenshot job skipped by its existing branch condition.

This supersedes prior pending source/CI statements only. Local full suite17,966pass/914skip/one expected failure; actual isolated PG17journeys used simulated model/evidence/audit. No real inference, protected OS qualification, Linux/Windows supplier, installed-native UI or production acceptance. No deployment/settings/schema/credentials/provider action. Existing production target/schema/TLS and all full-master owner/live gates remain.

## November12 — P01 scope decision recorded

Owner selected **include Axiom production deployments, template hosting and growth publishing in Governance**. Scope is resolved, enforcement is not complete. Source inspection found automatic S3 writes behind a GET and LinkedIn image uploads during draft generation; both belong in the coverage map. Proposed separate platform authority and staged enforcement are documented in `docs/recovery/2026-11-12/platform-governance-scope/PROPOSAL.md`. No product code, authority, flag, credentials, schema or external action changed. P01 stays a readiness blocker; owner production-click and spending rules remain.

## November12 — platform Governance initial local implementation

Owner approved the platform design for local code/schema definitions/isolated tests. Exact effect contracts and pure plan/review/claim/terminal transitions now pass9tests; transactional action/child-effect service passes7in-memory checks. Three actual isolated PostgreSQL journeys prove one concurrent claim, event rollback and terminal unknown preservation; server stopped. Root strict types pass. Dedicated platform tables are proposed only; no production migration, current-auth default, provider transport, workflow/UI or full P01 coverage is complete. P01 remains blocked. Source plan: `docs/superpowers/plans/2026-11-12-platform-governance.md`.

## November12 — operational platform local scope approved

Owner approved the reviewed operational-release design for LOCAL implementation/schema/synthetic and owned-isolated tests only, superseding the original source-modification exclusion for the named administrative entrypoints within their complete replacement batch. No actual workflow, credentials, grants, provider/production action or spending. Follow `docs/superpowers/plans/2026-11-12-operational-platform-releases.md`; initial metadata contracts pass5focused checks/root types, not complete enforcement. Other pending authority designs are not approved by this decision.


## November12 — durable manual release notices, local only

Operational Task2 now has dedicated notice/event SQL and current paired possession/admin composition, not owner or provider authority.27focused checks/root types and39actual isolated PG journeys pass (synthetic release evidence; server stopped). Default new preparation/review/notice refuses unqualified sources; current-reader history is available in unregistered source. Two appended local notice models preserve all178prior model bytes; reviewed current mock-helper pin/client refreshed, historical packets unchanged. Full Task2/P01/workflow/CI/production remain open. See platform-governance-scope/CURRENT.md and MANUAL-RELEASE-SCHEMA-REVIEW.md.


Manual-release evidence continuation: strict private bundle reconstruction and bounded exact deployment observation now join current paired SQL notice/history composition. Successful tests use synthetic qualification/provider receipts; actual source/profile/smoke qualification remains unavailable and defaults refuse. No owner identity, deployment or rollback authority is inferred.39actual isolated PG cases/root types PASS; see platform-governance-scope/MANUAL-RELEASE-EVIDENCE-PG-RECEIPT.json. Full Task2/P01/CI/live/production remain open.


Operational workload identity candidate:32local synthetic-signature/identity/replay checks/root types pass; actual JOSE crypto, simulated private profile/replay storage. Three approved public GitHub documentation reads consumed; see WORKLOAD-IDENTITY-SOURCE-REVIEW.md. No default supplier or operational allow path, real key/token, workflow/credential/provider or production action. Exact durable delegation/leases/reservations and full P01 remain incomplete.


Operational local delegation: exact approved parent/requester/run now joins a distinct workload claim, global replay SQL and durable pending/issued/unknown credential metadata.72focused checks/root types and44actual isolated PG journeys pass; real profile/source/credential issuance/provider and requester HTTP binding remain unqualified or simulated. Generic human ECS claims/effects refuse, no operational provider dispatch exists. Two new local tables/one inverse relation were semantically reviewed before current helper pin update; historical packets unchanged. See platform-governance-scope/OPERATIONAL-DELEGATION-PG-RECEIPT.json. Full P01/native/live/production acceptance remains open.


Operational target continuation: exact physical-service generation reservations/immutable receipts now join workload claim before credential entry. Unknown/held targets and prior pending/unknown credentials block fresh actions; issued leases require separately qualified closure metadata.116focused checks/root types and51actual isolated PG cases pass; native/provider/closure qualification remains simulated, no qualified default or dispatch. Two proposed models/inverse relations reviewed; current helper/client updated, no historical qualification. See OPERATIONAL-TARGET-PG-RECEIPT.json and CURRENT.md. Protected settings/default effects/UI/full P01 remain incomplete; no production/provider/spending action.


### Protected settings codec — local unit, not execution authority

Settings manifests now require an explicit nonsecret artifact profile. The private codec reuses the existing AES-GCM kernel, binding each value to the exact parent action/plan/manifest, effect, original creator/session, target and profile. Public plans and metadata contain no value, ciphertext or secret-dependent hash. Wrong bindings/keys, malformed envelopes and oversized/invalid values refuse with a fixed error; supplied key buffers remain unchanged. The 64 KiB bound is local memory protection, not provider qualification.

Validation:10focused checks across2files and strict root types PASS. Tests use synthetic values and random local keys; no actual secret, key supplier, provider or database was accessed. Durable immutable artifact storage, current-authority/clock checks around custody, settings reservations, final transport, qualified default composition and Task3/P01 completion remain open. No HTTP route, default key lookup, production schema, deployment or spending.


### Protected settings transactional intake — local injected unit

The private intake service locks the original proposed parent, derives the exact artifact binding, checks current original requester authority/source/DB time around awaited custody and insert, and returns metadata only. Duplicate artifacts and any save after review refuse before key access. No replacement, deletion, renewal, decrypt/export or provider operation is exposed. Errors normalize to a fixed refusal. Transactional rollback is required of the repository.

Validation: missing-module RED, then10focused codec/intake tests PASS (5intake cases); strict root types PASS. Tests use an explicitly simulated transactional repository, source, authority and synthetic random keys. They verify key preservation, duplicate nonreplacement, post-review/identity refusal, revocation/expiry/source changes after custody, unavailable custody and rollback after a final authority failure. Actual SQL adapter/schema/uniqueness/isolated-PG composition and qualified custody remain REQUIRED next steps; this is not durable database acceptance or Task3 completion. No production/schema/provider action, real credential or spending.


### Private settings actual SQL — fixture acceptance, local only

The shared platform SQL repository now provides private insert/read operations under the original parent lock, with canonical binding/parent checks and insert-only uniqueness on artifact ID and parent/effect. The fresh isolated fixture adds a dedicated encrypted-envelope table; no public history/export endpoint or mutable artifact operation exists. The current Prisma production schema/model and migration are NOT yet added, so this is not a deployable schema claim.

Strict root types PASS.53actual isolated PostgreSQL cases PASS, including two new cases: competing saves yield one exact decryptable synthetic envelope; reviewed parents refuse replacement; final authority loss rolls back the actual inserted envelope. Existing51cases also pass. Source/custody remain SIMULATED, real current identity SQL is used, and no paired HTTP/real-key/provider acceptance is claimed. Latest `/private/tmp/axiom-platform-pg-95iuomy1` stopped; earlier52case fixture z8t_9jqo preserved/stopped. See SETTINGS-ARTIFACT-PG-RECEIPT.json for enumerated source hashes/limits. Next: proposed Prisma model and semantic review/current-helper regeneration, private preparation/review composition and settings execution/reservation qualification. Task3/P01 remain open. No production/provider/spending action.


### Private settings proposed Prisma schema/client — local only

Added PlatformSettingsArtifact and its parent inverse relation. Actual Prisma DMMF comparison verifies all184prior models/enums: only the inverse relation changes existing metadata; no existing data field/default/enum/migration changed. Current185-model mock-helper schema pin updated AFTER semantic review; historical packets and engine/CLI/seed pins unchanged. The existing stale-schema guard first refused as expected;12mocked recipe checks now pass including omission of the new table. Cached client generation ran with network denied and no DATABASE_URL; client compilation, generated metadata guards and strict root types pass. Additional12focused generated-model/codec/intake checks pass.

See SETTINGS-ARTIFACT-SCHEMA-REVIEW.md/json. Prior53actual isolated SQL receipt remains accurately scoped to its earlier enumerated schema hashes, not relabeled as a new runtime attestation. SQL table behavior is unchanged by this source-model addition. Actual protected custody, registered request/reviewer workflow, current artifact presence at review and final execution/settings reservations remain open. No production migration/apply, key/provider action, deployment, spending or historical qualification.


### Dedicated private settings review — local only

Added exact original-plan/version independent review to settings intake. Every saved artifact must match the derived action/effect/creator/session/target/profile binding under the parent lock; current requester/reviewer/source and database deadlines are checked around all awaits and after the durable review event. Review reads metadata/envelopes only, never custody keys or plaintext, and returns review-only/executionAuthorized=false. This dedicated workflow is not registered publicly; the generic legacy review remains separate and must not be mistaken for usable settings execution.

Missing-method RED then8focused store tests PASS.53actual isolated SQL cases PASS, with the private-settings journey now using this exact dedicated independent review and self-review refusal. Latest `/private/tmp/axiom-platform-pg-5c4iuk1h` stopped; see SETTINGS-REVIEW-PG-RECEIPT.json. Strict root types initially found a closure-narrowing issue; fixed by capturing the already narrowed settings count, then types PASS. The SQL receipt predates only that type-preserving local count capture. Full registration/preparation/preview/default custody/reservations/final dispatch, Task3/P01/full validation remain open. No production/provider/key action or spending.


### Signed-session private settings composition — local only

Private request composition now derives the actor from verified existing desktop bearer possession plus current SQL session/user/membership and platform-admin authority. Save/review accept no caller identity. Bound possession is checked around awaited current-authority checks; missing/changed headers refuse before source/custody. There is no cookie/API-key/cron fallback, public route, export or execution method.

Missing-module RED then focused possession test PASS; strict root types PASS.54actual isolated PostgreSQL cases PASS, including a new actual synthetic-HMAC/current-identity/SQL save→self-review refusal→separate independent-review case and removed-possession refusal. Actual source/custody remain SIMULATED; no real keys/users/provider effects. Latest `/private/tmp/axiom-platform-pg-7gkw7xh3` stopped; see SETTINGS-REQUEST-PG-RECEIPT.json. Registered HTTP/preview/original-reference recovery, qualified default custody, settings reservation/final execution and complete Task3/P01 remain open. No production/schema/provider/credential action, deployment or spending.


### Exact settings review preview — local only

Private settings preview returns the exact project/team/profile, plan/version/deadline, physical environment/name/type/sensitivity/current-source reference and missing/saved artifact status. It exposes no values, envelopes, creator sessions or key-dependent hashes; reviewReady means only all exact records are present, never execution authority. Current source and reader/requester authority/deadline are required. Signed-session composition exposes this private method, not a registered public route/UI.

Missing-preview RED and a behavioral source-revocation-during-read RED were reproduced; preview and review now recheck source qualification after each awaited record read.11focused checks and strict root types PASS.54actual isolated SQL cases PASS, with actual HMAC/private request preview joined to save/independent review. Synthetic source/custody remain unqualified; fixture `/private/tmp/axiom-platform-pg-b1zgec53` stopped. See SETTINGS-PREVIEW-PG-RECEIPT.json. No full workflow/execution/Task3/P01 acceptance, production change or spending.


### Vercel settings provider contract — three public reads consumed

See SETTINGS-VERCEL-SOURCE-REVIEW.md: exact existing-ID PATCH and response updatedAt do not establish request-side compare-and-swap in the inspected docs; no safe default update profile is qualified. POST documents upsert/duplicate behavior but create-only still needs scoped qualification. Setting changes are separate from running deployment updates. No API/account/key/write access occurred. SETTINGS-CONCURRENCY-DECISION.md recommends a locally prepared create-only first stage with updates held and still unfinished, pending owner design choice. Continue independent reservations/workflow work; no invented CAS, provider allow path, retirement or completion.


### Create-only scope selected; native settings exclusion — local primitive

Owner approved local create-only settings preparation/implementation; existing-variable updates remain held and explicitly unfinished. Full settings coverage is not narrowed to the create-only stage. No real setting/key/provider authority is granted.

A physical setting key now includes exact project/team/name/environment and excludes action/artifact/profile/value metadata. Actual SQL reuses the existing unique child publicationKey storage for a permanent settings-creation reservation. It requires the locked claimed parent, exact saved artifact binding/plan/source/requester/effect and a claimed child. Unknown retains the key; a cloned action/reference cannot reserve it. There is no reset/release/retry API; even terminal records do not by themselves grant a fresh creation. This storage primitive does not establish current provider absence, custody qualification, claim/decrypt/final-send authority, CAS or prevention of external admin changes. Complete create-only execution composition still remains.

Missing-key-module RED;12focused checks/root strict types PASS.55actual isolated SQL cases PASS, including the new competing/cloned native-setting-after-unknown exclusion case; provider/source/custody remain simulated. Fixture `/private/tmp/axiom-platform-pg-f9b__nrd` stopped; see SETTINGS-RESERVATION-PG-RECEIPT.json. No new model/schema/migration, production/provider action or spending.


### Create-only original-requester claim — local only

Dedicated settings claim now revalidates exact parent version/digest, both current humans, every immutable artifact binding/presence, current source and DB deadline before and after its durable claim/event. Only the original requester/session may claim; missing artifacts, existing-setting updates, stale/expired/revoked source/people and duplicate claims refuse before custody. Private signed-session composition derives the requester; claim returns metadata only/executionAuthorized=false and opens no value. This is not final-send authority or complete create-only execution.

Missing-method RED then13focused store/request checks PASS; strict root types PASS.55actual isolated SQL cases PASS with the actual synthetic-HMAC request journey extended through reviewer-claim refusal, original requester claim and duplicate refusal. Source/custody remain SIMULATED. Fixture `/private/tmp/axiom-platform-pg-_ksjnub3` stopped; SETTINGS-CLAIM-PG-RECEIPT.json records source/limits. Next is joining native child reservation/private custody/final transport with qualified source and unknown-result semantics, then complete workflow/default coverage. Existing-setting updates remain held and unfinished. No production/provider/key action or spending.


### Joined private create-only execution candidate — local only

The private executor now joins actual platform child claim/proofs/outcome machinery to exact settings records. A repository wrapper validates the current create-only manifest/source/profile/humans/deadline and atomically claims the child AND reserves the native setting before commit. Only after confirmed reservation commit may a separate private transaction obtain the synthetic custody key and decrypt the exact context-bound value. Final send rechecks current humans/source/profile/child/held reservation and is one-use; failures/unknown recording halt later children, preserve native exclusion and never replay. No value/envelope/raw response is returned in the result. Known confirmation is separately labelled provider_confirmed/deploymentPerformed=false, not running-app or deployment acceptance.

Transport and source qualification are explicitly private injected ports; the exact default Vercel HTTP/credential/visibility profile is NOT implemented or qualified. This is not public registration, real provider acceptance, complete create-only workflow or P01 completion. Existing-setting updates remain held. Value strings cannot be guaranteed zeroized by JavaScript; no memory-erasure claim is made. No real values, keys or providers are accessed.

Missing-module RED preceded implementation; initial denial-test failure was a fixture bug sharing one spy across all ports, corrected to distinct spies (no assertion removed). Focused denial test/root strict types PASS.59actual isolated SQL cases PASS, including four new execution cases: two sequential exact simulated creates, unknown-first blocks later custody/send, unavailable profile refuses before custody/child, and final-profile revocation prevents simulated physical send while retaining unknown reservation. Latest fixture `/private/tmp/axiom-platform-pg-eqk50wp0` stopped; preceding57case z7301_a4 preserved/stopped. See SETTINGS-EXECUTION-PG-RECEIPT.json. No production/schema/provider action, deployment or spending.


### Bounded Vercel create-only transport candidate — local only

Private transport now constructs one fixed-origin POST for the exact project/team/name/type/single environment, with no upsert, branch/custom-scope expansion, delete, retry or deploy. Explicit private source qualification precedes credential lookup and repeats before the final one-use execution callback. One10second deadline covers private preparation/request/response; late supplier continuations check abort before network. Responses are bounded64KiB and parsed into exact nonsecret receipt identity; contradictory targets/types, partial failures, redirects/rejections/transport loss stay unknown, with no raw response/error/value exposure. A response visibility conflicting with secret sensitivity refuses.

Missing-module RED then8focused transport tests PASS, including fake-clock late-credential/no-send. Strict root types PASS.59actual isolated SQL journeys PASS with the positive two-child executor case now using this actual transport and synthetic fetch/credential/profile; other unknown/revocation cases remain. Fixture `/private/tmp/axiom-platform-pg-vols3jjq` stopped; see SETTINGS-TRANSPORT-PG-RECEIPT.json. The cached already-approved create reference was revisited to resolve its response shape; no fourth documentation page/account/API was read.

This is not a qualified default: actual credential custody, create-conflict/visibility/size profile, actual provider acceptance, registered workflow/default callers and complete Task3/4/P01 remain open. No API, real key, production schema, deployment or spending. Existing-setting updates stay held, not dropped from scope.


### Durable exact settings result metadata — local only

The executor now records a nonsecret typed settings result within the existing immutable effect.observed event transaction: exact action/plan/manifest/effect/native key, outcome, confirmed setting ID or null, database observation time and metadata integrity digest. SQL rejects event/action/source/index/outcome mismatches. This preserves the original result for later recovery rather than relying on the response reaching the caller. Unknown never fabricates a setting identity, clears reservation or permits replay. No value/session/envelope/credential/raw response is included. Digests are not signatures or provider qualification. No new table/migration is needed.

Actual SQL RED reproduced missing durable IDs; corrected59actual isolated SQL journeys PASS, with positive execution checking both saved result IDs. Initial strict types found the broad event status union; explicit claimed-status rejection fixed it.11focused result/executor/transport checks PASS; root strict types PASS. Fixture `/private/tmp/axiom-platform-pg-v5f6q7id` stopped; failed RED fixture _tl3w16j preserved/stopped. See SETTINGS-RESULT-PG-RECEIPT.json. Source/fetch/custody qualification remain synthetic, public history/UI/default mounting and full Task3/4/P01 remain open. No production/provider/key action or spending.


### Read-only settings recovery history — local only

Dedicated inspect returns bounded immutable result receipts and nonsecret parent status/version/attempt/source digest/user IDs with current-reader authority, history_only/sourceValidation=not_checked/executionAuthorized=false. SQL reads only settingsResult projections from exact effect.observed events, bounded32; malformed, duplicate, cross-action/plan/source/index receipts refuse. Historical access does not depend on expired source/custody or a former reviewer's current role and never changes state, opens values or authorizes replay. Private signed-session composition exposes inspect; no public registration/UI is claimed.

Missing-method RED then14focused store tests PASS (request test also passed with the new port before the final malformed-result case); strict root types PASS.59actual isolated SQL cases PASS, with positive execution now inspecting both exact saved result IDs after actual fixture reviewer-session revocation and unavailable old source, without a new key read. Fixture `/private/tmp/axiom-platform-pg-xu5m_t57` stopped; see SETTINGS-HISTORY-PG-RECEIPT.json. Source/transport/custody remain simulated; full default qualification/preparation/UI/Task3/4/P01 remain open. No production/provider action or spending.


### Durable settings preparation and original reference — local only

Exact create-only nonsecret selections now become a proposed parent plus immutable settingsManifest in the same existing proposed-event transaction, after private source/current-requester/deadline checks. No new table/column is added. SQL validates manifest/plan/event agreement when writing and reading. Deterministic original requester/session/request references recover the original record after a lost response; matching historic references do not renew expiry, re-review, create duplicate actions or revalidate old source. Changed selections under the same reference refuse. Signed-session private composition has optional explicitly qualified preparation/lookup; without that supplier it refuses. No raw secret is accepted in selection.

Missing-module RED then focused preparation/store/request checks PASS; strict root types PASS.60actual isolated PostgreSQL cases PASS: new concurrent/reference/changed-selection recovery case; all four private executor cases now prepare and read the actual saved manifest through SQL instead of closing over an injected manifest. Source/custody/provider qualification remains synthetic. Fixture `/private/tmp/axiom-platform-pg-rcueewfa` stopped; see SETTINGS-PREPARATION-PG-RECEIPT.json. Public workflow/UI, actual default supplier qualification, remaining ECS/default/legacy coverage and full Task3/4/P01 remain open. No production/schema/provider action, deployment or spending.


### Prepared settings HTTP/default composition and exact-child correction

Prepared strict POST command handling now joins authenticated preparation/lookup/save/preview/review/claim/inspect and one exact child execution. Request identities/outcomes/unknown fields are rejected; input is bounded, errors fixed and responses private/no-store. No implicit claim, child loop, retry or deploy. Private request composition checks request cancellation with possession and only constructs execution when explicit private qualified ports are supplied. The prepared actual default uses existing HMAC/admin/SQL history, saved manifests and unavailable preparation/source/custody, with no credential fallback or execution port. No route is registered.

A deliberate actual SQL regression reproduced that repeating a successful execute-next command could select the following child. Fixed by requiring the exact expected effect index in preflight AND the atomic child-claim wrapper; a repeat of index0 refuses before child1/key/send. This preserves one-command/one-physical-change semantics. Failed fixture dyqqvbls is preserved/stopped, not relabeled as acceptance.

Four focused handler/executor checks and strict root types PASS.61actual isolated SQL cases PASS, including new real in-process HTTP→synthetic HMAC/current SQL→private executor→actual HTTP transport with simulated fetch; repeated child and reviewer execution refuse, current-reader result history succeeds. Fixture `/private/tmp/axiom-platform-pg-b2wd2_8h` stopped; SETTINGS-HTTP-PG-RECEIPT.json records scope. The earlier60test executor repeat regression is superseded by corrected exact-index acceptance only. No public route/UI/provider/custody qualification or full Task3/4/P01 completion. No production/schema/provider action, deployment or spending.


### Operational ECS exact command and acceptance — local protocol unit

Three approved official AWS documentation reads consumed; ECS-EXECUTION-SOURCE-REVIEW.md records exact pages and source-backed credential/rolling-controller/image-tag/result limits. Added installed-SDK UpdateService command construction with explicit reviewed task definition and only selected force behavior. Strict response projection requires exact service/cluster/task, bounded request identity and unique new primary deployment distinct from the original captured ID; it always returns accepted/stable=false/rollbackAuthorized=false. No SDK send/client/credential call occurs.

Missing-module RED then3focused protocol checks/root strict types PASS. No SQL or existing store behavior changed, so no passing PG rerun. Actual private issuance/delegated child/final transport/immutable image and native result qualification remain open; this is not usable ECS workflow or Task4/P01 completion. No provider/account/key/workflow action, deployment or spending.


### Pending-bound private credential issuance — local only

The private delegation store now optionally accepts an explicit qualified issuer; no default exists. A committed pending proof is consumed once, then exact current humans/source/identity/held native generation and issuer qualification are checked before the bounded10second synthetic issuance. Only after actual issued metadata commits and current checks repeat may an opaque WeakMap handle be returned. Raw key/session values never enter history/events/results. Lost/invalid/timed-out issuance records unknown and yields no handle; recording failure preserves pending/issued uncertainty without replay. Reviewer revocation during issuance still permits truthful issued-liability recording but prevents the handle. Existing read-only observation remains non-authoritative and cannot manufacture this handle from JSON.

Missing-method RED then12focused delegation checks/root strict types PASS, including timeout, revoked reviewer, clone/replay and key exclusion.63actual isolated PostgreSQL cases PASS, adding real pending→synthetic issuance→issued-private-handle and issuer-loss→unknown/no-second-mint cases. Latest `/private/tmp/axiom-platform-pg-wop_n25z` stopped; see OPERATIONAL-ISSUANCE-PG-RECEIPT.json. No schema/model change or historical pin renewal. Actual STS/custody/profile, credential-handle child/final-send consumption, transport/result/default workflow and full P01 remain incomplete. Handles are not public send authority; no provider send exists here. No real key/token/issuer/provider action, deployment or spending.


### Private credential-handle ECS child execution — local only

Opaque issued handles are consumed once before child preparation. Actual SQL joins exact delegation/lease/current humans/source/workload/native held generation and transport qualification to the sole ECS child claim. A final one-use callback repeats those checks immediately before the private synthetic send. Credentials are passed only inside the fixed private transport callback, never through JSON/history. Original captured deployment identity is required by the exact acceptance parser. Ten-second timeout or malformed/contradictory/lost result stays unknown; there is no retry, waiter-based rollback or second use of the handle.

Immutable nonsecret operationalResult metadata now records action/manifest/native generation/lease/result identity and DB observation time in the same child outcome event transaction. SQL checks event/delegation/result agreement. Accepted child is command-confirmed but parent remains claimed/not-stable; target reservation stays held pending separately qualified observation. Unknown marks parent/child unknown and retains target/issued-credential liability. Metadata digests are not source/issuer proof.

Missing-module RED then focused result refusal/root strict types PASS.66actual isolated SQL journeys PASS, including3new private issued-handle execution cases: accepted-not-stable/no-reuse, uncertain-no-rollback/native hold, final native-profile revocation/no simulated physical send. Issuer/profile/transport remain SIMULATED; actual SQL and existing signed-workload crypto are exercised. Fixture `/private/tmp/axiom-platform-pg-gbb86u2z` stopped; preceding65case ll6fc9xk preserved/stopped. See OPERATIONAL-ECS-EXECUTION-PG-RECEIPT.json. No default SDK send, actual STS/custody/provider/native-result qualification, registered workflow/legacy replacement or full Task4/P01 completion. No production/schema/provider action, deployment or spending.


### Installed-SDK ECS network boundary — local candidate

Added the actual pinned ECSClient/UpdateService transport with explicit temporary credential inputs, exact fixed regional endpoint, ambient endpoint suppression, maxAttempts1 and no waiter/rollback. The signed HTTP handler validates method/origin/path/action header/exact serialized command/session identity, consumes one send slot and invokes current final authorization AFTER signing, immediately before native dispatch. Abort/expiry is checked again. Existing native bounded-response handler limits success/error streams64KiB and refuses redirects; fixed errors do not expose SDK/provider messages. No default qualified profile is supplied.

Initial actual-SDK tests refused before native dispatch: installed Smithy emits JsonBytesStringAdapter, a Uint8Array subclass rather than a primitive string. Reviewed its local installed source/types; request guard now decodes only bounded string/Uint8Array UTF-8 and still requires exact canonical payload equality. No SDK/schema/historical pin changed. Missing-module/protocol REDs preserved;7focused SDK/protocol checks and strict root types PASS, including real signing with synthetic credentials, ignored ambient endpoints, revoked final callback, cancellation, one-attempt errors, redirects/body overflow.

67actual isolated SQL cases PASS, adding actual private-issued-handle/current-authority/native-reservation→installed SDK→intercepted NodeHttpHandler→immutable acceptance. No socket/request reaches AWS. Synthetic issuer/profile/custody/native response remain explicit; this is not provider/live/default qualification. Fixture `/private/tmp/axiom-platform-pg-prsbefiy` stopped; see ECS-SDK-TRANSPORT-PG-RECEIPT.json. Native observation/stability/conditional rollback, default workflow/legacy replacement/full P01 remain open. No production/schema/real credential/provider action, deployment or spending.


### Original-operation ECS read-only outcome source — local candidate

Actual SQL now reads the sole immutable operational result under the original action lock. A request-scoped source requires that original accepted action/manifest/native generation before any describe; it never discovers a replacement deployment. The first reserved-target transition adopts qualified saved acceptance only. Subsequent bounded10second explicit reads require private current profile/evidence qualification before mapping exact original rollout/counts to accepted/stable/terminal failure/unknown. Missing evidence/read errors cannot establish stability or failure. Unknown-without-original-ID remains blocked. Qualification is repeated around immutable receipt writes; no default source, scan, polling, credentials or provider action is present.

The installed pinned SDK's Deployment field documentation describes supported rolling ECS/non-Classic-LB rollout states; this local source inspection adds no external page read and no source pin change. The structural observation projection is labelled qualificationRequired and grants no execution/rollback authority. Stable native evidence does not itself finalize the original parent, clear issued credential liabilities or execute rollback; those separate joins remain.

Missing-module RED then observation tests PASS; root strict types PASS.68actual isolated SQL cases PASS, adding original-acceptance-required/no-describe→accepted→unrelated completion unknown→exact qualified stable, preserving4immutable native receipts. Describe/profile/evidence remain SIMULATED. Fixture `/private/tmp/axiom-platform-pg-ubo2mk_m` stopped; see ECS-OBSERVATION-PG-RECEIPT.json. Actual SDK read-only supplier, current-reader workflow, terminal parent reconciliation, default/runtime/provider qualification and full Task4/P01 remain open. No production/schema/provider action or spending.
