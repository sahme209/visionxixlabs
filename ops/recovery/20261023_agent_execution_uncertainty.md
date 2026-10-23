# Agent approval execution uncertainty

An unexpected exception after an approval was claimed previously escaped without a recorded execution outcome. The provider might already have accepted a write. The decision handler now records a generic `action_outcome_unknown` result and a conversation warning to inspect the external outcome. The desktop shows the same uncertainty rather than saying the write definitely failed. The existing schema's terminal `failed` status denotes an unsuccessful confirmation, not proof of provider rollback. No automatic retry is added; an already decided proposal remains consumed.

A new regression first failed on the unhandled exception, then passed. It checks generic persisted evidence, no raw exception disclosure, one execution attempt and refusal to reuse the same decision. A desktop component regression checks the warning and removal of the approval button. The three focused suites passed 121 cases. Full exact-source verification is recorded separately; this document does not claim a live provider exception was forced.

Existing distinct-reviewer, current tool-policy, proposal integrity, expiry and tenant checks remain. No tool grant, provider call, production SQL or historical result rewrite is part of this fix. Recovering a provider outcome still requires reading the external system; it must not be inferred from the local error alone.

## Live coding acceptance gate

A real write acceptance needs a separately authorized scratch repository and branch/file, a distinct existing authorized reviewer, a bounded new inference allowance and explicit temporary tools. The two earlier README approvals are consumed. Do not use the public installer release repository as an unapproved write target, modify main/tags/releases, grant permissions, dispatch CI, create credentials or purchase credits under those read-only approvals. The user's direction to proceed authorizes local implementation; these concrete live-test details remain to be settled before execution.
