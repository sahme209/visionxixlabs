/* Fixed synthetic cancellation fault only. Not a time reader or publisher. */
#define _GNU_SOURCE
#include <unistd.h>
#include <fcntl.h>
#include <poll.h>
int main(void){
 int fd=openat(3,"ready",O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0400);
 if(fd<0)_exit(70);
 if(write(fd,"ready\n",6)!=6||close(fd))_exit(70);
 for(;;)(void)poll(NULL,0,-1);
}
