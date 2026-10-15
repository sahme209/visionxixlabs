# Legacy cloud controls and scoped enrollment authority

The existing autopilot mode API authenticated a plan-eligible session but did not
establish durable membership in the selected account's workspace. A supplied
organization ID could therefore substitute for actual tenant authority. The
read path could also return another account's mode/events. This source fix does
not prove that the currently serving website has received it.

GET now loads the selected account and confirms current accepted membership in
its actual organization before mode/event access. PUT preserves the existing
session/plan gate, additionally checks same origin and accepted owner/admin
membership, and treats the supplied organization ID only as a consistency check.
Missing, pending/revoked, unsupported-role or unreadable membership denies before
read/mutation; unauthorized account responses do not reveal cross-tenant
existence. Malformed JSON is rejected without a write. Existing authorized legacy
admin behavior remains covered by positive tests.

## New credential namespace is not a legacy execution capability

New enrollment creates `cloud-v2:` account references with generic scanning
turned off. That initial flag alone is insufficient because old enable and
mode controls also address canonical CloudAccount rows. The legacy enable route
therefore refuses enabling that namespace, while pause remains available. Its
conditional enable write also binds the observed reference. Autopilot escalation
above observe_only is refused. Both direct and queued scanner boundaries reject
the namespace before preferences, snapshots or legacy credential resolution,
including the queued cached-snapshot shortcut, even if storage is forcibly enabled.

Only the new tenant-scoped, explicitly bounded inventory reader supports these
credentials. No generic Agent bridge, new apply authority or provider operation
is introduced. Existing legacy dispatch/cache behavior remains tested.

## Evidence and limits

`lib/axiom/agent/__tests__/cloudV2Containment.test.ts` covers the real route/scanner
boundaries over simulated repositories and providers, including tenant spoofing,
role changes, origin/malformed requests, forced enabling, cached queued results,
legacy dispatch and authorized positive cases. Actual provider and deployed
acceptance remain outstanding. This is not a complete review of legacy
scheduler/approval policy concurrency or all cloud mutation surfaces.

The two touched legacy scanner files contain unchanged pre-existing lint debt:
26 explicit-any errors and eight unused-variable warnings. The recorded baseline
comparison in `docs/mission/aws-legacy-lint-baseline.json` confirms no additional
violations; no lint configuration or suppression was added. New feature/API/test
files pass lint separately. Avoid unrelated type refactoring inside this security
boundary change.
