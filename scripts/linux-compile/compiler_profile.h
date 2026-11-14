#ifndef AXIOM_COMPILER_PROFILE_H
#define AXIOM_COMPILER_PROFILE_H
#if !defined(__linux__) || !defined(__x86_64__) || defined(__ILP32__)
#error This compiler restriction requires Linux x86_64, not x32
#endif
#if !defined(__BYTE_ORDER__) || __BYTE_ORDER__ != __ORDER_LITTLE_ENDIAN__
#error This compiler restriction requires the reviewed little-endian ABI
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
#error Installed headers must define the x32 syscall bit
#endif
_Static_assert(sizeof(struct sock_filter)==8,"unexpected filter ABI");
_Static_assert(sizeof(((struct seccomp_data *)0)->args[0])==8,"unexpected argument ABI");
_Static_assert(sizeof(((struct seccomp_data *)0)->nr)==4,"unexpected syscall ABI");
#define ARG_LOW(n) ((uint32_t)(offsetof(struct seccomp_data, args)+(n)*sizeof(uint64_t)))
#define ARG_HIGH(n) (ARG_LOW(n)+(uint32_t)sizeof(uint32_t))
#define AXIOM_DENY (SECCOMP_RET_ERRNO | (EPERM & SECCOMP_RET_DATA))
#define AXIOM_CLONE_FLAGS (CLONE_VM | CLONE_FS | CLONE_FILES | CLONE_SIGHAND | CLONE_THREAD | CLONE_SYSVSEM | CLONE_SETTLS | CLONE_PARENT_SETTID | CLONE_CHILD_SETTID | CLONE_CHILD_CLEARTID | CLONE_VFORK | CLONE_PIDFD)

#define AXIOM_ALLOWED_SYSCALLS(X) \
 X(read) \
 X(write) \
 X(readv) \
 X(writev) \
 X(pread64) \
 X(pwrite64) \
 X(close) \
 X(close_range) \
 X(openat) \
 X(fstat) \
 X(newfstatat) \
 X(statx) \
 X(lseek) \
 X(getdents64) \
 X(readlink) \
 X(readlinkat) \
 X(access) \
 X(faccessat) \
 X(faccessat2) \
 X(fcntl) \
 X(dup) \
 X(dup2) \
 X(dup3) \
 X(pipe) \
 X(pipe2) \
 X(poll) \
 X(ppoll) \
 X(select) \
 X(pselect6) \
 X(epoll_create1) \
 X(epoll_ctl) \
 X(epoll_wait) \
 X(epoll_pwait) \
 X(mmap) \
 X(mprotect) \
 X(munmap) \
 X(mremap) \
 X(madvise) \
 X(brk) \
 X(arch_prctl) \
 X(set_tid_address) \
 X(set_robust_list) \
 X(rseq) \
 X(futex) \
 X(futex_waitv) \
 X(rt_sigaction) \
 X(rt_sigprocmask) \
 X(rt_sigreturn) \
 X(sigaltstack) \
 X(rt_sigsuspend) \
 X(fork) \
 X(vfork) \
 X(execve) \
 X(execveat) \
 X(wait4) \
 X(waitid) \
 X(exit) \
 X(exit_group) \
 X(getpid) \
 X(getppid) \
 X(gettid) \
 X(getuid) \
 X(geteuid) \
 X(getgid) \
 X(getegid) \
 X(getgroups) \
 X(uname) \
 X(sysinfo) \
 X(getrlimit) \
 X(prlimit64) \
 X(getrusage) \
 X(sched_getaffinity) \
 X(sched_yield) \
 X(clock_gettime) \
 X(clock_getres) \
 X(nanosleep) \
 X(clock_nanosleep) \
 X(getrandom) \
 X(getcwd) \
 X(chdir) \
 X(fchdir) \
 X(mkdir) \
 X(mkdirat) \
 X(unlink) \
 X(unlinkat) \
 X(rename) \
 X(renameat) \
 X(renameat2) \
 X(link) \
 X(linkat) \
 X(symlink) \
 X(symlinkat) \
 X(ftruncate) \
 X(truncate) \
 X(fchmod) \
 X(fchmodat) \
 X(chmod) \
 X(umask) \
 X(utimensat) \
 X(fsync) \
 X(fdatasync) \
 X(flock) \
 X(copy_file_range) \
 X(statfs) \
 X(fstatfs)

/* Every branch ends in ALLOW or a fixed refusal. No userspace notification,
 * tracing, path matching, pointer inspection or default-allow action exists. */
static const struct sock_filter compiler_filter[] = {
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data, arch)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,AUDIT_ARCH_X86_64,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_DENY),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data, nr)),
 BPF_JUMP(BPF_JMP|BPF_JSET|BPF_K,__X32_SYSCALL_BIT,0,1),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_DENY),
 BPF_JUMP(BPF_JMP|BPF_JGE|BPF_K,0x80000000U,0,1),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_DENY),
 /* clone3's flags are behind a pointer. Deliberately expose ENOSYS only here. */
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,SYS_clone3,0,1),
 BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ERRNO | (ENOSYS & SECCOMP_RET_DATA)),
 /* clone: reject every upper/unlisted bit and accept only 0 or SIGCHLD exit. */
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,SYS_clone,0,11),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_HIGH(0)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,0,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_DENY),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_LOW(0)),
 BPF_JUMP(BPF_JMP|BPF_JSET|BPF_K,~(uint32_t)(AXIOM_CLONE_FLAGS | CSIGNAL),0,1),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_DENY),
 BPF_STMT(BPF_ALU|BPF_AND|BPF_K,CSIGNAL),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,0,2,0),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,SIGCHLD,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_DENY),
 BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ALLOW),
 /* prctl selector is a kernel int: compare its relevant low word. */
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,SYS_prctl,0,6),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_LOW(0)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,PR_GET_NO_NEW_PRIVS,3,0),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,PR_GET_SECCOMP,2,0),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,PR_SET_NAME,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_DENY),
 BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ALLOW),
 /* ioctl request is the kernel's unsigned-int command word. */
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,SYS_ioctl,0,6),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,ARG_LOW(1)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,TCGETS,3,0),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,TIOCGWINSZ,2,0),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,FIONREAD,1,0),
 BPF_STMT(BPF_RET|BPF_K,AXIOM_DENY),
 BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ALLOW),
#define AXIOM_ALLOW(name) BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,SYS_##name,0,1), BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ALLOW),
 AXIOM_ALLOWED_SYSCALLS(AXIOM_ALLOW)
#undef AXIOM_ALLOW
 BPF_STMT(BPF_RET|BPF_K,AXIOM_DENY)
};
_Static_assert(sizeof(compiler_filter)/sizeof(compiler_filter[0])<=USHRT_MAX,"filter length overflow");
#endif
