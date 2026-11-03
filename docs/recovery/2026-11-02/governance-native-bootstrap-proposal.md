# Same-process native bootstrap — local review proposal

November 2, 2026 · **PROPOSED; NEW NATIVE BOUNDARY REQUIRES REVIEW.**

This proposes local implementation and owned tests only. It does not authorize
provider traffic, credentials, downloads, deployment, settings, activation, or an
executing issuer identity. No runtime implementation, native compilation, launch,
or network request was performed to prepare this proposal.

## Problem and proposed smallest profile

The existing canonical external CommonJS package can verify a complete file set,
but built-in Node APIs cannot install the necessary macOS process restrictions.
Readonly files alone do not protect a mounted image's backing file. A parent's
receipt, environment value, callback, or claimed sandbox status cannot initialize
private issuer identity. See `governance-private-bootstrap-kernel-gap.md`.

Implement one **owned, network-denied, read-only local probe profile** first. It
would combine a real readonly mounted package with actual same-process sandbox
installation before application imports. The first profile denies filesystem
writes, networking, and subsequent process execution; it has no mutable-data
exception, arbitrary policy input, customer credentials, or provider access. If
Node, addon loading, required runtime operations, or the sealed compiled fixture
cannot work under these restrictions, that profile is unsupported. Do not silently
broaden it or call a narrower successful probe a production launch.

This is an **experimental local control test**, not a production-supported profile
based on a deprecated API. Approval of the fixed probe would not approve trusted
bootstrap identity for the actual issuer. The latter remains a separate acceptance
decision requiring the complete sealed compiled-consumer evidence below.

## Exact topology and private initialization

1. A reviewed trusted-host launcher starts the **packaged Node executable** at the
   fixed canonical package `index.cjs`, using a freshly constructed environment and
   fixed arguments. It does not preserve `NODE_OPTIONS`, `NODE_PATH`, loader hooks,
   preload flags, dynamic-loader variables, credential variables, or caller-selected
   JavaScript. It rejects unsupported launch flags before child creation. Package
   paths, runtime bytes, and entrypoints must belong to the verified readonly root;
   no workspace module roots, writable configuration, or development/HMR fallback.
2. Main uses built-ins only to verify the strict manifest and complete executable
   file closure, including its own canonical external module, native component,
   packaged Node, compiled consumer, application entrypoint, native addons, generated
   dependencies, and trace/support files. It verifies actual readonly filesystem
   controls and supported host/runtime prerequisites. This is performed before
   loading the native component or application modules. Missing native/transitive
   closure refuses; trace presence or a Git/build hash is not a completeness grant.
3. Only `require.main === module` can enter the bootstrap sequence. Direct imports,
   duplicate module instances, worker imports, environment data, DTOs, and package
   observations cannot enter it. Public package exports remain read-only
   `readIssuerIdentity()`; no exported initializer, setter, token exchange, global
   registry, IPC initialization message, or caller-provided validator exists.
4. Main loads one fixed, canonical, manifest-bound native addon. Its N-API module
   initialization itself installs the **compiled fixed restriction profile** through
   the actual OS API. It accepts no JS arguments and exports no callable methods,
   policy setter, or authority boolean. Initialization throws/terminates on an
   unsupported platform/API/profile or installation failure. Successful `require`
   completion means that actual package-bound code completed restriction installation;
   no JSON result or remote/parent assertion substitutes for this execution.
5. Main retains state lexically inside the same external CommonJS module. The addon
   cannot grant identity to another module instance. Application code is imported
   only after actual restrictions and all required launch gates pass. A compiled
   consumer must resolve exactly this canonical cached external module. No
   already-loaded module is blessed by a later rehash. Main must refuse unexpected
   pre-application module cache entries, aliases, loaders, or prior initialization;
   this supplements rather than replaces the trusted launcher's pre-import controls.

Loading a native addon directly can at most apply restrictions to its own process;
it cannot initialize the lexical issuer state. Merely reaching the restricted local
probe still does **not** enable a verified issuer variant: that remains absent until
the actual same-artifact compiled consumer acceptance below is satisfied and reviewed.

## Actual OS API and support constraints

The inspected local SDK header
`/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sandbox.h` declares
`sandbox_init(const char *profile, uint64_t flags, char **errorbuf)` and
`sandbox_free_error`. The header explicitly marks the API **“No longer supported”**
and deprecated for macOS 10.5–10.8. API availability does not imply that the required
profile is supported or stable on the current OS. The host observed during this
investigation is build `26B123`; another host/build requires qualification again.

Use only that declared API, with flags fixed for the reviewed literal profile and
proper error-buffer cleanup. Do not infer a supported `sandbox_check` ABI from a
symbol: its declaration/filter constants were absent from the inspected public SDK.
No guessed private ABI, entitlements, privileged helper, sudo, or system setting
change is proposed. If `sandbox_init`, its required operations, inheritance, or
actual enforcement is unavailable, stop with `native_sandbox_profile_unsupported`.
No permission-only, parent-asserted, or post-load-observation fallback is allowed.

The native build/toolchain is an explicit prerequisite. Its resulting bytes and
native dependency closure must be included in a newly successful exact-source
package; hashing an arbitrary cached addon or compiling it after packaging cannot
retrofit provenance. System frameworks, the kernel, loader, and host toolchain
remain explicit trusted-host prerequisites, not a hostile-host attestation claim.

## Immutable closure and enforcement

The package must be genuinely kernel-readonly before main runs; owner-writable
`chmod` modes are insufficient. The native restriction profile denies **all**
filesystem writes, including package files, its backing image and parent directory,
renames, truncation, unlink, metadata changes, and alternate writable paths. It
does not rely on a supplied backing-image pathname. Required mount/detach, process,
or other mutation operations must be shown denied where the proposed profile can
express them; otherwise the immutable-launch gate remains unsupported. Existing
open descriptors and OS/native mutation paths need explicit tests; open/read-only
mount observations alone do not prove these properties.

There is no exemption for a writable executable cache, source tree, alternative
module path, native loader path, downloaded module, or mutable Next configuration.
The first profile allows no mutable application data. Any future logs/cache/data
exception needs a separate concrete non-executable path policy and tests against
module/config/native loading from that path. Do not grant executable writes to
make a server start. The host owner/kernel remain trusted; external hostile host
modification and fleet absence are outside this local model.

## RED → GREEN qualification gates

| Boundary | Required genuine negative and positive evidence |
| --- | --- |
| Native installation | On an owned child, absence/failure/unsupported API never imports the fixture consumer or returns identity. Actual successful API installation must precede observed kernel denials; a mocked boolean is insufficient. |
| Filesystem enforcement | An otherwise-writable owned control file is writable in an unrestricted control child, but denied in the restricted child; package/backing-image writes, truncate/rename/unlink/metadata and retained writable-descriptor cases refuse. Compare exact file bytes afterward. |
| Network/process limits | Actual network attempts and child execution are denied in the owned probe without contacting a real provider. Use local controlled endpoints only if separately allowed for the test; otherwise no-network tests must not claim all network-operation coverage. No retries or provider credentials. |
| Readonly root | Writable copy, permission-only readonly root, missing mount, writable runtime/native module, changed mode, symlink alias, missing file, or extra executable file refuses before native load/application import. Actual sealed fixture is the positive control. |
| Pre-import/loaded code | Preload/loader/path/cache overrides refuse before child execution where controllable. Attempt replacement before and after import, duplicate resolution, worker/restart and direct-import initialization; none can acquire or replay lexical identity. Record trusted-host limits honestly. |
| Same compiled consumer | A newly successful exact archive build must include the canonical native bootstrap and actual compiled issuer/store/transport consumer in the same sealed package. Real compiled composition, with explicitly simulated auth/provider ports, must obtain identity through the same module instance and refuse tampered/partial/runtime/native/profile variants before reservation/mint/write. A toy fixture alone cannot pass this gate. |
| Separation | Even a later reviewed `local_verified_launch` has `executionAuthorized:false`; fleet, legacy, coverage, activation and external quiescence remain unavailable. No package digest substitutes for role/source/approval/claim/drain checks. |

Tests must preserve actual RED receipts before fixes and include successful control
operations to distinguish sandbox enforcement from filesystem permissions or an
already-readonly backing file. Any environmental inability is reported as
unsupported/unavailable, never converted into a passing positive test.

## Staged result and decision requested

First implement the fixed internal native boundary and owned denial tests while
the public consumer remains unavailable. Then qualify the readonly sealed fixture
and supported runtime closure. Only after an actual successful package containing
the native boundary **and actual compiled issuer consumer** exists may a reviewed
private identity variant be implemented/accepted. Current Prisma engine provenance
still blocks the full application build and is not bypassed by this proposal.

A network-denied local probe is not a provider-enabled production runtime. Permitting
real provider networking, writable runtime data, additional processes, unsupported
OS profiles, or production issuer binding requires a separately reviewed concrete
profile and its genuine tests. No global activation or current coverage change is
part of this proposal. Until every relevant gate passes, keep fixed unavailable
states and do not expose an `issuerArtifactDigest` as executing identity.

Review requested: approve or reject the additional native component/API support
risk, the strict first profile, the exact main-only topology, and these acceptance
gates before implementation. If the deprecated API cannot support a defensible
profile, retain unavailable and select a separately reviewed execution boundary.
