# Exact coding-change approval and tenant GitHub boundaries

This increment repairs the legacy `ai_coding` pipeline. It does not grant an Agent additional tools, enable an integration, or assert that real GitHub CI has run.

The successful read records a verified commit identity. Proposal validation and patch application use that immutable base rather than a moving branch. File reads require the current workspace-scoped connection; the platform environment token is never a fallback.

A coding review captures the exact proposal, repository, branch, base commit, source-stage identities, and before/after UTF-8 file contents. It refuses unsafe or sensitive paths, invalid encoding, unsupported patches and oversized evidence. A canonical fingerprint identifies this record. The fingerprint itself grants no authority.

The coding gate atomically stores the frozen review with its pending two-step approval in a serializable transaction. The transaction rechecks source evidence and validation fingerprints and claims only a queued, unbound gate. Capture failure cannot leave a newly orphaned awaiting-approval gate. Existing database approval guards remain in effect. Approval creation retains the best-effort audit entry without logging source contents.

Approval requests echo the displayed fingerprint. Changed, missing or historical unbound reviews cannot approve a repository write. Rejection remains available. The review UI renders escaped full before/after contents, the repository, branch, base commit and fingerprint, and honestly states that structural/assertion checks do not execute the repository's lint or tests.

PR execution requires the current originating member's apply permission, a running tenant-bound run, the successful bound gate, and the approved snapshot with distinct authenticated vote provenance. API-key approval principals are not represented as two human reviewers. The computed patch must match the approved files. Current review authority and the captured installation revision are checked again before each provider operation. This narrows revocation races; it does not make a database and GitHub request an atomic operation.

The Git writer checks the base branch still points to the reviewed commit. Before any write, it traverses complete non-recursive trees from that commit, preserving regular and executable file modes. Symlinks, submodules, directory targets, malformed/truncated metadata and non-directory parents refuse. New regular files use mode 100644. Mode-only changes and new executable-mode requests require a separate supported review workflow. Partial or uncertain provider writes remain explicit failures and must be inspected before retrying; there is no automatic merge or retry.

## Verification boundaries

- Unit and component cases cover artifact integrity, immutable reads, encoding/size/deadline bounds, tenant authority, per-operation rechecks, partial-write reporting, exact review voting, atomic gate dispatch and file modes.
- Seven owned PostgreSQL cases exercise actual capture, serializable mint, two bound votes, guarded stage continuation, approved reload, inert PR transport, stale-review refusal, tampering, role revocation, cancellation, rollback and proposal mutation. The runner also executes the preceding 73 database acceptance cases and removes its private cluster.
- The isolated browser preview uses the real components with labeled synthetic repository data and intercepted responses. It verifies expand/collapse, fingerprint submission, unavailable-review disabling, rejection reason and changed-review error behavior. It is not a real customer approval or GitHub acceptance test.
- A real repository write, repository lint/tests, GitHub CI, paid AI generation, customer authorization and signed installer publication are not established by these tests.
