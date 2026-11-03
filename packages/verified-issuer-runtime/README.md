# Canonical local issuer runtime — unqualified

The public CommonJS package exports only `readIssuerIdentity()`. It currently
returns an immutable **unavailable** result with no issuer-artifact authority.
The local canonical-main/native-current-origin implementation may expose bounded
package/native observations after its private checks, but runtime, issuer,
fleet and legacy qualification remain unavailable and execution stays false.
All TypeScript issuer readers continue refusing. No descriptor, caller flag,
manifest, environment value or imported callback can enable qualification.

The actual controlled restriction-first, readonly package → canonical CJS → same
compiled store/transport qualification is still pending. Source tests, native
compilation, ad-hoc signatures and file-set observations do not establish that
endpoint. Current-origin checks do not claim protection against a hostile host
or malicious native code already executing inside the trusted runtime.

## Explicit runtime distribution

The package `files` allowlist is exact: index/types/README, the internal full
file-set verifier and the generated `native/origin_guard.node`. Diagnostic
`origin-unit` code, unsafe historical capability initializers/classifiers and
native tests are not production runtime files. The fixed bootstrap is a distinct
prebuild artifact relocated to `__axiom_runtime__/origin-bootstrap`; the broker
and controller belong to the separate control app, not this npm package.

A native overlay must be compiled and recorded **before** one fresh build
attempt. Its source, fixed compiler configuration, unchanged build Node and
headers, native outputs and signed broker/controller are rechecked by the build
and materializer. A completed stage/receipt must never be patched. These are
unqualified build-input observations, not runtime identity or publisher trust.

The outer control app binds the completed package manifest only after
materialization, then seals its resource image and binding file. This avoids a
broker/guard/package digest cycle. Actual image/service/restriction execution
requires its own exact reviewed run; no packaging command installs a service,
mounts an image, initializes identity or performs a provider action.

## File observation and qualification limits

The internal `verify-package.cjs` performs strict manifest/full-file-set/NFT
observation verification and is not a package subpath export. Python/CJS
`package_file_set_verified` is never a cross-language capability. Profiles `/1`
and `/2` retain their explicit trace bounds and unavailable qualifications.

The package is externalized from Next so the eventual compiled consumer can
resolve the same actual canonical module instance. Resolution or compilation
alone does not prove controlled execution. The full cache/alternate-main,
worker, tamper, replay, current-origin and same-consumer matrix remains required.
Historical failed restriction experiments and consumed attempts remain unchanged.
