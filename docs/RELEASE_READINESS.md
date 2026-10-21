# Axiom Agent release readiness

## Verification cleanup and Git-output milestone — October 21, 2026

- Confirmed and repaired two independent defects locally: scoped tokens appearing alone in Git diagnostics/success output, and canceled native checks leaving an attached descendant running. Synthetic redaction cases and a real descendant marker-write regression failed before their repairs.
- Unix verification now creates a private process group, observes child exit with waitid WNOWAIT, retains the unreaped leader through output collection, stops the owned group before reaping, and refuses group signaling when child ownership cannot be confirmed. Independent review rejected an earlier numeric-ID-only guard because reaping before pipe drain allowed PID/PGID reuse; that unsafe candidate was not committed. The revised lifecycle passed independent review.
- Validation: all 43 default native Mac tests passed; the additional real Keychain acceptance test remains opt-in and previously passed explicitly. Native debug compilation passed. Earlier 81 affected frontend cases, TypeScript/lint/frontend build remain valid for unchanged renderer files. No repeated GitHub Actions or deployments.
- Limits: deliberately detached descendants can escape; failed ownership confirmation/signals remain unverified. No unrelated component may reap the owned child concurrently. Windows retains its previous direct-child behavior; fresh Linux compilation/runtime acceptance for the new Unix lifecycle remains pending. Redaction covers literal credentials, not arbitrary transformed/partial representations; Git argument exposure is unchanged.
- Next gated acceptance remains rendered desktop inspection (remote Mac Screen Recording/automation permission), isolated provider/Stripe/cloud journeys, approved source publication and required CI. No current installer publication, production DB/secret/billing change, paid request or new deployment occurred.

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

Verified release preparation: candidate identities align at 0.1.21 across npm/Tauri/Cargo without dependency changes. Existing version-alignment command and 17 focused release-version tests pass; desktop TypeScript/frontend build and native locked debug build pass. No release tag, remote push, certificate access, installer signing/notarization or publication occurred.

Read-only production download acceptance: manifest and ARM download JSON both returned 200, runtimeReady=true, current public release desktop-v0.1.20, Mac signed/notarized flags true. HEAD of the resolved actual public ARM installer returned 200 with 7,683,804 bytes; no binary was downloaded/installed. This verifies the existing public download path, not that newly developed source has been released or the installer/customer journey has passed. Windows/Linux signing remains unverified by published attestations.

Verified scoped Git transport: all 53 default native Mac tests and locked native build pass. Command arguments and initial cloned origin remain credential-free; exact repository URL-matched temporary headers, disabled scoped redirects, helper/askpass suppression and disabled trace destinations are verified with actual local Git commands. Raw, URL-decoded and Basic-encoded credentials are removed from captured output. Independent review identified configuration precedence and askpass fallback issues; both were reproduced by failing regressions and fixed before final review. Existing percent-encoding 2.3.2 is now an exact direct dependency; no additional package/version was introduced to the lock graph. No real credentials or remote network writes were used. Process environments remain inspectable by same-user/privileged processes; Git >=2.31 is needed for child environment configuration. Fresh Linux/Windows and real GitHub authentication acceptance remain pending.

## Isolated native first-run and model/repository connection evidence — October 21, 2026

The archived source at 67fdfc85 was built and launched as a separately identified, ad-hoc-signed Axiom Acceptance app. A test-only exact-identifier Keychain guard refused all other namespaces; its WebView connection policy excluded external services. Own-WebView instrumentation observed actual React sign-in rendering, native version 0.1.21, enabled login/create-account controls, and local rejection of a deliberately invalid nonsecret administrator key. The fetch observer recorded zero calls in both observations. The exact owned app process was stopped. Receipt: /tmp/axiom-native-validation/gui-receipt.ndjson on the authorized Mac; test instrumentation remains outside the release source.

This is instrumented first-run/IPC acceptance, not a trusted-pointer, authenticated, installed-release, provider, cloud or billing journey. Screen Recording permission was not changed. Initial automatic launch review rejected a possible production-vault access risk; source/bundle identity checks plus the stricter test-only denial guard resolved that risk before the later approved launch. No production vault entry was queried.

Cached public Gateway discovery identifies current Grok models under spacexai/. The existing generic loader/policy already accepts that identity. A reproduced display-grouping defect is repaired by labeling this namespace xAI without rewriting model IDs or enabling unapproved models. Inert-IO policy/resolver tests verify the exact Grok ID reaches existing billing admission and revocation prevents another hold/call; this is not real inference acceptance. The cumulative authorized AI test cap is $5; requests and spend remain zero because secure test credentials are unavailable.

Repository preference reads throwing SecurityError previously aborted valid connected-repository selection, misreported integration failure, and disabled Clone. A failing rendered-component regression reproduced this. Preference read/write failures now retain authorized in-memory selection; no credential is minted merely by selection. Validation: 100 focused model/policy/repository/edit cases passed, followed by both preference-failure cases passing after the additional write regression; desktop TypeScript and frontend build passed. ESLint has zero errors and an existing catalog ref cleanup warning; existing bundle-size warnings remain. Independent source review found no blocking findings. Rust source is unchanged from the prior 53-test/native-build checkpoint.

GCP is deferred by owner direction, with existing code retained. AWS/Azure/Kubernetes/Terraform real CLI acceptance is blocked in the current Mac PATH and standard binary locations by missing aws/az/kubectl/terraform/docker tools; this does not establish absence of server-side SDK support. Real sandbox identities and resource/cost scope also remain required. Local API/policy fixtures do not certify actual cloud execution.

## Airflow binding repair and real Stripe TEST catalog audit — October 21, 2026

- Airflow scheduler now rejects a persisted rule bound to a different connection before scheduled triggering, run reads, snapshots or proposals. Two regressions failed before the guard; all 123 Airflow tests now pass. Existing stable scheduled-run identity, executor approval/retry checks and diagnostics remain. Independent review found no blockers. This is tick-evaluation binding, not a lock against concurrent reconnects.
- Website TypeScript surfaced a readonly-array mutation in the newly added Grok test fixture; replaced it with an immutable copied selection. The 22 dispatch tests pass afterward; website TypeScript and affected-file lint produce no errors. No production model-policy change.
- Read-only Stripe connector audit selected Vision XIX Labs TEST mode explicitly. Complete active-price page (has_more=false) contains three $4.99/month VisaNova Premium prices, not Axiom. No active Axiom $29 Pro/$79 Enterprise or corresponding annual prices exist in this account. Existing matcher rejects these unrelated terms; never bind them as Axiom.
- Complete TEST webhook page (has_more=false) contains only the existing Founding Supporters endpoint on an older Vercel Preview hostname, enabled for checkout.session.completed and charge.refunded. Leave it unchanged. This is not a subscription-lifecycle receiver and must not be repurposed. No live account resources were read or changed.
- Exact proposed TEST catalog, requiring separate approval before writes: two new Axiom products (Pro, Enterprise), four active USD per-unit licensed recurring prices with no quantity transform: Pro monthly2900 cents, annual27840 cents; Enterprise monthly7900 cents, annual75840 cents. These preserve the public catalog's20% annual discount. Metadata identifies axiom_public_test_v1 but never serves as payment authority. Existing products/customers/support checkout remain unchanged.
- Before actual hosted-payment acceptance: bind returned TEST price IDs and the verified TEST account to an isolated application runtime/store with securely configured test key and webhook verification secret. A separate subscription event receiver or approved local Stripe forwarding session is required; do not create a webhook with an unverified URL or use the production support route. Checkout, signed event, renew/cancel/fail/refund, anniversary allowance and application entitlement acceptance remain unverified. No Stripe objects, payments or webhooks were created.

## Native changed-file protocol acceptance — October 21, 2026

Real owned Git repositories reproduced two defects before repair: a modified one-character path disappeared after porcelain trimming, and rename/quoted paths were not exposed exactly. Only repository_status now requests porcelain v1 NUL records and parses raw protocol fields; rename/copy source records are consumed and destination identity retained. Invalid UTF-8 or malformed output fails closed rather than appearing clean. Existing credential redaction, clean-tree guards and other output_text callers are unchanged.

All56 default native Mac tests pass (one intentional opt-in Keychain test ignored), including real Unicode/tab/newline/quote/rename and single-character path fixtures; locked offline native debug compilation passes. Independent source review found no blockers. Non-UTF8 filenames deliberately make status unavailable. Status labels retain the existing trimmed XY display, not staged/unstaged column detail. New Windows/Linux runtime acceptance remains unverified. No remote Git request, global Git config change, installer publication or paid operation occurred.

## AI task-progress implementation and native coding IPC acceptance — October 21, 2026

Primary engineering is focused on the AI coding experience after the owner's refinement; one agent completed native acceptance independently. GCP remains deferred. Git mechanics are supporting work, not the primary product milestone.

AI: actual policy-approved read-only tool calls now emit optional bounded progress through decisionLoop, authenticated NDJSON, DesktopClient and the rendered Agent chat. The new client explicitly requests tool_activity_v1; older clients receive no extra events, and new clients accept the same older JSON response without a second request. Events contain only step1–8, an allowlisted low-risk tool name and running/completed/failed state. Arguments, outputs, raw exceptions and credentials are excluded. Strict ordering/identity/shape checks reject malformed frames. Write proposals and policy-denied tools never become executing activity; persisted final responses remain the approval authority. Activity is transient and removed on completion/cancel/context change. A terminal response can end an unfinished activity when the request is refused; progress is not an execution certificate.

Validation: four expected red failures established missing runtime/wire activity before implementation. Final affected-model/profile/transport/composer/route batch:280 tests passed across13 files; the4 client cases passed again after extending legacy JSON compatibility to negotiated activity. Desktop and website TypeScript passed, affected-file lint had zero errors (four existing unused test-parameter warnings), frontend build passed with existing bundle warnings. Independent source/security review found no blockers; initial-grounding, cancellation-during-read, denied-tool absence and readonly-registry coverage regressions were added. No extra provider call, retry, permission or billing lane was introduced. This is integrated application code with synthetic external IO, not authenticated real-provider acceptance.

Native acceptance at f6b19a42e95dc3463a082e118837ef541aa711bd: a fresh isolated ad-hoc-signed own-WebView test app passed repository identity, real edit/stale-save refusal, exact changed path, two-file create/no-overwrite, wrong-branch refusal, real npm verification under Finder-like PATH, running-process cancellation without a passing receipt, and absence of its attached descendant marker after the observed deadline. Native request and stream entry points were denied in this instrumented copy; its single observed fetch was local IPC. Exact test identity guarded all vault/legacy-store entry. Owned app stopped and its absence checked. All58 default native tests and Clippy passed; one Keychain test remained deliberately opt-in. Original failed receipt retained. Same-user/privileged observation and deliberately detached process escape remain outside guarantees. This is not authenticated, trusted-pointer, installed-release or full chat-to-cloud acceptance.

Remaining real acceptance: secure test model/Gateway credentials (approved cumulative$5 cap, zero inference/$0 spent), isolated account/workspace and subscription runtime/catalog, authorized AWS/Azure sandbox identity/scope, and final installed signed-app customer journeys. Stripe catalog writes, source pushes, hosted CI/deployments and installer publication retain separate approval gates. No production/payment/cloud changes occurred.

## October 21 — AI request recovery (local only)

Interrupted or canceled Agent responses now require an identity-verified saved-conversation review before Send/Enter can submit again. Failed reloads keep the guard and unsent draft; no automatic AI retry. 20 application-composition tests, desktop TypeScript, affected lint and frontend build passed; independent review found no blocker. Session-local guard does not prove server completion or idempotency. Installed release and real-provider acceptance remain unverified; $0 of the approved $5 AI test cap spent.

Combined Agent proposal/local workspace UI journey now covered with mixed update/create review, separate baseline-bound Save, explicit Create and separately consented verification;76 affected tests, TypeScript and lint passed with independent review. Native peer remains synthetic in this integration coverage; no new installed/provider acceptance claim.

## Shared disposable customer coding repository — October 21

Owner requested a test repository and confirmed Windows/Linux are full product targets, not Mac-only. Created a dependency-free, local-only repository at /tmp/axiom-native-validation/customer-coding-sandbox on the Mac, with no remote, credentials or package install. Baseline contains calculator.js and a real node:test assertion. Branch acceptance/subtraction is reserved for the coding task: propose subtract(a,b), create its test, review both diffs, explicitly save/create, and consent to npm test. The task is not already implemented or claimed AI-generated.

Portable acceptance/report.mjs records platform, architecture, actual subprocess result and diff; ignores its generated receipt in Git. Installed Axiom, real-provider and native cancellation fields remain unverified rather than inherited from CLI results.

| Platform | Fixture test evidence | Installed-app / provider status |
| --- | --- | --- |
| macOS ARM64 | npm test and report runner passed, one baseline assertion | Current shared fixture not yet exercised through installed UI/provider |
| Linux x64 | All seven fixture source hashes match Mac. Direct execution of the exact node:test file passed one assertion. Report runner subprocess failed EPERM, retained as failed CLI-runner acceptance | Native app, terminal and provider unverified; no substitution of direct assertion for process acceptance |
| Windows | No Windows execution environment available in this session | Unverified, same fixture/checklist required |

Existing native/WebView and renderer test receipts remain separate. No hosted repo, push, CI, installer, deployment or paid request was initiated.

## Actual model acceptance — October 21

Owner authorized creation/use of a dedicated test-only Gateway key within the combined $5 cap. Created using supported pinned CLI65; no production key extraction, environment/billing change, top-up or deployment. Read-back confirmed active $5 nonrenewing quota, BYOK usage included, seven-day expiration, zero initial spend. Secret stored only outside source in a0700 directory/0600 file, never passed in process arguments or printed. Duplicate raw creation capture redacted; scan found no test key in tracked source.

One single-attempt real stream per model,512 maximum output tokens, sequential, using actual VercelGatewayProvider.streamTextOnce in a private opt-in harness with an allowlisted environment and no production DB/Stripe/cloud credentials:
- OpenAI GPT4.1 mini: passed real streaming (187 text chunks),95 input/188 output/283 total tokens and Gateway generation metadata. Two reviewed complete files added subtraction plus tests in the disposable repository. All3 real Node assertions passed. Execution child had no provider credentials.
- Grok4.1 fast nonreasoning: failed before text. Gateway routing receipt resolved to vertex and upstream404 Not Found. Model is in fresh public catalog; catalog presence is not usable-provider acceptance. No speculative retry/routing change.
- Claude Haiku4.5: failed before text with Gateway403 explicitly restricting this model for free-credit users and requiring paid credits. No credit purchase, account restriction bypass or repeated request.

Post-attempt key budget reports $0.0004888 metered usage, BYOK0, quota5/none active. This is a Gateway usage reading, not a complete invoice or application billing/entitlement acceptance.

Real failures exposed two source issues in the streaming adapter: every upstream SDK error became network, and installed SDK default error handling printed raw upstream detail. Four classification regressions and one installed-SDK logging regression failed before repair. Bounded numeric status/cause inspection now returns fixed nonretryable authentication/model-access/route errors; raw error logging disabled only in this lane, with fullStream exceptions retained.42 affected tests passed; TypeScript/lint evidence retained separately. Independent classification review found no blockers; direct-throw, cycle and nonleak assertions added from review. No new inference needed for local repair.

Not verified: authenticated desktop-to-server complete Agent/billing-reservation lifecycle, actual native UI application of the model proposal, real-provider tool execution/cancellation, installed Windows/Linux or native Mac release acceptance. Public/provider account restrictions remain distinct from source test results.
