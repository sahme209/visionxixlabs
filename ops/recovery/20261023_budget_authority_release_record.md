# Budget authority production release

Source `69f2b0bc422d077c6d5cbae7d22975137e13186e` is live at visionxixlabs.com as deployment `dpl_HH7fVoC8uZTfFc1Nqnk59Lcbnta5`. Correct project identity, nine candidate checks, explicit promotion, exact apex alias and nine public checks passed.

The exact archived source passed 10,115 tests with zero failures and 150 opt-in skips, root typecheck and production build. All 4,405 tracked hashes remained unchanged. The isolated owned PostgreSQL runner passed 73 cases, including ten actual pipeline budget-authority cases, and verified resource cleanup. Earlier Airflow safeguards remain included.

Caller metadata can tighten a saved budget but cannot raise or waive it. Strict execution reads reject malformed saved restrictions rather than discarding them into a larger or unlimited fallback. Administrator-configured unlimited policy remains supported. These are authority and validation safeguards, not projected-cost or concurrent-spend enforcement.

The unrelated legacy coding/GitHub and approval-artifact draft was excluded. No production DDL, policy-row mutation, provider inference, payment or installer publication occurred for this release. Cockpit design is unchanged. Public checks verify routing/authentication refusal and canonical callbacks; they do not prove authenticated purchases, roles or third-party authorization.
