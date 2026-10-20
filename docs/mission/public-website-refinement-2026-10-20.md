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
