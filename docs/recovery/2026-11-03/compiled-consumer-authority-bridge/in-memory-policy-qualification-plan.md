# Exact in-memory policy construction/serialization qualification plan

Design review only within `call_Nu5fVdY8QbGHZLHdabhskBJr[0]`, against canonical `4968408f`. **No helper source, compile or Security API execution occurred here.** Existing preparation approval does not authorize the proposed actual Security calls; request specific one-attempt execution authorization after the concrete helper/build is reviewed. No new external reads.

## Fixed owned profile

Use the same `cssm_policy_builder.c`, `cssm_policy_copy.c` and once-claim implementation, compiled as a test-only executable with one reviewed compile-time profile selector. Source must contain exactly two fixed literals: the existing unallocated installation path for the canonical preparation profile, and `/private/tmp/axiom-cssm-policy-artifacts/pure-test` for this test-only profile. No arbitrary path macro, CLI argument, environment override, test registration hook or runtime caller path. Only the test helper selects the test literal; the canonical builder default remains unchanged. Main requires argc1 and invokes the same builder/copier once. Do not use the bundle as a dynamic plugin or launch any native issuer.

The fixed fixture already exists; read-only filesystem binding observed during this plan: SHA256 `d136d3f7d7c8135a543161afd4fa5127772bd1c35f41ed45cc37bf8d513e6f5e`, UID501, mode0600, size138024 bytes. It is the previously compiled pure copier test, not an issuer binary, installed custodian or signing authority. It is **never executed by this qualification**. Preparation must verify its Mach-O format from file bytes and bind current resolved absolute path, owner, mode, file identity, size and hash before and after the attempt. No signing operation or private key is needed. If the current platform rejects this existing fixture's code identity/signature, stop; do not sign, chmod, replace the fixture, choose another path or retry automatically. This exact file's changed hash/identity also stops pending review.

The receipt must state prominently: **test-only path/profile differs from the canonical installation path; no installed-path, code-identity exclusivity, custody or executing-issuer qualification follows.** Fixture metadata/hash establish reproducible input only, never access authority.

## One fixed call trace

After file preflight and once-claim, successful construction uses exactly these Security calls, in order; any failure stops, without invoking later stages:

1. `SecAccessCreateFromOwnerAndACL`: explicit retained root owner, zero-entry temporary object, as current source.
2. `SecTrustedApplicationCreateFromPath`: fixed test fixture literal only.
3. `SecACLCreateWithSimpleContents`: same single-application builder path.
4. `SecACLUpdateAuthorizations`: same two fixed rights.
5. `SecAccessGetOwnerAndACL`: one temporary export, passed to the unchanged bounded framework copier.
6. `SecAccessCreateFromOwnerAndACL`: same one-entry copied arena, final in-memory access object.
7. `SecAccessGetOwnerAndACL`: one final export for serialization inspection only.

Exactly two `CFArrayCreate` calls belong to the existing successful builder trace, one application and one two-rights array; retain all policy objects/buffers/exports to process exit. No `SecItem*`, Keychain/default-keychain open/search/read/update/delete, persistent-reference operation, access installation, session manipulation, authentication prompt, credential/provider/DB/service call or root grant is included. No supplier startup/read or business initialization is linked into the helper. No second builder invocation or failure-path retry.

The seventh call is a narrowly scoped addition for this qualification: compare final serialized structure with the prepared arena's intended owner, two rights and complete code-signature subject. Require exactly one final entry, root process owner, expected delegate/validity/tag fields and no threshold/prompt/ANY/extra branch. Use bounded typed traversal and complete opaque-subject byte equality only to verify the same in-memory representation survived reconstruction. This comparison is **serialization equality, not authorization equivalence**, path exclusivity or proof of OS item enforcement. Do not feed the final application-only shape into the unchanged copier if it expects the original threshold shape. A small separate bounded inspection routine must be reviewed for that distinction before compilation.

## Bounds and output

Reuse copier limits (256 nodes,64KiB copied datum bytes,16 rights and current traversal-depth checks) and apply the same or stricter limits to final serialization inspection. Fixed one-shot call count bounds application work/storage; OS allocation/runtime hard bounds remain unclaimed. Retain policy-only outputs until process exit; no guessed deallocator or zeroization guarantee. No resource item or secret data exists in this attempt.

Stdout is one bounded fixed-schema result (maximum2048 bytes): profile name, literal source revision/hashes from the reviewed build receipt, terminal stage ordinal, success/refused/unknown, numeric OSStatus for the failed call if returned, and structural pass/refusal booleans/counts. Do not emit application-subject bytes, signature requirements, paths returned by Security, raw CSSM memory, arbitrary error descriptions or opaque identity payloads. Source/file hashes are receipt provenance, not runtime grant inputs. Stderr is bounded fixed stage labels only; no crash/core dump collection or framework diagnostic dump.

A separately reviewed ordinary-user watchdog starts exactly this helper once and enforces a 10-second wall deadline from launch. It does not start another fixture or execute a Security call itself. On timeout, attempt termination of that owned helper only and report **unknown/incomplete** regardless of later output; if termination/reaping cannot be confirmed, report that outstanding process and stop. Never infer “no API ran,” installed denial or safe retry from timeout. No cleanup mutates files/items/services. Failure/crash/output overflow/file change also ends this single attempt; no automatic rerun with modified unsigned/signed profiles. Watchdog limits observation time, not synchronous framework work internally.

## Acceptance and exact remaining prerequisite

Preparation acceptance: review the two-literal compile-time profile separation, unchanged copier/builder semantics, one-attempt trace, final export checker, bounded output/watchdog and prohibited symbol/link surface; compile only after its authorization and record exact binary/source/fixture hashes. The current canonical code lacks the test-only literal selection, seventh export inspector and helper/watchdog, so **that narrow helper preparation is the concrete missing prerequisite**, not an existing executable to run now.

Execution acceptance, only after specific authorization: one actual in-memory success with final expected structure proves constructor/export/copier/reconstructor compatibility for this exact test fixture and OS; returned failure is an honest stage-specific incompatibility; timeout/crash is unknown/incomplete. None proves a Keychain item's installed effective policy, noninteractive denial, code equivalence restrictions, pre-main integrity, dedicated launch/epoch or real supplier delivery.

Full installed synthetic policy/resource qualification, original same-compiled-consumer/native/copy matrix, actual DB/key compatibility, unbound/legacy withdrawal, historical exposure/unknowns, fleet/full mutation coverage and Governance enrollment remain unchanged. Canonical supplier gate stays false and private business channel remains unmounted. No original blocked case is regenerated or renamed.
