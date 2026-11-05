# Detached broker preparation — restore approved seal-last order

## Evidence and cause

The previous exact signing argv targeted a file inside the app's Contents/MacOS path whose basename equals CFBundleExecutable. Its raw display reports app bundle, bound Info.plist and sealed resources; CodeResources was added. The controller in the same app was not CFBundleExecutable and displayed a thin file. This explains why pathname-only targeting failed to ensure leaf-only effects. No additional signing experiment is needed to establish the observed discrepancy.

The already approved System peer-binding proposal explicitly requires independent leaf signing before sealing the containing app last. The local assembler correction adds a separate broker-leaf phase emitting only stage/leaves/AxiomIssuerBroker, outside every .app ancestor. It preserves all historical phases/artifacts and keeps actual installation paths fixed. No signed bytes are moved into an app or enabled, and no existing seal is removed. A new actual key operation still needs a separately frozen packet and explicit approval; detached layout alone is not proof of actual codesign behavior.

## Local verification

One new actual owned-stage test failed because detached phase was missing, then passed with the added phase: only broker recipe, exact outside-app output, known Node/controller requirements, no guessed broker/guard hash, no target execution and closed readiness/activation. Historical passing suites were not repeated. No signing, Security/Keychain call, target execution, install, account/service, provider, deployment or spending operation occurred.

Full Governance/System/custody/consumer/fleet/coverage acceptance and all21parents remain open.

Actual fresh detached compile passed exit0/empty stderr, same original unsigned byte hash,0600/unrun. Complete original stage file closure verified; only declared detached output added. Source review passed; exact next signing review prepared but no key use authorized or performed.

Independent read-only final review passed: all2875original staged inputs, exact compile argv/full detached output binding, emptyplist/receipt hashes and standalone/file-set signing guard packet agree. No codesign/Security/target/test/build operation repeated.

## Actual separately approved detached signature

~~One exact signing/strict verification/display sequence passed~~ (signing-observation/result.json). Everycommandexit0; actual display confirms standalone thin arm64, Info.plist not bound, no sealed resources, Runtime/FG5Team/exact broker identifier/empty entitlements. All2875original stage inputs and exact file set unchanged. New signed bytes `bc9dada02019204bd581f8441e977880c40902e154b5653b5e6f1ff128be43ed`,190656bytes,0600/unrun. Independent ordinary-file review passed without repeating commands. Approvalcall_TakF...consumed; no retry. The earlier unintended app-bundle seal remains preserved and is not accepted as final. Static success is not execution/custody/installation/Governance acceptance.
