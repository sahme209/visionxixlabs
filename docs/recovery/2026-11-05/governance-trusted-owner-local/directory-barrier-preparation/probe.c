/* Prepared native fixture experiment. Do not run without exact approval. */
#define _DARWIN_C_SOURCE 1
#include "barriers.h"
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <errno.h>
#define FIXTURE "/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-05-directory-barrier"
int main(int argc,char**argv){
 (void)argv;if(argc!=1||getuid()==0||getuid()!=geteuid())return 70;
 int directory=open(FIXTURE,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);if(directory<0)return 71;
 struct stat d;if(fstat(directory,&d)||!S_ISDIR(d.st_mode)||d.st_uid!=getuid()||(d.st_mode&0777)!=0700){close(directory);return 72;}
 /* Additional invocation guard. An existing/unknown marker never retries. */
 int marker=openat(directory,"probe-attempt.v1",O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
 if(marker<0){close(directory);return 73;}
 int marked=write(marker,"1",1)==1;int marker_closed=close(marker);if(!marked||marker_closed){close(directory);return 74;}
 int fd=openat(directory,"probe-data.v1",O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);if(fd<0){close(directory);return 75;}
 static const char data[]="AXIOM owned storage probe only\n";
 struct stat f;int valid=fstat(fd,&f)==0&&S_ISREG(f.st_mode)&&f.st_uid==getuid()&&(f.st_mode&0777)==0600&&f.st_nlink==1&&f.st_dev==d.st_dev;
 if(!valid||write(fd,data,sizeof(data)-1)!=(ssize_t)(sizeof(data)-1)){close(fd);close(directory);return 76;}
 AxProbeResult r;int pass=ax_probe_barriers(fd,directory,&r);
 int file_close=close(fd),dir_close=close(directory);
 printf("{\"file_result\":%d,\"file_errno\":%d,\"directory_attempted\":%d,\"directory_result\":%d,\"directory_errno\":%d,\"file_close\":%d,\"directory_close\":%d,\"fixture_device\":%llu}\n",r.file_result,r.file_errno,r.directory_attempted,r.directory_result,r.directory_errno,file_close,dir_close,(unsigned long long)d.st_dev);
 return pass&&!file_close&&!dir_close?0:77;
}
