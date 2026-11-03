#include "protocol.h"
#include <string.h>
#define WINDOW 30000000000ULL
void origin_revoke(OriginSlot*s){if(s){s->phase=ORIGIN_REVOKED;memset(s->client,0,32);memset(s->broker,0,32);s->peer=0;}}
int origin_spawn(OriginSlot*s,pid_t pid,uint64_t now){if(!s||s->phase!=ORIGIN_EMPTY||pid<=0||now>UINT64_MAX-WINDOW)return 0;s->child=pid;s->deadline=now+WINDOW;s->phase=ORIGIN_SPAWNED;return 1;}
int origin_begin(OriginSlot*s,int authenticated,int alive,uint64_t now,uintptr_t peer,const unsigned char client[32],const unsigned char broker[32]){
 if(!s||!authenticated)return 0;if(!alive||now>=s->deadline){origin_revoke(s);return 0;}if(s->phase!=ORIGIN_SPAWNED||!peer||!client||!broker)return 0;
 s->peer=peer;memcpy(s->client,client,32);memcpy(s->broker,broker,32);s->phase=ORIGIN_PENDING;return 1;
}
int origin_ack(OriginSlot*s,int authenticated,int alive,uint64_t now,uintptr_t peer,const unsigned char client[32],const unsigned char broker[32]){
 if(!s)return 0;if(!authenticated||!alive||now>=s->deadline||s->phase!=ORIGIN_PENDING||peer!=s->peer||!client||!broker||memcmp(client,s->client,32)||memcmp(broker,s->broker,32)){origin_revoke(s);return 0;}
 s->phase=ORIGIN_CONSUMED;return 1;
}
