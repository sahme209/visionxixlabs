# v0.1.22 authorized retry

The user approved one failed-job retry within the original $2 additional allowance, with no automatic further retry or budget increase. GitHub budget UI confirmed both account and repository Actions usage $0.00 / $12.00. No budget settings were changed. Attempt 1 timing API reported zero billable milliseconds; the old monitor estimate counted skipped jobs and is superseded.

- Same run: 41224761240, attempt 2.
- Same source: 0f82571b888ca9d47c203a878456189ddf01d9f5.
- Same tag: desktop-v0.1.22. No retag or new run.
- Retry launched once using failed-job rerun after availability confirmation.
- Owned observer: /private/tmp/axiom-v122-attempt2-watch.py; terminal session 4853.
- Receipt: /private/tmp/axiom-v122-attempt2-receipt.json; log: /private/tmp/axiom-v122-attempt2-watch.log.
- Monitor excludes skipped/unassigned jobs and reads attempt 2 only. Estimated-compute cancellation threshold $1.72 reserves storage/publication headroom under $2; estimates are not invoices.
- Restore draft export readiness OFF and remove the source whitelist after terminal export/failure. Never automatically rerun.
- Candidate creation is not public publication. Exact assets/source/signatures must be verified; final protected publisher approval must be personally performed by the user.

The original retry approval is consumed. No new Vercel deployment, provider write, credential, grant, schema or spending-cap change is authorized.

## Final result

Attempt 2 completed: identity validation, SBOM, Windows and Linux succeeded; both Macs failed at the reproduced native Swift availability check. No draft export or publication occurred. Successful artifacts were downloaded and hashed locally before their three-day retention expires. Estimated compute is $0.93, not a settled invoice. The timing endpoint returned zero durations even for real completed jobs, so it is not used as proof of free usage. Draft export readiness is OFF and its exact-source whitelist is removed. The one retry authorization is consumed; no further run started. See v122-attempt2-result.json and v122-macos-availability-repair.md.
