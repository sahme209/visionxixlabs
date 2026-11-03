#define _DARWIN_C_SOURCE 1
#include <sandbox.h>
#include <libproc.h>
#include <sys/proc_info.h>
#include <sys/stat.h>
#include <sys/mount.h>
#include <fcntl.h>
#include <unistd.h>
#include <string.h>
#ifndef OWNED_ROOT
#error fixed owned root required
#endif
int main(int argc,char **argv){
 if(argc!=2||strcmp(argv[1],"--resource-restriction-once"))return 64;
 struct stat s;struct statfs fs;
 if(lstat(OWNED_ROOT,&s)||!S_ISDIR(s.st_mode)||s.st_uid!=getuid()||(s.st_mode&0777)!=0700)return 65;
 if(statfs(OWNED_ROOT "/mount",&fs)||!(fs.f_flags&MNT_RDONLY)||strcmp(fs.f_mntonname,OWNED_ROOT "/mount"))return 66;
 int claim=open(OWNED_ROOT "/restriction-claim.json",O_CREAT|O_EXCL|O_NOFOLLOW|O_WRONLY|O_CLOEXEC,0600);if(claim<0)return 70;
 const char message[]="{\"status\":\"claimed_unknown_no_retry\"}\n";int claimed=write(claim,message,sizeof(message)-1)==(ssize_t)sizeof(message)-1&&fsync(claim)==0;if(close(claim)||!claimed)return 70;
 int fd=open("/dev/null",O_RDONLY|O_NOFOLLOW|O_CLOEXEC);if(fd<0||dup2(fd,0)<0)return 67;if(fd>2)close(fd);
 struct proc_fdinfo fds[4097];int bytes=proc_pidinfo(getpid(),PROC_PIDLISTFDS,0,fds,sizeof(fds));
 if(bytes<=0||bytes>=(int)sizeof(fds)||bytes%(int)sizeof(fds[0]))return 68;
 for(size_t n=0;n<(size_t)bytes/sizeof(fds[0]);n++)if(fds[n].proc_fd<0||(fds[n].proc_fd>=3&&close(fds[n].proc_fd)))return 68;
 bytes=proc_pidinfo(getpid(),PROC_PIDLISTFDS,0,fds,sizeof(fds));if(bytes!=3*(int)sizeof(fds[0]))return 68;unsigned seen=0;
 for(size_t n=0;n<3;n++){int f=fds[n].proc_fd;if(f<0||f>2||(seen&(1U<<f))||(f>0&&fds[n].proc_fdtype!=PROX_FDTYPE_PIPE))return 68;seen|=1U<<f;}if(seen!=7)return 68;
 if(chdir(OWNED_ROOT))return 69;
 char *error=NULL;int result=sandbox_init(kSBXProfileNoWrite,SANDBOX_NAMED,&error);if(error)sandbox_free_error(error);if(result)return 78;
 char *args[]={OWNED_ROOT "/resource-attack","--resource",NULL};char *env[]={"PATH=/usr/bin:/bin","LANG=C","LC_ALL=C",NULL};
 execve(args[0],args,env);return 79;
}
