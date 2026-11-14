# Compiler-only network-deny alternative — finite design request

Status: source-only decision request. The approved PR331 compiler attempt is consumed: run43552654814/job132318365256 at ecfb83c9 stopped at `isolation-preflight` with `/proc/self/uid_map: Operation not permitted`. No dependency acquisition, compiler or produced runtime ran. Do not retry that grant or infer that a different restriction mechanism is approved.

## Local inventory result

A targeted repository search found no existing reviewed Linux seccomp/BPF/Landlock/no-new-privileges implementation to reuse. Existing native Linux time code is the publication/capture adapter, not process network isolation. macOS restriction code cannot enforce Linux runner behavior. Therefore replacing unshare with an assumed ctypes/BPF snippet would introduce a new unreviewed restriction mechanism.

## Recommended narrow alternative

Investigate one fixed, minimal C compiler launcher that installs an irreversible child-inherited Linux seccomp syscall filter, then execs the exact already-selected compiler/tool command. Preserve ordinary runner user identity: no user namespace, sudo, sysctl, root/service change, package install or additional dependency. Use the runner compiler’s actual Linux UAPI headers for structures, offsets, syscall names and constants instead of manually reproducing a ctypes/BPF ABI; no downloaded runtime module or new package. Its separate compilation and actual execution would require the future exact one-attempt approval, not this research request. The existing supervisor still owns the original process/session and deadlines.

If the documented contract supports it, the launcher would set no-new-privileges, install the exact filter, verify success before exec, and refuse on unsupported/error. Every post-fetch metadata/tree/C/Rust/link/symbol tool must use it. Registry fetch stays the ONLY network-allowed phase and must fully finish before the restricted phase; there is no unrestricted fallback or automatic retry. This is compiler-child network denial, not general filesystem/runtime containment or a new Governance clock boundary.

Do not promise arbitrary hostile-code containment. The concrete filter must address the actual x86_64 syscall ABI, reject other architectures and x32 dispatch, deny socket-based network access and known alternate submission paths (notably io_uring), and prevent acquisition/manipulation of another process's descriptors/state where that could bypass the intended boundary. Start with a finite deny policy supported by source contracts; do not assert that denying `connect` alone is sufficient. Clean inherited FDs/environment remain mandatory. If denying all socket creation/socketpair prevents a build dependency, report that result rather than silently permit an address family or relax the rule.

Filter construction itself must be ordinary source/mocked-test work first. No actual prctl/seccomp invocation, launcher exec, compiler or CI run follows from this request. A subsequent conditional one-attempt approval must name the exact reviewed launcher/filter/driver packet and benign restriction preflight before any registry request.

## One finite primary-contract pass before implementation

Request at most THREE primary public documentation pages in one pass, no automatic follow-up:

1. Linux kernel userspace API seccomp-filter documentation: installation, inheritance/exec, stacked restrictions and architecture warnings.
2. Linux man-pages seccomp(2): operation/failure/return-action contract and unsupported-kernel behavior.
3. Linux man-pages PR_SET_NO_NEW_PRIVS(2): required irreversible privilege state and inheritance contract.

The candidate uses actual installed UAPI header types/macros rather than copying raw numeric values from four more kernel files. This removes that separate source-acquisition loop; future preparation must still require all selected macros and inspect the exact generated filter/target/headers in its approved build packet. Public text only; no source clone, installation, compiler/probe, filter invocation, account access, credentials, settings, CI retry or spending follows. Actual kernel support remains unverified until a separately approved restriction preflight; unavailable means stop without workaround.

## Required design output and decision

After that finite pass, freeze the exact source-derived allow/deny instruction program, architecture handling, installed UAPI macro bindings and compiler-enforced structure/offset/target checks, no-new-privileges/installation error behavior, FD inheritance/exec ordering and command supervision. Review its limitations and synthetic tests independently. Only then request the single new conditional preparation/execution grant. Do not reuse a generic qualification callback, change cloud topology or broaden the time/custody architecture to solve this compiler-runner restriction failure.
