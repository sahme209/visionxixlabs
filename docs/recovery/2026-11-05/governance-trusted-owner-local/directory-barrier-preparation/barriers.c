#define _DARWIN_C_SOURCE 1
#include "barriers.h"
#include <fcntl.h>
#include <errno.h>
int ax_probe_barriers(int f,int d,AxProbeResult*r){
 if(!r||f<0||d<0||f==d)return 0;
 *r=(AxProbeResult){.file_result=-2,.directory_result=-2};
 errno=0;r->file_result=fcntl(f,F_FULLFSYNC,0);r->file_errno=errno;
 if(r->file_result!=0)return 0;
 r->directory_attempted=1;errno=0;r->directory_result=fcntl(d,F_FULLFSYNC,0);r->directory_errno=errno;
 return r->directory_result==0;
}
