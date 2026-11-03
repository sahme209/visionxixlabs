# Concrete named-NoWrite probe — prepared, not executed

This artifact makes the separately pending native experiment inspectable. Source preparation and compilation do not approve execution, install a restriction, establish immutable launch, or produce executing identity. The canonical issuer readers, package/launcher code and all production availability remain unchanged.

Source: `scripts/governance_local_issuer/native_nowrite_probe.c`.
Exact compile command, official SDK header hash, source hash, binary path/hash/modes and successful compiler status are recorded in `compile-result.json`. The final binary is owner-read/write only (0600) inside its unique owner-only (0700) build directory; it has never run. The first compiled preparation was superseded after review identified bounded child-reaping cleanup; its binary was also made non-executable. No runtime claim is drawn from either compile.

## Specific pending execution decision

A future approval would authorize exactly one invocation of this exact hashed standalone binary with `--owned-temp-fixture-run`, after making only that owned binary executable. It would create a generated `/private/tmp/axiom-nowrite-probe-XXXXXXXX` root (0700) and two private fixture directories. It accepts no caller fixture path, flags, policy text, environment authority or executable entrypoint. Retained fixture files remain available for independent inspection; it deletes no outside files.

There are exactly two forked children, supervised sequentially: an unrestricted positive control and a child calling only the public `sandbox_init(kSBXProfileNoWrite, SANDBOX_NAMED, &error)`. The API error buffer is freed without printing its contents. Each child has a two-second alarm; the parent bounds collection and child-reaping polls, kills a timed-out child, and explicitly reports unknown if bounded reaping fails. There is no exec, addon, bootstrap, IPC authority initializer, network/provider operation or environment dump.

Each child tests twelve fixed owned operations: create, path write, path truncate, rename, unlink, chmod, timestamp, retained-descriptor write, retained-descriptor truncate, retained-descriptor chmod, ordinary backing-like file write and hardlink-alias write. Files are prepared otherwise writable (0600), and the parent checks exact content, existence, modes, hardlink count and timestamp after each child's complete matrix. The control must succeed and the restricted operations must return EPERM/EACCES with unchanged files for a feasibility result. Missing files, unsupported API/profile, other failures or incomplete child reports cannot become successful restrictions.

Output is fixed bounded text (at most 28 normal lines with fixed operation names and numeric results), not JSON identity or raw environment/provider data. Exit 0 would mean only this owned-file feasibility matrix passed; exit 78 means unsupported/failed required restrictions, 74 means fixture/supervisor unavailable, and 64 means invocation refused. An unreaped child is explicitly unknown, never described as absent.

## Limits retained

The official public SDK marks the API deprecated and “No longer supported.” Suppressing declaration warnings for compilation is not platform support or runtime acceptance. An already-sandboxed harness may reject initialization; no chaining, alternate profile or weakening is provided.

The ordinary backing-like and hardlink fixtures are not a mounted image or sealed executable package. Actual backing-image protection, loader/runtime closure, private same-module bootstrap, the same-artifact compiled issuer/store/transport consumer, fleet/legacy qualification and activation remain unaccepted. NoWrite is not credited with network or process-execution denial. Provider access and all real action authority remain separately governed.
