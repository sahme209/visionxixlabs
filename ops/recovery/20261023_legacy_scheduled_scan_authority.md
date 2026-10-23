# Legacy scheduled scan authority hardening

The legacy cron previously accepted an absent CRON_SECRET, selected an organization-level Lead credential without checking the scheduled cloud account, and counted a null scan persistence result as success. Eight initial focused regressions reproduced those defects.

The tick now requires its cron secret; binds legacy AWS credentials to the current enabled tenant account and matching account/role identity; refuses modern credential pointers rather than falling back to legacy credentials; captures and rechecks the Lead credential revision and owner binding; validates revision timestamps; and rechecks account/schedule authority before inventory. A version-scoped seven-minute lease prevents two ticks that loaded the same due revision from both dispatching. A crashed attempt can become due again after expiry; this is not a promise of exactly-once provider execution beyond that lease.

Result/failure writes target the claimed version and never re-enable a schedule paused concurrently. Wrong observed inventory identity and null persistence cannot become scan.success. Manual scans now prepare only a paused schedule; separate explicit activation requires a stable signed-in identity, same origin and current accepted owner/admin membership inside a Serializable transaction. The mutation refuses missing/disabled/modern accounts, uses tenant/version-scoped writes and returns only to its fixed local page.

Twenty-three cron and thirteen toggle fixture tests pass. Actual isolated PostgreSQL verified the initial run rollback, paused draft creation, overlapping tick lease, pause during provider read and failed-persistence retry (100 combined cases at the first verification). Four further actual PostgreSQL cases verify accepted-admin activation, deletion/downgrade refusal despite cached owner context, and modern-connection containment: 104 combined cases passed with owned-cluster cleanup.

This does not make local revocation atomic with a remote read, restore absent legacy tables, add provider access or prove hosted cloud acceptance. No customer cloud request or production database mutation occurred in these regression suites.
