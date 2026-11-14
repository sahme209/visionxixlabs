/* Fixed role-free native resource test ONLY; not a production/runtime qualifier. */
#define _GNU_SOURCE
#include "runtime_profile.h"
#include <sys/stat.h>
#include <unistd.h>
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#ifndef AXIOM_NATIVE_BEHAVIOR_HARNESS
#error Fixed owned absolute harness path must be bound at compilation
#endif
static const char fixed_node[]="/opt/hostedtoolcache/node/24.22.2/x64/bin/node";
static const char fixed_harness[]=AXIOM_NATIVE_BEHAVIOR_HARNESS;
static _Noreturn void fail(void){_exit(70);}
static void validate_stdio(void){
 struct stat null_file,input,output,error;
 if(stat("/dev/null",&null_file)||fstat(0,&input)||fstat(1,&output)||fstat(2,&error))fail();
 if(!S_ISCHR(input.st_mode)||input.st_dev!=null_file.st_dev||input.st_ino!=null_file.st_ino||input.st_rdev!=null_file.st_rdev)fail();
 int in_flags=fcntl(0,F_GETFL),out_flags=fcntl(1,F_GETFL),err_flags=fcntl(2,F_GETFL);
 if(in_flags<0||out_flags<0||err_flags<0||((in_flags&O_ACCMODE)!=O_RDONLY&&(in_flags&O_ACCMODE)!=O_RDWR)||(out_flags&O_ACCMODE)!=O_WRONLY||(err_flags&O_ACCMODE)!=O_WRONLY)fail();
 if(output.st_uid!=getuid()||error.st_uid!=getuid()||!S_ISFIFO(output.st_mode)||!S_ISFIFO(error.st_mode)||(output.st_dev==error.st_dev&&output.st_ino==error.st_ino))fail();
}
static void describe(void){
 printf("{\"format\":1,\"scope\":\"trusted-fixed-native-behavior-only\",\"target\":\"linux-x86_64\",\"arch\":%u,\"defaultAction\":\"allow-trusted-source\",\"defaultErrno\":%d,\"clone3Flags\":\"source-trusted-not-inspected\",\"deniedSyscalls\":[",(unsigned)AUDIT_ARCH_X86_64,EPERM);
 int first=1;
#define AXIOM_RUNTIME_NAME(name) do{printf("%s\"%s\"",first?"":",",#name);first=0;}while(0);
 AXIOM_RUNTIME_DENIED_SYSCALLS(AXIOM_RUNTIME_NAME)
#undef AXIOM_RUNTIME_NAME
 printf("],\"instructions\":[");
 const size_t count=sizeof(runtime_filter)/sizeof(runtime_filter[0]);
 for(size_t i=0;i<count;i++)printf("%s{\"code\":%u,\"jt\":%u,\"jf\":%u,\"k\":%u}",i?",":"",(unsigned)runtime_filter[i].code,(unsigned)runtime_filter[i].jt,(unsigned)runtime_filter[i].jf,(unsigned)runtime_filter[i].k);
 printf("]}\n");if(fflush(stdout)||ferror(stdout))fail();
}
int main(int argc,char **argv){
 if(argc==2&&!strcmp(argv[1],"--describe")){describe();return 0;}
 if(argc!=2||strcmp(argv[1],"--"))fail();
 const size_t length=sizeof(fixed_harness)-1;const char suffix[]="/native_time_behavior.mjs";
 if(fixed_harness[0]!='/'||length>=PATH_MAX||length<sizeof(suffix)-1||strcmp(fixed_harness+length-(sizeof(suffix)-1),suffix))fail();
 uid_t ruid,euid,suid;gid_t rgid,egid,sgid;
 if(getresuid(&ruid,&euid,&suid)||getresgid(&rgid,&egid,&sgid)||ruid==0||rgid==0||ruid!=euid||ruid!=suid||rgid!=egid||rgid!=sgid)fail();
 validate_stdio();
 if(syscall(SYS_close_range,3U,~0U,0U)!=0)fail();
 if(prctl(PR_SET_NO_NEW_PRIVS,1L,0L,0L,0L)!=0)fail();
 if(prctl(PR_GET_NO_NEW_PRIVS,0L,0L,0L,0L)!=1)fail();
 struct sock_fprog program={(unsigned short)(sizeof(runtime_filter)/sizeof(runtime_filter[0])),(struct sock_filter *)runtime_filter};
 if(syscall(SYS_seccomp,SECCOMP_SET_MODE_FILTER,0U,&program)!=0)fail();
 if(prctl(PR_GET_SECCOMP,0L,0L,0L,0L)!=SECCOMP_MODE_FILTER)fail();
 char *const child_argv[]={(char *)fixed_node,(char *)fixed_harness,NULL};
 /* No inherited credentials, loader injection, NODE_OPTIONS or discovery. */
 char *const child_env[]={"PATH=/usr/bin:/bin","LANG=C.UTF-8","LC_ALL=C.UTF-8",NULL};
 execve(fixed_node,child_argv,child_env);
 fail();
}
