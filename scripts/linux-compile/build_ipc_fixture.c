/* Trusted build-only fixture. Source tests do not compile or execute this file. */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <sys/syscall.h>
#include <unistd.h>
#include "compiler_profile.h"
#if !defined(__linux__) || !defined(__x86_64__) || defined(__ILP32__)
#error Unsupported build fixture target
#endif
static _Noreturn void fail(void) {
    fputs("build-ipc-c:failed\n",stderr);
    _exit(70);
}
/* DATA evaluation of the actual compiled array, not a kernel/session probe.
 * Only this pinned program's closed instruction subset is supported. */
static uint32_t evaluate_filter(const struct seccomp_data *observed) {
    const size_t count=sizeof(compiler_filter)/sizeof(compiler_filter[0]);
    uint32_t accumulator=0;size_t pc=0;
    for(size_t steps=0;steps<count;steps++) {
        if(pc>=count) fail();
        const struct sock_filter instruction=compiler_filter[pc++];
        size_t jump=0;
        switch(instruction.code) {
        case BPF_LD|BPF_W|BPF_ABS:
            if(instruction.k>sizeof(*observed)-sizeof(accumulator)) fail();
            memcpy(&accumulator,(const unsigned char *)observed+instruction.k,sizeof(accumulator));break;
        case BPF_JMP|BPF_JEQ|BPF_K:jump=accumulator==instruction.k?instruction.jt:instruction.jf;break;
        case BPF_JMP|BPF_JGE|BPF_K:jump=accumulator>=instruction.k?instruction.jt:instruction.jf;break;
        case BPF_JMP|BPF_JSET|BPF_K:jump=(accumulator&instruction.k)?instruction.jt:instruction.jf;break;
        case BPF_ALU|BPF_AND|BPF_K:accumulator&=instruction.k;break;
        case BPF_RET|BPF_K:return instruction.k;
        default:fail();
        }
        if(jump>=count-pc) { if(jump || pc==count) fail(); }
        pc+=jump;
    }
    fail();
}
static void denied_pair(uint64_t domain,uint64_t type,uint64_t protocol) {
    int pair[2]={-1,-1};errno=0;
    long result=syscall(SYS_socketpair,domain,type,protocol,pair);
    int saved=errno;
    /* Even if a broken filter permits a local pair, close both before stopping. */
    if(result==0) { (void)close(pair[0]);(void)close(pair[1]);fail(); }
    if(result!=-1 || saved!=EPERM) fail();
}
static void denied_receive(uint64_t length,uint64_t flags,uint64_t address,uint64_t address_length) {
    char buffer[8]={0};
    /* Zero-extended -1 passes the profile's FD high-word check, but remains an
     * invalid kernel int FD. Wrong predicates cannot block or consume a pair. */
    const unsigned long invalid_fd=UINT32_MAX;
    errno=0;
    if(syscall(SYS_recvfrom,invalid_fd,buffer,length,flags,address,address_length)!=-1 || errno!=EPERM) fail();
}
int main(int argc,char **argv) {
    (void)argv;
    if(argc!=1) fail();
    struct seccomp_data observed={0};observed.arch=AUDIT_ARCH_X86_64;
    observed.nr=SYS_setsid;
    if(evaluate_filter(&observed)!=AXIOM_DENY) fail();
    observed.nr=SYS_setpgid;
    if(evaluate_filter(&observed)!=AXIOM_DENY) fail();
    int pipes[2]={-1,-1},enabled=1,disabled=0;
    if(pipe2(pipes,O_CLOEXEC)) fail();
    if(ioctl(pipes[0],FIONBIO,&enabled)) fail();
    int flags=fcntl(pipes[0],F_GETFL);
    if(flags<0 || !(flags&O_NONBLOCK)) fail();
    if(ioctl(pipes[0],FIONBIO,&disabled)) fail();
    flags=fcntl(pipes[0],F_GETFL);
    if(flags<0 || (flags&O_NONBLOCK) || close(pipes[0]) || close(pipes[1])) fail();

    int pair[2]={-1,-1};
    if(socketpair(AF_UNIX,SOCK_SEQPACKET|SOCK_CLOEXEC,0,pair)) fail();
    int first=fcntl(pair[0],F_GETFD),second=fcntl(pair[1],F_GETFD);
    if(first<0 || second<0 || !(first&FD_CLOEXEC) || !(second&FD_CLOEXEC)) fail();
    const char payload[8]={'b','u','i','l','d','i','p','c'};char buffer[8]={0};
    if(write(pair[0],payload,8)!=8) fail();
    if(syscall(SYS_recvfrom,pair[1],buffer,8,0,NULL,NULL)!=8 || memcmp(buffer,payload,8)) fail();
    if(close(pair[0]) || close(pair[1])) fail();

    const uint64_t high=UINT64_C(1)<<32;
    denied_pair(AF_INET,SOCK_SEQPACKET|SOCK_CLOEXEC,0);
    denied_pair(AF_INET6,SOCK_SEQPACKET|SOCK_CLOEXEC,0);
    denied_pair(AF_UNIX,SOCK_STREAM|SOCK_CLOEXEC,0);
    denied_pair(AF_UNIX,SOCK_DGRAM|SOCK_CLOEXEC,0);
    denied_pair(AF_UNIX,SOCK_SEQPACKET,0);
    denied_pair(AF_UNIX,SOCK_SEQPACKET|SOCK_CLOEXEC|SOCK_NONBLOCK,0);
    denied_pair(AF_UNIX,SOCK_SEQPACKET|SOCK_CLOEXEC,1);
    denied_pair((uint64_t)AF_UNIX|high,SOCK_SEQPACKET|SOCK_CLOEXEC,0);
    denied_pair(AF_UNIX,(uint64_t)(SOCK_SEQPACKET|SOCK_CLOEXEC)|high,0);
    denied_pair(AF_UNIX,SOCK_SEQPACKET|SOCK_CLOEXEC,high);
    denied_receive(0,0,0,0);
    denied_receive(7,0,0,0);
    denied_receive(9,0,0,0);
    denied_receive(UINT64_C(8)|high,0,0,0);
    denied_receive(8,MSG_PEEK,0,0);
    denied_receive(8,high,0,0);
    struct sockaddr_storage address;unsigned int address_length=sizeof(address);
    denied_receive(8,0,(uintptr_t)&address,0);
    denied_receive(8,0,0,(uintptr_t)&address_length);
    denied_receive(8,0,high,0);
    denied_receive(8,0,0,high);
    errno=0;
    if(syscall(SYS_recvfrom,UINT64_MAX,buffer,8,0,NULL,NULL)!=-1 || errno!=EPERM) fail();
    errno=0;
    if(syscall(SYS_ioctl,UINT32_MAX,0,0)!=-1 || errno!=EPERM) fail();
    /* Impossible negative PID/PGID cannot move any real process, even if the
     * filter is broken. Session denial is checked from filter data, not setsid. */
    errno=0;
    if(syscall(SYS_setpgid,-1,-1)!=-1 || errno!=EPERM) fail();
    if(puts("build-ipc-c:ok")<0 || fflush(stdout)) fail();
    return 0;
}
