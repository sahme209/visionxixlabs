# Email verification storage recovery — 2026-10-23

Applied only `20261023_email_verification_storage_only.sql`, SHA-256 `bda50945e6f964f9913e9e1c77d2452fcc3095bf46999c762efb91e210de129d`, to the explicitly bound production Neon project `odd-union-57413470`, branch `br-holy-voice-ai303o8m`, endpoint `ep-small-mountain-ailw0kvt`, database `neondb` (PG17).

## Scope

Restores the nullable User.emailVerifiedAt field and hashed one-time EmailVerificationToken table/indexes/FK expected by existing password-authentication and verification code. It verifies no account, issues no token, changes no password, sends no email and grants no session. Existing OAuth canonical-identity selection remains unchanged. Password accounts still require real mailbox proof; no backfill substitutes for proof.

## Recovery and execution evidence

- Fresh private actual-production read-only custom logical dump: 1,155,703 bytes; SHA-256 `091c750b5a527e587ec715efc39631bb5febff1a74a6f6199430d86b8edcfa32`. Older backups retained; no credentials or backup bytes in the repository.
- Exact script rehearsed on an owned Unix-socket-only PG17 restore. All 136 existing public-table data fingerprints unchanged, comparing preexisting User values while excluding only the newly added nullable field. Empty token storage/no automatic verification/FK verified. Repeat refused and a competing Prisma migration lock refused without schema changes. Owned cluster removed.
- Four actual-Prisma/real verification-route tests passed in that disposable restore, using synthetic users removed afterward: competing claims and replay, rollback on synthetic identity-write failure and same-link recovery, expired proof, and safe desktop pairing navigation. No outbound email/provider calls or sessions created. All old data fingerprints still unchanged after tests.
- Independent review found no SQL blocker. Immediately before execution: role owned User, no applicable custom table default ACL, no enabled DDL event trigger, no active DDL or User transaction. Five-second lock timeout retained for the active User table; no timeout relaxation.
- Eleven intact reviewed statements executed in one Neon transaction with explicit target, installed Prisma advisory key and migration-ledger SHARE lock.

## Live postconditions

Token table exists and had zero rows. All users had null emailVerifiedAt. The field is nullable timestamp without a default; expected table owner, FK, unique hash and expiry indexes are present. A private before/after full-row aggregate fingerprint confirmed all prior User values and row count unchanged, excluding only the newly added field. No customer rows were printed.

The old failed identity migration and missing email migration ledger entry remain unchanged. Migration-history convergence is still required; never replay the unsafe identity permission backfill or use blanket schema synchronization. Delivery by the configured email provider and customer password sign-in are separate acceptance checks, not established by this storage repair.
