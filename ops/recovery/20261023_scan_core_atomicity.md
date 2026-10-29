# Completed scan core atomicity

Two actual owned-PostgreSQL regressions reproduced a completed run surviving a later finding or recommendation insert failure. The caller received null even though the dashboard could still see that partial completed run.

Account upsert, completed run, findings and mapped recommendations now commit in one bounded transaction (5-second lock wait, 30-second transaction deadline). A later core failure rolls back all those rows and account metadata changes. Existing orphan recommendation skip behavior and counts remain unchanged. No provider call occurs inside this transaction.

The legacy approval bridge, paused schedule preparation and outbound notification remain separate best-effort steps. Approval create arguments are collected while writing recommendations and submitted only after the core commits; no new execution plan is invented or approved. Existing legacy stand-in plan references are not repaired by this change and must be reviewed separately before additional legacy storage activation. Notification promise rejection is contained and logged without claiming delivery. This is core atomicity, not a globally atomic scan workflow.

Validation: the original two later-insert regressions failed, then passed. All 109 owned PostgreSQL cases pass with cleanup, including nine scan cases: initial/new/existing account rollback, later finding/recommendation rollback, linked core success, paused manual schedule, unavailable approval bridge, and rejected notification. A separate connection verifies committed finding/recommendation visibility when notification begins. Thirty-six scheduler/activation component cases pass. Model transports and notification transport are synthetic; no AWS, Azure, inference, production SQL, schedule activation or historical backfill was performed.

Keep every Neon branch and private backup. Missing tables and the historical migration ledger remain unchanged. Release still requires the exact source archive checks and deployment gates.
