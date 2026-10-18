# Repository catalog recovery

The installed app's GitHub repositories workspace offers **Refresh connected
repositories** beside the connected repository selector. It repeats the existing
current-credential GitHub catalog read without remounting the workspace. This is
separate from **Refresh**, which only reads repositories in the local folder.

Use this action after a temporary catalog failure or after validating GitHub in
Settings → Integrations. It preserves the selected local repository, unsaved
editor draft and manual clone entry. It does not clone, mint a token, save files,
or grant repository access. A connected selection is retained only while present
in the refreshed catalog; otherwise the selector and clone target both fall back
to a returned repository, or clear with Clone disabled when none remain. Manual
entry is unaffected. Clone authorization remains checked by the service.

Initial loading and retries share one loader. A mounted-session, config identity,
context revision and request generation fence prevents superseded reads and late
success/failure responses from prior credentials from replacing current catalog
options or errors. Native filesystem and real provider acceptance remain separate.

Focused component evidence: recovery from a failed initial read without remount,
blank and populated manual-entry preservation alongside unsaved drafts,
superseded and prior-credential success/service-error/rejection responses, and
local Refresh causing no additional GitHub read. No production login or native
acceptance is inferred from mocked component tests.
