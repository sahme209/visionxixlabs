# Detached query compatibility implementation plan

Goal: test one explicitly authorized detached derivative, preserving originals and library validation.
Spec: PROPOSAL.md in this directory; user approved the conditional bundle November6.
Architecture: reuse runtime_query_probe descriptor restoration and bounded child supervisor; add a fixed detached-library packet and a narrow MH_DYLIB signature-difference checker. No new dependencies.

1. [x] Add synthetic tests for accepted signature-only changes and refused code/load-command/overlap/malformed changes; implement validate_derivative(before, after) for bounded arm64 MH_DYLIB only.
2. [x] Prepare fixed fresh lab files, source bindings and signing commands. Add mocked failure/once-only/currentness tests. Reuse original candidate restoration through an explicit internal child callback; old packets remain consumed.
3. [x] Independent source and exact packet review, then one signing/static-check/load attempt under approved limits. Record all outcomes; no retries.
4. [ ] Preserve receipts, original hashes, limitations, board and local backup. No issuer qualification or production claim.

Review focus: malicious offsets, unrelated program changes, source/currentness replacement, failure after signing, unknown Node restoration. Actual static signature verification is separate from structural byte comparison. No scope extension to package adoption.

Execution stopped on first signing command: no identity found. No runtime success or full Governance completion. Task4 evidence saved; local bundle backup pending.
