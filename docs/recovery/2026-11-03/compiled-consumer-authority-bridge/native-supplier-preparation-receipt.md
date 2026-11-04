# Native supplier preparation receipt

Local preparation only under approval `call_Mm4BMrLH7OrDbH1LNoKN51j7[0]`, based on `86a43469`. This is **incomplete actual supplier delivery**, not a completed operational custody gate or issuer qualification.

The real Objective-C supplier body implements the three fixed generic-password queries with service `com.visionxixlabs.axiom.issuer.bootstrap` and accounts `authority-postgres`, `vault-key`, `desktop-session-key`. It checks returned CFData type/length before copying, validates datasource UTF-8/PostgreSQL URL shape, and wipes owned material on failure. Startup includes weak-symbol availability and actual `SecKeychainSetUserInteractionAllowed(false)` success checking, once, before workers, with no reset/re-enable. No code here invokes those APIs during compilation or import.

## Explicit unimplemented gate

`axiom_private_supplier_operational()` currently returns zero unconditionally. Genuine immutable dedicated system launch/search context, file-based item provenance/ACL qualification and compatible provisioned resource exclusivity have not been implemented or established. This closed placeholder is **not** counted as an actual available supplier or completion of the approved connected implementation unit. Actual OS query source exists and compiles behind it; no query, no-interaction setter, custodian executable, native helper or signed-in app was run. No flag, UID, frame, item bytes or source hash may turn this into qualification. Replacing this closed gate requires concrete separately authorized installation/custody work and evidence.

The broker source reserves one delivery with the original epoch/deadline, creates a fresh close-on-exec anonymous pipe, maps only its readonly end to child fd0, adopts/watches the actual stopped child before resume, and starts one bounded supplier worker only after actual native session ACK. The header carries the authenticated retained epoch/deadline and startup client/broker nonces. The writer is nonblocking and handles partial writes without restarting at zero; it marks consumed before the first possibly exposing write, closes on timeout/revocation, and wipes late material. A blocking supplier job retains its storage and prevents false shutdown completion until its API returns. This path has not run or been security-qualified.

## Exact permitted local checks

All commands ran in `/private/tmp/axiom-native-bootstrap-supply-86a4`. Exit status zero, no compiler diagnostics:

```sh
clang -fblocks -Werror -Wall -Wextra -c packages/verified-issuer-runtime/native/origin_broker.c -o /private/tmp/axiom-bootstrap-broker-86a4.o
clang -fobjc-arc -Werror -Wall -Wextra -c packages/verified-issuer-runtime/native/origin_private_resource_supplier.m -o /private/tmp/axiom-bootstrap-supplier-86a4.o
clang -std=c11 -Werror -Wall -Wextra -c packages/verified-issuer-runtime/native/origin_private_bootstrap_writer.c -o /private/tmp/axiom-bootstrap-writer-86a4.o
clang -std=c11 -Werror -Wall -Wextra packages/verified-issuer-runtime/native/tests/private_bootstrap_writer_test.c packages/verified-issuer-runtime/native/origin_private_bootstrap_writer.c -o /private/tmp/axiom-bootstrap-pure-writer-86a4
/private/tmp/axiom-bootstrap-pure-writer-86a4
```

Only the last executable was invoked. It uses synthetic buffers and asserts max-size encoding, fixed header/nonces/offsets, invalid lengths, missing epoch, NUL, invalid UTF-8/surrogates and valid multibyte UTF-8. It contains no OS resource calls. This test does not establish partial-IO/state-machine behavior, native origin, ACL/custody, compiled-consumer identity or authority. Those remain unresolved until their permitted checks and original qualification gates pass. The blocked compiled-consumer/cache-forgery test was neither generated nor rephrased.

Object/test SHA-256 at this check:

```text
e1086a4e5d88ffcf71d3c9a5fb936a8c8d1d6a6e2ee057c1805a22a2cdce9c62  broker.o
3bdf31ce197944b7bcc7a1a7ec591498d892ba5b06048bb9a8e1fbabec03f7ab  supplier.o
29110b43ef375d0cff5ac6802aa9e5bc1e5cd01a799f5a7feef09e88141f8157  writer.o
d87767f7b9eb01fd7e2762c6c72ab9b3dec6e7b409661a80eea82f259000950e  pure-writer-test
```

No live material, credentials, SQL, provider effects, installation/provisioning/grants, service registration, restrictions/mounts, native/helper launch, deployment or activation occurred. Default profile and actual issuer identity remain refused.

## Concrete remaining mechanism and evidence

The existing diagnostic `origin-unit/prepare.py` emits a user LaunchAgent, which cannot establish this selected custodian. It remains unchanged. The selected architecture needs a separately reviewed actual system-domain launchd definition for the dedicated non-login `_axiomissuer` principal and the fixed installed supervisor/package paths described in `process-placement-and-request-channel.md`. The real service, manifest, executable, package and parent directories need administrative ownership and desktop-user non-writability; origin/session lookup must consistently reach that actual system namespace. Preparing a reviewed definition and immutable-path verification is distinct from authorizing account creation, installation, bootstrap registration or starting it.

Actual installation evidence must establish the fixed daemon's system security session/default file-based System-keychain search context, fixed three items' provenance and file-based `SecAccess` ACL authorization for that exact supervisor identity, and compatible DB/vault/session custody with equivalent unbound/legacy access withdrawn. API success, effective UID, a supplied JSON statement and a compile-time ready flag cannot substitute for that evidence. The currently consumed references do not supply a supported introspection API that proves all those properties. Therefore this source preparation does not invent one or silently open System keychain, broaden search, inspect items, or reclassify runtime observations as proof. A concrete reviewed installation/ACL qualification procedure and supported verification mechanism are still required before this closed gate can be replaced; they are outside this bounded no-install/no-Keychain-execution task.
