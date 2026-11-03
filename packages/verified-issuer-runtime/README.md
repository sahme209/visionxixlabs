# Verified issuer runtime — unavailable foundation

Builtins-only local CommonJS package and one external-module consumer seam. It
exports only `readIssuerIdentity()`, which currently returns an immutable
unavailable result with no `issuerArtifactDigest`. Running its main entry fails
closed before importing Next or application code. Direct import, another module
instance, a worker, JSON and environment descriptors cannot initialize anything.
There is no exported or unused fake initializer and no successful launch path.

The real shared CJS package verifier, private launch registry, immutable-root
mechanism, native/runtime closure and same-artifact compiled issuer acceptance
are NOT implemented. Python `package_file_set_verified` is an observation, never
a cross-language capability. Future main-only initialization must remain inside
this canonical module after real verification/seal and before importing Next;
it requires source review and acceptance, not a global/env/HTTP handoff.

This package is explicitly externalized from Next so a future compiled consumer
can resolve the same module instance as its controlled launcher. Compilation or
successful resolution does not prove that a process used a verified artifact.
No provider/outbound path is wired to this package and no activation is enabled.

A running main cannot prevent Node preloads that execute before it. Current tests
prove it remains unavailable even with a preload; they do not claim loader
isolation. A future trusted launcher must reject loader/preload/path/cache attacks
before child execution and establish the approved trusted-host constraints.

Tests are limited real subprocess/module mechanics: direct/main/duplicate/worker
imports and forged descriptor rejection. They do not attest a package, launch a
Next server, replace provider authority, or qualify fleet/legacy runtime state.

The internal CJS `verify-package.cjs` now performs actual strict manifest/full
file-set/NFT observation verification, with Python-produced canonical fixtures
used only as data. It returns file-set observation with all execution/runtime/
fleet/legacy states unavailable and never initializes the public consumer. It
is not exported as a package subpath. Real sealed-launch identity remains absent.
