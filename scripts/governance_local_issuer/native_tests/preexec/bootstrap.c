#define _DARWIN_C_SOURCE 1
#include <sandbox.h>
#include <sys/stat.h>
#include <fcntl.h>
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
 if(strncmp(root,"/private/tmp/axiom-preexec-owned-",31)||strchr(root+31,'/')||lstat(root,&st)||!S_ISDIR(st.st_mode)||st.st_uid!=getuid()||(st.st_mode&0777)!=0700)return 65;
 int nullfd=open("/dev/null",O_RDONLY|O_NOFOLLOW|O_CLOEXEC);if(nullfd<0||dup2(nullfd,0)<0)return 66;if(nullfd>2)close(nullfd);
 /* Exact fixture never passes a writable regular-file stdio or any extra FD. */
 long limit=sysconf(_SC_OPEN_MAX);if(limit<3||limit>65536)return 67;for(int fd=3;fd<limit;fd++)close(fd);if(chdir(root))return 67;
 if(!strcmp(argv[1],"restricted")){char *error=NULL;int r=sandbox_init(kSBXProfileNoWrite,SANDBOX_NAMED,&error);if(error)sandbox_free_error(error);if(r)return 78;}
 char *args[]={FIXED_NODE,FIXED_SCRIPT,(char *)root,argv[1],NULL};
 char *env[]={"PATH=/usr/bin:/bin","LANG=C","LC_ALL=C",NULL};
 execve(FIXED_NODE,args,env);return 79;
}
