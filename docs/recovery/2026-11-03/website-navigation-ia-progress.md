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

## Actual mobile accessibility finding and correction

The parent's real compiled `ed0ddcd6` preview exposed a Close icon visually in the
outside header, but its native accessibility modal subtree contained only Product
through Download. The focus trap likewise excluded Close. This is an actual browser
finding, not inferred from the rendered tests above.

The corrected source uses a full-viewport mobile dialog with its own header and
visible **Close** button (minimum 44px target) inside the modal. Close receives
initial focus and participates in both directions of the Tab loop. Clicking Close
or pressing Escape returns focus to the opener. The outside header is inert and
aria-hidden while the dialog is open, so it supplies no duplicate accessible Close
or background toggle. Resize, outside-pointer, route and link closure and both
scroll locks retain their cleanup. The prior offset-to-bar geometry check was
purposefully replaced with a full-viewport modal/header check.

Local layering inspection found privacy controls at z90/100 and the AI widget at
z9998/9999. Only while this modal is open, its navigation layer is z10000, covering
those background controls; their consent, storage and interaction logic was not
changed. This source observation still requires the parent's actual browser check.

- Proper old-source RED: temporarily rendered exact HEAD `ed0ddcd6` Navigation with
  the new regression, then restored corrected source. **2 Close-missing failures,
  4 passing controls**, exit 1:
  `/private/tmp/axiom-mobile-navigation-modal-close-red.log`.
- Final corrected rendered tests: **12 passed across 3 files**, exit 0:
  `/private/tmp/axiom-mobile-navigation-modal-close-green.log`.
- Initial attempts stalled reading the workspace Heroicons barrel, with an owned
  worker descriptor open on `ArrowLongRightIcon.js` and no semantic result. The
  owned wrappers/workers were identified, terminated and confirmed absent. Those
  blocked attempts are not the claimed RED. Focused rendered fixtures now simulate
  decorative icon components only; actual navigation markup/state/focus handlers
  remain under test. The parent compiler/browser will use actual icons.
- Ordinary narrow types stalled on an actual workspace
  `ChatBubbleLeftRightIcon.d.ts` read (owned PID36917/FD11); it was stopped rather
  than declared passing. Exact actual Heroicons declarations from the already
  verified source066d offline dependency stage were mapped for type resolution,
  with no fake declaration, changed source import or production configuration.
  That narrow type check **exited 0**:
  `/private/tmp/axiom-mobile-navigation-modal-close-stage-icon-types.log`, config
  `work/website-navigation-ia/tsconfig.stage-icon-types.json`. All other type inputs
  retain their existing resolution.

No full build, preview restart, native action or provider request was performed.
The existing `ed0ddcd6` browser preview does **not** contain this correction. The
parent owns the next batched compiler and real mobile accessibility validation.

Read-only type-input revalidation also compared the actual completed ed0 stage at
`/private/tmp/axiom-website-ed0ddcd6-q9wwqa72/stage`: **all 2,584 Heroicons `.d.ts`
files match source066d stage byte hashes, sizes and modes**. Root/066d/ed0 package
locks are identical, SHA-256
`472bd3b6cabeca9129214fd58f3caf104a973cce0332d2ad3b29d82a8fa86775`;
the same pinned Heroicons 2.2.0 integrity remains. The full declaration-set metadata
hash is `defb8b703cf22d78d75309be30500c9eaa3e3f6e9a7a1cc0fd3079ca20ac6049`.
No type rerun or build was needed for this equivalent-input confirmation.
`work/website-navigation-ia/type-inputs.json` records exact paths, input hashes,
alias configuration and final Navigation hash
`3473fb0356ac40fb04bd58528fa89e51188040f488f556f3468d3f1f134b1baf`.
Independent final source review of this Close correction is **clear**; actual fixed
browser acceptance remains for the parent batch.
