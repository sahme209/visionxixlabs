# Joined template credential/grant deadlines — local partial checkpoint

Parent checkpoint: `f198cee6`. This implements the already approved joined-time design item7 under owner grant `call_89eb4532167a4e55b4c65c38f8fe44cc`, local code and simulated tests only. It does not qualify a native expiry supplier or enable a runtime.

## Actual connected source

`templateNativeTransport.ts` requires positive safe absolute `expiresAt` in held credential metadata, with a representable SDK Date. Parsing captures the value with the exact held key/token identity. Later expiry changes refuse, even if the key bytes are unchanged. No duration, current-process-time or environment fallback supplies a lifetime.

The existing final HTTP-handler/locked-authorization join now intersects credential and action expiry with the current locked participant bounds. Missing/unusable expiry cannot reach a native command. The installed SDK receives only its expected credential fields, including `expiration`; the private `expiresAt` name is not forwarded as a substitute.

A presigned grant is refused if its exact requested TTL would end after the captured credential expiry. It is not shortened or re-signed. Equality is accepted while actual decision intervals still satisfy strict expiration. Final opaque proof creation additionally intersects the grant's own validated hard expiry, so a still-current action and credential cannot certify a grant at `U == grant expiry`. Existing admission, durable unknown results, once-only opaque proofs and output claims remain consumed.

## Evidence

- Positive absolute metadata initially failed the original strict parser; the mandatory shape was then added.
- Three subsequent behavioral failures reproduced ignored credential overlap, expiry rebinding with unchanged key bytes, and an overlong grant. All now refuse.
- An unusable Date-range timestamp initially reached a command; it now refuses. Absent, nonfinite, zero/negative and fractional bounds refuse without I/O.
- Passing the private expiry name directly to the real installed SDK initially yielded no SDK expiration; explicit mapping now binds both clients correctly.
- The actual installed-SDK final handler blocks expiry during asynchronous preparation. A memory-transaction store using real reservation/outcome kernels retains exactly one UNKNOWN, zero outgoing writes and no replay when the shorter credential expires there.
- Actual installed presigner tests prove exact equality preserves reviewed TTL, overlong TTL refuses without re-signing, and the grant's own final interval boundary refuses. The latter initially returned a proof at the expired grant boundary.
- Full final ordinary suite:19,001passed/0failed tests or suites/1,142pending/20,143total. Its relevant subset includes88passed cases across8files, not88additional independent tests. Strict root types pass. Existing Vite native-loader warning remains visible.
- Independent source review found no important design ambiguity or remaining source issue in this credential/grant unit, including the final grant-bound delta. Review is source-only.

## Not verified / remaining

No actual PostgreSQL was run; existing opt-in SQL fixture definitions now include captured synthetic expiry only and remain skipped. All keys/profiles/clock/people/provider responses are synthetic. SDK signing-clock compatibility, native expiry provenance, protected source/custody and fleet qualification remain open. This supersedes the earlier local missing-template-expiry-metadata item, not those native guarantees. Other source-acquisition/image/post/schedule/manual timing consumers, transitive coverage, actual SQL/genuine people/provider end-to-end trials, frozen build/green PR, production compatibility and owner activation remain required. No real token, provider call, cloud resource, signing, installation, production/schema/flag change, push, deployment or spending occurred. Full Governance is incomplete and disabled.

The five living documents were surgically updated after timestamped backups; all unrelated original content is byte-preserved. No public API, guide, SDK, UI, demo workflow or user-visible availability changed.
