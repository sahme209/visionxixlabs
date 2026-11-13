# Joined private-media read timing — local partial checkpoint

Parent7066f65f; approved joined-time design item7 and owner grant call_89eb4532167a4e55b4c65c38f8fe44cc, local code and simulated tests only. This extends actual connected callers, without qualifying a native clock or enabling Governance.

## Actual caller changes

- A private participant helper captures original actor identities and validates/captures additional bounds before awaited row reads. It intersects exact session lifetimes in one interval read; it adds no role, reviewer, credential or resource authority. Existing locked owners still repeat current role/source checks afterward.
- Live image intake now joins people and connection expiry before decoding/key access. The captured private clock lives in ImageArtifactResources and is retained through guarded request composition.
- Preparation and private review/preview retain original action expiry through validatedArtifact, including after key acquisition and decoding. Phase-specific actors are preserved: a proposed action does not need an already-assigned reviewer, but the actual preview/review caller is checked. Post-clock checks retain connection revision, people, decoder/profile and any held key. Failed preview copies are cleared; original caller keys and stored metadata remain intact.
- Selected-image preview uses the NEW post/schedule action's current people and deadline. Exact source-plan reconstruction verifies its deadline does not exceed the current connection expiry and repeats after time. Original upload lineage is provenance, never old-approver permission. Active image decoder and key checks repeat after the new clock await.
- A workflow configured with different artifact/execution clock callbacks refuses live reads. Matching callbacks remain unqualified metadata, not proof of native origin. Captured clocks cannot be switched by replacing the private configuration property after construction. Original metadata/reference history still uses its current-reader recovery path without acquiring a key, decoding or requesting a new clock.

## Tests and review

Four initial intake regressions reproduced accepted expired session/connection intervals, ignored revocation during the clock await and missing controlling signal. Three selected-preview regressions reproduced expired new reader, action expiry across key acquisition, and revoked key/decoder returning private bytes. A composed request test reproduced accepting different artifact/execution clock policies. These now refuse; matching-policy/current-access positive paths remain usable.

Actual local service tests cover intake→prepare→unassigned-reviewer preview→independent review, actual plan/role/source reconstruction, real crypto and selected-new-action rendered-post/media preview. Authentication, rows/transactions, roles, profile, decoder and time evidence are simulated. Actual SQL and native/profile qualification were not run. Additional cases cover captured restrictions, malformed/empty/substituted participants, source unavailability, nonsecret historical recovery and buffer clearing after later expiry.

Final ordinary suite19,031passed/0failed tests or suites/1,142pending/20,173total. Its relevant subset contains34passed cases across5files, included rather than additional. Strict root types pass. Existing Vite native-loader warning remains visible. Independent source review found no important authority-design ambiguity or remaining important finding in this media-read slice; reviewer performed no execution.

## Connected completion map and remaining gates

JOINED-TIME-CALLER-STATUS-2026-11-13.json records the inspected caller status and exact current source hashes. It is a scoped source-tracing aid, not a universal call-graph, coverage or qualification attestation. Publishing/scheduling, manual release control, source acquisition and whole cross-participant/transitive consistency remain to finish. Protocol point timestamps, private callback origin/use validity, actual credential/clock/custody/fleet protection, real SQL and genuine human/provider end-to-end acceptance remain unqualified. Frozen build/green PR and all production target/schema/recovery/owner enablement gates remain. Preserve consumed unknowns and the already-written ServiceNow note; no replay.

No real clock/key/credential/decoder/provider call, actual SQL, service/resource/install/signing, schema/flag, push/deploy or spending occurred. Full Governance is incomplete and disabled. Historical receipts are unchanged. Five living documents were surgically updated after timestamped backups, with byte-preservation checks; no public API/SDK/UI/demo behavior or new audience was introduced.
