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
- Next.js **16.4.5**, React 19.3, TypeScript 5.9, Tailwind **4.3.5** (CSS-first migration; customer engine acceptance remains gated), Prisma **5.22**, Vitest **4.1.12**.
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
- **Held packages** (ignored in `dependabot.yml`, each needs a planned PR — section 10): TypeScript major, Prisma major, ESLint major, Vitest major, Stripe (all versions), `next`/`eslint-config-next`. AWS updates still require the ECS/S3 contract checks.
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

November 11 AWS/AI SDK batches have no UI or public API changes. The Tailwind batch updates styling, the install guide’s engine requirements, generated heading hashes/corpus, three existing ModuleIntro review dates and the internal Desktop Pairing scenario. Guide count remains 31; SDK methods and webhook events are unchanged. Evidence: `docs/recovery/2026-11-11/tailwind4-upgrade/README.md`.

| You change | You must also |
|---|---|
| Any `app/docs/**/page.tsx` | Update **`lib/docs/guide-heading-index.json`**: the `sourceSha256` of that page; `fields` (DocHeader title, summary, then DocSection/Callout titles in page order); `navigationSha256` = sha256 of `components/docs/DocsSidebar.tsx`. Normally `node scripts/generate-docs-heading-index.cjs` (needs TypeScript installed). Without deps, compute sha256 with Python and keep the same JSON shape (2-space indent, non-ASCII unescaped). |
| Docs text | Regenerate the Ask Axiom corpus: `node scripts/support/build-docs-corpus.mjs` → `lib/support/docsCorpus.json` (a freshness test enforces it). |
| Add or remove a docs guide | Add it to `DocsSidebar.tsx`, add the index entry in sidebar order, and bump the guide count in `app/docs/__tests__/guide-navigation-search.test.ts` (it is **31** now). |
| Ask Axiom knowledge or ranking | Keep the eval `lib/support/__tests__/answerEval.test.ts` at ≥ 90%. It is 94.7% now; the 2 known misses are CI-gate and GCP setup. |
| A `/control/*` screen | `<ModuleIntro>` props and `lastReviewed`. |
| A product flow | The matching scenario in `lib/demo/demoScenarios.ts` (≥ 3 steps, unique ids, valid approval values). |
| A `/api/v1/*` endpoint | SDK methods in 4 languages, plus `sdk/README.md`. |
| A webhook event kind | Its producer, plus the `sdk/README.md` event list. |

---

## 6. Pinned and reviewed things — do not break

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
- **Vitest pin:** `lib/billing/__tests__/fixtures/newTestChildEnvironment.ts` requires the exact installed Vitest version (now **4.1.12**) and the sha256 `a5012da3…` of `vitest/suppress-warnings.cjs`. On every bump, check that file's hash via jsDelivr, then update the version in the fixture and its test mocks.
- **AWS SDK:** `scripts/fixtures/generateEcsTaskSchema.mjs` asserts `@aws-sdk/client-ecs` **3.1166.0** (`pinned_ecs_sdk_changed`). The S3 plan-reader tests (`lib/terraform/__tests__/customerPlanAwsRead.test.ts`) assert exact SDK stream and middleware behaviour.
- **Stripe:** `lib/billing/settleAIUsageToStripe.ts` pins API version `2026-01-28.clover`. Even stripe 20.4.1 moves it, so Stripe is fully held.
- **ai SDK:** v7 moves the AI Gateway URL v3 → v4. The installed-SDK composition tests pin v3.
- **Governed AI path:** `lib/axiom/agentRuntime/governedAiCall.ts` is the only place the Agent may call a model, and it is gateway-only. Do not add a fallback provider there (section 10, offline ADR).
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
- **Latest applied migration in production:** `20261109100000_add_audit_seal`, which matches the repo.
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
   - Tailwind 4: CSS-first 4.3.5 implementation for web and desktop, merge gated on all green checks. Evidence: `docs/recovery/2026-11-11/tailwind4-upgrade/README.md`.
   - TypeScript 7 (native compiler: tooling that loads `node_modules/typescript` breaks, including the owned-website TS API fixture, so re-review those pins);
   - Prisma 7: new client generator and config. **Needs an owner-approved production schema check; no data changes.**
   - Vitest 5.
   - Remove each package's Dependabot ignore line after its PR merges.
4. **Flaky `lib/governance/qualification/__tests__/privateFixtureJoined.test.ts`.**
   - Not reproduced in 60 failed runs.
   - When it fails, capture the `fixed_fixture_scenario_unavailable:<site>` code from the log and fix that race. Do not guess.
5. **Offline AI (only after the ADR is accepted and the owner answers its 3 questions):**
   - implement the `customer_hosted` governed branch exactly as the ADR says;
   - offline mode excludes the gateway; operator-only endpoint; same redaction and admission; configured output bounds; a token budget instead of a price; an audit record per call;
   - kernel tests first.
6. **Docs coverage (B4):** guides for Plugins, Workspaces, MCP and Settings. Use the same method as #308: gather facts from the real screens and server checks, and write only what the UI actually does.

### 10.2 Owner decisions (ask; do not decide)
- **P01:** should Governance cover Axiom's own deploys, template hosting and growth publishing?
- **Offline-AI ADR:** which model servers first; default token budget; whether online installs may use customer-hosted models.
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
