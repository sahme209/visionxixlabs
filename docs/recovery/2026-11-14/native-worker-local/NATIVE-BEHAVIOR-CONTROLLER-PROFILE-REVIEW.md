# Independent controller and runtime source review

Verdict: **CLEAR within the explicitly trusted, role-free fixture boundary**. File-only source review; no compiler, runtime, child process, new network request or test invocation was performed for this review. This is not native behavior acceptance.

## Important findings resolved

- The packet now includes the fixture, parent and protocol source-guard tests alongside current actual source. Historical native-worker inventory stays unchanged; current instrumented source is bound directly by this new packet, not represented as the previously compiled binary.
- The runtime header now explicitly includes `<asm/unistd.h>` for the installed x32 macro, preserving the architecture/x32 refusal.

## Controller

The fixed V2 Unknown record has exact12line codec grammar, generation fixture-v2, positive publication1, asOf0/voidAfter1, bound0/drift0/statusunknown/marker0/support0. The next record changes only publication to2. Fixed numeric generated header uses only checked uint64 values, no arbitrary source text. Compiler and actual native source/headers/tools are frozen and rechecked across stages, with the packet bytes captured once before inert helper imports.

Module validation requires x86_64 ELF DYN/entry0, actual private entry/registration symbols, no unresolved private axiom symbols, and N-API imports declared by the matching installed headers. Critical ABI diagnostics refuse before loading; other warnings remain recorded. The fixed Node path is not invoked for discovery; the single harness checks its actual version before addon loading. Native failure stdout is parsed into closed phase/reason facts before a failed exit is refused, avoiding a blind retry.

The existing supervisor is used for each bounded native command with exact cleanup confirmation, one controlled Node fixture invocation, an overall300second budget and no automatic retry. The fresh opened event is bound to the same public repo/main/head branch and run attempt1; no extra provider action or package acquisition is introduced.

## Runtime restriction and launcher

All encoded relative offsets in clone, clone3, pidfd_send_signal, prctl and ioctl paths were independently traced in the actual source. Architecture/x32/negative-number refusal precedes dispatch. Legacy clone rejects unlisted flags and inappropriate exit-signal bits. clone3 checks nonzero pointer and exact installed structure size; it honestly does NOT inspect pointed-to flags. pidfd signalling accepts only zero upper FD word, full-word SIGKILL, NULL info and flags0. Ownership remains the actual trusted parent's responsibility.

The separately reviewed trusted-default-allow baseline denies networking/socketpair and io_uring, PID import, session/group escape, identity/privilege/namespace changes, tracing and other listed privileged classes. It is not claimed to contain hostile filesystem code or future unknown syscalls. The fixed launcher admits only `--` or its inert describe mode; validates owned distinct FIFO outputs and /dev/null stdin; rejects root/mismatched IDs; closes all fd≥3; sets/checks no-new-privileges; installs the actual dumped filter and verifies filter mode BEFORE fixed Node exec. The child environment is a fixed clean three-entry list, with no ambient NODE_OPTIONS/loader/credentials. Node threads and actual owned workers inherit that restriction.

Actual profile installation, Node startup, module loading, cloning, descriptor/reap behavior and physical timing remain unperformed under this review. The eventual single approved checkpoint, not these source observations, determines native acceptance.

Exact reviewed files:

- `scripts/governance_native_time_behavior.py` SHA-256 `dd6597f1da7a9b797137efff9febd4e741d23aa8af4c89851846aa1aec636388`
- `.github/workflows/linux-native-time-behavior.yml` SHA-256 `839fb3c65792b285872d1754ae003b2bc9e74ab8b87841d577b773b46f167ba4`
- `scripts/tests/test_governance_native_time_behavior.py` SHA-256 `585a369a238e651964938b880f773739e7feeda031126f7fa86e26f3f20e6f7f`
- `scripts/linux-native-behavior/runtime_launcher.c` SHA-256 `401681ec18f4d9e48ef1a00c2ffba36d79315c672ced425de69d70d9fdc10434`
- `scripts/linux-native-behavior/runtime_profile.h` SHA-256 `8fbd5d645a75956279e77123d07d7f2a0f67db3a1a3852e184415468c3211ed4`
