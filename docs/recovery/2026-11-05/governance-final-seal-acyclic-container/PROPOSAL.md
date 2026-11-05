# Acyclic final container seal — approved local preparation

Local source/compilation/pure/mock preparation approved via call_JTk51lvoRfOo1Oo2e21DEbgF. No target/signing/assembly/installation authority.

## Verified dependency blocker

The current System Info.plist selects AxiomIssuerBroker as CFBundleExecutable. The native guard embeds the detached broker CDHash. The control app's sealed_control check requires actual valid sealed app resources; it cannot be skipped. Final app sealing binds Info.plist and CodeResources into its main executable's CodeDirectory. Saved real observations already demonstrate this context effect: identical unsigned broker bytes dab320… signed in app context yield CDHash0c47… with bound Info/resources, while the detached broker yields210bc… with neither. The guard is inside the private package/DMG, and that image is an app resource. Therefore brokerHash→guard→image→appResources→brokerHash is circular. Repeated rebuilding/resigning or replacing the hash after publication does not solve it. Existing owner/peer cycle repair does not remove this separate container cycle.

## Proposed explicit packaging boundary

Use a distinct fixed, native non-JIT/no-exception **container main**, not any authoritative native leaf. Its only entry returns a fixed unavailable exit status with no file/resource/network/XPC/process/credential effects or selectors. It never launches the owner or broker and is never accepted as their peer, controller, Node or issuer. This is the internal synthetic custodian container, not the customer desktop app; no UI behavior is replaced.

A new explicit versioned preparation/profile would set CFBundleExecutable=AxiomSyntheticContainerMain. Keep all existing authoritative leaf paths/identifiers/requirements unchanged: owner, broker, controller and maintenance remain nested independently signed leaves; bootstrap/guard/Node retain their existing roles. Final app signing may change only the new container main's signature and the final resource seal. No authoritative leaf pins the container main CDHash. The existing sealed_control app validity check remains mandatory, alongside actual root-protected peer selection and all per-message/current-origin checks.

The acyclic order is: independent native leaves and broker → guard → actual private package → image → containing-app resource seal/container-main signature. No --deep or leaf re-signing during final sealing. A later exact signing/assembly packet must compare every authoritative signed leaf byte/hash before and after the final seal and refuse/preserve any unexpected mutation; actual dynamic/loader/platform/custody qualification remains required.

## Local implementation scope requested

After validation-first approval only: prepare the fixed minimal container-main source, explicit new phase/version and exact proposed wrapper role metadata; compile locally and run pure/mock/owned-file tests only. Do not repoint or mutate historical stages/receipts/phases or require unnecessary re-signing/recompilation of already bound unchanged authoritative leaves. Keep historical version1 observations visibly unresolved. New container provenance is separate from the authoritative role table and cannot become an accepted XPC/issuer role. Model exact final assembly coordinates and seal-last DAG; no new operational enablement.

Tests must show: all authoritative leaf coordinates differ from CFBundleExecutable; no authoritative requirement depends on container-main hash; old broker-main profile remains explicitly unresolved; unknown/main-equals-controller-or-owner-or-broker refuses; exact fixed no-effect wrapper source/recipe only; existing stages remain untouched; original source/quarantine mode and prospective installed mode remain distinct; existing sealed_control guard remains present; readiness/identity/activation false. Versioned profile changes must not invalidate the original observed source graph merely by adding an unrelated wrapper source. Preserve every original requirement and unavailable gate.

## Excluded authority

No new key use, codesign/static/dynamic Security/Keychain call, target/container/Node execution, real image build/mount/seal, root/account/service/installation, grant, provider action, deployment or spending. Actual signing and final app sealing require fresh exact frozen review/approval after preparation, including the new main target. This design alone does not establish a sealed app, operational issuer, supported System topology, custody, private consumer, fleet coverage, native enrollment or Governance completion. All21master parents remain open.

Independent source/evidence review confirms the real dependency cycle and that this proposed distinct-main DAG addresses it while retaining sealed_control and all authoritative leaf paths. Local implementation is now authorized and In Progress. No actual wrapper target execution, signing, final assembly or installation is authorized.
