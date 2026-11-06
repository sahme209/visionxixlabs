# Conditional artifact null-sink correction and one-run bundle

## Observed prerequisite

The approved, exact deny/control experiment established that the pinned installed Git revision read fails with the exact null-device OS-denial signature under the current file-write policy, and succeeds with only literal /dev/null file-write-data allowed. All other policy text and fixed command inputs were unchanged. This is a source-read startup prerequisite, not full Governance qualification. Previous artifact attempts remain consumed and unchanged.

## Proposed bounded implementation

Prepare/test/review an artifact-only correction: introduce a new StageA packet format requiring a bound nullSink observation; lstat only the fixed /dev/null path, require nonsymlink root-owned character device major3/minor2, and bind its actual device/inode/owner/group/mode/rdev facts. Verify the observation before execution, in child/currentness checks and after results on success AND failure paths. If final integrity cannot be established, preserve the original failure evidence and classify currentness as unknown; never retry or infer a clean device state. Old format packets cannot gain this capability by omission or fallback, and are never rewritten.

Append only `(allow file-write-data (literal "/dev/null"))` to the artifact outer policy after those checks. No directory/device metadata write, general /dev allowance, arbitrary sink parameter, environment bypass or new path grant. Keep original repository/cache/tool/engine/recipe write protections, network denial, exact source joins, no automatic retry and all issuer/runtime/installation refusal flags. Unit tests must cover foreign/missing/changed device evidence, absent legacy field, exact policy delta and existing one-attempt/unknown/currentness guards. Independent source review required.

Prepare a NEW frozen same-authoritative-master source, self-contained byte-verified Lab Git fixture and exact packet; use the same fixed originalNode/npm/Python/cache/engines/acceptedrecipe inputs. Final file-only source/tool/cache-coordinate/device/receipt/packet review must pass. Any failed prerequisite stops; no user credential, trust root, migration or fleet authority is invented.

## Proposed one actual invocation after conditions pass

Then ONE reviewed fixed artifact procedure: one outer sandbox, finite Git source observations/archive, cache-only npm ci(ignore-scripts), matching Prisma format/generate observations, fixed producer compilation and file-only reconciliation. Never execute the emitted producer. First failure stops. Outer390seconds plus existing at-most5seconds owned-child cleanup; active360with20cleanupmargin; offline120/generation120/emission60 bounded by remaining budget.512MiB outer/offline per-file,128MiB generation/emission,64MiB captured-log monitor. No total-disk quota, universal secret-read isolation or descendant-quiescence claim. Preserve all failures/partials/unknowns, exclusive one-use markers and no retry/adoption.

No production/runtime/Governance activation, database/SQL connection, real credentials, signing/Security/Keychain API, image/mount/root/account/service operation, installation, provider/customer action, paidCI/AI, deployment or spending. This is separate from the user's consolidated future production-release intent. Success would qualify only a source-bound offline artifact checkpoint; actual runtime/custody/SAME-consumer/fleet/all mutation coverage remain open.

## Approval boundary

The earlier conditional grant authorized the diagnostic sink allowance only, not an artifact-profile change or another artifact invocation. This new explicit conditional bundle may authorize local implementation/tests/review and one actual run after the frozen manifest passes independent review, avoiding additional procedural checkpoints inside that exact grant. It does not authorize further retries or changing other constraints if the next phase refuses.

Independent evidence/design review PASS: all10saved evidence files match manifest; exact known83-byte denial and41-byte revision control corroborate the report. No remaining critical design finding. Final implementation tests/review must cover failure-path currentness too.
