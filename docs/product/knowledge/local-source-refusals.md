# Understand the local source and AI allowance refusals

**INTERNAL DRAFT - unpublished; customer eligible: false; publication approved: false.** This guide describes application source `201f5e77` as contained in inspected Git `82c378d1924ac9c8bc03516b8a73208e41721680`, not an installed or deployed version. The [source manifest](local-source-refusals.sources.json) records exact files/ranges. Bracketed keys are documentation evidence references, not runtime help IDs or an approved retrieval binding. Customer-facing publication, authentic media, editorial approval, browser/AT and installed-version acceptance remain open.

## Start with the exact code

| Observed code | Meaning in this source | Appropriate next step |
|---|---|---|
| `github.tenant_source_required` (HTTP 412, precondition) | The legacy server-wide GitHub discovery source has no verified workspace ownership. Being signed in or having a configured server credential does not establish that ownership. | Record the affected feature, exact version and code. Use the supported workspace-scoped workflow only if its own access checks succeed. A qualified tenant-bound discovery implementation is required; reconnecting or changing an organization name is not a recovery mechanism for this refusal. |
| `ai.public_admission_unavailable` (HTTP 503) | The legacy anonymous website assistant has no verified usage owner/allowance/admission. It refuses before processing the prompt or dispatching inference. | Browse available documentation and report the version/code through the supported help channel. Do not add a guessed tenant, identity or credit value, change model settings or buy credits expecting this local guard to lift. Public assistance needs its own reviewed funding/admission design. |
| Public assistant HTTP 429 | Its existing IP limiter ran before the unavailable gate. | Do not automatically retry. A later eligible request still encounters the unqualified-allowance guard; waiting does not create funding or permission. |

The two typed refusals intentionally describe different boundaries. Neither grants new access, sends a message or executes a deployment. These local changes have not themselves been deployed. The codes are not asserted to appear in the currently published v0.1.21 installers or an uninspected production session. [github-refusal, github-scanner-gate, error-http-status, public-assistant-guard, ordinary-build-evidence]

## Which GitHub work is affected?

The legacy scanner rejects live discovery before creating its ambient server client or resolving its token. The ReleaseOps aggregator propagates that specific failure instead of returning a successful preview fallback. In the inspected source, execution-graph GET/POST, GitHub sync GET/POST, ReleaseOps state GET/POST and ReleaseOps scan POST can reach this boundary after their existing sign-in checks. Other consumers of the shared aggregator may also receive the failure; this is not a complete UI inventory. Supplying another organization name does not bind a tenant to that source. The sync/scan routes can record existing audit-start entries before refusing; such an entry does not prove a live scan ran or authorize a retry. [github-scanner-gate, github-state-propagation, graph-route, github-sync-route, releaseops-state-route, releaseops-scan-route]

Explicit preview/disabled paths remain separate and accurately labeled. Preview is synthetic information, not a successful live read or restored authority. Separately scoped GitHub installation/repository resolvers were not modified by this containment. That fact does not prove a particular account is connected, permitted or healthy now; follow each workflow's current access and exact-action review. Do not interpret this legacy refusal as evidence that every GitHub operation, Outlook or another integration is broken. [github-state-propagation, scoped-github-resolver, github-local-evidence]

**Example:** A signed-in user opens a legacy release graph and receives `github.tenant_source_required`. There is no failed deployment to resend. Record the version/code and keep any existing action history. Do not reset consent, widen the server token, override the organization or bypass the guard. A source label alone cannot establish workspace ownership. [github-refusal, graph-route, github-local-evidence]

## Which AI work is affected?

The anonymous website route checks the IP limit, then returns its fixed 503 before per-request configuration checks, body parsing, knowledge prompt preparation, orchestration or inference. Valid text, malformed JSON and caller-supplied authority claims are not ways around the boundary. It creates no allowance or customer price. [public-assistant-guard, assistant-local-evidence]

The separate admitted app text route still requires authenticated user/workspace context, policy and request checks, reservation through `admitAIText`, and one-use `generateTextWithAdmission`. It was not changed by the website containment. Its own credit, model, access and unknown-usage conditions still apply; this guide does not certify useful qualified quotes, every AI caller or current account access. [admitted-app-ai, assistant-local-evidence]

**Example:** The website assistant returns `ai.public_admission_unavailable`. This is not the same as an app workspace running out of credit. Do not repeatedly submit the prompt, add a tenant ID to the request or switch providers. Documentation remains the suggested help path; no paid public AI offer or automatic fallback is authorized. [public-assistant-guard, admitted-app-ai]

## Safe support handoff and remaining gates

Record only the exact code/status, feature, version and an existing safe correlation/reference if the interface actually supplies one. Do not invent a reference or send passwords, access tokens, private prompts, unredacted repository screenshots or customer records. Use the supported help flow and its privacy guidance; no new message is authorized or sent by this guide.

Useful live discovery still needs verified current workspace membership, installation/repository source binding, bounded read permissions, revocation checks and actual accepted readback. Public AI still needs an explicitly reviewed identity/funding policy, conservative request admission and limits, unknown-cost reconciliation, abuse controls and qualified support knowledge. Existing independent human approvals and uncertain attempt histories must be preserved. None of these is replaced by a configuration switch, an internal source hash or these negative tests. [github-local-evidence, assistant-local-evidence]

Local evidence is bounded: GitHub isolation/mode/auth tests use synthetic external ports; the public assistant also has a compiled-userland refusal smoke with 14 direct invocations under network/write denial. The latter is not an HTTP server, browser, real AI, native issuer or production test. The ordinary web build passed without qualifying executing issuer/custody/Governance. No live provider validation, authentic screenshots, customer editorial/retrieval eligibility or full parent completion is claimed. [github-local-evidence, assistant-local-evidence, compiled-refusal-evidence, ordinary-build-evidence]
