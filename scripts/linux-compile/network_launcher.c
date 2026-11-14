/* Trusted compiler-child syscall restriction only; NOT a runtime/host sandbox. */
#define _GNU_SOURCE
#include "compiler_profile.h"
#include <sys/stat.h>
#include <unistd.h>
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
extern char **environ;
static _Noreturn void fail(void) { _exit(70); }
static void validate_stdio(void) {
 struct stat null_file,input,output,error;
 if(stat("/dev/null",&null_file)||fstat(0,&input)||fstat(1,&output)||fstat(2,&error))fail();
 if(!S_ISCHR(input.st_mode)||input.st_dev!=null_file.st_dev||input.st_ino!=null_file.st_ino||input.st_rdev!=null_file.st_rdev)fail();
 int in_flags=fcntl(0,F_GETFL),out_flags=fcntl(1,F_GETFL),err_flags=fcntl(2,F_GETFL);
 if(in_flags<0||out_flags<0||err_flags<0||((in_flags&O_ACCMODE)!=O_RDONLY&&(in_flags&O_ACCMODE)!=O_RDWR)||(out_flags&O_ACCMODE)!=O_WRONLY||(err_flags&O_ACCMODE)!=O_WRONLY)fail();
 /* Actual original supervisor supplies separate owned write-only pipe ends. */
 if(output.st_uid!=getuid()||error.st_uid!=getuid()||!S_ISFIFO(output.st_mode)||!S_ISFIFO(error.st_mode)||(output.st_dev==error.st_dev&&output.st_ino==error.st_ino))fail();
}
static void describe(void) {
 const size_t count=sizeof(compiler_filter)/sizeof(compiler_filter[0]);
 printf("{\"format\":1,\"target\":\"linux-x86_64\",\"arch\":%u,\"defaultErrno\":%d,\"clone3Errno\":%d,\"allowlist\":[",(unsigned)AUDIT_ARCH_X86_64,EPERM,ENOSYS);
 int first=1;
#define AXIOM_NAME(name) do { printf("%s\"%s\"",first?"":",",#name);first=0; } while(0);
 AXIOM_ALLOWED_SYSCALLS(AXIOM_NAME)
#undef AXIOM_NAME
 printf("],\"instructions\":[");
 for(size_t i=0;i<count;i++)printf("%s{\"code\":%u,\"jt\":%u,\"jf\":%u,\"k\":%u}",i?",":"",(unsigned)compiler_filter[i].code,(unsigned)compiler_filter[i].jt,(unsigned)compiler_filter[i].jf,(unsigned)compiler_filter[i].k);
 printf("]}\n");
 if(fflush(stdout)||ferror(stdout))fail();
}
int main(int argc,char **argv) {
 if(argc==2&&!strcmp(argv[1],"--describe")){describe();return 0;}
 if(argc<3||strcmp(argv[1],"--")||argv[2][0]!='/')fail();
 uid_t ruid,euid,suid;gid_t rgid,egid,sgid;
 if(getresuid(&ruid,&euid,&suid)||getresgid(&rgid,&egid,&sgid)||ruid==0||rgid==0||ruid!=euid||ruid!=suid||rgid!=egid||rgid!=sgid)fail();
 validate_stdio();
 if(syscall(SYS_close_range,3U,~0U,0U)!=0)fail();
 if(prctl(PR_SET_NO_NEW_PRIVS,1L,0L,0L,0L)!=0)fail();
 if(prctl(PR_GET_NO_NEW_PRIVS,0L,0L,0L,0L)!=1)fail();
 struct sock_fprog program={(unsigned short)(sizeof(compiler_filter)/sizeof(compiler_filter[0])),(struct sock_filter *)compiler_filter};
 if(syscall(SYS_seccomp,SECCOMP_SET_MODE_FILTER,0U,&program)!=0)fail();
 if(prctl(PR_GET_SECCOMP,0L,0L,0L,0L)!=SECCOMP_MODE_FILTER)fail();
 execve(argv[2],argv+2,environ);
 fail();
}
