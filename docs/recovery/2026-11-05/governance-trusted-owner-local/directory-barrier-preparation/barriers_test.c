#include "barriers.h"
#include <fcntl.h>
#include <errno.h>
#include <assert.h>
#include <stdio.h>
static int calls,fail;
int probe_fcntl(int fd,int cmd,...){assert(cmd==F_FULLFSYNC);assert(fd==(calls?32:31));calls++;if(calls==fail){errno=EINVAL;return -1;}errno=0;return 0;}
int main(void){AxProbeResult r={0};assert(ax_probe_barriers(31,32,&r)==1);assert(calls==2&&r.directory_attempted&&r.file_result==0&&r.directory_result==0);for(int i=1;i<=2;i++){calls=0;fail=i;assert(!ax_probe_barriers(31,32,&r));assert(calls==i);assert(i==1?r.file_errno==EINVAL&&!r.directory_attempted:r.directory_errno==EINVAL&&r.directory_attempted);}puts("exact barrier order and no retry: PASS");return 0;}
