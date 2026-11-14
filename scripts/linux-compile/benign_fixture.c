/* One future CI preflight only. No inference, address, credential or clock trial. */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <linux/seccomp.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/prctl.h>
#include <sys/ptrace.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#if !defined(__linux__) || !defined(__x86_64__) || defined(__ILP32__)
#error Unsupported fixture target
#endif
static _Noreturn void fail(const char *stage) {
    /* Stage names are fixed literals, never input or provider error text. */
    fprintf(stderr,"compiler-fixture:%s\n",stage);
    _exit(70);
}
static void denied(long result, int expected, const char *stage) {
    if (result != -1 || errno != expected) fail(stage);
}
int main(int argc, char **argv) {
    if (argc != 3 || argv[1][0] != '/' || strcmp(argv[2],"/usr/bin/true") != 0) fail("arguments");
    if (prctl(PR_GET_NO_NEW_PRIVS,0L,0L,0L,0L) != 1 || prctl(PR_GET_SECCOMP,0L,0L,0L,0L) != SECCOMP_MODE_FILTER) fail("restriction-state");
    const char payload[]="local-only\n";
    int fd=open(argv[1],O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
    if (fd < 0) fail("create");
    struct stat st;
    if (fstat(fd,&st) || !S_ISREG(st.st_mode) || st.st_nlink != 1 || (st.st_mode & 07777) != 0600 || st.st_uid != getuid()) fail("file-identity");
    if (write(fd,payload,sizeof(payload)-1) != (ssize_t)(sizeof(payload)-1) || fsync(fd) || close(fd)) fail("write");
    fd=open(argv[1],O_RDONLY|O_NOFOLLOW|O_CLOEXEC);
    char bytes[sizeof(payload)]={0};
    if (fd < 0 || read(fd,bytes,sizeof(bytes)) != (ssize_t)(sizeof(payload)-1) || memcmp(bytes,payload,sizeof(payload)-1) || close(fd) || unlink(argv[1])) fail("read-cleanup");
    if (puts("local-file:ok") < 0) fail("output");

    pid_t child=fork();
    if (child < 0) fail("fork");
    if (child == 0) { execl(argv[2],argv[2],(char *)NULL); _exit(71); }
    int status=0;
    if (waitpid(child,&status,0) != child || !WIFEXITED(status) || WEXITSTATUS(status) != 0) fail("child-exec");
    if (puts("child-exec:ok") < 0) fail("output");

    errno=0; denied(syscall(SYS_socket,AF_INET,SOCK_STREAM|SOCK_CLOEXEC,0),EPERM,"ipv4");
    errno=0; denied(syscall(SYS_socket,AF_INET6,SOCK_STREAM|SOCK_CLOEXEC,0),EPERM,"ipv6");
    errno=0; denied(syscall(SYS_socket,AF_UNIX,SOCK_STREAM|SOCK_CLOEXEC,0),EPERM,"unix-socket");
    int pair[2]={-1,-1};
    errno=0; denied(syscall(SYS_socketpair,AF_UNIX,SOCK_STREAM|SOCK_CLOEXEC,0,pair),EPERM,"socketpair");
    errno=0; denied(syscall(SYS_io_uring_setup,0,NULL),EPERM,"uring");
    errno=0; denied(syscall(SYS_pidfd_getfd,-1,-1,0),EPERM,"descriptor-acquisition");
    /* Invalid targets avoid attaching to or changing any real other process,
     * even if a broken filter were to pass an operation to the kernel. */
    errno=0; denied(syscall(SYS_ptrace,PTRACE_PEEKDATA,-1,NULL,NULL),EPERM,"cross-process-trace");
    errno=0; denied(syscall(SYS_process_vm_writev,-1,NULL,0,NULL,0,0),EPERM,"cross-process-memory");
    /* Flags0 cannot create a namespace; this checks the denied syscall family. */
    errno=0; denied(syscall(SYS_unshare,0),EPERM,"namespace-family");
    errno=0; denied(syscall(SYS_clone3,NULL,0),ENOSYS,"clone3-policy");
    if (puts("network-denials:ok") < 0) fail("output");

    int pipes[2]={-1,-1},available=-1;
    if (pipe2(pipes,O_CLOEXEC) || ioctl(pipes[0],FIONREAD,&available) || available != 0 || close(pipes[0]) || close(pipes[1])) fail("allowed-ioctl");
    errno=0; denied(syscall(SYS_ioctl,-1,0,0),EPERM,"ioctl-selector");
    errno=0; denied(prctl(-1,0L,0L,0L,0L),EPERM,"prctl-selector");
    if (puts("selector-denials:ok") < 0 || fflush(stdout)) fail("output");
    return 0;
}
