#ifndef AXIOM_REQUEST_PROTOCOL_H
#define AXIOM_REQUEST_PROTOCOL_H
#include <stdint.h>
#include <stddef.h>
#define AX_REQUEST_PROTOCOL "axiom.issuer-owned-request/1"
#define AX_REQUEST_INPUT_CAP 4096U
#define AX_REQUEST_BODY_CAP 262144U
#define AX_REQUEST_FRAME_CAP (AX_REQUEST_BODY_CAP+8U)
typedef enum {AX_REQUEST_EMPTY,AX_REQUEST_ADMITTED,AX_REQUEST_DISPATCHED,AX_REQUEST_COMPLETED,AX_REQUEST_CANCELLED,AX_REQUEST_EXPIRED,AX_REQUEST_UNKNOWN} AxRequestPhase;
typedef struct {AxRequestPhase phase;uintptr_t desktop,child;uint64_t epoch,deadline;unsigned char id[32];} AxRequestSlot;
int ax_request_admit(AxRequestSlot*,uintptr_t,uintptr_t,uint64_t,uint64_t,uint64_t,const unsigned char[32],size_t);
int ax_request_dispatch(AxRequestSlot*,uint64_t);
int ax_request_current(AxRequestSlot*,uintptr_t,uint64_t,const unsigned char[32],uint64_t);
int ax_request_cancel(AxRequestSlot*,uintptr_t,const unsigned char[32]);
int ax_request_complete(AxRequestSlot*,uintptr_t,uint64_t,const unsigned char[32],uint64_t,const unsigned char*,size_t);
void ax_request_revoke(AxRequestSlot*);
int ax_request_id_parse(const char*,unsigned char[32]);
void ax_request_id_text(const unsigned char[32],char[65]);
int ax_request_response(const unsigned char*,size_t,uint32_t*,size_t*);
#endif
