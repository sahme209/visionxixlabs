# Independent seccomp compiler correction design review 2

Source/document review only of SECCOMP-COMPILER-CORRECTION-PROPOSAL.md, THREE-LINUX-DOCS-ASSESSMENT.md and the retained failed-attempt receipt. No external page, code change, syscall/filter/fixture, compiler, child, network or CI action performed. The earlier grant is consumed; PR331's actual failure remains the uid-map isolation-preflight failure before dependency fetch or source compilation.

## Important scope precision before freezing approval

**P2: bind the corrected event to PR331 explicitly.** The proposed synchronize predicate names repository/branch, attempt1 and the exact previous head, but does not explicitly include the pull-request number. Those coordinates identify a branch transition, not necessarily its single intended pull request; a synchronize event for a different PR using that same head branch/transition would satisfy the listed predicate. Require `github.event.pull_request.number == 331` in the workflow and independent `event.pull_request.number == 331` validation in the driver (plus the expected base if the execution packet selects it). Retain the exact before-head check and pre-push remote-head check. This makes the owner’s ONE corrected attempt in the existing PR concrete without reopening or creating another PR. It does not authorize that push/run now.

## Mechanism and conditional scope otherwise coherent

- The launcher is a real installed-header C implementation, not a ctypes/numeric ABI guess. Linux/x86_64/non-ILP32 and architecture/x32 checks, no-new-privileges and checked filter installation all precede exec; missing symbols/support/installation refuse. The actual compiled symbolic profile/instruction shape and target/header/tool observations still need independent preparation review.
- The exact positive SYS-name set with unlisted EPERM refuses sockets/socketpair/network calls, io_uring, pidfd_getfd, ptrace/process_vm, namespaces, mount/BPF and session/group changes. This is a proposed compiler compatibility profile, not a demonstrated complete list of actual Rust/C needs. Additional syscall requirements cause a truthful stopped attempt; they do not silently widen policy or authorize another run.
- clone predicates must inspect the actual native flags word, including every stated namespace and CLONE_UNTRACED mask. clone3 deliberately returns ENOSYS because the filter cannot inspect its pointed-to flags. That may exercise an existing libc fallback; no success is presumed. The design correctly avoids claiming a pointer inspection or arbitrary clone3 permission.
- prctl/ioctl selectors are limited using the words the kernel actually interprets. No kill/tkill/tgkill exception is silently added; an unexpected tool requirement remains a compatibility failure. Original external supervisor cancellation/group cleanup remains required.
- File/memory operations are explicitly not path-confined. Filter inheritance/no-new-privileges do not imply complete hostile filesystem/process containment, authenticated clock/runtime evidence or safe same-user collusion. The proposal states this limit rather than presenting seccomp as a full sandbox or native qualification.
- The one benign fixture is a new, explicitly requested native execution effect: owned-file and ordinary exec success plus fixed denied-operation categories, without external destinations/services. It runs through the actual launcher before registry access. Trusted launcher/fixture compilation is separately distinguished from compiler build scripts and the never-launched Governance daemon/linked output. Unsupported fixture/kernel/header results stop before fetching dependencies.
- Subsequent locked dependency acquisition and actual offline filtered C/Rust/link stages retain clean environment, source/tool/packet/lock checks,45-minute job/40-minute driver bounds, diagnostics, cleanup and no retry. The existing failed receipt is not renewed or overwritten. Neither the three documentation pages nor a future fixture pass qualifies Governance or permits resource/credential/provider/production actions.

## Verdict

No additional material design blocker found beyond the exact PR-number predicate above. After resolving it, this is a coherent finite conditional owner-decision unit: source/pure-mocked preparation and independent review first; only then the explicitly approved launcher/fixture compilation+execution and ONE corrected compiler event. This review is not implementation or run authority. Actual installed-header/filter/kernel/compiler compatibility, instructions, executable behavior and qualification remain unproven.


## Final finite-scope follow-up

The one primary GitHub event-documentation/schema read is a future conditional request only. It checks the exact synchronize fields before code/push; unavailable evidence stops preparation before CI. No current read grant or trigger assumption is introduced. Final source-only review finds the addition coherent; no further external read, code, compiler, filter, test or workflow action occurred.
