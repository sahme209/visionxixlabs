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

Implement one **owned local named-profile write-denial feasibility probe** first.
The candidate is exactly `sandbox_init(kSBXProfileNoWrite, SANDBOX_NAMED, &error)`.
It combines no profiles and accepts no policy text, flags, mutable-data exception,
customer credentials, or provider access. Its documented purpose is filesystem
write prohibition; it does **not** establish network or process-execution denial.
The probe must perform no network/provider operations. Any outer harness network
restrictions are test controls, not proof that the child installed those restrictions.
If the API or actual required write denials fail, report unsupported; do not silently
substitute a different profile or claim a production launch.

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
   initialization itself installs the **fixed named `kSBXProfileNoWrite` profile** through
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

The SDK explicitly says flags **must be `SANDBOX_NAMED`; all other values are
reserved**. Use only `kSBXProfileNoWrite` with that flag and proper error-buffer
cleanup. No flags-zero literal profile, custom Seatbelt text, private API, or
combined profile is proposed. Other predefined names include `kSBXProfileNoNetwork`
and `kSBXProfilePureComputation`; their existence does not combine their effects
with NoWrite. The header also says an already-sandboxed process ignores the new
profile and returns an error: **do not chain calls or assume additive restrictions**.
In particular, an outer sandbox-exec wrapper may cause this probe's initialization
to fail; record that incompatibility rather than pretending both profiles applied.
Do not remove or weaken required harness controls without review to obtain a pass.

Do not infer a supported `sandbox_check` ABI from a symbol: its declaration/filter
constants were absent from the inspected public SDK. No guessed private ABI,
entitlements, privileged helper, sudo, or system setting change is proposed. If
installation or the required actual write enforcement is unavailable, stop with
`native_sandbox_profile_unsupported`. No permission-only, parent-asserted, or
post-load-observation fallback is allowed.

The native build/toolchain is an explicit prerequisite. Its resulting bytes and
native dependency closure must be included in a newly successful exact-source
package; hashing an arbitrary cached addon or compiling it after packaging cannot
retrofit provenance. System frameworks, the kernel, loader, and host toolchain
remain explicit trusted-host prerequisites, not a hostile-host attestation claim.

## Immutable closure and enforcement

The package must be genuinely kernel-readonly before main runs; owner-writable
`chmod` modes are insufficient. The named NoWrite profile is a **candidate** for
protecting the executable root and backing files. Its actual behavior must be
qualified against package/backing-image writes, rename, truncation, unlink,
metadata changes, alternate writable paths, and retained open descriptors. Do not
claim every operation is denied from the profile's name alone. Readonly mount
observations alone do not establish backing-file protection.

There is no proposed exemption for writable executable caches, source trees,
alternative module/native loader paths, downloaded modules, or mutable Next
configuration. If required write protection cannot be established, immutable launch
remains unavailable. Any future data-write exception requires separate review.

NoWrite does not establish network or process-execution denial. These are explicit
limitations, **not newly invented mandatory conditions for local identity** under
the original approved immutable-launch design. Provider traffic remains forbidden
by this task and independently governed by existing action authority/transport
controls. No local identity grants provider access. The host owner/kernel remain
trusted; external hostile-host modification and fleet absence remain out of scope.

## RED → GREEN qualification gates

| Boundary | Required genuine negative and positive evidence |
| --- | --- |
| Native installation | On an owned child, absence/failure/unsupported API never imports the fixture consumer or returns identity. Actual successful API installation must precede observed kernel denials; a mocked boolean is insufficient. |
| Filesystem enforcement | An otherwise-writable owned control file is writable in an unrestricted control child, but denied in the restricted child; package/backing-image writes, truncate/rename/unlink/metadata and retained writable-descriptor cases refuse. Compare exact file bytes afterward. |
| Network/process scope | No network/provider operations occur in the probe. NoWrite is not credited with network or process-execution denial. Outer harness restrictions are documented separately and never become child self-proof; initialization failure under an already-sandboxed harness is unsupported, not a chained success. |
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

The first named-profile probe grants no identity and authorizes no provider traffic.
If actual NoWrite enforcement, clean loader/runtime closure, immutable package and
all actual compiled-consumer gates subsequently pass, it may support local identity
under the original approved design without invented network/process-denial gates.
Provider traffic still requires its existing independent action authorization; the
probe itself supplies none. Writable runtime exceptions and unsupported OS changes
require separate review. No global activation or current coverage change is
part of this proposal. Until every relevant gate passes, keep fixed unavailable
states and do not expose an `issuerArtifactDigest` as executing identity.

Review requested: approve or reject the additional native component/API support
risk, the strict first profile, the exact main-only topology, and these acceptance
gates before implementation. If the deprecated API cannot support a defensible
profile, retain unavailable and select a separately reviewed execution boundary.

## Review correction before approval

Independent review and a second direct SDK-header read corrected the initial draft's
unsupported literal-profile/flags assumption and combined network/process-denial
claims. The public API requires SANDBOX_NAMED and rejects re-sandboxing. This revision
proposes only fixed named NoWrite feasibility, records its exact limitations, and
does not promote a harness result or profile name into actual issuer identity.
No native code or test was executed while making this documentation correction.
