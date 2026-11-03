# Revised controlled launch: eliminate retained filesystem capabilities

**Design for review; not implemented or executed.** This changes the native
qualification mechanism and requires its own decision before implementation or
execution. Existing canonical readers, launcher refusal, enrollment and activation
stay unavailable. It authorizes no rerun, native call, mount, identity, initializer,
provider access, credentials or settings change.

The next implementation is a clean launcher plus capability-aware native
initializer, not another attempt to make NoWrite revoke existing descriptors.
Keep the original main-only CJS/native-addon topology; do not move restriction
installation into a different process and accept a parent receipt afterward.

## What actually failed

The exact approved binary installed the named profile and denied ten of twelve
restricted operations. The unrestricted control succeeded in all twelve.
`retained_write` and `retained_truncate` nevertheless succeeded after installation.
Independent observation found changed bytes and an empty retained-truncate file.
The original return 78 and its generic final message remain immutable evidence.
This is **successful installation with insufficient retained-capability protection**,
not evidence that `sandbox_init` failed or the API was absent. NoWrite alone does
not qualify the issuer. Do not remove those cases, relabel them passing, or retry
the consumed approval.

## Fixed order to implement after review

1. **Package first.** A new exact successful build must contain packaged Node,
   canonical external CJS main/reader, one fixed native addon, actual compiled
   issuer/store/transport consumer and complete native/dependency closure. No
   patching the old copied package, workspace import, HMR, download, or late
   native replacement. Current module still returns unavailable.
2. **Seal before exec.** Build an owned readonly image from that closed package;
   attach readonly at a canonical owned mountpoint. Both host preflight and the
   later in-process verifier must observe kernel readonly flags on the actual
   package root. Permission bits alone fail. The host prepares/seals the image
   before launching and closes creation/write handles. No mount is performed by
   this design document.
3. **Fresh clean exec.** The trusted host launcher runs the exact packaged Node
   executable at fixed canonical `index.cjs`. It constructs an environment from
   an explicit fixed allowlist, fixed cwd and fixed arguments; it does not copy
   loader/preload/inspector/compile-cache/credential variables or caller entrypoints.
   Use close-on-exec-by-default plus explicit file actions (or an equivalently
   qualified close-fds subprocess implementation), not a guessed descriptor list.
   Pass only fd0 opened read-only on `/dev/null`, and fd1/fd2 as anonymous pipes
   created and owned by the trusted launcher. Logs are collected by the host;
   stdout/stderr must not be writable regular files. No caller fd, socket, shared
   memory object, image handle or directory capability is passed through. A fresh
   exec discards the launcher's address-space mappings; fork alone is insufficient.
4. **Builtins-only CJS verification.** Before any application import, verify main
   identity, exact manifest/closed file set, actual executable and native paths,
   loader arguments, canonical module cache, and the kernel-readonly root. Main
   can only require the one manifest-bound addon after these checks. A parent JSON,
   descriptor number, environment string or package hash is not process identity.
5. **Native pre-inventory.** The addon's no-argument initialization enumerates only
   its own process descriptors and virtual mappings using the inspected public
   SDK. Fixed bounds: at most 4,096 descriptors and 16,384 leaf VM regions; overflow,
   truncation, duplicate/changed descriptor identity, failed classification,
   unsupported version or non-progressing region traversal refuses. No external
   PID, privileged task lookup, raw memory contents, environment dump or network
   is inspected. This must also reject a dangerous capability deliberately opened
   by a fixture after clean exec but before addon initialization.
6. **Install the same fixed profile once.** Call only
   `sandbox_init(kSBXProfileNoWrite, SANDBOX_NAMED, &error)` and free its error
   buffer correctly. No chaining, flags-zero policy, private API, temporary-write
   exception or alternate profile. An already-sandboxed/unsupported process fails;
   do not weaken its outer controls to obtain a pass.
7. **Native post-inventory, then reverify.** Repeat capability inventory after
   successful installation, before returning from addon initialization. This
   catches a writable descriptor/mapping acquired between the first scan and
   installation. Refuse rather than close an unexpected capability and continue:
   its earlier effects or mappings may already matter. After successful addon
   completion, reverify the sealed closure, readonly root and no unexpected
   module/native loads before importing the application. Changed bytes/modes,
   unknown state or failed reads refuse. No already-loaded app is blessed later.
8. **Private same-module state last.** Only actual main execution in this canonical
   cached CJS module, after all those successful steps and the reviewed acceptance
   below, may initialize a future lexical capability. The addon exports no callable
   initializer, setter or boolean. Direct imports, duplicates, workers, IPC and
   restarted processes cannot initialize/replay it. No public identity variant
   is implemented by this document. Local identity never grants execution authority.

## What the native inventory must reject

- Any writable vnode descriptor (`F_GETFL` access mode `O_WRONLY` or `O_RDWR`),
  including a retained regular file, image backing file, hardlink alias or device.
  Do not treat path permissions, `FD_CLOEXEC`, an unlinked path or a descriptor's
  current file offset as revocation of an already-open write capability.
- A writable regular-file stdout/stderr replacement. Only typed anonymous pipe
  descriptors may carry output. A filesystem FIFO is not accepted from `S_IFIFO`
  alone; use the public descriptor type, and qualify the actual classification.
- Writable POSIX shared memory, pre-import sockets, unknown descriptor types and
  unexplained inherited handles. Start with typed anonymous pipes/kqueues needed
  by the qualified Node startup (bounded counts), exact readonly package handles,
  and fd0's checked readonly `/dev/null`. No structural caller-provided allowlist.
  Unexpected runtime prerequisites cause refusal and a separate reviewed change,
  not an automatic exception. This is capability closure, not a claim that NoWrite
  denies future network or process execution.
- A writable **shared file-backed mapping**, even if its fd was already closed.
  Check current **and maximum** protection: an initially readonly shared mapping
  with maximum write permission can regain write access. Private/COW runtime heap
  and mappings do not write through to backing files; classification must come
  from the qualified public VM information, not the absence of a pathname.
  A shared writable region with missing/ambiguous file classification refuses.
  Do not interpret `proc_regionfilename` returning no name as proof of anonymous
  memory. No system-cache exception is silently assumed; if the actual runtime
  cannot satisfy/qualify this rule using the public SDK, this mechanism stays
  unavailable and a different boundary needs review.

The two scans are not claimed to make arbitrary concurrent hostile native code
safe. The pre-import code/runtime is the verified trusted closure, with no caller
preloads or app code running. Installation prevents later new write opens; the
post-scan removes unknown surviving capabilities from the acceptance path. Exact
closure revalidation catches pre-import changes. If those facts cannot be shown,
refuse rather than claim atomic hostile-host attestation.

## Real package and backing-image protection — required evidence

The previous ordinary `backing_file`/hardlink controls were useful but not a real
image. The next owned qualification must contain and launch the **actual closed
compiled package** from a readonly image, not just a toy text file.

- Observe the mounted root/device and readonly filesystem through actual OS state
  in the child. Verify every required package/native/runtime file and internal
  link through the canonical root, refusing writable copies, symlink aliases,
  missing/extra executable files and external loader/module fallback.
- Target that exact owned image's backing file and a hardlink alias outside the
  mount for path write/open/truncate/rename/unlink/metadata attempts from the same
  controlled process. Preserve bytes, modes, inode/alias observations and image
  identity before/after. No privileged disk access, other mounts or customer paths.
- Preserve the original successful retained-fd writes as a negative control for
  **NoWrite alone**. For the revised launcher, injected inherited write handles
  must be absent (`EBADF`) after clean exec, or a substituted writable stdio handle
  must make native qualification refuse. A writable fd deliberately opened by the
  pre-import fixture must make the initializer refuse; it must never reach the
  consumer. Do not silently close it, discard the test, and call the profile fixed.
- Add a shared writable file mapping with its fd closed and a readonly-current /
  write-capable-maximum mapping. Both must refuse private initialization. Valid
  private/COW runtime state needs a positive control. Inventory failure/overflow
  and descriptor/mapping races must conservatively refuse.
- Under the complete revised qualified path, attempt backing-image and package
  mutation by all allowed owned aliases. Demonstrate denials and unchanged bytes
  in addition to syscall results. Trusted host/kernel/launcher can still mutate
  host-owned backing files; hostile-host resistance remains outside the original
  trusted-localhost model, and no parent observation is promoted into identity.

If real backing protection or complete capability classification fails, retain
`unavailable`. Do not weaken retained-fd checks or count mere mount/hash observation
as executing identity. The deprecated API risk and host/build qualification remain.

## Smallest acceptance sequence and implementation split

| Next work | Within original local artifact implementation | New native decision required |
| --- | --- | --- |
| Fixed argv/environment/cwd, package closure checks, explicit FD handoff policy and pure decoders/tests using recorded data | Can be prepared locally while actual launch and identity continue refusing. No customer reads or production changes. | Wiring/executing the revised native mechanism is not inferred from that approval. |
| Native descriptor/VM inventory + pre/post-install order, strict pipe/device/mapping rules | Can be specified/reviewed now; no fake positive provider or initializer. | Approve this changed mechanism before implementation/execution; the previous one-run native approval is consumed. |
| Owned readonly image carrying the actual new compiled package and backing-file/retained/mapping controls | Packaging/source plans remain local preparation. | Exact mount/native execution scope and bounded experiment must be made concrete and approved; no automatic probe retry. |
| Same-artifact compiled issuer + actual store/transport consumer | Original required endpoint remains the target, with auth/provider ports explicitly simulated. | Native mechanism must first pass; then all original compiled-consumer/tamper/loader/cache/duplicate/restart gates still need real acceptance. |
| Fleet/legacy credential qualification, provider quiescence, covered executors and enrollment | Remain separate outstanding controls. | No executing digest, source receipt or local probe supplies them or enables activation. |

Implement in that order. Do not spend another broad application build before the
native mechanism is actually qualified. The first future native result should
answer one bounded question: does the reviewed clean-launch plus pre/post capability
closure protect the real readonly package/backing image while permitting the fixed
packaged runtime to start? A passing toy probe still cannot complete Governance.
