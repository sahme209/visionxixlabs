# One corrected compiler checkpoint — proposed conditional bundle

Status: DESIGN ONLY. Three approved Linux primary pages are read and their authority consumed; see THREE-LINUX-DOCS-ASSESSMENT.md. No launcher source/compiler/filter or retry has run. Preserve PR331's original failed attempt and every receipt. This is a compiler infrastructure correction, not Governance enablement or a changed approval/credential/time model.

## Concrete mechanism

Replace the unsupported unprivileged user/network namespace wrapper with ONE small trusted C launcher. Build it using the already installed runner C compiler and installed Linux UAPI headers; no ctypes layouts/numeric syscall table, new dependency, privilege change, sudo, user namespace, host setting or service. The launcher is ordinary single-threaded code: validate its fixed invocation; close inherited descriptors above2; set/check no-new-privileges; install the frozen positive syscall filter; confirm success; exec the exact tool with the existing clean environment. Any failure stops BEFORE exec. The current bounded supervisor retains the original process group and cancellation/cleanup ownership.

Use compiler-provided __linux__/__x86_64__ guards with !__ILP32__, AUDIT_ARCH_X86_64, __X32_SYSCALL_BIT and offsetof(struct seccomp_data,...). Require actual installed constants/types; missing macro or wrong target is a preparation failure, never a guessed numeric fallback. Reject other architecture and x32 dispatch, including unsupported/negative numbers. Default action is EPERM. No TRACE, USER_NOTIF, permissive logging, alternate address family or allow-all fallback.

The following is the EXACT initial candidate profile, not evidence that all compilers will work. Each token is bound through SYS_<name> from the installed headers. A missing listed macro stops compilation. All unlisted operations—including socket/socketpair, network sends/connect/bind, io_uring, pidfd_getfd, ptrace, process_vm, namespace, mount, BPF and session/group-change operations—are refused.

```
read write readv writev pread64 pwrite64 close close_range
openat fstat newfstatat statx lseek getdents64 readlink readlinkat
access faccessat faccessat2 fcntl dup dup2 dup3 pipe pipe2
poll ppoll select pselect6 epoll_create1 epoll_ctl epoll_wait epoll_pwait
mmap mprotect munmap mremap madvise brk arch_prctl
set_tid_address set_robust_list rseq futex futex_waitv
rt_sigaction rt_sigprocmask rt_sigreturn sigaltstack rt_sigsuspend
fork vfork execve execveat wait4 waitid exit exit_group
getpid getppid gettid getuid geteuid getgid getegid getgroups
uname sysinfo getrlimit prlimit64 getrusage sched_getaffinity sched_yield
clock_gettime clock_getres nanosleep clock_nanosleep getrandom
getcwd chdir fchdir mkdir mkdirat unlink unlinkat rename renameat renameat2
link linkat symlink symlinkat ftruncate truncate fchmod fchmodat chmod
umask utimensat fsync fdatasync flock copy_file_range statfs fstatfs
```

Additional predicate-controlled operations ONLY:
- clone: permit ONLY bits in CLONE_VM, CLONE_FS, CLONE_FILES, CLONE_SIGHAND, CLONE_THREAD, CLONE_SYSVSEM, CLONE_SETTLS, CLONE_PARENT_SETTID, CLONE_CHILD_SETTID, CLONE_CHILD_CLEARTID, CLONE_VFORK and CLONE_PIDFD; the CSIGNAL field may be0or SIGCHLD only. Require zero unlisted upper/lower bits. Thus namespace/parent/ptrace/untraced/future flags refuse, rather than relying only on a namespace deny mask. Use actual installed header macros; no pointer inspection or observed compatibility claim.
- clone3: deliberately return ENOSYS, not allow opaque pointed-to flags. This explicit policy may permit a library's existing clone fallback; that behavior is NOT assumed verified. Compatibility failure stops, with no policy widening.
- prctl: only PR_GET_NO_NEW_PRIVS, PR_GET_SECCOMP and PR_SET_NAME. Inspect the kernel-relevant low argument word; all other selectors refuse.
- ioctl: only TCGETS, TIOCGWINSZ and FIONREAD, using actual installed headers and the kernel-relevant request word; no arbitrary device controls.
- No kill/tkill/tgkill permission is added. The external original supervisor remains responsible for cancellation; unexpected abort/compiler requirements remain an honest failure rather than a silent exception.

Allowlisted files and memory calls remain unrestricted within the ephemeral job's ordinary account permissions. This does NOT mediate arbitrary filesystem paths or same-user host collusion and is not full hostile-code containment. Do not claim otherwise. No credentials/secrets are supplied; inherited stdin is the system sink and stdout/stderr are owned pipes. Existing exact source/packet/tool protections remain mandatory. No custodian or production runtime uses this launcher.

## Preparation and actual preflight

Conditional implementation scope: fixed launcher/profile, a small benign native fixture, driver/workflow correction and pure/mocked tests. Freeze the symbolic BPF instruction program, exact named profile, header requirements and source pins; independently review before the one run. The job captures actual header/tool/target identities and the resulting instruction program, and verifies their expected shape before the first restriction invocation. These observed build inputs are not prequalified runtime attestation. No fourth external page or new dependency follows.

In the future approved job, compile ONLY the reviewed trusted launcher and benign fixture before registry access. The fixture must run through the actual launcher once, perform local owned-file and ordinary child-exec success, and show direct IPv4/IPv6/Unix socket creation, socketpair and selected descriptor/uring/namespace attempts refuse. It uses no external network address or service. Its expected denied results are evidence about this exact filter, not broad security qualification. Output is fixed categories, bounded by the existing supervisor. Unsupported filter/kernel/header/fixture results stop before registry access. Native launcher/fixture execution is explicitly distinct from the never-launched Governance daemon/output.

Only if preflight passes: unchanged pinned upstream source materialization, same locked dependency acquisition, actual metadata/features/Rust/C/whole-library link and final exact source/symbol checks. Every post-fetch command executes through the filter; fetch alone retains approved registry networking. Preserve the45minute standard Ubuntu24.04 public-runner job,40minute driver budget, bounded diagnostics/cleanup, no matrix, cache save or artifact upload. No retry, toolchain repair or permissive fallback.

## One corrected attempt in the EXISTING PR

Do not open a second PR or merge the failed one. Replace the compile workflow's event with synchronize, guarded in BOTH workflow and driver by pull_request.number==331, base.ref==main, the exact existing branch/repository, attempt1 and event.before == ecfb83c98b809a6a6cbe0d80c0fd309ba9a99769 (the actual failed source head). The corrected driver independently verifies that same prior head and actual new checkout. Before implementation/push, permit ONE primary GitHub event-documentation or official event-schema read to verify the synchronize payload fields; no additional read/retry is implied. If the required before/head/PR/base fields are not established, stop preparation rather than guess a trigger or consume a native run. Freeze all new runtime input hashes in a new packet while retaining INPUT-PACKET.json and OBSERVED-RESULT.json as history. Verify remote head still equals that old head before the ONE push; a mismatch stops. This admits one reviewed transition without a self-referential HEAD pin. Later pushes cannot reuse it. Do not close/reopen the PR or duplicate existing CI merely to trigger a compiler.

All existing exact-head checks and the corrected compiler result must pass before a normal merge. No red/admin/bypass merge. A new failed attempt remains consumed and does not authorize another run.

## Approval required and limits

Request one conditional owner decision covering that one primary GitHub event-contract read, source/test preparation, independent exact review, the changed single-sync trigger, trusted launcher/fixture compilation and execution, then ONE corrected compiler job only if every preparation gate passes. Earlier permissions do NOT authorize these actions.

No Governance runtime/clock qualification, actual protected resources, credentials, account/IAM/service changes, SQL, provider effect, deployment, feature flag, spending or production enablement. Other real qualification and full master-plan requirements stay open; unchanged passing suites are not repeated as substitute progress.
