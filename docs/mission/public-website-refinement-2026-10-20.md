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
