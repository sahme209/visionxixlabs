# Decision after restriction-first feasibility failure

**No retry or runtime implementation is authorized by this analysis.** The exact one-shot result is preserved in `../preexec-feasibility-result/`: Node starts; ordinary and shared-file effects are blocked; POSIX shm is created and written. The reviewed matrix fails. Canonical identity/enrollment remain unavailable.

## What this does and does not establish

The result does not show mutation of a package, image, backing file, native module, or private authority. A freshly owned anonymous/unlinked POSIX shared-memory object is not thereby an alias of any of those resources. Actual owned seed-file hashes remained unchanged. Conversely, those unchanged toy files do not establish actual package/backing-image immutability, absence of authority-channel influence, or safe module loading. No real readonly package or authenticated origin has been qualified.

Original artifact requirements are immutable executable root/loaded-code consistency, closed dependencies, private controlled-launch origin and the exact same canonical module consumed by the actual compiled store/transport (`2026-11-02/governance-issuer-artifact-binding-proposal.md` steps4 and loaded-code consistency). The later reviewed native design explicitly added denial of writable POSIX shm and maximum-write shared mappings. That is a real acceptance requirement; the latest experiment cannot be reclassified passing merely because its surviving shm was owned. The distinction below requires an explicit decision.

## Options

| Choice | Concrete mechanism | What must change / qualification |
| --- | --- | --- |
| **Preserve strict no-shared-write requirement** | Move the issuer into a separately qualified OS enforcement boundary with a minimal syscall/capability policy. A Linux VM candidate can expose the exact guest package disk read-only and no host shared directories; a fixed guest launcher would also need a verified filter denying named shm/SysV shm/memfd and shared writable/upgrade-capable mappings, with clean FD handoff. | New platform/package/launch-origin design, not a macOS NoWrite tweak. Apple Virtualization supports read-only disk attachment, but does **not** itself deny guest shm. Guest filter feasibility/Node compatibility and all same-artifact tests are unproven. No Linux sources/tools/images downloaded or API used. |
| **Explicitly scope enforcement to protected executable/authority resources** | Keep candidate NoWrite-before-exec only as one layer, actual readonly closed package/backing controls, no inherited writes, strict main/cache/import closure, and a reviewed kernel-authenticated fixed launch origin. Fresh isolated shm is allowed only if it cannot alias executable/backing resources, carry accepted authority, or become a loader path. | This changes the later native acceptance requirement and needs explicit approval. Preserve the old failed test as failure under its original contract; never rewrite it. Then design new resource-oriented controls/attacks against actual image and origin before any runtime code/run. Current toy result is not sufficient to approve or qualify this option. |
| **Supported macOS App Sandbox investigation** | A separately signed narrow helper with reviewed entitlements, never the deprecated named profile. | `sandbox.h` recommends App Sandbox, but the installed header does not promise denial of POSIX shm, complete resource isolation, or compatibility with this Node/Next package. No claim it solves the failure; investigate exact supported entitlements/contracts before proposing another experiment. Do not silently add private policy strings, NoWriteExceptTemporary, or chained profiles. |

A language/Wasm-only issuer could withhold filesystem/shared-memory host interfaces, but it cannot run the current exact native Node/Next package unchanged. It would be a substantial application/runtime rewrite, not the next small fix.

## Recommended next decision

Ask one bounded design question: **must the issuer deny every writable shared-memory object, or must it prevent mutation/substitution of the verified package, backing image and execution authority?**

- If the strict requirement stands, stop the current NoWrite qualification branch and approve design-only stronger-boundary evaluation. No more VM metadata exceptions or repeated NoWrite probes. First feasibility proof would be the minimal guest Node/control under a specified supported filter, not another whole-app build.
- If the protected-resource requirement is intended, explicitly approve the changed threat model first. Next deliverable is a narrow resource-oriented specification tying each permitted memory/channel capability to its non-authority/non-loader role; retain trusted-localhost assumptions, genuine approvals, private same-module initialization and all original compiled-consumer attacks. No immediate activation or inference from these tests.

For a trusted-localhost application, the second may be the smaller product mechanism, but it is not approved here and cannot be marketed as blanket shared-memory denial or hostile-host attestation. A positive origin/immutable-artifact mechanism remains necessary regardless of choice.

## Public source limits

Installed `sandbox.h` lines8–9 recommends App Sandbox; lines19–49 only defines the deprecated current-process named-profile call and lines70–73 labels NoWrite filesystem protection. It supplies no guarantee for POSIX shm; actual behavior is recorded, not inferred.

Installed `Virtualization.framework/Headers/VZDiskImageStorageDeviceAttachment.h` lines74–79 explicitly describes readOnly:YES as preventing the device writing the image. `VZVirtioSocketDeviceConfiguration.h` exposes guest↔host communication. These justify a candidate read-only disk plus dedicated channel design, not an executing identity, syscall policy, signed guest image, host backing-file protection or full system qualification. Trusted host can still modify its backing file; no hostile-host claim is introduced.

Only result files and installed headers were read. No restriction/profile retry, mount, network/provider read, broker code, native load, guest, credentials or identity was executed or created.
