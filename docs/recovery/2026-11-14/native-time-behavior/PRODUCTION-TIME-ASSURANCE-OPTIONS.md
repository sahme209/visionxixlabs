# Production time assurance — decision proposal

Design only, based on HOST-TO-PRODUCTION-GATE-ASSESSMENT.md, TRUSTED-HOST-DECISION.md, the accepted authorization-linearization decision and current nativeTime/executionTime source. No new research, implementation, policy issuance, host operation, code approval or activation follows. Isolated operational-host trust was approved for evaluation preparation; **production operational trust has not been accepted**.

## The decision in plain English

Axiom must decide what it trusts when it says an approval, session or credential is still within its allowed time. The existing design requires a conservatively justified interval containing actual UTC. We have exact arithmetic and real resource-behavior evidence, but no genuine production supplier for the physical error/rate/quantization/lifetime premises. Ordinary AWS NTP and passing clock samples do not supply that mathematical proof.

| Option | Production promise | Consequence |
| --- | --- | --- |
| **A. Retain the current independent conservative physical guarantee** | Time decisions use an outward interval supported by independently justified source/error/rate/quantization/time-scale/lifetime evidence. | Keep production admitted time unavailable until that actual evidence/authority exists. No known supplier is established in this repository. More wrappers, measurements or Unknown-only constructors cannot close this gap; no completion date should be invented. |
| **B. Explicitly trust a named AWS/Linux operating model for production** | Time decisions rely on the exact managed source, configured Linux clock and protected lifecycle under a documented operational trust assumption. Behavior and failures are tested; universal physical UTC enclosure is not promised. | A meaningful production security-contract change. Define a distinct operational assurance profile and revised consumer/closure semantics, implement and qualify the real supplier/startup and complete every other Governance gate before separately considering activation. |

**Recommendation: choose B as the practical production design direction**, if the owner accepts the timing risks below. This is not a recommendation to enable current defaults or call strict G3 complete. If that risk acceptance is unacceptable, choose A and honestly keep this lane unavailable rather than spend on a host trial described as a mathematical proof. The already useful host/resource trial can proceed under its own complete approved packet whichever choice is made.

## Risks that option B must explicitly accept

If the trusted host is slow, a session, approval or credential can appear unexpired after its true deadline; an early clock can reject legitimate work or consider a not-before time satisfied too soon. Clock changes, leap-smear differences, suspend/restart and source failures can affect these decisions. Valid JWT signatures, immutable publication, native resource ownership and a healthy NTP status do not correct a wrong clock. Native measurements establish observed behavior, not an unseen worst-case error or all future drift.

The accepted original authorization still takes effect at its acknowledged commit. The same consumed attempt then checks its original narrowed deadline, cancellation and sealed native binding before each covered effect. Scheduling can pause after that check; neither option newly promises provider receipt before expiry. Option B adds operational clock risk to those comparisons; it does not authorize renewal, replay, a different credential or postcommit human reauthorization.

## Actual semantic/source work required after a choice

Current `nativeTime/interval.ts` computes an enclosure only under TimePremises; `source.ts` returns that strict interval. `nativeLinuxPorts.ts` deliberately refuses admitted methods, and `linuxComposition.ts` is dormant injected composition. `executionTime.ts` requires earliest/latest comparisons with strict expiry. A host scalar must **not** be injected as `[t,t]`, guessed padding/B/lambda/maxAge, or a qualified boolean in those ports.

For B, prepare one reviewed implementation contract that:

- Gives the actual protected host/source operating policy its own assurance identity, exact applicable scope and acceptance/withdrawal authority. Bind actual image, source configuration, one clock writer, producer/reader generation, native resources and lifecycle. Keep operational observations distinguishable from physical intervals in types and receipts; no arbitrary request field, environment switch or evidence hash can issue acceptance.
- Defines how original session/JWT/action/source/credential not-before/expiry, newly joined deadlines and same-proof dispatch consume operational observations. Retain original transaction locks/current-role/source/final-native-facts checks and no fallback. Any age/use-window/step tolerance or other numeric parameter needs an explicit justified contract; **none is selected here**. Unsupported or uncertain lifecycle/source state still refuses.
- Audits every time consumer in the existing joined graph, including native STS/ECS, template/image/growth/deployment/settings/manual/recovery and result reads. Keep old history's assurance/source scope; do not retroactively relabel prior strict or synthetic receipts. Migration/default registration and selected-family coverage require explicit review, not a global clock substitution.
- Preserves actual credential inventory, native renewal cutoff, original unknown source/derived/in-flight liabilities and complete fleet evidence. Host time alone cannot establish conservative elapsed credential closure under the strict existing rule. Define acceptable provider-native expiry/cutoff/termination evidence for each scope, or retain its liability/refuse closure. If B proposes changing a closure guarantee itself, that is an explicit additional semantic decision within the same reviewed contract—not silent acceptance from successful samples or machine shutdown. Never discard the requirement merely because initial role-free tests acquire no credential.

For A, no consumer relaxation is proposed: deliver genuine premise authority plus protected supplier/currentness and qualify it against the existing contract; otherwise refusal remains correct.

## Finite acceptance evidence before any production activation proposal

Use one exact joined package/host qualification plan, reusing passed compiler/raw-worker checkpoints. Retain independently reviewed source and whole-consumer coverage; actual source association/configuration and one steering owner; protected startup with first Unknown; generation/restart/withdrawal/disruption and alternate-writer refusal; held-resource identity, owned cleanup and final observation binding; original deadline/cancellation/currentness and UNKNOWN/no-replay behavior. For B, receipts must plainly identify the operational assumptions and measured cases, not claim physical enclosure. For A, genuine premise evidence is additionally indispensable.

Then retain actual credential supplier/custody/cutoff and complete native closure evidence; genuine independent requester/reviewer authentication and current permissions through the real client/HTTP path; one exactly authorized disposable provider journey/readback; whole approved family/platform coverage and independent security/activation review. Strict production compatibility and all remaining master requirements remain. None becomes satisfied by choosing a time model or passing the role-free host trial.

**Proposed decision boundary:** accept A or B as a production-assurance design direction and require one concrete supplier/consumer/closure implementation-and-qualification contract reflecting that choice. Code approval, real host/resources/credentials/provider operations, production/default registration and activation are separate explicit decisions after that contract and evidence are reviewable. This document asks for no owner action by itself.
