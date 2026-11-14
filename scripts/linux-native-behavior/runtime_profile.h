#ifndef AXIOM_NATIVE_BEHAVIOR_RUNTIME_PROFILE_H
#define AXIOM_NATIVE_BEHAVIOR_RUNTIME_PROFILE_H
/* DEFAULT-ALLOW ONLY for reviewed fixed role-free Node/C test source.
 * Not hostile-code/filesystem isolation. clone3Flags: source-trusted-not-inspected.
 * BPF cannot inspect clone3 flags or attest pidfd ownership. */
#if !defined(__linux__) || !defined(__x86_64__) || defined(__ILP32__)
#error Linux x86_64 only, not x32
#endif
#if !defined(__BYTE_ORDER__) || __BYTE_ORDER__ != __ORDER_LITTLE_ENDIAN__
#error Reviewed little-endian ABI required
#endif
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <linux/sched.h>
#include <asm/unistd.h>
#include <sys/syscall.h>
#include <sys/prctl.h>
#include <sys/ioctl.h>
#include <signal.h>
#include <stddef.h>
#include <stdint.h>
#include <limits.h>
#include <errno.h>
#ifndef __X32_SYSCALL_BIT
#error Installed x32 bit required
#endif
_Static_assert(sizeof(struct sock_filter)==8,"filter ABI");
_Static_assert(sizeof(((struct seccomp_data *)0)->args[0])==8,"argument ABI");
_Static_assert(sizeof(((struct seccomp_data *)0)->nr)==4,"syscall ABI");
#define ARG_LOW(n) ((uint32_t)(offsetof(struct seccomp_data, args)+(n)*sizeof(uint64_t)))
#define ARG_HIGH(n) (ARG_LOW(n)+(uint32_t)sizeof(uint32_t))
#define AXIOM_RUNTIME_DENY (SECCOMP_RET_ERRNO | (EPERM & SECCOMP_RET_DATA))
#define AXIOM_RUNTIME_CLONE_FLAGS (CLONE_VM | CLONE_FS | CLONE_FILES | CLONE_SIGHAND | CLONE_THREAD | CLONE_SYSVSEM | CLONE_SETTLS | CLONE_PARENT_SETTID | CLONE_CHILD_SETTID | CLONE_CHILD_CLEARTID | CLONE_VFORK | CLONE_PIDFD)
#define AXIOM_RUNTIME_CLONE_SIZE ((uint32_t)sizeof(struct clone_args))

#define AXIOM_RUNTIME_DENIED_SYSCALLS(X) \
 X(socket) \
 X(socketpair) \
 X(connect) \
 X(bind) \
 X(listen) \
 X(accept) \
 X(accept4) \
 X(shutdown) \
 X(getsockname) \
 X(getpeername) \
 X(setsockopt) \
 X(getsockopt) \
 X(sendto) \
 X(recvfrom) \
 X(sendmsg) \
 X(recvmsg) \
 X(sendmmsg) \
 X(recvmmsg) \
 X(io_uring_setup) \
 X(io_uring_enter) \
 X(io_uring_register) \
 X(pidfd_open) \
 X(pidfd_getfd) \
 X(kill) \
 X(tkill) \
 X(tgkill) \
 X(setsid) \
 X(setpgid) \
 X(setuid) \
 X(setgid) \
 X(setreuid) \
 X(setregid) \
 X(setresuid) \
 X(setresgid) \
 X(setfsuid) \
 X(setfsgid) \
 X(setgroups) \
 X(capset) \
 X(unshare) \
 X(setns) \
 X(mount) \
 X(umount2) \
 X(pivot_root) \
 X(chroot) \
 X(open_tree) \
 X(move_mount) \
 X(fsopen) \
 X(fsconfig) \
 X(fsmount) \
 X(fspick) \
 X(mount_setattr) \
 X(ptrace) \
 X(process_vm_readv) \
 X(process_vm_writev) \
 X(process_madvise) \
 X(process_mrelease) \
 X(kcmp) \
 X(bpf) \
 X(perf_event_open) \
 X(userfaultfd) \
 X(ioperm) \
 X(iopl) \
 X(modify_ldt) \
 X(init_module) \
 X(finit_module) \
 X(delete_module) \
 X(kexec_load) \
 X(kexec_file_load) \
 X(reboot) \
 X(swapon) \
 X(swapoff) \
 X(acct) \
 X(quotactl) \
 X(add_key) \
 X(request_key) \
 X(keyctl) \
 X(sethostname) \
 X(setdomainname) \
 X(settimeofday) \
 X(clock_settime) \
 X(clock_adjtime) \
 X(adjtimex) \
 X(open_by_handle_at) \
 X(name_to_handle_at) \
 X(fanotify_init) \
 X(fanotify_mark) \
 X(chown) \
 X(fchown) \
 X(lchown) \
 X(fchownat) \
 X(setxattr) \
 X(lsetxattr) \
 X(fsetxattr)

static const struct sock_filter runtime_filter[] = {
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data, arch)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,AUDIT_ARCH_X86_64,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data, nr)),
 BPF_JUMP(BPF_JMP|BPF_JSET|BPF_K,__X32_SYSCALL_BIT,0,1),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_JUMP(BPF_JMP|BPF_JGE|BPF_K,0x80000000U,0,1),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,SYS_clone,0,11),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_HIGH(0)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,0,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_LOW(0)),
 BPF_JUMP(BPF_JMP|BPF_JSET|BPF_K,~(uint32_t)(AXIOM_RUNTIME_CLONE_FLAGS | CSIGNAL),0,1),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_STMT(BPF_ALU|BPF_AND|BPF_K,CSIGNAL),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,0,2,0),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,SIGCHLD,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ALLOW),
 /* Shape only; pointed flags remain the trusted exact source's responsibility. */
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,SYS_clone3,0,12),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_LOW(0)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,0,0,3),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_HIGH(0)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,0,0,1),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_HIGH(1)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,0,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_LOW(1)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,AXIOM_RUNTIME_CLONE_SIZE,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ALLOW),
 /* This does not attest that the supplied pidfd belongs to our child. */
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,SYS_pidfd_send_signal,0,22),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_HIGH(0)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,0,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_HIGH(1)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,0,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_LOW(1)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,SIGKILL,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_HIGH(2)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,0,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_LOW(2)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,0,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_HIGH(3)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,0,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_LOW(3)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,0,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ALLOW),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,SYS_prctl,0,14),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_LOW(0)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,PR_SET_DUMPABLE,0,1),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,PR_SET_KEEPCAPS,0,1),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,PR_SET_SECUREBITS,0,1),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,PR_SET_PTRACER,0,1),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,PR_SET_MM,0,1),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,PR_CAP_AMBIENT,0,1),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ALLOW),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,SYS_ioctl,0,7),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_LOW(1)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,TCGETS,4,0),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,TIOCGWINSZ,3,0),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,FIONREAD,2,0),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,FIONBIO,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ALLOW),
#define AXIOM_RUNTIME_DENY_CALL(name) BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,SYS_##name,0,1), BPF_STMT(BPF_RET|BPF_K,AXIOM_RUNTIME_DENY),
 AXIOM_RUNTIME_DENIED_SYSCALLS(AXIOM_RUNTIME_DENY_CALL)
#undef AXIOM_RUNTIME_DENY_CALL
 BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ALLOW)
};
_Static_assert(sizeof(runtime_filter)/sizeof(runtime_filter[0])<=USHRT_MAX,"filter length");
#endif
