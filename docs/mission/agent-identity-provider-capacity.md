# Agent recovery rehearsal — provider capacity blocker

Checked 2026-10-23 at approximately 02:28 UTC. The user approved up to $5 for temporary recovery resources and their cleanup; no plan upgrade, production SQL, permission grants or paid AI calls were approved.

- New historical snapshot request: HTTP 422, `snapshots limit exceeded`.
- Existing snapshot preserved: `snap-falling-wildflower-aif6heir`, created 2026-10-22T02:55:18Z from the inspected main branch. Its existence is verified; its restorability is not yet verified.
- Restore of that existing snapshot into a NEW named disposable branch: HTTP 422, `branches limit exceeded`. No existing target branch was supplied.
- Follow-up branch search returned no rehearsal branches. Snapshot listing still contains the same single existing snapshot. Source main remains ready with its production restrictions intact.
- No test SQL ran, no application credentials changed, no production endpoint moved, and no existing branch or backup was deleted. No temporary resource was successfully created; no compute was requested. Actual billing was not independently measured.

The actual-schema rehearsal remains blocked by provider capacity. Next decision: identify an explicitly approved disposable existing branch to remove, or authorize a provider limit/plan change after reviewing its cost. Do not delete arbitrary preview branches or the sole existing backup. The $5 temporary-resource approval does not authorize either action.

After capacity is available: create a recent expiring snapshot, restore only into a new isolated branch, verify exact schema and migration preconditions, apply the unchanged schema-only proposal there, verify empty/disabled/no-tools defaults and unchanged ledger, then clean up only the newly created resources.

Production repair also still needs effective runtime database binding verification, a retained verified recovery point, migration-ledger resolution and exact-target SQL approval. The existing eight PostgreSQL17 synthetic checks passed; this blocked provider rehearsal is not a live Agent acceptance pass.
