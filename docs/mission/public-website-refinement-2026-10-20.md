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
