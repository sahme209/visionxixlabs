# Installed native integrity — next platform evidence required

Design/source research only under the existing installation-design specification scope. Local source5d276967 and the installed macOS26.5 SDK were read; no native binary, codesign tool, Security/Keychain API, service, principal, credential or external source was accessed.

## What the existing material establishes

The connected dormant provisioning/reader source is already locally verified. Its fixed path and permission checks run in native startup; they cannot retroactively prove that no attacker code ran before main. The composed-boundary design therefore still requires actual installed image, dependencies, loader/debugger and same-instance qualification. Do not replace that requirement with another hash manifest or successful mock.

The local `Security/CSCommon.h` declares signature flags for runtime hardening, library validation, dyld restriction and hard/kill behavior. It explicitly distinguishes ad-hoc signatures, which have no signer identity, and linker-generated signatures. These are declaration-level facts, not observed properties of our compiled artifacts or a supported exact installation policy. No signature flags were queried from a live process and no signing/verification operation was invoked. The current compile-only integration receipt remains unavailable for runtime qualification.

## Four concrete questions before selecting a signing/startup policy

1. **Hardened Runtime:** what supported protections are applied before main, what signing/runtime prerequisites exist, and which exceptions would defeat this supplier's no-injection boundary?
2. **Library validation:** what is admitted by default, especially Apple/same-team libraries, and what must the fixed immutable dependency closure prove beyond merely retaining this option? Do not equate same-team membership with the required exact supplier/consumer identity.
3. **Debugger and executable-memory access:** what do get-task-allow and runtime exception entitlements permit, and what must be absent or explicitly excluded for the non-JIT native custodian? Do not silently apply the custodian policy to Node's separately unresolved JIT/runtime needs.
4. **Code requirement/static versus running identity:** how should exact installed code/dependencies and the actual running process be checked without treating a valid disk signature, path, certificate or metadata flag as proof of the running protected instance?

The inspected local headers do not fully specify these entitlement interactions, supported runtime behavior and deployment requirements. Existing approved Apple reference batches concern ACL encoding, IPC identity and Keychain supply; they do not resolve these four questions. A new narrowly bounded public-documentation read is therefore needed before selecting an implementation recipe. No new protection mechanism or entitlement policy is chosen here.

## Requested research boundary

Official Apple documentation search to locate at most four relevant public Apple pages covering the questions above, then read those pages. Text only. No repository clone, SDK/font/binary download, codesign/Security API invocation, signing identity/key access, installation, service/account change, image/restriction experiment, provider/customer data, inference, deployment or spending. Earlier public-read permissions were finite and are not reused.

After permission and research: preserve exact sources/redirects and their limits, select or reject a concrete proposed non-JIT custodian profile, reconcile it with actual native/Node/dependency/installation requirements and independently review that proposal. Any new code/signing or real installed qualification still needs its own scoped authorization; documentation cannot make custody or Governance available. All21masterparents remain open.
