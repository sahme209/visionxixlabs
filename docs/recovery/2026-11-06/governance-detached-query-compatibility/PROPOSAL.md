# Detached query-library compatibility — conditional proposal

## Purpose and existing evidence

Stage A produced the fixed offline artifact, not a qualified issuer. The signed Node load of original query-library bytes refused with `library_validation_refused`; the exact underlying signature incompatibility is unconfirmed. No retry or change to that original is proposed. Mandatory vendor checksum authentication is explicitly outside the approved trusted-local model (see ../governance-query-origin-read/MASTER-ALIGNMENT-CORRECTION.md). HTTP403 remains recorded; upstream and commit authenticity remain unavailable.

## Alternatives and recommendation

1. Disable library validation: rejected because it weakens the reviewed protection.
2. Repeat the unchanged load or optional checksum: rejected; neither supplies a new compatibility mechanism.
3. Prepare and test one separately company-signed derivative: recommended investigation, not yet approved. This tests compatibility while keeping the original and library-validation policy unchanged. Company signing attests only the locally transformed artifact, not Prisma authorship or safety.

## Proposed conditional authorization

Prepare source, pure/mocked tests, exact byte packet and independent review first. Only after those pass, make one detached private copy of query SHA e0f4077c48e80b36425e6b0295803593eed753988c5f31adfab966b739d4809d. Require stable no-follow regular single-link input and owner/private-ancestry checks. Pin both original path and copy path in the frozen packet; no caller-selectable modules. Original cached/bound library remains untouched. Preserve applicable package notices.

Sign only the detached copy using existing saved identity 4C2E59F247CA275001586AE020A9269464529452 (expected team FG5N98FE6W), with fixed identifier, Runtime, no entitlement exceptions and --timestamp=none. Perform one strict static verification and one metadata display. Each operation is bounded to 10 seconds and 64 KiB combined output; error, prompt, timeout or uncertain cleanup stops the whole bundle without retry. No key enumeration/export or access grant.

Adapt the existing fixture_final_seal.py comparison principles to the actual 17,251,592-byte MH_DYLIB input; do not reuse its 2MiB executable limit or the unrelated 16MiB bundle limit. Before any load, a mechanical Mach-O comparator must establish signature-only transformation: preserve executable/data bytes, architecture/header semantics and load configuration, allowing only precisely parsed code-signature payload/command length and necessary link-edit sizing changes. Unknown structures, overlaps, unrelated load-command changes or program-byte differences refuse. The exact parser rules and test vectors must be independently reviewed before signing; this proposal does not authorize accepting arbitrary codesign changes. Record input-to-derived hashes, signature metadata and all limitations. A failed comparison stops without executing the copy.

After exact checks, invoke the same signed Node candidate SHA1aa6f6936040d80d6f9c1bb75ba4af97ce596af514ab7f0157a77f461abce134 ONCE with a fixed script requiring only the new copy and checking QueryEngine is a function. No engine construction, engine methods, PrismaClient, database, issuer/private composition or provider action. Retain library validation and existing minimal-JIT profile unchanged. Reuse the reviewed clean environment, network-denied/write-bounded sandbox and literal /dev/null control. Retain verified Node descriptor; arm restoration before temporary0600→0700 and restore0600 in finally through that descriptor. Child10seconds plus at most5seconds owned cleanup, bounded output, original and derivative currentness verification on all outcomes. Unknown outcomes stay unknown. Parent synchronous byte verification is outside the child limit; no universal descendant-quiescence claim.

## Acceptance and remaining gates

A successful result proves only that this signed derivative loads its expected export under this exact signed Node on this Mac. Failure is preserved with no retry/alternative module. It does not qualify queries, custody, private-consumer identity, installed principals/services, fleet, complete execution coverage, enrollment or production. Adoption into generated packages requires a separately reviewed explicit provenance/materialization binding; do not silently replace generated outputs or claim the original upstream artifact is unchanged.

No actual signing/load is currently authorized. This conditional proposal requests one preparation/review/sign/static-check/load bundle, not another series of automatic attempts. No installation, account/root/service action, image mount, unrelated credentials (only the explicitly named existing signing-key use is requested), customer data, provider/network call, schema/production change, deployment or spending. Existing final-release and independent-human-approval gates remain intact.
