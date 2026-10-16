# Current account AI allowance evidence

The canonical `/control/usage-billing` page previously multiplied public catalog
credits by seats even though `reserveAICredits` uses the current legacy account
plan's flat allowance. A three-seat Growth account could display $30 instead of
its $200 current reservation pool. It also omitted unresolved holds and permanent
paid credits. This patch corrects read-side reporting only; it does not migrate
customers to a catalog, change prices, grant access, collect charges or modify
admission/overage policy.

`readCurrentAIAllowance` reads a Repeatable Read snapshot of the raw account tier,
active paid/partially-refunded add-ons, current UTC month's recorded debits and
active reservations. It uses the existing `planForStripeTier` and
`applyAddOnsToEntitlements`, matching reservation queries exactly. Current-month
credits and unrefunded permanent credits apply net of recorded reversals. Expired
unlinked holds are excluded without expiring their rows; linked legacy reserved
and pending-settlement holds count regardless of expiry or month. Missing tables,
failed queries, malformed status or missing/negative/noninteger financial sums
produce unavailable evidence, never a fabricated balance. Genuine null aggregates
remain zero; a genuinely missing account retains the current Starter $25 baseline.

The page labels the result **Included AI allowance remaining**, subtracting both
settled usage and holds. An exhausted included allowance is not a promise that
metered overage is enabled or that a request can execute. Access, configured
request/spending controls, provider readiness and all other existing gates still
apply. Displayed policy is the current reservation policy; public/new-subscription
terms do not silently replace current account allowance. Independent financial
reads remain visible when unrelated membership/history queries fail.

Regression evidence covers the real async server component, Growth flat allowance
versus public seat multiplication, no-plan baseline, net current/permanent add-ons,
used and held amounts, exhausted metered allowance, ledger outages and malformed
financial evidence. A composed regression compares this reader's actual queries
with `reserveAICredits` and asserts that the reader performs no expiry or creation
writes. These simulated IO tests are not real Stripe/Gateway, production billing
or paid-entitlement acceptance. New test-catalog authority and durable recurring
Checkout recovery remain separate workstreams.
