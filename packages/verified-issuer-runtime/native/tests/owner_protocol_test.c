#include "../owner_protocol.h"
#include <assert.h>
#include <string.h>
#include <stdio.h>
static unsigned char g[16]={1},c[32]={2},b[32]={3},wrong[32]={9};
static void setup(AxOwnerSlot*s,AxOwnerClient*k){memset(s,0,sizeof(*s));memset(k,0,sizeof(*k));assert(ax_owner_slot_reserve(s,1,g));assert(ax_owner_slot_child(s,37,1,2));assert(ax_owner_client_prepare(k,37,g,c));}
int main(void){
 AxOwnerSlot s;AxOwnerClient k;uint64_t q=0;setup(&s,&k);
 assert(!ax_owner_slot_begin(&s,0,1,3,8,g,c,b));assert(s.phase==AX_OWNER_CHILD);
 assert(ax_owner_slot_begin(&s,1,1,3,8,g,c,b));assert(ax_owner_client_pending(&k,1,37,g,c,b,0));
 assert(ax_owner_slot_ack(&s,1,1,4,8,g,c,b,0));assert(ax_owner_client_confirm(&k,1,37,g,c,b,0));
 assert(ax_owner_client_next(&k,&q)&&q==1);assert(ax_owner_slot_live(&s,1,1,5,8,g,c,b,q));assert(ax_owner_client_live(&k,1,37,g,c,b,q));
 assert(ax_owner_client_next(&k,&q)&&q==2);assert(ax_owner_slot_live(&s,1,1,6,8,g,c,b,q));assert(ax_owner_client_live(&k,1,37,g,c,b,q));
 assert(!ax_owner_slot_live(&s,1,1,7,8,g,c,b,1));assert(s.phase==AX_OWNER_REVOKED);assert(!ax_owner_slot_reserve(&s,8,g));
 setup(&s,&k);assert(ax_owner_slot_begin(&s,1,1,3,8,g,c,b));assert(!ax_owner_slot_ack(&s,1,1,4,8,g,c,wrong,0));assert(s.phase==AX_OWNER_REVOKED);
 setup(&s,&k);assert(!ax_owner_slot_begin(&s,1,0,3,8,g,c,b));assert(s.phase==AX_OWNER_REVOKED);
 setup(&s,&k);assert(!ax_owner_slot_begin(&s,1,1,s.deadline,8,g,c,b));assert(s.phase==AX_OWNER_REVOKED);
 setup(&s,&k);assert(!ax_owner_client_pending(&k,1,99,g,c,b,0));assert(k.phase==AX_OWNER_REVOKED);assert(!ax_owner_client_prepare(&k,37,g,c));
 setup(&s,&k);assert(!ax_owner_client_pending(&k,0,37,g,c,b,0));assert(k.phase==AX_OWNER_REVOKED);
 memset(&s,0,sizeof(s));assert(!ax_owner_slot_reserve(&s,UINT64_MAX,g));assert(!ax_owner_slot_child(&s,37,1,2));
 memset(&s,0,sizeof(s));assert(ax_owner_slot_reserve(&s,1,g));assert(!ax_owner_slot_child(&s,37,0,2));assert(s.phase==AX_OWNER_REVOKED);
 setup(&s,&k);assert(ax_owner_slot_begin(&s,1,1,3,8,g,c,b));assert(ax_owner_client_pending(&k,1,37,g,c,b,0));assert(!ax_owner_client_confirm(&k,1,37,g,c,wrong,0));assert(k.phase==AX_OWNER_REVOKED);
 setup(&s,&k);assert(ax_owner_client_pending(&k,1,37,g,c,b,0));assert(ax_owner_client_confirm(&k,1,37,g,c,b,0));assert(ax_owner_client_next(&k,&q));assert(!ax_owner_client_next(&k,&q));assert(k.phase==AX_OWNER_REVOKED);
 puts("owner protocol and native client decision paths passed");return 0;
}
