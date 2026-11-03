#ifndef AXIOM_ORIGIN_RUNTIME_PROTOCOL_H
#define AXIOM_ORIGIN_RUNTIME_PROTOCOL_H
#include <stdint.h>
#include <sys/types.h>
#define AXIOM_ORIGIN_STARTUP_NS 180000000000ULL
/* Internal state only. Auth/alive inputs MUST come from the actual native broker,
 * never a decoded request. No PID/challenge/digest alone constructs authority. */
typedef enum {AXIOM_ORIGIN_EMPTY,AXIOM_ORIGIN_RESERVED,AXIOM_ORIGIN_SPAWNED,AXIOM_ORIGIN_PENDING,AXIOM_ORIGIN_CONSUMED,AXIOM_ORIGIN_REVOKED} AxiomOriginPhase;
typedef struct {AxiomOriginPhase phase;pid_t child;uintptr_t peer;uint64_t deadline;unsigned char client[32],broker[32],last_live[32];int has_live;} AxiomOriginSlot;
void axiom_origin_slot_revoke(AxiomOriginSlot*);
int axiom_origin_slot_reserve(AxiomOriginSlot*,uint64_t);
int axiom_origin_slot_may_resume(const AxiomOriginSlot*,pid_t,uint64_t);
int axiom_origin_slot_spawn(AxiomOriginSlot*,pid_t,uint64_t);
int axiom_origin_slot_begin(AxiomOriginSlot*,int authenticated,int alive,uint64_t now,uintptr_t peer,const unsigned char client[32],const unsigned char broker[32]);
int axiom_origin_slot_ack(AxiomOriginSlot*,int authenticated,int alive,uint64_t now,uintptr_t peer,const unsigned char client[32],const unsigned char broker[32]);
int axiom_origin_slot_live(AxiomOriginSlot*,int authenticated,int alive,uint64_t now,uintptr_t peer,const unsigned char nonce[32],const unsigned char broker[32]);
#endif
