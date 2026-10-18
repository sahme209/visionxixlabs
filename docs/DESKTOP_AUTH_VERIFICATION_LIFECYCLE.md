# Desktop startup and focus verification

The saved-credential check previously allowed overlapping focus requests to
apply out of order. A failed check also asynchronously cleared both credential
stores, even when the failure could be a service/schema/network problem. An
older response could override a newer identity or begin deleting credentials
after a newer sign-in.

The startup/focus coordinator now applies only the latest request for the same
immutable client configuration. `setSession` and `setApiBase` replace that
configuration, including same-token reloads; explicit sign-in, sign-out and
access transitions invalidate outstanding checks. Unmount disposes the
coordinator. No raw credential is logged or exposed by this controller.

An authoritative current failure clears the active transport synchronously,
removes the displayed identity and returns to sign-in. It does not delete secure
vault records. Network failure is not proof that a saved secret is invalid.
Saving credentials still does not grant access: the service must return a valid
verified identity and an explicit access result. Explicit sign-out retains its
existing vault-clearing behavior. Manual API-key and browser-pairing submission
lifecycles remain separate follow-up surfaces; this change covers startup/focus.

Eight deferred-response tests cover older failure/newer success, older
success/newer failure, credential replacement/removal, explicit invalidation,
unmount, missing credentials and sanitized unexpected errors. The existing
first-run contract also checks the coordinator wiring, explicit access gate and
absence of automatic vault-deletion calls in App. These tests do not certify
native keychain behavior, actual OAuth sessions, deep-link acceptance or signed
macOS installation. Production login and founder mapping still require the
protected read-only database preflight followed by approved repair and actual
password/Google/GitHub session checks. No production configuration or data is
changed by this desktop source repair.

Local validation: 540 Vitest files / 5,356 tests; web and desktop TypeScript;
targeted desktop lint; desktop frontend build; 30 Python CLI tests; mission
register validation. Actual native/runtime acceptance remains open.

## Administrator-key recovery candidate

Recovery input is now verified with an explicit request-scoped bearer before any
vault write or active transport change. Invalid format, server rejection and
verification transport failure preserve existing stored credentials. A vault
write failure does not hot-apply the candidate or delete the previous key; actual
OS-vault atomicity still requires native acceptance. Successful verification
keeps commercial access decisions separate, then persists before activation.
Browser sign-in buttons and the recovery Enter shortcut cannot start an alternate
flow while key verification is busy. Browser cancellation/unmount races remain a
separate tracked concern; this change does not claim to resolve them.

Recovery-candidate validation: 545 Vitest files / 5,402 tests passed on the combined
branch, including request-scoped bearer, vault ordering and rendered sign-in
interaction checks. Web/desktop TypeScript, desktop frontend build and all 30
Python CLI tests passed. Native Keychain and actual OAuth/pairing acceptance are
not established by these simulated tests.

Clean web CI follows these component imports into desktop modules. Root development
dependencies therefore pin the existing desktop versions of the Tauri API and
shell JavaScript packages for type resolution. Vitest continues to stub native
calls; no native toolchain, runtime permissions or credential access is added to
web CI, and no source/test compiler exclusion is introduced.

## Local backend pairing protocol rehearsal (2026-10-16)

`scripts/rehearse-local-desktop-pairing-http.mjs` extends the isolated auth HTTP
harness after its real web session and accepted synthetic workspace exist. The
parent supplies only its bounded loopback web request function and synthetic
challenge context; device polling and identity checks use a separate cookie-free
HTTP channel. The module checks pending/device binding, authenticated consent,
approval, single-use consumption, workspace identity, owner session listing and
revocation invalidation. Bearer/session identifiers remain in memory and are not
included in its result.

The module reports commercial access as an **observation**, not entitlement
acceptance. Current source deliberately uses identity-only commercial access;
a no-plan account may therefore report `allowed: true`. Whether to enforce paid
access remains an explicit product/commercial policy decision. This rehearsal
neither changes that policy nor exercises cloud enrollment, deployment, billing
providers or production. Its protocol safety tests use a local test server;
actual application/PostgreSQL acceptance must be recorded separately by running
the parent isolated harness. It proves neither browser consent interaction nor
native deep links, Keychain persistence, installer behavior or production login.

## Connected Agent context selection (2026-10-18)

The existing Agent repository, branch and environment selectors now include
labeled native search fields and a visible selected-context summary. Searches
filter the service-returned catalog, retain the current selection, and report
no matches; a truncated repository catalog explicitly limits search coverage.
Selecting a connected repository retains its server-reported default branch.
No new provider or deployment operation is introduced.

Saved repository/environment preferences are advisory snapshots. Active IDs
start empty; only the current credential's successful catalogs can restore
matching IDs. Failed, missing or foreign saved entries never initiate branch or
file reads. Catalogs load independently and expose a scoped retry, so one
unavailable integration does not disable an independently verified selection.
Retry and credential changes discard late catalog responses. A saved environment
is not cleared by the initial empty render before catalog validation finishes.

Explicit manual repository recovery remains available, visibly labeled as
catalog-unverified. It never restores a cached repository automatically or
claims connected authority; existing server authorization, model readiness and
approval checks still apply. Deploy-readiness guidance requires both an explicit
repository and a selected service-returned environment.

Focused React render/click tests exercise service-returned fixture catalogs,
exact message context, independent failures, retry, saved-preference validation,
manual recovery, truncation and stale credential results. Transport remains
mocked; these tests do not establish real GitHub access, native keyboard/installer
acceptance, provider execution, or production login.

Catalog retry preserves explicit choices: choosing no environment clears the
saved preference instead of resurrecting it later. A selected or manually
entered branch is retained only when the same repository is revalidated;
a different selected repository uses its own default branch. Branch changes
invalidate dependent file selection until the current branch catalog returns.
Independent review reproduced both retry regressions before the fix; actual
component tests now cover explicit empty environment, nondefault/manual branch
continuity and dependent-file invalidation in addition to the initial flows.

## Connected desktop Agent context — reviewed local acceptance (2026-10-18)

The reviewed change `6cc017bf` was normally integrated with main #167
`31d7f3a9`, producing clean validation source `8e08bcd9`. Existing connected
repository/environment controls now support labeled search, current-context
summary and scoped catalog retry. Saved preferences never become active before
current catalogs validate them. Explicit manual repository recovery remains
unverified by the catalog and still requires server authorization. Independent
review reproduced and closed retry regressions involving an explicit empty
environment and a selected/manual branch; branch changes clear dependent files.

All 46 focused component/model/receipt/demo tests passed. On the integrated
source, fresh whole web TypeScript (8192 MiB, incremental disabled, root-only
dependency resolution), default Vitest (642 files / 6,914 tests; one file/six
tests skipped), separate desktop TypeScript/release-alignment/Vite build,
30 Python CLI tests, 16 offline auth-evidence tests, scoped lint and the
18-source/2,112-row mission check passed. No dependency install, Prisma
generation, Next build, server, provider operation or production change ran.
See [the source-bound local receipt](mission/desktop-connected-context-local-acceptance.json).

Component transport remains mocked. These checks do not establish native
installer/keyboard/vault, real GitHub selection, production authentication, paid
entitlement or provider deployment/rollback acceptance. Required clean exact-head
CI and production compilation remain merge gates; existing production blockers
and every other workstream remain active.

## Native repository editor ownership (2026-10-18)

The existing explorer/editor, Git operations and detected checks use actual
registered Tauri commands; this change introduces no terminal or local Agent
execution authority. The native canonical Git-root/path containment and existing
server authorization for short-lived GitHub credentials remain unchanged.

Editor state is now owned by the current immutable credential configuration,
selected repository generation and latest file read. Selecting another repository
clears its predecessor's file/content, status, checks, result and confirmation
immediately. Reversed file/status/check responses cannot repopulate the current
editor. Credential changes remount the entire scoped workspace. Unsaved-change
confirmation and Cancel still preserve the user's draft.

Save and commit bind the exact loaded repository, path and content snapshot before
native invocation. Keyboard Save cannot bypass an in-flight operation. A completed
write marks only its own snapshot saved; edits made while writing remain unsaved.
Late save, verification, branch, remote Git or PR responses cannot update another
context or release a newer operation's busy state. Multi-stage actions recheck
ownership before beginning their next native or remote step. Already-started local
or remote operations may finish in their original repository: navigation does not
promise cancellation, undo, provider rollback or suppression of external effects.

Actual React render/click tests with mocked Tauri/client transport reproduced eight
failures in the previous source, including an A-file response saved into repository
B, before passing with the ownership fix. Existing unsaved-confirmation behavior
remains covered. These tests perform no real file writes, Git operations, checks,
provider calls or native runtime operations. Full compilers/regression and actual
OS installation/filesystem acceptance remain distinct scheduled gates.

The workspace subscribes to the existing DesktopClient context revision, so a
credential/origin change invalidates it without a parent render. Each keyed
session captures its initial configuration immutably and checks both the live
revision and configuration immediately before acting. A queued old-editor event
cannot recapture new credentials and revive an old loaded file. Regression uses
the actual DesktopClient.setSession notification implementation, without an
explicit view rerender; provider methods and native transport remain mocked.

Final integrated local validation passed: 36 focused checks, fresh whole-web and
desktop TypeScript, the default suite (7,138 passing tests; eight skipped), desktop
release/Vite build, 30 Python SDK tests and 16 offline authentication-gate tests.
The mission tracker retains 18 sources and 2,112 requirement rows. An initial
test-only mock return-type inference error was corrected without changing product
behavior or compiler options. See the [source-bound editor receipt](mission/desktop-editor-ownership-local-acceptance.json)
for exact source hashes, validation environment and acceptance limits. These local
checks use mocked native/provider transport; clean exact-head CI and actual native
filesystem/customer acceptance remain separate gates.
