# Historical review — the two displays were subsequently authorized and consumed

Current result: [observations and limits](metadata-observation/README.md). The original request below is preserved; its unapproved status is historical and cannot authorize another invocation.

# Two exact display-only artifact reads — requires approval

The four public Apple documentation reads do not authorize Security-framework-backed local inspection. This asks a new, concrete read-only exception, **not** signing, signature validation, a native experiment or an installation.

Exact inputs and commands are in metadata-read-packet.json, bound to the two already compiled integration outputs. Both remain0600 and will never be executed or loaded. The existing artifact hashes/sizes/modes were rechecked using ordinary file reads only; no codesign operation has run.

For each of those two exact artifacts, make one `/usr/bin/codesign --display --verbose=4 --entitlements :- <bound-path>` call. This displays existing public code-signature and entitlement metadata. It does not sign or verify the file, enumerate Keychains/certificates, access a private key or invoke the target program. No shell expansion, other path or followed document command is included. In particular, none of Apple's troubleshooting/cleanup/signing/notarization examples is authorized.

Before either call, recheck the input bindings. Changed input stops the batch. Ten seconds and65536 combined stdout/stderr bytes per display; zero retries. Unexpected prompt/network requirement, tool error, timeout or malformed/unavailable metadata stops without workaround, signing, repair or another command. Incomplete metadata remains unavailable, never a qualified image. Record raw bounded outputs with input identities and review their meaning separately; do not treat successful display as validation or running-instance evidence.

No `--verify`, `--sign`, `--deep`, assessment, timestamp, notarization, identity/key/certificate enumeration, Security/Keychain item operation, service/account/install action, provider/customer data, inference, deployment or spending is included. The target images remain dormant. A later signing/validation/installation request would require its own exact scoped review.
