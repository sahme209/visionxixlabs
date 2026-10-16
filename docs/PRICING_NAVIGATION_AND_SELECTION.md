# Pricing navigation and explicit checkout selection

`/plans` remains the canonical pricing page; `/pricing` retains its existing redirect. Desktop navigation, the inherited mobile menu, and the Product footer now expose Pricing. Support Axiom/Founding Supporters routes and payment flows are untouched. No redesign, price, plan entitlement, billing activation, or credential change is included.

Paid plan and billing interval selections survive sign-in as validated `/plans?plan=…&interval=…` navigation state. Unsupported plans, intervals and repeated query values are ignored. Returning from sign-in restores the interval and displays the selection; it never starts checkout. The customer must explicitly choose a plan again.

When the existing self-service gate is enabled, the server-rendered page obtains the current authenticated workspace using `currentContext`. Only the workspace ID and display label cross the client boundary. An unavailable workspace blocks checkout while leaving public pricing readable; signed-out visitors receive a sign-in callback preserving their selection. The explicit checkout POST includes `expectedOrganizationId`, which the billing route must independently compare with its current authenticated workspace before seat counts or provider work. A stale page is rejected rather than silently purchasing for another workspace. The client never retries with a different workspace or follows an old response after its rendered workspace changes.

The `expectedOrganizationId` route validation is a coordinated billing-agent change and must be integrated with this client patch. URL selections and the client workspace are consistency hints, never billing authority. Existing owner/admin authorization and origin/mode/live-billing gates remain backend-enforced.

Behavioral tests render actual desktop/mobile/footer navigation and the pricing page, exercise sign-in selection retention, require a fresh purchase click, inspect the actual bound POST, reject unknown workspace state, and suppress stale redirects. Navigation and restored-selection regressions fail against the original implementation. Providers are mocked: actual production signup/login, recurring Stripe checkout, webhook reconciliation, purchased entitlements and AI credits remain separate customer-journey acceptance requirements. Recurring checkout uncertainty/idempotency and the public-versus-legacy entitlement catalog mismatch are tracked billing blockers; navigation restoration does not resolve them.

Account creation remains desktop-first and requires a pending pairing challenge. Free and preview paid-plan CTAs retain `/download`; this change does not expose an unsupported general website signup path.

Known subscription history is refused before a new Checkout request, including
past-due/canceled records: the current authoritative event consumer cannot replace
a subscription ID, so another charge is not an upgrade or recovery workflow. An
unavailable history read also refuses before financial IO. Four regressions fail
against the previous route. This does not solve different-key concurrent initial
purchases or ambiguous provider responses; durable recurring intent remains
required before activating the new test lane.


Local integrated verification (2026-10-16): 599 files / 6,307 tests, web and
desktop types/build, 30 Python tests, scoped lint, and 293-page production build
passed. An actual loopback production server returned `/plans` 200 with Pricing
navigation and disabled checkout, and redirected `/pricing` to `/plans`; owned
server stopped. No browser payment, real Stripe event or production login is
verified by this check. Exact-head CI is required before merge.

Independent review: existing customer-only bindings are also refused before
seat/provider IO, since creating a new customer would conflict with webhook
ownership. Regression demonstrated the unsafe previous behavior before the fix.
