#define _GNU_SOURCE
#include "time_worker_protocol.h"
#include <unistd.h>
#include <errno.h>
#include <fcntl.h>
#include <sys/stat.h>
#define WORKER_DIRECTORY_FD 3
#define WORKER_SOURCE_FD 4
#define WORKER_RESULT_FD 5
#define WORKER_BOOTSTRAP_FD 6
static _Noreturn void die(void) { _exit(70); }
static int pipe_mode(int fd,int mode) {
 struct stat value;int flags=fcntl(fd,F_GETFL);
 return flags>=0&&(flags&O_ACCMODE)==mode&&fstat(fd,&value)==0&&S_ISFIFO(value.st_mode);
}
int main(void) {
 if(!pipe_mode(WORKER_RESULT_FD,O_WRONLY)||!pipe_mode(WORKER_BOOTSTRAP_FD,O_RDONLY))die();
 unsigned char bootstrap[AXIOM_WORKER_CONTEXT_MAX+1];size_t used=0;
 for(;;) {
  ssize_t n=read(WORKER_BOOTSTRAP_FD,bootstrap+used,sizeof(bootstrap)-used);
  if(n<0){if(errno==EINTR)continue;die();}
  if(n==0)break;
  used+=(size_t)n;if(used>AXIOM_WORKER_CONTEXT_MAX)die();
 }
 struct axiom_worker_context wire;
 if(axiom_worker_context_decode(bootstrap,used,1,&wire)||close(WORKER_BOOTSTRAP_FD))die();
 struct axiom_time_context context;
 context.directory_fd=WORKER_DIRECTORY_FD;context.source_fd=WORKER_SOURCE_FD;
 context.publisher_uid=wire.publisher_uid;context.reader_gid=wire.reader_gid;
 context.directory_device=wire.directory_device;context.directory_inode=wire.directory_inode;
 struct axiom_time_capture capture;
 if(axiom_time_capture_v2(&context,wire.generation,&capture))die();
 unsigned char frame[AXIOM_WORKER_FRAME_MAX];size_t length=0;
 int encoded=axiom_worker_capture_encode(&wire,&capture,frame,sizeof(frame),&length);
 axiom_time_capture_release(&capture);
 if(encoded||close(WORKER_SOURCE_FD)||close(WORKER_DIRECTORY_FD))die();
 size_t offset=0;
 while(offset<length) {
  ssize_t n=write(WORKER_RESULT_FD,frame+offset,length-offset);
  if(n<0&&errno==EINTR)continue;
  if(n<=0)die();
  offset+=(size_t)n;
 }
 if(close(WORKER_RESULT_FD))die();
 _exit(0);
}
