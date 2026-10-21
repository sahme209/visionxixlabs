# Release validation checkpoint

## Scope and evidence

Main baseline: 0c32b6fdab8de2e4a72c10f22b45cf2fbc5d8e4c. PR #195 remains draft and unmerged at 6a89410d5a142c152b274f39b2adb63ffcd5d197. Its safe new-file creation remains separate from these follow-ups. Test and Desktop CI passed; website acceptance did not.

### Browser startup investigation

Existing run 39524856726 failed during setup with cdp.Page.navigate operation timeout, no script delivery, and no documentation interaction. This is distinct from the older intermittent documentation-click issue. Available evidence cannot determine whether initial application response, proxy delivery or browser acknowledgment stalled. Next app.prepare readiness does not prove that the first page has rendered. No cause is claimed fixed.

Plan: retain all deadlines/request restrictions and add bounded, sanitized homepage proxy counters plus initial navigation/interception/acknowledgment observations. Use a future approved checkpoint to compare stages. No warmup, retry or speculative application changes. Focused diagnostic tests: 96 passed across five files; web TypeScript and JavaScript syntax checks passed. Independent diagnostics review found no blocker (88 focused tests passed). Local full browser acceptance remains blocked by the existing subprocess EPERM restriction; do not bypass it.

### Separate product fixes

- Cancellation: local dad338bb, owned prepare/run/cancel registry with repository/window fences and late-success suppression. Author:128 focused tests, desktop types/build passed. Independent review:54 tests passed, no concrete blocker. Rust compilation and installed process behavior remain unverified; direct-child stop only.
- Direct OpenAI/xAI streaming: local ecce129ed6b7895bafa95885190b087a22a6fa27. Independent review identified buffered SSE events could continue after abort during a suspended yield; the repair added per-event/resumption checks and four regressions. Author:86 focused tests and web TypeScript passed. Independent re-review:30 tests passed, no remaining code blocker. No paid calls or native desktop lane acceptance.

### Stripe TEST read-only audit

The connected Vision XIX Labs TEST account currently exposes three active USD $4.99/month prices associated with products named VisaNova Premium Monthly (complete active-price/product listings). These are unrelated products, not evidence of incorrect Axiom pricing. Do not edit/delete/relabel them. No active Axiom $29/$79 prices were observed in that account; this does not establish which account the application actually uses.

Axiom public catalog intends Free/Pro/Enterprise $0/$29/$79 monthly with the existing approved test-only policy. Checkout resolves STRIPE_PRICE_PRO_MONTHLY and corresponding plan/interval environment bindings, requires authenticated workspace ownership/admin, explicit organization binding and enabled self-service billing. Runtime Stripe credentials are absent here. The actual application's Stripe account, price-ID bindings and webhook destination remain UNVERIFIED. A previously inspected TEST endpoint's event list alone is insufficient to bind it to Axiom. No Stripe writes, checkout sessions or live requests were made.

Next: authorized operator must privately attest TEST account/price/product/currency/interval equality and signed-webhook application destination before real checkout acceptance. No new resources or billing settings are authorized. Existing support checkout remains untouched.

### Remaining gates

See INSTALLED_MAC_ACCEPTANCE.md. Installed-Mac, actual provider streaming/cancellation/accounting, real test checkout, cloud execution and deployment acceptance remain unverified. No Vercel deployment, push, merge, installer publication or production change was performed. New protected pushes require exact owner authorization after local validation and independent review.
