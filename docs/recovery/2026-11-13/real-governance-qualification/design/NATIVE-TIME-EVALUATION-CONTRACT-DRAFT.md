# Finite native-time evaluation contract — source-grounded design draft

This records the three parallel assessments after the completed four-file audit. It is DESIGN ONLY, not code, library adoption or real qualification. The authorization/physical-send boundary decision in AUTHORIZATION-LINEARIZATION-DECISION.md takes priority over implementing a new generic time port.

## Current structural-audit correction

The approved five-file source pass completed and is consumed; see five-file-structural-audit/ASSESSMENT.md and OBSERVED-RESULT.json. It establishes header/publication and separate V2/V3 writers, but does NOT establish descriptor-copy consistency. The real reader uses mapped atomic Acquire/volatile semantics; inode/size/equal16-bit generation alone does not prove lifecycle continuity or absence of ABA. The earlier descriptor-only candidate below is preserved as a rejected/unqualified mechanism candidate, not an implementation instruction. Choose and review a supported bounded reader and complete conservative sampling contract before native code; no mmap/cache fallback or new fetch is authorized. Native ABI/source/host/time/custody qualification remains open.

## Earlier bounded capture candidate — not implementation-ready
One fresh supervised fixed raw-snapshot child per observation; no retained vendor Client/cache or mutable shared mmap. Fixed protected source IDs/paths and reviewed ABI, no caller path. Proposed engineering limits:4KiB/read,8snapshot attempts,32reads/128KiBtotal,500ms parent deadline through parsed result plus at most100ms termination/reap. These are proposed limits, NOT measured Linux guarantees. No restart/retry/fallback. Parent termination/owned-child isolation must itself qualify; a missing confirmed stop remains unknown/unavailable.

Require exact before/after source identity/type/size and matching nonzero even initial/copied/final sequence, supported unchanged layout, bounded complete payload and immutable owned output. No old/default record. Child receives only fixed descriptors/result pipe, no network/credentials/inherited resources; this isolation remains unverified. Output carries artifact/ABI/source identity, layout/byteorder/counter/time type, three sequences, read/attempt/bytecounts, raw timestamp/horizon/error/drift/status/disruption fields, parent elapsed capture disposition, and explicit `timeAuthority:false`/`executionAuthorized:false`. It does not self-certify trusted writer/provenance.

Unread exact header/writer/daemon ordering, native descriptor-read semantics and source lifecycle remain mandatory evidence. If descriptor reads cannot preserve that protocol, refuse without mmap/cache fallback. No code can guess binary offsets or treat this draft as implementation-ready native extraction.

## Exact V2-only conditional arithmetic candidate
V3 remains an open requirement, unsupported in the initial evaluation until exact projection-error proof. Private raw V2 input uses integer nanoseconds: R=realtime read BEFORE M=monotonic; A/V=same coherent snapshot's as_of/void_after; B=bound atA; D=integer drift ppb; F=qualified maximum snapshot age with NO default. Require actual synchronized/disruption/host/writer/layout/provenance evidence. R,M,A,V,B,F lie in0..2^63−1;F>0;0<=D<10^9. Reject M<A without causality blur, M>=V, M−A>F, unsupported statuses/time scales and negative/overflow endpoints. Use exact arbitrary-width or checked>=128bit intermediates.

elapsed=M−A; growth=ceil(elapsed*D/10^9) using quotient/remainder; radius=B+growth; Lns=R−radius; Uns=R+radius. Then Lms=floor(Lns/10^6), Ums=ceil(Uns/10^6); require both safe nonnegative integer milliseconds. Preserve strict Ums<expiry and Lms>=notBefore and existing closure-lower-bound semantics.

Reference vectors: R=10^10,M=A,B=0,D=0 gives[10^10,10^10]; R=10^10,elapsed=500000000,B=100,D=1 givesgrowth1 and[9999999899,10000000101];R=10^10,elapsed=10^9,B=7,D=3 givesradius10;R=2000000,elapsed1,B=0,D=1 gives[1999999,2000001]ns and[1,3]ms. M<A,M=V,ageF+1 refuse;R=0/radius1 or R=2^63−1/radius1 refuse.

The proof is CONDITIONAL on B already enclosing realtime error atA, D truly bounding growth and M−A conservatively covering elapsed time atR. Reading R before M does not by itself establish that last premise for coarse/quantized clocks. Actual OS/daemon input intervals and uncertainty must be verified and formula rederived if needed; NO guessed padding. This conditional arithmetic must never qualify a native clock or close final dispatch validity by itself.

## Decisive real gate
Only a separately reviewed and authorized role-free Linux packet may establish actual reader/isolation/daemon/host/status/growth/restart/disruption/time-scale/latency behavior. Source identity/availability/cost/IAM/network/retention quote first; no cloud resources or spending currently approved. Task credentials remain ECS task credentials on an EC2 ECS host; no IMDS fallback. Full credential/human/provider/master/production qualification follows, not automatic activation.
