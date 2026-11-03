# Canonical consumer authority bridge: source-only design audit

Snapshot `d410be88fab31a95ba9c41c1a00cd11a92c423e4`. This is design-review input, not a vulnerability finding, proof of impossibility, successful qualification or authorization to implement a new boundary. No code, test generation, runtime, provider or deployment action was performed.

## Factual conclusion

The source defines a private native-origin check within the canonical module, but does not yet define a positive, independently established authority bridge through the **actual compiled consumer** to the claim/credential/final-send gates. More native component preparation or package assembly alone cannot resolve this missing contract and evidence. Production readers remain deliberately unavailable.

- `packages/verified-issuer-runtime/index.cjs:21–38,55–74`: canonical main/thread/path/environment/cache checks, closed-package verification and private capture of a fresh native assertion. `:40–50` rechecks origin when reading. The returned observation at `:73` remains unavailable and nonauthorizing.
- `next.config.ts:10–13`: canonical dependency is external, intended to share the actual canonical module instance with the compiled server. Externalization is an arrangement to validate, not proof of actual consumer authority.
- `lib/governance/intelligence/issuerArtifactIdentity.ts:2–7`: compiled-facing TypeScript seam calls an imported JavaScript reader. `mergeOutboundIssuer.ts:3–9` explicitly supplies no verified variant and always throws. No positive bridge is implemented here.
- `lib/governance/intelligence/mergeOutboundDrain.ts:23–38,56–85`: the real adapter checks issuer digest through that reader, retains exact claimed-operation checks, and repeats current-issuer checks before credential reservation and final submission freshness. These are meaningful operation gates, but do not independently establish the imported reader's native origin.
- `lib/governance/intelligence/enrollmentDrainStore.ts:65–80,88–93`: durable records and transaction/freshness checks rely on the trusted caller's original-claim/operation verifier. A stored issuer digest or server nonce does not by itself authenticate the process executing that verifier.

## Existing assumptions versus unresolved decision

The approved integrated contract already assumes a trusted local host/platform, exact protected package and fixed native launch, private canonical initialization, actual same-instance compiled dependency and genuine operation approval. It excludes caller-selected verifier/identity descriptors and does not add a hostile-root or universal malicious-native-code objective. These assumptions must be preserved.

It additionally requires the actual compiled consumer to refuse authority outside the qualified main, including substituted dependency/cache authority. What remains undefined is the positive consumer authority contract: **what establishes that the consumer executing the claim and final-send checks is connected to the actual private canonical/native authority, and which module/loader integrity assumptions are trusted versus independently demonstrated?** The existing native challenge checks the canonical native session; its source presence does not answer that downstream question. A matching digest, frozen DTO or callable-looking reader is explicitly insufficient under the approved contract. This audit proposes no replacement mechanism and does not relax that requirement.

## Prerequisites before expensive final-artifact work

1. Review and specify that authority bridge and its trust assumptions at the real consumer/claim/final-send seams, retaining the original same-compiled-consumer requirement.
2. Identify an appropriately permitted validation route for the original requirement. `canonical-consumer-validation-status.md` records automatic safety review blocking specialized generation; that case remains unverified. Do not recreate, rephrase, delegate or replace it with source inspection, a wrapper-only test or a fabricated positive identity.
3. Keep the unavailable readers and activation refusal until coherent final-artifact/native/consumer evidence satisfies the original integrated matrix. Do not count a separate diagnostic exchange, successful build or component review as this evidence.

## Exact source hashes (SHA-256)

| File | Digest |
| --- | --- |
| `packages/verified-issuer-runtime/index.cjs` | `a9152cbf65c8b1516c2506dc7d37250ed1ea0057ca11feabbfba08cb47de8c1f` |
| `lib/governance/intelligence/issuerArtifactIdentity.ts` | `48285af5129fca81560008a15247d19765760b3a42ac4402885d7c050db7258a` |
| `lib/governance/intelligence/mergeOutboundIssuer.ts` | `3e0d39538b925a443788a075e5d4a2114d1f4ffba11abd5caddeb2ef5ab7535f` |
| `lib/governance/intelligence/mergeOutboundDrain.ts` | `c744366368b71af45070b03a232e879ec061fcbb8a041b15c5726069f8e2e2fd` |
| `lib/governance/intelligence/enrollmentDrainStore.ts` | `41dd39f41478209eba137aae6a4d83c8dc40262815741edbae61a29421fafe59` |
| `next.config.ts` | `491566295d50eddd8dae881ae9c143648c2a2af0ccbf7a050da62a8db4a2bd9f` |
| `docs/recovery/2026-11-03/xpc-origin-local-unit/canonical-integrated-next-unit.md` | `c3f5e4545f351eb5298403119e0735cecc8770e12e0dafd78b894f36b51f1516` |
| `docs/recovery/2026-11-03/canonical-consumer-validation-status.md` | `b3149d9527a389c7367ab3a7e56edb8bec0e561af3b656efdcdcf83dd97697eb` |
