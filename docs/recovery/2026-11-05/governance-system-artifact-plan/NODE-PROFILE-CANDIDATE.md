# Private Node profile candidate — design only

## Decision and evidence

The approved display in node-observation/result.json binds the existing arm64 input SHA256 e4b5a3af0e05c75de2eae013904145f40fe7fc2a6e6f17510128bf45cca4e79b. Its six true entitlements are preserved verbatim. A Hardened Runtime flag does not qualify this input for private bootstrap resources. No actual compromise is asserted.

Propose a separately bound review copy, never modifying the .nvm original. Its candidate entitlement dictionary contains ONLY com.apple.security.cs.allow-jit=true. The other five observed exceptions are absent. This is a hypothesis to qualify, not a demonstrated compatible or secure runtime. Failure must stop; no automatic entitlement broadening, alternate signing identity, different Node download or retry.

## Numbered execution checklist

1. ~~Observe the exact existing Node profile once and retain unchanged-input evidence.~~
2. **In Progress — design:** specify minimal-JIT candidate and preserve all unresolved protection requirements.
3. ~~Approved inert preparation completed; exact bindings in node-candidate-preparation.json.~~ The fresh nonexecutable copy, one-key plist, fixed test source and same-install license are prepared. Original unchanged; no signing/execution. Preparation specification: prepare a fresh private directory and nonexecutable copy, exact one-key plist and a benign fixed test script. Bind source, copy, license, script and intended signer separately. Reject existing destination/symlinks; directories0700/files0600. No key use or Node execution during preparation.
4. [ ] Obtain exact signing/test authorization against those prepared inputs. Historical company identity reference is not proof of key availability or permission. Any signing must target only the copy, use the reviewed existing identity, runtime option and no network timestamp. No key export/enumeration/ACL change. Error, prompt or unavailable identity stops without fallback.
5. [ ] Under that exact authorization, verify/display the resulting copy and run only the bounded benign compatibility test; restore nonexecutable mode. Bind all before/after bytes, outputs and consumed attempt. A pure arithmetic smoke does not prove JIT optimization, addon compatibility, pre-main protection or custody.
6. [ ] Separately qualify actual private consumer/addon dependency enforcement, substitution resistance, running identity, process/resource custody and platform support. Same-team library validation alone is insufficient. No private resources are supplied before those gates pass.
7. [ ] Resolve persistent no-replay consumption and one-allowed-launch binding independently. Neither this candidate nor a successful smoke resolves the rejected same-UID writable claim.
8. [ ] Only then consider the existing System assembly/signing sequence, actual installed qualification, fleet/drain/coverage and genuine native governance reviews. No issuer/enrollment activation follows from this document.

## Authority and stop conditions

This document authorizes no artifact creation, signing, Security calls, execution, installer/service/account operation, real secret access, provider call, deployment or spending. Original Node and historical receipts remain unchanged. Native custodian remains non-JIT with its own proposed no-exception profile. All A1–A9/B1–B6/C1–C6 acceptance requirements remain binding and incomplete.
