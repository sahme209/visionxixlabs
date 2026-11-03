# Approved local website browse batch

User approved docs/product/axiom-website-information-architecture.md November3.
Navigation/Footer, Docs landing and public catalog sources are implemented and
independently reviewed. Raw focused logs: /private/tmp/axiom-website-navigation-ia-
{red,green,types}.log (11tests/3files); /private/tmp/axiom-docs-landing-
{red,green,types}.log (3 rendered tests); /private/tmp/axiom-public-catalog-
{red,green,types}.log (4 rendered tests). Source tests use jsdom, mocked pathname
and ordinary anchors; no provider or actual authentication acceptance.

Planned cards have no setup link. All enabled catalog links use existing public
guides/scope pages, not OAuth or API actions. Job/availability/operation filters
are intersected metadata models, never access decisions. Empty results/reset and
announced counts are tested. Global integrationRegistry and account flows unchanged.
Docs sidebar/layout/feedback retained. Navigation preserves Escape/focus return,
mobile scroll/focus/resize cleanup and adds explicit More disclosure keyboard
access. Footer review omission of Contact was caught/fixed before final review.

No full build or production/interactive acceptance is claimed yet. Root batches
one actual isolated build next; existing private066d/source preview is preserved.
