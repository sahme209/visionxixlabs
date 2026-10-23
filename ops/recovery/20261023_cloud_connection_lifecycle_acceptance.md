# Cloud connection lifecycle acceptance

The repaired cloud enrollment storage is exercised by 13 actual Prisma/PostgreSQL service cases, with provider identity and inventory transports replaced by fixed local fixtures. The portable owned-database runner now executes 93 cases in total and verifies cleanup.

AWS cases cover one-use challenge persistence, disabled observe-only enrollment, tenant-scoped sealed configuration, membership/device revocation after identity validation, concurrent challenge completion, local credential wipe/version increment and pending-challenge expiry, fresh reconnect, and atomic rollback on vault failure. Azure cases cover disabled enrollment/list/disconnect/reconnect, revocation after validation, mismatched provider identity, vault failure, withholding disconnected inventory before decryption, and withholding inventory when the connection changes during its bounded read.

These are real local database transactions, not real AWS/Azure identity, OAuth, IAM/Reader policy, inventory or customer acceptance. No cloud account or credential is created in production by these tests.

The desktop Azure catalog now explicitly shows pending reads, a verified empty response and previously recorded rows after refresh failure. Refresh cannot be duplicated while pending. Unexpected transport rejection produces a safe error rather than an unhandled rejection. A mutation that supersedes a pending list clears its obsolete loading state. Existing credential-context, unmount, StrictMode, revision and suspended-mutation guards are preserved. Three failing UI cases and an unhandled rejection reproduced the missing behavior before the fix; all 13 component cases pass afterward.

Root typecheck and the desktop frontend build passed. Native acceptance and publication status are recorded separately after verification; this record does not establish a signed release installer or completed cloud integration.
