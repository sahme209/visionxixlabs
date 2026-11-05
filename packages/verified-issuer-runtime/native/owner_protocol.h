#ifndef AXIOM_OWNER_PROTOCOL_H
#define AXIOM_OWNER_PROTOCOL_H
#include <stdint.h>
#include <sys/types.h>
#define AX_OWNER_HANDSHAKE_NS 10000000000ULL
#define AX_OWNER_REQUEST_NS 250000000ULL
/* Inputs authenticated/alive are native observations, not peer JSON claims. */
typedef enum {AX_OWNER_EMPTY,AX_OWNER_RESERVED,AX_OWNER_CHILD,AX_OWNER_PENDING,AX_OWNER_AUTHENTICATED,AX_OWNER_REVOKED} AxOwnerPhase;
typedef struct {AxOwnerPhase phase;pid_t child;uintptr_t peer;uint64_t deadline,sequence;unsigned char generation[16],client[32],owner[32];} AxOwnerSlot;
void ax_owner_slot_revoke(AxOwnerSlot*);
int ax_owner_slot_reserve(AxOwnerSlot*,uint64_t,const unsigned char[16]);
int ax_owner_slot_child(AxOwnerSlot*,pid_t,int journal_created,uint64_t);
int ax_owner_slot_begin(AxOwnerSlot*,int authenticated,int alive,uint64_t,uintptr_t,const unsigned char[16],const unsigned char[32],const unsigned char[32]);
int ax_owner_slot_ack(AxOwnerSlot*,int authenticated,int alive,uint64_t,uintptr_t,const unsigned char[16],const unsigned char[32],const unsigned char[32],uint64_t);
int ax_owner_slot_live(AxOwnerSlot*,int authenticated,int alive,uint64_t,uintptr_t,const unsigned char[16],const unsigned char[32],const unsigned char[32],uint64_t);
/* Broker-private validation state. Values are not origin without actual native
 * transport authentication and SELF observation at each response. */
typedef struct {AxOwnerPhase phase;pid_t self;uint64_t sequence;int live_pending;unsigned char generation[16],client[32],owner[32];} AxOwnerClient;
void ax_owner_client_revoke(AxOwnerClient*);
int ax_owner_client_prepare(AxOwnerClient*,pid_t,const unsigned char[16],const unsigned char[32]);
int ax_owner_client_pending(AxOwnerClient*,int authenticated,pid_t,const unsigned char[16],const unsigned char[32],const unsigned char[32],uint64_t);
int ax_owner_client_confirm(AxOwnerClient*,int authenticated,pid_t,const unsigned char[16],const unsigned char[32],const unsigned char[32],uint64_t);
int ax_owner_client_next(AxOwnerClient*,uint64_t*);
int ax_owner_client_live(AxOwnerClient*,int authenticated,pid_t,const unsigned char[16],const unsigned char[32],const unsigned char[32],uint64_t);
#endif
