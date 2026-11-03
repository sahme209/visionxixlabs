/* Fixed restriction-before-exec bootstrap. COMPILE ONLY in ordinary preparation.
 * Actual invocation can install a restriction and requires exact run approval. */
#define _DARWIN_C_SOURCE 1
#include "origin_config.h"
#include <sandbox.h>
#include <mach-o/dyld.h>
#include <libproc.h>
#include <sys/proc_info.h>
#include <sys/stat.h>
#include <sys/mount.h>
#include <fcntl.h>
#include <unistd.h>
#include <limits.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
static int failure(void){fputs("verified_issuer_bootstrap_unavailable\n",stderr);return 70;}
static int closed_stdio(void){
 struct proc_fdinfo list[4];int bytes=proc_pidinfo(getpid(),PROC_PIDLISTFDS,0,list,sizeof(list));if(bytes!=3*(int)sizeof(list[0]))return 0;
 struct stat null;if(stat("/dev/null",&null)||!S_ISCHR(null.st_mode))return 0;int seen[3]={0};
 for(size_t i=0;i<3;i++){
  int fd=list[i].proc_fd;if(fd<0||fd>2||seen[fd]++)return 0;struct stat item;int flags=fcntl(fd,F_GETFL);if(flags<0||fstat(fd,&item))return 0;
  if(fd==0){if(list[i].proc_fdtype!=PROX_FDTYPE_VNODE||(flags&O_ACCMODE)!=O_RDONLY||!S_ISCHR(item.st_mode)||item.st_rdev!=null.st_rdev)return 0;}
  else if(list[i].proc_fdtype!=PROX_FDTYPE_PIPE||(flags&O_ACCMODE)!=O_WRONLY||!S_ISFIFO(item.st_mode))return 0;
 }
 return seen[0]&&seen[1]&&seen[2];
}
int main(int argc,char**argv){
 (void)argv;if(argc!=1||!AXIOM_ISSUER_PACKAGE_ROOT[0])return failure();
 char root[PATH_MAX],self[PATH_MAX],actual[PATH_MAX],expected[PATH_MAX],node[PATH_MAX],main_file[PATH_MAX];struct stat item;struct statfs volume;uint32_t length=sizeof(self);
 if(!realpath(AXIOM_ISSUER_PACKAGE_ROOT,root)||strcmp(root,AXIOM_ISSUER_PACKAGE_ROOT)||lstat(root,&item)||!S_ISDIR(item.st_mode)||statfs(root,&volume)||!(volume.f_flags&MNT_RDONLY)||strcmp(volume.f_mntonname,root))return failure();
 if(_NSGetExecutablePath(self,&length)||!realpath(self,actual)||snprintf(expected,sizeof(expected),"%s/__axiom_runtime__/origin-bootstrap",root)>=(int)sizeof(expected)||strcmp(actual,expected))return failure();
 if(snprintf(node,sizeof(node),"%s/__axiom_runtime__/node",root)>=(int)sizeof(node)||snprintf(main_file,sizeof(main_file),"%s/node_modules/@axiom/verified-issuer-runtime/index.cjs",root)>=(int)sizeof(main_file))return failure();
 if(lstat(node,&item)||!S_ISREG(item.st_mode)||!(item.st_mode&0111)||!realpath(main_file,actual)||strncmp(actual,root,strlen(root))||actual[strlen(root)]!='/'||stat(actual,&item)||!S_ISREG(item.st_mode)||!closed_stdio()||chdir(root))return failure();
 /* No code/env/request selected between restriction installation and exact exec.
  * The actual owned origin handshake supplies lineage; no sandbox flag does. */
 char*error=NULL;
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
 int installed=sandbox_init(kSBXProfileNoWrite,SANDBOX_NAMED,&error);
 if(error)sandbox_free_error(error);
#pragma clang diagnostic pop
 if(installed)return failure();
 char*args[]={node,main_file,NULL};char*environment[]={"PATH=/usr/bin:/bin:/usr/sbin:/sbin","LANG=C","LC_ALL=C","TZ=UTC","NODE_ENV=production",NULL};
 execve(node,args,environment);return failure();
}
