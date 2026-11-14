# Independent source review — compiler driver and workflow

Scope: file-only review of `scripts/governance_linux_compile.py`, the actual materializer/supervisor interfaces, `.github/workflows/linux-time-compile.yml`, PLAN/DECISION and the source dependency inventory. No compiler, namespace, registry, CI or output program was run during review. INPUT-PACKET.json was not present yet, so exact final packet/hash review remains pending.

## Finding requiring correction before freeze

**P2 — later packet checks can accept replacement authority.** `governance_linux_compile.py:91–101` reads INPUT-PACKET.json anew on every `verify_packet` invocation and trusts the hashes in that newly read mapping. The first packet SHA is only recorded at line142; later checks at177/183/195 do not compare against it. A replacement packet plus corresponding changed input files can therefore pass the intended frozen-input checks. Dependency build scripts execute with filesystem access, so the later consistency check must not adopt a fresh self-consistent packet. Capture the original packet bytes/hash once before any child; every later recheck must require the exact original bytes/hash, then validate the original frozen mapping. Add a synthetic replacement-packet regression. No new authority is needed for this correction.

## Source/contract assessment

- Standard ubuntu-24.04, public same-repository opened PR, exact branch, first attempt, read-only permission and credential-free checkout are consistent with the one-run/free boundary. Workflow deliberately does not run on synchronize/rerun; no permanent coverage claim. All existing mandatory checks remain untouched.
- Installed rustup lookup has auto-install disabled; real resolved tool paths are constrained beneath installed toolchains and observed/hashed. Root/core source does not pin a Rust version, so unsupported installed stable remains a legitimate stop rather than grounds for an automatic update.
- The actual unprivileged user/network namespace preflight precedes registry fetch, with no sudo/sysctl/apt fallback. Subsequent metadata/tree/C/archive/Rust/link/symbol phases all use the same namespace wrapper and allowlisted environment. Namespace support remains unverified until the authorized run. Fresh Cargo/home paths and ancestor-config checks address ambient source overrides.
- Locked fetch explicitly permits the complete fixed lock graph; the inventory establishes261standard-registry entries/no Git/alternate source. Metadata is correctly labelled workspace data, while the separate core normal/build feature tree checks actual requested root features. No false127package exact-graph claim.
- `cargo rustc --lib --crate-type staticlib -C link-dead-code=yes` compiles real daemon-feature source. Final whole-archive Rust linkage, ordinary C archive fallback and required actual Rust/C symbol definitions avoid accepting only a standalone C stub. A duplicate forced C object is avoided. Native static system libraries are taken from compiler output and constrained by an allowlist; an unsupported output is a stop, not a guess.
- Actual full source bytes/lock are verified before and after build, outputs are hashed and never run, and no installed profile/runtime qualification is minted. These guards are build evidence, not containment/attestation of malicious compilers or all dependency code. The supervisor explicitly limits cleanup claims to its retained leader/process group; ephemeral CI remains the wider boundary.

## Remaining review point

After the packet-currentness correction, review the final frozen packet and actual final driver/workflow hashes before the one authorized PR/run. No native success or readiness is claimed from this source review.

## Follow-up — frozen-packet correction

File-only follow-up confirms the original packet bytes are captured once before children, the initial verification uses those bytes, every later verification requires exact byte equality, and the receipt hashes that original capture. The reported replacement-packet regression failed before the correction and passed afterward; tests were not rerun by this reviewer. The P2 finding is resolved. SIGTERM now raises through the command supervisor's cleanup path and the driver retains failure receipts through BaseException handling; no runtime/helper launch was added. Final driver source review is CLEAR within the preparation scope. The independently frozen INPUT-PACKET.json remains the last file-only review step before any authorized invocation.
