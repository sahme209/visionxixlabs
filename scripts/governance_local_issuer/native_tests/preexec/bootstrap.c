#define _DARWIN_C_SOURCE 1
#include <sandbox.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <libproc.h>
#include <sys/proc_info.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#ifndef FIXED_NODE
#error fixed paths required
#endif
#ifndef FIXED_SCRIPT
#error fixed paths required
#endif
int main(int argc,char **argv){
 if(argc!=3||(strcmp(argv[1],"control")&&strcmp(argv[1],"restricted")))return 64;
 const char *root=argv[2];struct stat st;
 if(strncmp(root,"/private/tmp/axiom-preexec-owned-",sizeof("/private/tmp/axiom-preexec-owned-")-1)||strchr(root+sizeof("/private/tmp/axiom-preexec-owned-")-1,'/')||lstat(root,&st)||!S_ISDIR(st.st_mode)||st.st_uid!=getuid()||(st.st_mode&0777)!=0700)return 65;
 int nullfd=open("/dev/null",O_RDONLY|O_NOFOLLOW|O_CLOEXEC);if(nullfd<0||dup2(nullfd,0)<0)return 66;if(nullfd>2)close(nullfd);
 /* Exact fixture never passes a writable regular-file stdio or any extra FD. */
 struct proc_fdinfo fds[4097];int bytes=proc_pidinfo(getpid(),PROC_PIDLISTFDS,0,fds,sizeof(fds));
 if(bytes<=0||bytes>=(int)sizeof(fds)||bytes%(int)sizeof(fds[0]))return 67;
 for(size_t n=0;n<(size_t)bytes/sizeof(fds[0]);n++){if(fds[n].proc_fd<0)return 67;if(fds[n].proc_fd>=3&&close(fds[n].proc_fd))return 67;}
 bytes=proc_pidinfo(getpid(),PROC_PIDLISTFDS,0,fds,sizeof(fds));
 if(bytes!=3*(int)sizeof(fds[0]))return 67;unsigned seen=0;
 for(size_t n=0;n<3;n++){int fd=fds[n].proc_fd;if(fd<0||fd>2||(seen&(1U<<fd)))return 67;seen|=1U<<fd;if(fd>0&&fds[n].proc_fdtype!=PROX_FDTYPE_PIPE)return 67;}
 if(seen!=7||chdir(root))return 67;
 if(!strcmp(argv[1],"restricted")){char *error=NULL;int r=sandbox_init(kSBXProfileNoWrite,SANDBOX_NAMED,&error);if(error)sandbox_free_error(error);if(r)return 78;}
 char *args[]={FIXED_NODE,FIXED_SCRIPT,(char *)root,argv[1],NULL};
 char *env[]={"PATH=/usr/bin:/bin","LANG=C","LC_ALL=C",NULL};
 execve(FIXED_NODE,args,env);return 79;
}
