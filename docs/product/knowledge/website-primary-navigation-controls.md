# Public website: primary navigation, More, mobile menu and footer

**INTERNAL SOURCE GUIDE — unpublished and customer ineligible.** Owner: Axiom documentation workstream. Author: Codex draft. Human editorial owner: unassigned. Source date: November 5, 2026. Publication/editorial/authentic-media/browser/native/AT/retrieval acceptance remain false. The [source ledger](website-primary-navigation-controls.sources.json) pins `8a80fafb`; documentation IDs are not runtime help attributes or permission keys.

This finite unit covers the shared `Navigation` and `Footer` implementations and their literal destination catalogues. Confirmed mounting examples are Home, Product, the marketing route-group layout and the Docs layout—not proof that every site/account page uses this shell. It preserves the [historical skip-navigation source guide](../../recovery/2026-11-03/marketing-keyboard-bypass/internal-source-guide.md) and [responsive-focus repair](../../recovery/2026-11-04/navigation-resize-focus/README.md). The [global command palette](website-command-controls.md), [Docs navigation](website-docs-navigation-controls.md), account companion/cockpit shells and `SandboxNavigation` are separate scopes. [navigation, footer, home-mount, product-mount, marketing-mount, docs-mount]

## Choose a destination

The five wide-header primary links are **Product**, **Integrations**, **Security**, **Docs** and **Demo**. **More** contains **Pricing**, **Support (account required)**, **Status** and **Company**. The narrow navigation includes those nine destinations plus **Founding Supporters**, and offers Sign in and Download separately. All literal labels and hrefs are retained in the ledger. Link presence does not verify a connected provider, supported capability, current session, price, availability, health or destination response. [navigation]

**Support (account required)** goes to `/account/help`; the selected destination source redirects an unauthenticated visitor to sign-in with that callback. **Founding Supporters** goes to `/support`, a different public destination, not customer help or support-ticket submission. Footer **Contact** goes to `/contact`; opening it does not record a request or send email. Status navigation opens `/status`, not a guarantee of a healthy service. Sign in goes to `/auth/signin`, Download to `/download`; neither navigation signs in, pairs a device, installs an app or grants execution permission. Use the separate [browser sign-in](browser-signin-and-session-controls.md), [download](website-download-controls.md) and [contact](website-contact-controls.md) guides for their next boundaries.

| Documentation ID / control family | Purpose and steps | Result, limits and recovery |
| --- | --- | --- |
| `website.primary.skip` — **Skip to content** | Focus the otherwise visually hidden button, then activate it to bypass repeated header controls. | Closes both menu states, finds the first `main`, adds `tabindex=-1` only if absent and focuses it. No main means no target/focus change after menu closure. It is a button, not a hash link or universal article-section jump. |
| `website.primary.home` — **Vision XIX Labs home** | Opens `/` from the header logo/text. | Requests local menu closure when following the link. This is navigation, not sign-out or cancellation of another action. |
| `website.primary.link` — five wide primary destinations | Choose the relevant Product/Integrations/Security/Docs/Demo route. | Uses the literal route and requests local menu closure; no provider/API action is requested by these handlers. The header does not mark links with `aria-current`; `usePathname` here closes menus rather than proving page availability. |
| `website.primary.more-toggle` — **More** | Click to toggle the four secondary links; ArrowDown from the trigger opens it and focuses its first link (or focuses the first link when already open). | Exposes `aria-expanded`/`aria-controls`. It is a disclosure with a `role=group`, not a full ARIA menu with roving selection or a focus trap. |
| `website.primary.more-link` — four secondary destinations | Choose Pricing, account-required Support, Status or Company. | Requests closure of both local menu states when following the link; state commit is not a guaranteed prerequisite to navigation. Account/provider access remains separately checked at the destination. |
| `website.primary.signin-wide` — **Sign in** | Opens `/auth/signin` in the wide header. | No session lookup or account-aware substitution is performed by this component; a visible sign-in label is not proof that the browser is signed out. |
| `website.primary.download-wide` — **Download** | Opens `/download` in the wide header. | Link navigation does not download/verify a particular artifact. |
| `website.primary.mobile-open` — **Open navigation menu** | At narrow widths, opens the full-screen navigation and closes More. | Exposes expanded/control state; its bar becomes inert/aria-hidden while the dialog is open. The visible narrow trigger is not a second close button inside the dialog. |
| `website.primary.mobile-close` — **Close navigation menu / Close** | Closes the narrow dialog explicitly. | Schedules focus back to the trigger. This does not navigate or submit an action. Real browser/viewport focus acceptance remains separate. |
| `website.primary.mobile-link` — ten narrow destinations | Choose a listed page in the dialog. | Requests closure of both local menu states when following the link. The source keeps catalogue order; it is not a search or authenticated capability list. |
| `website.primary.signin-mobile` — **Sign in** | Opens the same browser sign-in route from the dialog. | Requests local menu closure. No identity/provider consent is completed by this link. |
| `website.primary.download-mobile` — **Download** | Opens the same download route from the dialog. | Requests local menu closure. No installer/runtime verification is implied. |
| `website.footer.explore` — **Explore Axiom** | Footer call-to-action opens `/product`. | Navigation only; no operational pipeline or AI call starts. |
| `website.footer.supporters` — **Founding Supporters** | Footer call-to-action opens `/support`. | Not a customer-support form, purchase acknowledgement, active subscription or grant. |
| `website.footer.home` — logo/text home link | Opens `/` from the footer. | Uses the public home route; it is not browser sign-out. |
| `website.footer.column-link` — Product/Company/Legal column links | Choose the labelled product, company or legal destination. | Fifteen literal catalogue records: Security appears twice within the columns; Founding Supporters also appears separately as a CTA. Repeated links are not unique routes or new permissions. There is no footer input, form, newsletter submission, accordion or mutable consent control in this component. |

Source keys: `navigation`, `footer`, `account-help-destination`, and the finite destination-presence records in the ledger. The footer's current-year text and **Production access is service-verified. Demonstrations are clearly labeled.** sentence are rendered copy, not a current service read, verified entitlement receipt or blanket qualification of every demo.

## Wide More disclosure: focus and dismissal

More is in the source's `xl` desktop group; resize handlers use 1280 pixels as the mode boundary. Click opens without an automatic first-link focus move. Only the trigger's ArrowDown sets that focus request. Normal Tab navigation remains native; no Up/Down result cycling, Home/End menu behavior or focus trapping is implemented. [navigation]

While open, document pointerdown outside the More wrapper closes it. Blur leaving that wrapper also closes it. These paths do not promise to restore focus to More; they can preserve the user's newly chosen external focus. Document Escape prevents that key's default action, closes More and focuses its trigger. It does not stop propagation or establish sole ownership over other listeners. No composition-state guard is present in these selected navigation key handlers; do not transfer the command palette's separate IME acceptance to this component.

Shrinking below 1280 while More is open closes it; if its wrapper owned focus, a later effect focuses the home link. This conditional recovery is not a guarantee that every closed-menu header control's focus survives every breakpoint. A pathname change closes both menu states; a hash-only/query-only change is not a pathname change. No general route-focus restoration is provided by that closure effect.

## Narrow dialog: focus, scroll and outside behavior

The mobile dialog has `role=dialog`, `aria-modal=true` and a fixed full-screen container. Opening captures body/root overflow values, sets both to hidden, installs key/pointer/resize listeners and schedules focus to the dialog's first button (Close). The header bar is inert and hidden to accessibility APIs while open; this is not proof that the entire page outside the dialog is inert. [navigation]

Ordinary Escape closes and schedules focus back to the trigger; this handler does not prevent the Escape default or stop propagation. Tab from the last selected focusable wraps to the first; Shift+Tab from the first wraps to the last. It does not implement a general `focusin` recovery mechanism for arbitrary programmatic focus outside the dialog. No native/browser/AT/composition acceptance is inferred from these finite handlers.

Pointerdown outside both dialog and trigger closes the menu, without the explicit close helper's trigger-focus scheduling. There is **no separate backdrop button**: the dialog itself fills the viewport, and blank space inside its container counts as inside, not a guaranteed outside-click dismissal. Link handlers request menu closure when followed; the source does not guarantee React commits that state before navigation. Closing/cleanup restores the previous body/root overflow and removes listeners; it does not cancel another page's network/provider work.

When resized to 1280 or wider while open, the menu closes and releases its locks. If the dialog owned focus, the post-state effect moves focus to the home link instead of the now-hidden trigger. Otherwise external focus is not deliberately moved. The resize effect runs only for the open dialog; this is not complete cross-breakpoint focus qualification.

## Scroll presentation and destination scope

The header listens passively for page scroll and changes its height/border/background styling when `scrollY > 8`. It does not introduce smooth scrolling or defer navigation until an animation finishes. These source styles are not measured contrast, motion, responsive or performance acceptance. The footer has responsive grid/stack classes; it does not contain a hidden mobile navigation implementation. [navigation, footer]

The ledger maps every selected catalogue/fixed link to a source destination file at the pinned revision, including the account-required help route. This establishes source presence only—not HTTP status, authentication/entitlement, current external state, legal/editorial approval or published artifact identity. Confirmed mount examples do not imply the same header/footer appears on sign-in, every account/control page, every error state or every route. Other page-specific controls and body links remain outside this unit.

## Finite closure and remaining acceptance

- [x] Sixteen documentation families cover the two shared components' skip/home/desktop links/More/sign-in/download/mobile controls and footer CTA/home/column links.
- [x] The five primary/four secondary catalogues, ten derived mobile entries and fifteen footer-column records retain exact labels/hrefs in the ledger, with fixed sign-in/download/home/CTA links separately bound. Overlapping catalogues are not unique-route counts.
- [x] Open/closed, viewport-dependent visibility, path change, scroll, focus entry/return, Tab boundaries, Escape, outside/blur and cleanup behavior are described with their source limits.
- [ ] Genuine editorial/customer/media/browser/OSIME/keyboard/AT/mobile/desktop/contrast/motion/performance acceptance and deployed-version/destination readback remain open.

Existing source guides and runtime metadata are unchanged; this unit adds only internal documentation/evidence. Product code, literal destinations and external state are unchanged. No tests, build, browser, credential/authentication, provider/API/DB/native/Security operation or network request was executed for this guide. It is shared-navigation source documentation, not all website controls/B4/B5, complete accessibility or core Governance completion.
