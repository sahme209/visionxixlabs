#ifndef AXIOM_ORIGIN_UNIT_PROTOCOL_H
#define AXIOM_ORIGIN_UNIT_PROTOCOL_H
#include <stdint.h>
#include <sys/types.h>
typedef enum {ORIGIN_EMPTY,ORIGIN_SPAWNED,ORIGIN_PENDING,ORIGIN_CONSUMED,ORIGIN_REVOKED} OriginPhase;
typedef struct {OriginPhase phase;pid_t child;uint64_t deadline;uintptr_t peer;unsigned char client[32],broker[32];} OriginSlot;
int origin_spawn(OriginSlot*,pid_t,uint64_t);
int origin_begin(OriginSlot*,int,int,uint64_t,uintptr_t,const unsigned char[32],const unsigned char[32]);
int origin_ack(OriginSlot*,int,int,uint64_t,uintptr_t,const unsigned char[32],const unsigned char[32]);
void origin_revoke(OriginSlot*);
#endif
