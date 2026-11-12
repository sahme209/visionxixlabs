# Managed image upload: protected derived grant — proposed local extension

Status: DESIGN ONLY; implementation not approved. The accepted platform design includes exact image initialization/PUT effects, but leaves custody of the provider's secret upload address unspecified. This extension needs owner review. The separately requested official LinkedIn documentation reads remain pending; no vendor destination/response profile is qualified or guessed here.

## Intent and verified local facts

Complete managed image upload without reinstating the raw-token/latest-account/draft-cron bypass. Image upload remains required P01 scope; current default refusal is containment, not completion.

- Approved platform proposal: exact image effects, distinct reviewer, current account/source, per-child one attempt, bounded destinations/redirects, stop on uncertainty.
- The old uploader accepted a caller token/owner then followed a provider-returned URL. `legacyImageUpload.test.ts` reproduced two simulated requests and success with no platform action. The current legacy helper refuses; daily drafts queue human review instead.
- `credentialVault.ts` has authenticated context-bound `encryptScopedCredential`/`decryptScopedCredential`. Its legacy unscoped envelope is unsuitable for new records. Actual key/host custody remains separately unqualified.
- Action/event records are metadata only. No URL, token, binary image or raw provider error may be added to them.

## Approaches and recommendation

1. **Client/raw-token upload or plaintext grant in action history:** reject; it exposes a transferable credential and trusts caller-selected transport data.
2. **Separate initialization and PUT reviews:** possible but not preferred. It adds a second human handoff after the provider starts its expiry timer. It is necessary only if the destination cannot be constrained in advance by a verified fixed profile.
3. **One exact two-effect plan with a server-private derived grant:** recommended, conditional on protocol qualification. Review exact bytes/account and both operations BEFORE any send. A predetermined opaque grant reference ties the PUT to the authenticated initializer response under the same parent; it never lets the caller choose an address. This preserves the approved per-child workflow and avoids another approval/picker-style timing loop.

If official protocol facts cannot support approach3's fixed destination profile, STOP for a revised design; do not silently fall back to broader origins or extra authority.

## Proposed local records and custody

Two dedicated proposed LOCAL models/fixture tables; no production migration or fabricated tenant:

- **Image artifact:** random ID, stable authenticated creator user ID, selected connection ID/revision, byte digest, MIME type/size, immutable context-bound encrypted bytes and creation metadata. Initial application cap2MiB (an app bound, NOT a claimed vendor maximum); unsupported formats/sizes refuse. Local tests use supplied synthetic bytes only, with no paid generation or external storage.
- **Upload grant:** predetermined opaque ID, exact parent action/plan and initializer/PUT effect indices, artifact/digest, connection/revision/author, fixed qualified destination-profile ID/version and nonsecret origin, provider image URN/expiry, immutable context-bound encrypted COMPLETE upload address, and durable one-use claim/outcome state.

Creator alone may prepare/execute the related plan under the existing original-requester/session rules. A distinct current platform reviewer may read the artifact only THROUGH that exact proposed/approved action; arbitrary artifact IDs do not grant access. No new roles, tenant sharing or creator reassignment policy is included.

Encryption contexts are purpose-separated. Artifact encryption binds artifact ID, creator, connection/revision and byte digest at intake (before a plan exists). Grant encryption additionally binds grant ID, actual parent action/plan digest and initializer/PUT indices after the plan is compiled. Ciphertext copied across records/accounts/actions must fail. New records use the existing scoped envelope with synthetic keys in tests; no real key read/provisioning is authorized.

Neither the URL nor a credential-bearing component is hashed into action/event/preview data. `uploadGrantDigest` is explicitly nonsecret immutable grant-reference metadata, not a URL/token digest. Replace and review the currently unimplemented `destinationPathDigest` profile rather than quietly treating old plans as newly qualified ones. Actual address custody comes from immutable authenticated grant storage plus exact parent/child binding, not a caller hash.

Encrypted storage is not process isolation. Native issuer, key custody, host, installed resources and complete execution coverage remain separate unresolved gates.

## Binary representation and clone-resistant workflow identity

Store bytes as strict canonical unpadded base64url inside the authenticated envelope: reject nonalphabet characters/noncanonical encodings and require decode/re-encode equality. Hash the decoded exact bytes, not the encoded string; recheck byte count/digest after decryption before preview or send. Base64 is an encoding, not encryption. Never accept a file path or remote image URL as artifact content.

Before artifact intake OR reviewer rendering, the concrete format profile must validate size, MIME/magic consistency, bounded dimensions/pixel allocation, single-image/nonanimated form and actual decode under a bounded approved decoder. Reject SVG/HTML/script/container formats. A PNG signature or client-declared MIME alone is insufficient. No new dependency is included: identify/review the actual existing bounded decoder or stop for an explicit dependency/profile decision. Until this qualification exists, image intake/rendering/default sends remain unavailable even if local custody primitives pass. Do not replace this gate with a mock and claim usable image support.

The durable initializer reservation key is SHA256 of canonical metadata `{purpose: linkedin_image_initialize_v1, author: canonical_provider_author_urn, bytesDigest: exact_decoded_byte_sha256}`. It deliberately EXCLUDES random artifact/action IDs, creator, connection record ID/revision and profile version: cloning the same bytes, reconnecting the same author, switching platform users or upgrading the profile cannot clear an unknown initializer. It is platform-only; the same author represents the same external upload owner, not a fabricated tenant. The record separately binds the selected current connection and creator, which still govern authorization. Reserve before credential/provider access; retain unknown liability permanently unless a separately reviewed real-proof recovery mechanism exists. Different authors are different external resources. A genuinely confirmed compatible image may be reused rather than initialized again. New copies or new records are not recovery authority.

PUT reservation is unique by the exact derived grant ID and immutable parent/child lineage. A different parent can neither claim that grant nor fabricate an equivalent one. These keys stop action/record cloning; they do not claim semantic similarity deduplication or control of out-of-band uploads.

## Proposed connected workflow

1. Current authenticated requester supplies an existing owned immutable artifact and exact account. Server derives a two-effect plan: initialize for those bytes/author, then PUT only the grant produced by that initializer under the fixed verified destination profile. The action/grant IDs and child references are generated before plan compilation. The reviewable grant metadata digest includes those IDs, artifact/bytes, connection/revision and fixed profile/origin, but EXCLUDES the parent plan digest to avoid a hash cycle. After compilation, the immutable grant row and its encryption context bind the resulting plan digest as well. No raw client URL, owner, SDK option, transport override or credential is accepted.
2. A genuinely distinct current reviewer inspects the exact image and BOTH operations/account/profile. Original requester claims the parent once. Credential lookup/decryption happens only after the initializer claim/current-source checks. No posting action is included or implied.
3. Initialization sends once to the qualified fixed provider endpoint. Parse only a bounded successful response with the reviewed identity/expiry/destination rules. Unknown/unsupported host/profile or contradictory response refuses; never expose raw response/address/error. A provider-returned URL is NOT automatically authority just because it is a URL.
4. A PRIVATE source-backed observation transaction atomically stores the scoped encrypted grant plus nonsecret lineage and confirms the initializer effect/event. The client cannot submit a grant or invented observation. If persistence/observation is uncertain, retain original liabilities; no PUT, reinitialization, reset or replacement workflow. Same artifact's unknown initializer cannot be evaded by a different action; reserve its workflow identity before sending. Content cloning is not a recovery mechanism.
5. The existing parent can advance only after confirmed initialization. Its next child must resolve THAT exact grant/artifact/account/profile and cannot accept another parent's capability. Atomically reserve the grant before one PUT; retain consumption after confirmed/refused/unknown outcomes. Recheck requester/reviewer, original action expiry, current connection/source, byte digest, grant lineage/profile and provider expiry after awaited preparation. Provider expiry can only narrow the already reviewed authority, never extend it.
6. Decrypt the address solely inside the authorized server send path; send exact bytes once with bounded deadline and redirect refusal through the fixed qualified profile. Confirm only documented result evidence. Unknown result stops; no auto PUT retry, reinitialization or post. Preserve original action/event history and all unknown liabilities.
7. A later separate reviewed post may reference only a genuinely confirmed compatible image record for the same artifact/account/author. Do not relabel an old arbitrary image URN or an initializer-only result as uploaded media. Existing confirmed compatible assets may be reused; unsupported historical/external media qualification remains explicit.

No cron execution until its separately qualified service identity exists. No cleanup/deletion/retention job is authorized; expired records become unusable without destroying history. Recovery after an unknown result needs genuine proof and a separately reviewed design, not a success/failure guess.

## Required protocol qualification

Pending official sources must resolve initializer/PUT success, expiry, destination origins/path rules and headers. Record exact sources and independently review the concrete fixed profile before a default profile allow path is implemented. Unsupported destination, HTTP, userinfo, fragment, port, redirect, altered bytes or grant/account substitution refuses. Use normal HTTPS/TLS identity checks; do not claim arbitrary DNS/proxy/host compromise or out-of-band dashboard prevention. Unknown protocol facts STOP that profile rather than broadening it.

No actual provider/network/key access or public/default activation is included. The global runtime/coverage gate stays closed even after local tests pass.

## Finite implementation/acceptance batch if approved

1. Strict artifact/grant/parent-child contracts and context-bound synthetic crypto; no provider or credential access during preparation.
2. Dedicated local schema, initializer-workflow reservation, atomic grant+observation transaction and one-use PUT reservation; actual owned isolated PostgreSQL only, no production migration/apply.
3. Qualified-profile init/PUT adapters tied to actual default current authority and final transports, plus exact uploaded-image lineage for later post preparation/execution. No profile allowance without verified protocol facts.
4. Joined synthetic/owned tests: positive two-effect workflow; role/session/account/source/expiry revocation; concurrent initializer/PUT claims; event/transaction rollback; lost init/PUT observation and cross-action no-replay; ciphertext/account/record substitution; byte/destination mismatch; no URL/token/error leakage.
5. Prepared UI/client/guidance show image, both exact operations/account/profile, expiry and unknown recovery without another human handoff. No route registration/activation until all original platform families/workflows qualify.
6. All required checks, one whole-branch independent review and exact-green PR under existing rules. Real provider/OS/key/schema/production acceptance stays separately authorized.

## Requested authority

Approve local implementation/schema definitions, synthetic crypto and existing owned isolated PostgreSQL tests for this custody extension, CONDITIONAL on protocol source qualification before implementing a profile allow path. No real key/Keychain read, credentials/grants, provider/network call, image generation, production migration, role/flag change, signing, installation, deployment, paid CI or spending. Pending public-documentation consent is separate; this approval does not consume or replace it.

## Independent design check

Builder review identified artifact/plan context circularity, clone-resistant reservation identity and binary-validation ambiguity. The revisions above purpose-separate contexts, exclude parent digest from precompiled metadata, reserve by external author/exact byte identity, and require a real bounded decoder before intake/rendering. Follow-up found no remaining important design blocker. This is design review only; protocol/decoder/key/host custody and owner implementation approval are NOT established.
