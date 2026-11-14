# Focused Rust/Cargo diagnostic — terminal result

Owner approval: `Approve one conditional focused diagnostic`. One run43592176140/job132439038988 completed at source47adbced23b378f4f4789a6bec8d836641785240. Permission is CONSUMED; no retry or broader permission follows.

- The actual trusted launcher/probe compiled; unchanged filter program SHA256c6fb0bf97c09adbd27e0002b1c7dfcf4b79ae16522dc749096e440a340d9c556.
- Ordinary Rust Command child: **exit-ok**. Identical child with no-op pre_exec: **spawn-error/errno1**. This proves the selected stdlib fallback is incompatible with this profile, not which syscall or Cargo branch caused the original full-build failure.
- Actual tiny offline/locked Cargo compile: **exit101**,316stderr bytes, no output, **cargo-error-unclassified**. The saved result does not establish its cause. No static crate/lock/command error was found in two independent source reviews. Our classifier did not retain the actual useful message; do not invent it from a byte count.
- Every phase confirms owned group cleanup. Governance runtime was not launched; compilerAccepted and governanceEnabled remain false.
- The old full compiler job43592176126 is **SKIPPED**, as required by its consumed-transition guard. This is not compiler acceptance. PR331 must remain unmerged until the real complete compiler/link and all applicable gates pass.

Complete observation: [RUST-SPAWN-OBSERVED-RESULT.json](RUST-SPAWN-OBSERVED-RESULT.json). New Cargo-only output amendment is proposed in [CARGO-ERROR-OBSERVATION-PROPOSAL.md](CARGO-ERROR-OBSERVATION-PROPOSAL.md); it is not permission to execute.

Source continuity: the original Documents Git pack read zero bytes despite its logical36MB size. A fresh separate local checkout restored ALL13771staged index entries exactly,27changed files, with original data untouched. [Recovery receipt](RUST-SPAWN-LOCAL-RECOVERY.json). All10diagnostic pins remained exact, independent review was clear, and the existing PR received one fast-forward update. No main push, production, schema, settings, flags, credential/provider effect, resource or spending occurred.
