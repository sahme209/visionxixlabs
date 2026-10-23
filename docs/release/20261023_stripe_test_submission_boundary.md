# Stripe test-only submission boundary

The test-only AI usage settlement job previously checked mode/enablement at entry, then reread STRIPE_SECRET_KEY after awaited reservation work. A configuration rotation during that wait could construct a live-mode client despite the job's test-only contract.

The submission helper now rechecks the complete test-only gate, captures only an sk_test_ credential, loads the SDK, then rechecks mode/enablement and exact credential identity before constructing the client and submitting. Changed authority defers with the durable reservation retained; it does not release uncertain earlier provider capacity, change the retry window, or generate a new idempotency key.

Four inert regressions reproduced the failures before the corresponding checks and passed afterward: live key, mode or enablement change during claim; and test-key rotation during awaited SDK loading. The latter confirms no client was constructed. No actual Stripe account, credential, request, invoice item, payment, configuration or spending limit was changed.

Independent review found no actionable blocker. Production build passed. The final sequential root typecheck and full suite passed: 9,936 tests passed, zero failed, 73 skipped. An earlier parallel run interfered with generated .next types and exceeded one native publication test's existing timeout; those failures are retained in private logs. Checks were rerun sequentially without changing assertions or time limits.

This change does not enable metered billing or establish real customer payment acceptance. The existing test-environment and per-workspace opt-in/cap checks remain mandatory. Revocation after the final durable authority read cannot undo an already dispatched provider request; unknown outcomes remain held for reconciliation.
