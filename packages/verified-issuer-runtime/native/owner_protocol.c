#include "owner_protocol.h"
#include <string.h>
static int nonzero(const unsigned char*p,size_t n){unsigned char v=0;if(!p)return 0;for(size_t i=0;i<n;i++)v|=p[i];return v!=0;}
static int equal(const unsigned char*a,const unsigned char*b,size_t n){unsigned char v=0;if(!a||!b)return 0;for(size_t i=0;i<n;i++)v|=a[i]^b[i];return v==0;}
void ax_owner_slot_revoke(AxOwnerSlot*s){if(s){s->phase=AX_OWNER_REVOKED;s->peer=0;memset(s->client,0,32);memset(s->owner,0,32);}}
int ax_owner_slot_reserve(AxOwnerSlot*s,uint64_t now,const unsigned char g[16]){if(!s||s->phase!=AX_OWNER_EMPTY||!nonzero(g,16)||now>UINT64_MAX-AX_OWNER_HANDSHAKE_NS)return 0;memcpy(s->generation,g,16);s->deadline=now+AX_OWNER_HANDSHAKE_NS;s->phase=AX_OWNER_RESERVED;return 1;}
int ax_owner_slot_child(AxOwnerSlot*s,pid_t child,int journal,uint64_t now){if(!s||s->phase!=AX_OWNER_RESERVED)return 0;if(!journal||child<=0||now>=s->deadline){ax_owner_slot_revoke(s);return 0;}s->child=child;s->phase=AX_OWNER_CHILD;return 1;}
int ax_owner_slot_begin(AxOwnerSlot*s,int auth,int alive,uint64_t now,uintptr_t peer,const unsigned char g[16],const unsigned char c[32],const unsigned char b[32]){
 if(!s||!auth)return 0;if(s->phase!=AX_OWNER_CHILD||!alive||now>=s->deadline||!peer||!equal(g,s->generation,16)||!nonzero(c,32)||!nonzero(b,32)){ax_owner_slot_revoke(s);return 0;}
 s->peer=peer;memcpy(s->client,c,32);memcpy(s->owner,b,32);s->sequence=0;s->phase=AX_OWNER_PENDING;return 1;
}
static int slot_matches(AxOwnerSlot*s,int auth,int alive,uintptr_t peer,const unsigned char*g,const unsigned char*c,const unsigned char*b){
 if(!s||!auth)return 0;if(!alive||!peer||peer!=s->peer||!equal(g,s->generation,16)||!equal(c,s->client,32)||!equal(b,s->owner,32)){ax_owner_slot_revoke(s);return 0;}return 1;
}
int ax_owner_slot_ack(AxOwnerSlot*s,int auth,int alive,uint64_t now,uintptr_t peer,const unsigned char g[16],const unsigned char c[32],const unsigned char b[32],uint64_t seq){
 if(!slot_matches(s,auth,alive,peer,g,c,b))return 0;if(s->phase!=AX_OWNER_PENDING||now>=s->deadline||seq!=0){ax_owner_slot_revoke(s);return 0;}s->phase=AX_OWNER_AUTHENTICATED;return 1;
}
int ax_owner_slot_live(AxOwnerSlot*s,int auth,int alive,uint64_t now,uintptr_t peer,const unsigned char g[16],const unsigned char c[32],const unsigned char b[32],uint64_t seq){
 (void)now;if(!slot_matches(s,auth,alive,peer,g,c,b))return 0;if(s->phase!=AX_OWNER_AUTHENTICATED||s->sequence==UINT64_MAX||seq!=s->sequence+1){ax_owner_slot_revoke(s);return 0;}s->sequence=seq;return 1;
}
void ax_owner_client_revoke(AxOwnerClient*s){if(s){s->phase=AX_OWNER_REVOKED;s->live_pending=0;memset(s->client,0,32);memset(s->owner,0,32);}}
int ax_owner_client_prepare(AxOwnerClient*s,pid_t self,const unsigned char g[16],const unsigned char c[32]){if(!s||s->phase!=AX_OWNER_EMPTY||self<=0||!nonzero(g,16)||!nonzero(c,32))return 0;s->self=self;memcpy(s->generation,g,16);memcpy(s->client,c,32);s->phase=AX_OWNER_RESERVED;return 1;}
static int client_matches(AxOwnerClient*s,int auth,pid_t child,const unsigned char*g,const unsigned char*c){if(!s)return 0;if(!auth||s->self!=child||!equal(g,s->generation,16)||!equal(c,s->client,32)){ax_owner_client_revoke(s);return 0;}return 1;}
int ax_owner_client_pending(AxOwnerClient*s,int auth,pid_t child,const unsigned char g[16],const unsigned char c[32],const unsigned char b[32],uint64_t seq){
 if(!client_matches(s,auth,child,g,c))return 0;if(s->phase!=AX_OWNER_RESERVED||seq||!nonzero(b,32)){ax_owner_client_revoke(s);return 0;}memcpy(s->owner,b,32);s->phase=AX_OWNER_PENDING;return 1;
}
int ax_owner_client_confirm(AxOwnerClient*s,int auth,pid_t child,const unsigned char g[16],const unsigned char c[32],const unsigned char b[32],uint64_t seq){
 if(!client_matches(s,auth,child,g,c))return 0;if(s->phase!=AX_OWNER_PENDING||seq||!equal(b,s->owner,32)){ax_owner_client_revoke(s);return 0;}s->sequence=0;s->phase=AX_OWNER_AUTHENTICATED;return 1;
}
int ax_owner_client_next(AxOwnerClient*s,uint64_t*out){if(!s||!out)return 0;if(s->phase!=AX_OWNER_AUTHENTICATED||s->live_pending||s->sequence==UINT64_MAX){ax_owner_client_revoke(s);return 0;}*out=s->sequence+1;s->live_pending=1;return 1;}
int ax_owner_client_live(AxOwnerClient*s,int auth,pid_t child,const unsigned char g[16],const unsigned char c[32],const unsigned char b[32],uint64_t seq){
 if(!client_matches(s,auth,child,g,c))return 0;if(s->phase!=AX_OWNER_AUTHENTICATED||!s->live_pending||s->sequence==UINT64_MAX||seq!=s->sequence+1||!equal(b,s->owner,32)){ax_owner_client_revoke(s);return 0;}s->sequence=seq;s->live_pending=0;return 1;
}
