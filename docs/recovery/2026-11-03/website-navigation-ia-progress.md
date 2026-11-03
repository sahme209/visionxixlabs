# Approved local website navigation — implementation receipt

November 3, 2026 · local website IA explicitly approved by the user. No deployment,
provider action, new route, real sign-in, download or consent action occurred.

`components/Navigation.tsx` now presents Product, Integrations, Security, Docs and
Demo as the five primary destinations. Quiet Sign in and Download links retain
`/auth/signin` and `/download`. A deliberate More disclosure contains Pricing,
Support (account required), Status and Company. Support points to existing
`/account/help`; it is not the Founding Supporters destination.

The mobile dialog offers those same destinations plus Founding Supporters. Its
existing Escape/focus-return, Tab trap, desktop-resize cleanup, header geometry and
scroll restoration remain. More supports native button activation and Arrow Down
into its first link, Escape returning focus, natural focus departure, outside
pointer closure and route-change closure. Mobile also closes on outside pointer or
route change. No hover-only interaction is required.

`components/Footer.tsx` includes Docs and clearly distinguishes account-required
Support from Founding Supporters (`/support`), including the latter CTA label.
Existing Contact and legal links are retained; Download is also available in the
Product footer column. Brand treatment and restrained layout are retained.

## Verification

- Genuine initial rendered RED: all four new initial cases failed against the old
  IA: `/private/tmp/axiom-website-navigation-ia-red.log`.
- Final focused run: **11 tests, 3 files passed**, exit 0:
  `/private/tmp/axiom-website-navigation-ia-green.log`. Covers primary/secondary
  links, More keyboard/Escape/outside/route closure, mobile conceptual destinations,
  focus trap/scroll restoration, footer support distinction, existing route files,
  resize cleanup and scroll-elevation geometry.
- Independent review caught the omitted existing Contact footer link; its rendered
  regression failed genuinely at
  `/private/tmp/axiom-website-navigation-footer-review-red.log`. Contact was restored
  alongside account Support, and the existing Download destination was added to
  the footer. The final 11-test/types receipts above include this correction.
- The existing responsive test's removed Contact-link expectation was updated to
  Company; its focus, geometry and scroll assertions were preserved.
- Narrow production/components/test types passed, exit 0:
  `/private/tmp/axiom-website-navigation-ia-types.log`, using
  `work/website-navigation-ia/tsconfig.json` and Node v24.21.0.

Rendered tests use jsdom, a mocked pathname and owned viewport/animation fixtures.
They exercise the actual components but do not prove real browser navigation or
visual acceptance. The mobile link-click test prevents default browser navigation
while checking the actual local close handler. Additional destination/outside-close
coverage followed implementation; the receipt does not claim every final assertion
preceded the code. No full build was run; the parent owns the batched build and
visible preview. Independent whole-batch review is requested separately.
