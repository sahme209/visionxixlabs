# Linux capture worker — local source only

The worker/protocol/parent source supplies the missing bounded raw transport implementation. It is **uncompiled and unexecuted**. The earlier accepted daemon C/Rust compiler artifact does not cover these newly added sources.

`time_worker.c` consumes only fixed descriptors3–6, decodes the bounded context, calls the existing capture once, releases its duplicate and sends the explicit bounded frame. `time_worker_protocol.c/.h` keep canonical wire numbers, version/generation/publication/marker checks and exact EOF; no native struct or time authority crosses the wire.

`time_parent_binding.c/.h` provide only a private C initializer entry, not public addon registration or an arbitrary JavaScript descriptor/path constructor. The future qualified initializer must supply the already verified read-only worker ELF descriptor. The child uses transient CLOEXEC fd7/execveat; only fixed resources survive. Actual qualification of that resource/ABI remains absent. The parent source retains the original source descriptor, owns one atomic child/pidfd, keeps I/O and waits off the JavaScript loop, and distinguishes result from proven reap/cleanup. Unknown ownership or close acknowledgment retires the parent rather than becoming success.

`lib/governance/platform/nativeTime/nativeLinuxPorts.ts` snapshots raw resources and exact BigInts and owns both promise channels and cleanup. Its admitted source ports deliberately refuse currentness/start/final observation: no protected bootstrap, sampling/lifecycle or accepted policy supplier exists yet. Raw points are not converted into qualified zero-width intervals or default premises. This factory is not mounted in production and loads no addon.

`native-worker-source.json` is an inert closed input inventory and names the two future artifacts. Output hashes and accepted Node headers are intentionally absent, not invented. No existing package export, historical compiler packet, producer source, schema, provider action or activation flag changes.

## Verification scope

The actual TypeScript adapter and existing supervisor have55 passing mocked tests; strict project type checking passes using existing same-machine dependencies and matching generated client declarations. Seventeen Python source-contract checks inspect C/protocol boundaries only; they are **not native runtime tests**. Source reviews cover ownership, original-FD checks, closed wire framing and error paths. Original RED histories are retained in recovery receipts.

Next: freeze a concrete Linux worker/object build packet, then obtain compilation approval. Actual native FD/process/clock/lifecycle/cancellation, protected bootstrap/policy/private packaging and real host/custody/people/provider/end-to-end/closure qualification remain required. Governance stays unavailable; no installation, credentials, SQL, resources, deployment, enablement or spending is authorized here.
