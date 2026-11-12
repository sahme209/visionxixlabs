# Platform template execution and original-session delivery

**Spec:** `docs/recovery/2026-11-12/platform-governance-scope/TEMPLATE-EXECUTION-CUSTODY-PROPOSAL.md` (explicit local approval in its final section).
**Goal:** Complete all three exact template operations, durable typed outcomes and encrypted one-use original-session access delivery, preserving every unknown history and real qualification gate.
**Method:** Existing inline implementation/TDD, one complete three-family independent source review at the end. No per-unit implementer/reviewer loop or new approval checkpoint.

## Global constraints
- Local source/additive local schema, existing scoped crypto with synthetic keys, mocked provider/HTTP/UI and owned isolated PostgreSQL only. No actual key/credential/provider/account/service/grant, signing/install, production SQL/flags/routes/deploy or spending.
- Existing metadata-only access plans stay readable and non-executable; no silent upgrade/backfill/replay. Derive executable recipient metadata from actual requester/user/session, not supplied hashes.
- Canonical bucket/object/access reservation keys exclude action/request/profile/region; access uses actual stable requester user, excluding session/TTL. Bucket/object holds are permanent; unknown access never releases by elapsed time.
- A new access generation requires a durable known expiry and independently qualified old-profile clock/skew evidence. New generation means a fresh plan, review and one attempt.
- No plaintext URL, URL-derived public digest or ciphertext in public history. One-use delivery claims commit before bytes are released, with current authority/expiry/custody/channel checks around awaits. Lost delivery response cannot fetch again.
- Real native/clock/key/host/channel suppliers remain unavailable by default. No local parser, hash or successful synthetic test qualifies them.

## Review focus
- Different UUID/region/session/TTL/profile cannot evade uncertainty for the same physical resource/recipient.
- Receipt/event/target/artifact changes are atomic; unknown acknowledgement yields no output capability.
- Old access plans and caller-declared recipient hashes never gain new execution/delivery authority.
- Context-swapped envelopes, changed object version/generation/requester/session/profile and expired source refuse.
- Issuance, server byte release and client receipt are distinct facts; public history never returns a bearer URL or grants permission.

### Task1: Closed bindings, reservations, receipts and scoped artifact codec
Files: `templateExecutionContract.ts`, `templateLiability.ts`, `templateGrantArtifact.ts`, focused tests.
Interfaces: actual-principal recipient/grant-reference derivation; exact action/effect/plan/source binding; native resource key; one generation reservation; typed immutable receipt; qualified-expiry-only new access generation; envelope binding to original action/plan/effect/epoch/resource/requester/session/profile/hard expiry.
- [x] RED clone-resistant keys, held/unknown exclusion, old/caller-recipient refusal, receipt substitution, known-expiry/skew versus unknown generation and envelope swaps/key preservation.
- [x] Implement pure metadata/transitions and existing scoped-crypto codec; no I/O or real default supplier.
- [x] Expected: focused tests and strict types pass; record only pure/synthetic evidence, not durable acceptance.

### Task2: Actual owned SQL, source definitions and profile-aware preparation/review
Interfaces: target-wide lock/read/CAS, immutable result/artifact records and separate durable delivery claim; new preparation metadata derived before plan compilation, independently reviewed under existing platform authority.
- [x] RED actual cross-action/native uniqueness, rollback/unknown commit, old-plan refusal, genuine review and reference recovery.
- [x] Add only required local schema/fixture definitions; semantically compare old Prisma models/enums before updating current helper pin/client. Preserve historical packets.
- [x] Expected: actual isolated SQL journeys with simulated qualification pass; no production migration or old-history adoption.

### Task3: Real template adapter/private observation composition
Interfaces: actual existing SDK adapters acquire no credential/issue no grant until exact durable admission; typed private transport observation; atomic receipt/target/artifact/event/outcome.
- [ ] RED unknown/malformed/version/identity/expiry/source/role revocation and final native-send/signer timing.
- [ ] Reserve before write/signing, preserve actual STS/owner/versioning/conditional-upload/version-read checks and SDK no-retry/fixed endpoints. Legacy access profile refuses before credential/signing work.
- [ ] Expected: intercepted actual SDK plus current SQL journeys pass, unknown outcomes held, no URL output on ambiguous recording.

### Task4: Original-session encrypted one-use delivery
Interfaces: qualified private key/clock/channel ports, exact stored grant context and locked durable once-only output claim; current requester/reviewer/source/approval/hard-expiry checks.
- [x] RED wrong/revoked/expired recipient/session/profile/key/context, concurrent delivery, unknown claim/delivery reply and metadata leak.
- [x] Implement authenticated output separately from history. Persist no plaintext; issue no replacement URL on failure. Never label a server output attempt as confirmed client receipt.
- [x] Expected: scoped crypto and actual isolated SQL delivery journeys pass with synthetic keys; real delivery/channel defaults refuse.

### Task5: Complete prepared HTTP/client/UI workflow
- [ ] Implement separate proposal, genuine review, requester issuance, typed history and one-use delivery; original references survive uncertainty and reload.
- [ ] Explain bearer transferability and distinct review expiry/grant hard expiry; no automatic navigation or secret persistence. Current context changes retire controls.
- [ ] Expected: exact browser-safe transport/digests, React workflow and joined client→HTTP→HMAC/current-SQL journeys pass with simulated native I/O.

### Task6: Family/caller validation and complete-batch handoff
- [ ] Audit all existing template callers and unknown histories; validate types, relevant source/frontend/SQL/build and keep living docs/demo current.
- [ ] Continue the separately approved image family, then perform one fresh whole-three-family independent source review/final validation and one mandatory-green PR. Do not create a guard-only completion claim.
- [ ] Production/live/native/installation/security/master-plan requirements remain separate and open.
