# Agent worker response privacy repair

The mounted admin/cron worker route exposed raw caught diagnostics in per-job results and its outer500 response. Synthetic actual-handler tests reproduced three marker reflections before changing production source (3failed/4passed); all7passed after the two response literals were fixed. Non-Error outer failures were already safe.

Internal lastError/audit/console diagnostics, admin/cron authorization, status/shape, attempts, successful jobs, known validation and continuation remain unchanged. Scoped strict types rooted at the actual-handler test and its transitive graph exited0; this is not a full project type check or full suite. Empty types.log is backed by exact command/exit evidence and tool chunk24f493.

Independent source/evidence review PASS; root byte parity with frozen actor PASS. No tests were rerun after review/integration because source bytes match. No live leak, provider or real database operation, native Security call, deployment or new full production build is claimed. Existing084 website preview predates this two-literal backend repair.
