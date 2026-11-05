#ifndef AX_PROBE_BARRIERS_H
#define AX_PROBE_BARRIERS_H
typedef struct {int file_result,file_errno,directory_result,directory_errno,directory_attempted;} AxProbeResult;
int ax_probe_barriers(int,int,AxProbeResult*);
#endif
