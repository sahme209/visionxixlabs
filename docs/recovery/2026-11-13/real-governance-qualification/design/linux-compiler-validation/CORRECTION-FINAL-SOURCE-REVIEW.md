# Corrected compiler checkpoint: final source review

Status: no important source finding in the exact files below. This is independent source review only; no compiler, child program, native security call, network request, test or CI job was run by this reviewer. Packet2 binding review remains a separate final step once generated.

Reviewed the actual positive syscall macro and BPF program, launcher, benign fixture, integrated driver/workflow and retained original-group supervisor. The clone branch skips eleven instructions for unrelated syscalls; prctl/ioctl branches each skip six. Unsupported ABI/x32/negative numbers and unlisted operations refuse; clone3 alone reports ENOSYS, clone uses the approved positive bitset with zero upper word and only zero/SIGCHLD signal, selectors use their kernel-relevant low words. No numeric fallback syscall table or permissive fallback is present.

The launcher checks same non-root real/effective/saved identity, actual /dev/null readable stdin (including Python DEVNULL O_RDWR), and distinct owned write-only FIFO outputs; closes descriptors above2 before installing the filter and execs only the original absolute argv. The supervisor continues to own the original process group, bounded diagnostics, termination handoff and kill/reap/ESRCH cleanup. This does not promise containment of arbitrary same-user filesystem access or foreign session escape.

The future fixture performs only its fixed owned file operation and /usr/bin/true child, then harmless direct refusal probes with no service/address/credential. Its exact four success categories are required before registry fetch. Source checks are source checks, not syscall execution evidence. Installed-header availability, C warning-free compilation, filter acceptance and actual compiler compatibility remain unproved until the approved job.

The workflow and driver both constrain the one PR331 synchronize transition from ecfb83c98b809a6a6cbe0d80c0fd309ba9a99769 to the matching new after/head, same public repository/branch, base main and attempt1; actual checkout is checked. Trusted launcher/fixture compile and actual preflight precede the only network-enabled registry phase. All subsequent tools use the fixed launcher. Initial tool/header/output digests are retained by compare-existing add_frozen; no overwrite rebind remains. Frozen packet and inputs are rechecked before each phase. Raw filter instructions and observed headers are build evidence, not native runtime qualification.

No Governance executable is launched, source/default supplier activated, protected clock read qualified or full Governance completion established. Failed compatibility must stop this attempt without profile widening, repair or retry.

## Exact source SHA-256

| File | SHA-256 |
| --- | --- |
| scripts/linux-compile/network_launcher.c | 7c11459094c8b4e02d5ec50a1110e339f9446b10e8315bc8958df25b1666e0b7 |
| scripts/linux-compile/compiler_profile.h | a9037954185e1b7e5e87ace0050df6dd76df9f1ec9b64ca8ae78d874bf080beb |
| scripts/linux-compile/benign_fixture.c | 6bb8c6d2d5758f4d593763770b937f65e464a7e7faefb0e86060e41d54a3d446 |
| scripts/governance_linux_compile.py | a48a6bba958fdd4a7cf8ffec85f3941c0bcc35d28b3ffd8c9c7819adecb87961 |
| scripts/governance_linux_compile_supervisor.py | c0a4300bd547bbcbd6e806ff373bbc6d32a5f54b6fccca0a609eed406c563868 |
| scripts/governance_linux_compile_inputs.py | 2e6ae367bc3480681fa1c7c11ff28943f0cfe7a3cbc756f3163be4b264ae17da |
| scripts/tests/test_network_launcher_source.py | ebe67c978057ddf97beb99c7cfc3914cad6bc837bc4065a855d6999876739cda |
| scripts/tests/test_governance_linux_compile.py | b5aa5bdf4f24df9c87ecc8b3757f89be0b306c28424dc77ae28b57bbab220e04 |
| .github/workflows/linux-time-compile.yml | d4d9c5bcd2c9c741652c01bea4f3b2db37d8c8689ef1b875eacb1dbd6bc7549f |
