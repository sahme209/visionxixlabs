#include "origin_runtime_protocol.h"
#include <string.h>
void axiom_origin_slot_revoke(AxiomOriginSlot*s){if(s){s->phase=AXIOM_ORIGIN_REVOKED;s->peer=0;memset(s->client,0,32);memset(s->broker,0,32);memset(s->last_live,0,32);}}
int axiom_origin_slot_reserve(AxiomOriginSlot*s,uint64_t now){if(!s||s->phase!=AXIOM_ORIGIN_EMPTY||now>UINT64_MAX-AXIOM_ORIGIN_STARTUP_NS)return 0;s->deadline=now+AXIOM_ORIGIN_STARTUP_NS;s->phase=AXIOM_ORIGIN_RESERVED;return 1;}
int axiom_origin_slot_spawn(AxiomOriginSlot*s,pid_t child,uint64_t now){if(!s||s->phase!=AXIOM_ORIGIN_RESERVED||child<=0)return 0;if(now>=s->deadline){axiom_origin_slot_revoke(s);return 0;}s->child=child;s->phase=AXIOM_ORIGIN_SPAWNED;return 1;}
int axiom_origin_slot_may_resume(const AxiomOriginSlot*s,pid_t child,uint64_t now){return s&&s->phase==AXIOM_ORIGIN_SPAWNED&&s->child==child&&child>0&&now<s->deadline;}
int axiom_origin_slot_begin(AxiomOriginSlot*s,int authenticated,int alive,uint64_t now,uintptr_t peer,const unsigned char client[32],const unsigned char broker[32]){
 if(!s||!authenticated||s->phase!=AXIOM_ORIGIN_SPAWNED)return 0;if(!alive||now>=s->deadline){axiom_origin_slot_revoke(s);return 0;}if(!peer||!client||!broker)return 0;
 s->peer=peer;memcpy(s->client,client,32);memcpy(s->broker,broker,32);s->phase=AXIOM_ORIGIN_PENDING;return 1;
}
int axiom_origin_slot_ack(AxiomOriginSlot*s,int authenticated,int alive,uint64_t now,uintptr_t peer,const unsigned char client[32],const unsigned char broker[32]){
 if(!s||!authenticated||peer!=s->peer)return 0;
 if(!alive||now>=s->deadline||s->phase!=AXIOM_ORIGIN_PENDING||!client||!broker||memcmp(s->client,client,32)||memcmp(s->broker,broker,32)){axiom_origin_slot_revoke(s);return 0;}
 s->phase=AXIOM_ORIGIN_CONSUMED;return 1;
}
int axiom_origin_slot_live(AxiomOriginSlot*s,int authenticated,int alive,uint64_t now,uintptr_t peer,const unsigned char nonce[32],const unsigned char broker[32]){
 (void)now;if(!s||!authenticated||peer!=s->peer)return 0;
 if(!alive||s->phase!=AXIOM_ORIGIN_CONSUMED||!nonce||!broker||memcmp(broker,s->broker,32)){axiom_origin_slot_revoke(s);return 0;}
 if(s->has_live&&!memcmp(nonce,s->last_live,32))return 0;
 memcpy(s->last_live,nonce,32);s->has_live=1;return 1;
}
