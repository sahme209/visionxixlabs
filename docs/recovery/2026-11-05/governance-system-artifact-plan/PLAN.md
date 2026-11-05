# System role-artifact preparation — source design, not implementation

Base1ecb5d5c. Continues the approved installation-design specification; no new assembly code, main entry, compiler, signing/API call, image/mount, principal/service or resource action is authorized here. The preceding two exact metadata displays remain consumed. Their ad-hoc/no-runtime observations must be addressed by actual role artifacts, never a metadata pass flag.

## Concrete current-source conflicts

1. The per-user overlay requires `controlApp.parent` to be current-user-owned/private and derives its startup claim there. The fixed System app instead belongs inside a root-owned0755 generation. Broker `claim_startup` requires a current-user0700 claim parent. Reusing one directory for both purposes cannot satisfy this design; do not make the immutable generation user-writable.
2. The old overlay's native source inventory and broker recipe omit the connected supplier/bootstrap/CSSM/contract dependencies. Its pinned input Node is under the developer's home. It is historical per-user preparation, not a complete System-role builder or installed readonly-runtime layout.
3. The current maintenance output is a compiled bundle/function, without the selected standalone trusted-operator entry. Neither that bundle nor the default-unavailable broker is a signed, configured, installed custodian artifact.
4. Broker compilation depends on actual selected Node/controller signing requirements; guard compilation depends on the actual signed broker requirement. Observed ad-hoc hashes or guessed IDs cannot fill those dependencies. Native-versus-Node entitlement policy cannot be inferred from the GUI app.

## One System profile, two location classes

Keep the existing runtime architecture and fixed synthetic generation; add a separately reviewed System preparation profile rather than weakening/relabeling the old per-user recipe. Historical stages, claims and receipts stay immutable. No arbitrary runtime profile, environment path override, caller receipt or generic resource loader is selected.

**Preparation space:** create a fresh private current-user-owned staging directory, directories0700 and nonexecuted outputs0600. Source/compile inputs and intended target paths are separate fields. Never copy a staging path into intended System configuration or claim installation from staging ownership.

**Intended immutable installation:** retain the existing shared synthetic generation root and `Axiom Synthetic Custodian.app/Contents/MacOS/AxiomIssuerBroker`. Root-owned protected generation, app/config/locator/image inputs; no mutable `current` symlink, no user-owned signing/dependency cache. Maintenance is proposed as a separate fixed `Contents/Helpers/AxiomSyntheticProvisioner` executable, root/operator invoked, never linked into broker or a customer/agent endpoint. These are design selections, not created locations.

**Persistent claim protection is UNRESOLVED.** A proposed separate `/private/var/db/.../<generation>/startup/` leaf owned0700 by the dedicated principal would satisfy the current broker's ownership check, but every process with that UID could delete the claim. It is therefore **rejected as a persistent no-replay mechanism** under the original same-UID attacker model. Do not implement that ownership/location change or weaken the immutable generation to make the old claim function run.

The [claim disposition](STARTUP-CLAIM-DISPOSITION.md) distinguishes a source-supported append-only-file candidate from a privileged launch-owner alternative. Neither is selected or operationally qualified. Persistent consumption must be protected against deletion/truncation/replacement by untrusted same-UID processes and tied to the actual one allowed launch. A JSON assertion, advisory lock or prose “never delete” cannot provide that enforcement. Existing or unknown state must refuse; no timer reset/reuse. Root/trusted installer remains outside the attacker model and must serialize changes. The exact owner, principal and new state transition require review before code; no positive startup follows from this design.

## Concrete preparation changes proposed for later implementation review

| Area | Required change and retained stop |
| --- | --- |
| System builder | Separate fresh private staging and exact intended System layout; complete transitive native source/header closure and architecture/platform inputs; actual compile/assembly, not an admission-only wrapper. Refuse missing required identity/configuration instead of emitting an installation-ready placeholder. |
| Broker configuration | Embed the existing fixed app/service and intended readonly package mount/backing. A separate persistent claim contract/path may be implemented only after its same-UID protection and actual launch binding are selected and reviewed. Keep fullpath matching, original one-process startup and consumed/unknown state. No supplier activation or new business channel. |
| Maintenance entry | Fixed argc1 one-shot native entry calling the existing maintenance composition; real root-operator and protected-path checks before operations, no argv/env secret/keychain/selector inputs. Fixed nonsecret result/exit reporting only. Preparation may compile it but never invoke it. |
| Readonly payload | Intended image stays at the existing app `Contents/Resources/issuer-package.dmg`; actual runtime root must be the approved readonly mount, not a chmodded stage. Preserve binding plist/full closed-package anchors and actual loaded Node/addon checks. No mount or frozen package regeneration under this design authority. |
| Native signing/runtime | Proposed non-JIT Hardened Runtime/no-exception profile, explicit reviewed existing Developer ID identity, complete native dependency/entry/control-flow contract. A changed signature or flags alone cannot establish pre-main enforcement. No signing or key use without a concrete later decision. |
| Node/addon | The actual pinned Node input and proposed intended readonly Node are distinct. Resolve its actual signing/runtime/entitlement metadata and the separate JIT/library-validation design before finalizing requirements or signing an addon. No blind reuse of native/GUI entitlements, team wildcard, guessed CDHash or automatic Node resigning. |

## Acyclic preparation/signing sequence

1. Freeze actual source/toolchain/platform and role policy; identify the actual intended Node and controller artifacts. Missing Node/signing/dependency policy stops final role configuration; no fake ready result.
2. Bind an already acceptable actual Node signed identity, or separately authorize its resigning only after its role policy is selected. After any separately authorized Node/controller signing, bind their actual requirements. Then compile broker with those requirements, sign it only under its own approved scope, and bind the actual resulting broker requirement.
3. Compile guard against that exact broker identity; complete/sign remaining native leaves under reviewed role scopes. Freeze the actual closed Node/private consumer package, then image and binding record. Seal the containing app last. Never embed the outer app's future hash in itself/broker, resign a bound dependency afterward, or reuse former ad-hoc identities.
4. Every actual source/compile/sign/mount/install/runtime operation remains separately gated. A proposed batch could be reviewed against frozen inputs and per-step dependencies, but this source plan grants no such batch. Staged bytes cannot grant native issuer identity or access to real resources.

## Identity reference without a Keychain query

The previous desktop signing receipt records Developer ID Application `Vision XIX Labs LLC (FG5N98FE6W)` and public leaf SHA1 `4C2E59F247CA275001586AE020A9269464529452`. This is only a historical candidate identity reference, not proof of current key availability, certificate validity, acceptable custodian requirements or new signing authority. No certificate/private-key enumeration, extraction or signing occurred in this audit.

## Node observation resolved; next profile decision

The exact approved Node display completed once; [raw evidence and limits](node-observation/README.md) replace the earlier missing-observation gate. Six true exceptions prevent accepting this input as-is. The [minimal-JIT candidate](NODE-PROFILE-CANDIDATE.md) proposes a separate copy, with no automatic broadening or original mutation. Preparation/signing/execution remain separately gated; no additional operation is authorized here.

Exact pre-main dependency/load/host enforcement remains UNKNOWN. The candidate cannot resolve persistent consumption, qualify custody or authorize issuer/enrollment activation. All21parents remain open.
