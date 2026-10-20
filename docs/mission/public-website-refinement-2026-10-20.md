# Public website refinement — 2026-10-20

Work in progress on the existing public surfaces, following the owner’s supplied
charcoal/neutral, restrained-orange direction. Homepage and product now center
the existing interactive workflow stories rather than scenic promotional art.
Shared navigation and footer are more compact; plans and Support XCM retain
their existing checkout and inquiry components. No new payment system exists.

Desktop navigation IDs and labels are extracted unchanged into a runtime-free
shared module. The desktop retains its icons and controls; the website uses
the same labels in an explicitly illustrated, non-operational frame. Direct
import of the desktop React component was rejected after web type checking
found independent React type declarations.

Validation so far: 58 focused website/navigation/pricing/support tests passed;
an additional frame/view-switch regression passed in the 12-case story suite;
50 desktop first-run/action contracts passed. Scoped lint and diff checks pass.
Web production-source and separate desktop type checks passed. The combined
focused run passed 109 tests across ten files. Independent review found a tablet
navigation-height mismatch; bar heights now share the xl menu breakpoint, and
the four navigation regression cases pass. Full root test-source compilation
with the two independently cached React trees produced a React declaration
conflict; clean CI remains necessary. Rendered desktop/mobile acceptance and
exact-head CI remain merge gates. No rendered acceptance is claimed.

The isolated browser fixture has a separately prepared output-containment
correction and managed-environment preservation commits. Those must be reviewed
and integrated together before another browser window. No guard relaxation or
old output cleanup is authorized merely to obtain screenshots.

No deployment, database change, secret change, live billing change or installer
release is included. The separately approved Google-login hotfix is serving;
the owner confirmed Google login works. This does not establish password,
GitHub, founder workspace or native pairing acceptance.


## Integrated browser attempt and continuing scope

At source `786a990a9db179714b69ff415f6a79b5f33cb156`, one fresh manifest-bound
local browser attempt reached the guarded server, but failed with
`website_driver_operation_timeout` before any DOM readiness wait was recorded.
No screenshots or interaction evidence were produced. The runtime log confirms
the private owned tsconfig was effective; the initial homepage response took
14.3 seconds. The exact timed-out CDP operation remains unattributed, so this
is not evidence of a hydration defect. External fonts were denied and fell
back as designed. No application guard or deadline was relaxed.

Cleanup failed closed when executable metadata disappeared during inspection
of one relevant process. Artifacts were retained. A subsequent read-only check
confirmed all four exact owned groups empty; this does not retroactively
certify the initial cleanup observation. No unrelated process was signalled.

Integration-catalog and demo-index presentation are also refined locally: only
style classes changed, with inventory states, copy, links and actions preserved.
Permission summaries wrap and setup links have a 44px minimum height. Their
73 focused tests, TSX parsing, non-style source comparison and diff checks pass.
Rendered responsive acceptance remains open for all changed surfaces.

Clean-install GitHub type checking at `786a990a` passed, demonstrating that the
local dual-cache React declaration conflict was not a clean CI failure. The
automated Vercel Agent review passed with zero suggestions; that is a source
review, not a deployment or product acceptance result. Full CI and rendered
acceptance remain required before merge.

The first full CI suite at `786a990a` passed 8,179 tests and failed three
source-text assertions in the two older public-presentation contracts. They
still expected the retired headline, 1400px grid and lg navigation breakpoint.
Those assertions now follow the approved shared 1280px/xl design and single
scripted hero; all 11 tests in the affected files pass locally. This is a
correction to stale presentation expectations, not a waiver of browser or CI
acceptance. Final exact-head CI must rerun after the batched follow-up.


## Download and responsive-navigation implementation continuation

The download page now shares the compact charcoal/1280px presentation and removes
scenic mock operational windows. Manifest retrieval and download resolver mappings remain intact; runtime-readiness
gates are strengthened as described below. Unconditional macOS
signing/notarization and checksum availability claims are removed. Each available
installer now reports its own manifest signing status; only explicit boolean
`true` supports a positive label. These are release-record statements, not
independent cryptographic/signing acceptance. No installer was published.

New rendered-component regressions reproduced the unconditional claim and
truthy malformed metadata before correction. Loading, failed manifest, mixed
platform signing, missing notarization and runtime-disabled resolver behavior
now pass. Focused download/mobile/release/desktop first-run checks passed 35
tests. The responsive navigation regression reproduced a hidden open dialog
retaining both scroll locks after crossing 1280px. The fix closes the dialog at
the same xl breakpoint and restores both prior overflow values; the 1279px
case remains open. Combined navigation/download presentation checks pass 22
tests. Scoped lint and web production-source TypeScript passed during this
continuation; final exact-source CI remains required.

Read-only production checks confirm visionxixlabs.com still serves the approved
Google-login hotfix. The latest-hour grouped P2022 log query returned no groups;
that is not proof of successful authentication. Anonymous endpoint checks from
this environment failed DNS resolution (EAI_AGAIN) without reaching production.
Google remains owner-confirmed; password/GitHub/account-workspace/native pairing
and database recovery remain separate unverified gates. No protected account or
desktop-session GET was used as a purported read-only probe: those routes can
bootstrap membership or update last-seen records.

The local browser blocker remains the known Page.navigate operation timeout,
with no screenshots. A bounded no-server executor probe completed normally, but
does not establish reliable long-lived supervisor/browser acceptance. No new
application runtime window, guard widening or deployment is part of this
continuation.

Additional download regressions reproduced two real integration defects before
correction: a malformed string readiness value allowed the primary button to
use a direct artifact URL, and Intel installation guidance was omitted while
the card showed only the first Apple Silicon asset's notice. Readiness now
requires explicit boolean true for the primary action and status; every
installer displays its own installation notice. Malformed/unready responses
retain resolver links and no download attributes. The seven-file focused
acceptance run passes 46 tests.

All four checks on e9e8a60a completed successfully, including both full test and
production-build jobs, native/frontend security checks and automated review.
This is source validation for that head; the current follow-up still needs its
own exact-head CI and rendered browser acceptance. The serving deployment was
independently re-read as READY, production target and approved commit
30d6363a01e04c35871025c161f69480244d7d17. No production deployment occurred.

Mac installer selection now asks the visitor to choose rather than inferring
Intel architecture from `navigator.platform` containing `MacIntel`. Browser
platform strings are not reliable CPU evidence (see
https://developer.mozilla.org/en-US/docs/Web/API/Navigator/platform). Both Mac
resolver links remain available, and Windows/Linux OS selection is unchanged.
The added rendered-component regression failed before this correction; all 17
download/mobile/release tests pass afterward. This does not verify an installer
or native installation.

## Browser CI and signed-in companion continuation

The isolated job now passes runtime metadata and clean immutable-source binding.
Its first actual CI window on `6ff58f59` failed capture, retained zero images and
reported failed/unverified owned cleanup despite unchanged source. See run
[39431463848](https://github.com/sahme209/visionxixlabs/actions/runs/39431463848).
The job stopped its ephemeral container; that is not a successful owned cleanup
receipt. The root cause remains unknown. A closed-field diagnostic extension
retains failure/cleanup enums and existing bounded DOM readiness observations,
without exposing raw logs or changing request rules, limits or cleanup authority.
No merge, UI acceptance or production release is claimed from that run.

Independent website work removed the signed-in overview's unconditional
“Pilot workspace” and “No-charge pilot” claims. It now distinguishes authenticated
identity from workspace/action permission, links to the existing authoritative
usage/billing page and labels the download destination accurately. No additional
database read, subscription mapping, entitlement mutation or checkout path was
introduced. Existing authentication guards and integration notices are preserved.

The next CI run (`faa49d5b`, run 39432735364) reports a browser evaluation
failure during homepage playback readiness. Its last successful DOM observation
was complete/visible with the tour and disabled Play button present, while the
browser reported reduced motion off. This is a previous-poll observation, not a
same-poll exception explanation or proof of a hydration defect. Cleanup remained
unverified with an unclassified error. Browser acceptance remains failed.

The dashboard continuation removes fabricated onboarding milestones previously
inferred from a linked cloud. Completed-scan hints now require a valid summary
scan timestamp, never connection presence; they do not assert clean results or
saved snapshots. HTTP, envelope, migration-pending and network failures clear
old summary data and show unavailable status. Eight actual rendered-component
regressions pass using mocked transport; backend schema, connector behavior,
authentication and cloud execution are unchanged. This is not a connected-cloud
or full customer journey acceptance receipt.

## Retained browser evidence and download recovery continuation

Run [39436295361](https://github.com/sahme209/visionxixlabs/actions/runs/39436295361)
on `95e653f8` retains the actual 1200×923 homepage document screenshot and
proves owned process groups empty after cleanup. Human inspection confirms the
styled preview renders, with scripted/sample labels. Playback still times out:
the complete, visible document has a disabled Play control despite reduced
motion being off. Ten Script requests were allowed, none denied, with zero
observed runtime exceptions. These facts do not establish the cause or prove
interactive acceptance. Script-resource timing counts are not a one-to-one
delivery ledger; no request permissions or timeouts are widened on that basis.

Download response handling now rejects unusable success/error envelopes rather
than leaving an indefinite loading state or rendering without an assets map.
Four rendered regressions reproduced the old loading/crash behavior before the
correction. Existing resolver fallbacks and explicit runtime-readiness gates
remain in place; no release, payment, authentication or production changes are
included. Independent source review found no material issues. Test results are
recorded separately from browser/native acceptance.

The twelve download presentation tests pass after correction (an initial
concurrent validation attempt exceeded two existing test timeouts; sequential
verification passes without changing timeout values). The integrated proxy
delivery/collector tests pass32 cases, with scoped lint and independent source
review. They preserve all request policies and existing limits. Exact-head
`95e653f8` CI has now passed the full types/tests/auth-evidence/production-build
job and desktop checks. Its browser failure remains a merge gate; later source
requires fresh exact-head CI rather than inheriting those results.

Combined follow-up validation passes104 tests across six files, covering release
response recovery, collector/transport integration, managed controls, operation
diagnostics and request-interception ordering. Scoped lint, syntax and tracker
validation pass. These are source-level checks, not a browser success receipt.

Checkout return context now has bounded informational notices: canonical billing
accepts only scalar `billing=success`, after its existing authentication guard;
plans accepts only scalar `checkout=canceled`. Both explicitly treat the URL as
untrusted context, never payment, cancellation or entitlement evidence. Existing
subscription/allowance reads and checkout handlers remain authoritative and
unchanged; the pricing notice links to the existing workspace billing view.
Targeted rendered tests first failed exactly the two missing notices while 37
other cases passed. Final validation results are recorded with this follow-up;
no hosted checkout, financial mutation or production acceptance is implied.
Final direct-executable validation passed 39 rendered tests across the two existing
page suites, plus scoped ESLint and whitespace checks. An intervening npm-exec
run suffered seven 5-second harness timeouts under environment contention; the
unchanged tests passed with direct Node invocation and no deadline relaxation.

Exact-head `9f677016` passed ordinary typechecking and the test suite, but the
production build's generated Next page-props contract rejected the billing
page's optional/default argument. The page now uses the normal required props
argument, and direct component tests pass `{}` explicitly. Both page suites
pass39 cases after correction; fresh production-build CI remains required.
Its isolated browser run39440799840 timed out with all three bootstrap markers
true and no predicate exception, proving the missing-control observation race
was corrected while leaving the later hydration/playback failure unresolved.
There were no upstream timeouts and owned groups were empty. No policy or
deadline is widened; the next observation distinguishes actual chunk delivery
and React-caught console errors using existing event surfaces only.

Run39442869941 onb7075d4d records completed2xxJavaScript delivery in every
fixed required chunk category and zero console errors; the earlier layout
response cancellation cannot by itself establish a current missing chunk.
The pinned development framework enables a WebSocket-backed Flight debug
channel, while this fixture intentionally denies HMR. The actual installed
decoder regression demonstrates a root waiting for an unresolved debug
reference until that stream provides data. Both verified fixture config paths
now disable only that unsupported debug channel; ordinary production config
and all network/process/ownership/deadline controls remain unchanged.

Root validation passes36 tests, with the existing real config-loader test
initially blocked by subprocess EPERM. Its exact local-only rerun passes and
now explicitly verifies both fixture reloads set false while ordinary config
retains the original true default. Imported-test types, scoped lint and
independent source review pass. This is controlled mechanism/config evidence;
fresh integrated browser acceptance is still required.


Browser continuation checkpoint: exact-head f312968a CI run39444422532 now
passes types, the full test suite, offline authentication recovery checks and
the production website build. Its separate browser job remains failed after
hydration; no merge or release is claimed. Reviewed correction424735a1 uses
instant fixture-only scrolling, finite viewport coordinates and an exact
hit-target check while retaining real CDP mouse events and every acceptance
assertion. Root verification passes45 tests across four files, imported-test
types and scoped lint. The first type invocation used the wrong standalone
module mode and was corrected to ESNext/Bundler; no source relaxation was
needed. Fresh exact-head browser acceptance is required. No deployment ran.


Continuation checkpoint53f66063: full GitHub CI39446921975 passes types,
tests, auth evidence and production website compilation, without deployment.
Browser39446921490 first attempt timed out at initial Page.navigate; one
unchanged failed-job retry passes10of11 closed interaction checks and retains
five desktop/mobile/reduced-motion PNGs. Only documentation_check remains
failed (DOM timeout); no runtime exceptions, source unchanged, owned groups
empty. No repeated retry or merge is authorized by this result. Human image
inspection finds the real first-visit privacy dialog obscures portions of the
preview; future capture must exercise Essential only through real controls,
never hide it or fabricate consent. Documentation navigation remains under
source review; all assertion/deadline/network gates remain.


Reviewed first-visit continuation exercises Essential only through the real named
dialog and CDP pointer controls, then waits for actual dismissal before capture.
New screenshot phase is playback_ready_after_essential_consent; the prior enum
remains historical only. Documentation timeout records exactly three sanitized
booleans and rethrows its original failure. Root35 focused cases, imported-test
types, scoped lint and syntax checks pass after preserving all newer diagnostic
fields during integration. No proxy, header, permission or deadline change.
Desktop CI39446921397 also passes on53f66063. New exact-head full CI/browser
acceptance and clean screenshot inspection remain required before merge.


Exact40f25fa6 browser39449126737 passes actual Essential-only consent and
all ten preceding demo interaction checks, then reaches the existing absolute
120-second driver limit during documentation navigation. Owned groups are empty;
no completed navigation is claimed. Its timeout-only DOM observation is null
because the absolute limit precedes that local wait's timeout. Full CI catches
one stale fixture-order assertion (734 files/8287 tests pass,1test fails); the
assertion now verifies the documented readiness→real consent→dismissal→capture
order, retains all six screenshot names and exception-redaction checks, and the
three focused suites pass34 cases. This is an expected contract update to the
reviewed capture sequence, not suppression of failed product behavior.

Installed Next helpers disprove an earlier untested redirect-count hypothesis:
fully stripped routing headers yield2fake fetches/1redirect, not21. Preserving
all hash inputs yields1/0; partially preserving only Next-Url yields21/21 up to
the actual client's bounded replay limit. This is protocol compatibility proof,
not yet the recorded browser timeout's cause. Any fixture correction must retain
all relevant bounded headers together and preserve existing public-only I/O.


Reviewed proxy correction8e07bbd9 preserves only bounded framework hash inputs,
with exact scalar own-data validation, prefetch1/2/3 and the existing three
public Next-Url paths. Invalid sets refuse atomically; cookies, authorization
and arbitrary headers remain unforwarded. All route/origin/method/process and
time bounds remain. Root84 cases across seven suites pass, with strict imported
types/lint; additional invalid-prefetch0 regression passes in37 focused cases.
Independent root-union review accepts preserved phases, script counters, cleanup
metadata and distinct documentation pre-wait/timeout observations. Actual
integrated browser acceptance remains required; no production fix is inferred.


2ebb292f full CI39450954399 passes all source/test/auth-evidence/build steps.
Its browser39450954502 retains11 preceding successful interactions but fails
actual documentation arrival: both pre-wait and timeout observations show the
product tour still present, docs pathname false, execution section absent.
This establishes the unchanged-page boundary, not its cause; corrected RSC hash
forwarding alone did not restore it. Root-reviewed closed transport categories
now distinguish navigation-shaped RSC, prefetch RSC and document responses,
including bounded status/MIME/completion/cancel/timeout counters and refusals.
No URLs, header values, response bodies or credentials are retained. Root81
focused cases pass plus strict imported-source types with the project's allowJs
semantics and scoped lint; an initial standalone invocation omitted allowJs and
was corrected without relaxing the source contract. A fresh browser run is
required; no production deployment or authorization change is included.
