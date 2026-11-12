# Proposed private target comparison — not authorized/executed

Reason: the one accepted read-only Neon result contradicts the build-3 receipt.
Do not presume the missing tables are on the currently configured Vercel target.

Proposed bounded procedure, only after specific owner approval:

1. One `vercel_filter_project_envs` for project
   `prj_BwKc7V1daPJ938ZW2QKYxZsTkZnp`, team
   `team_j0CEiAAorasdEVQyeAJjpNfm`, `decrypt=false`.
2. Select exactly one production DATABASE_URL through the reviewed helper;
   reject preview/custom-branch ambiguity, missing/changed/duplicate metadata.
3. One `vercel_get_project_env` for only that ID in that project/team.
4. In ephemeral tool orchestration memory, compare only its endpoint/database
   against the exact recorded Neon target. Require unchanged ID and timestamp.
   Return only fixed status/booleans/timestamp. Never print, persist, log or
   commit the value, username/password, connection URL or raw provider error.

Maximum two Vercel calls, no retry, SQL, Neon read, database write, setting change
or deployment. Stop on any ambiguity/error. Private provider/tool traces may
retain the raw responses; explicit owner consent must mention this fact.

This observes current project production configuration, not necessarily the
captured environment of an older deployment. Even a match does not prove the
cause of the historical discrepancy or authorize applying migration SQL.
Seven synthetic tests passed after actual initial missing-module RED; no provider
call has been made. Further review and owner approval remain required.

Independent source review found a missing nondefault-port refusal. A new test reproduced it and passed after exact port matching; related query-level host/port/database overrides, duplicate parameters and non-public schemas now refuse explicitly. Both new cases failed first, then all seven passed. Current/historical environment limitation is unchanged. No provider call occurred.
