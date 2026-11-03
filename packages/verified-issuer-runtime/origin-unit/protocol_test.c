#include "protocol.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
int main(void){OriginSlot s={0};unsigned char a[32]={1},b[32]={2},wrong[32]={3};
 assert(origin_spawn(&s,42,100));assert(!origin_spawn(&s,43,100));
 assert(!origin_begin(&s,0,1,101,9,a,b));assert(s.phase==ORIGIN_SPAWNED);
 assert(!origin_begin(&s,1,0,101,9,a,b));assert(s.phase==ORIGIN_REVOKED);
 s=(OriginSlot){0};assert(origin_spawn(&s,42,100));assert(origin_begin(&s,1,1,101,9,a,b));
 assert(!origin_ack(&s,1,1,102,10,a,b));assert(s.phase==ORIGIN_REVOKED);
 s=(OriginSlot){0};assert(origin_spawn(&s,42,100));assert(origin_begin(&s,1,1,101,9,a,b));
 assert(!origin_ack(&s,1,1,102,9,wrong,b));assert(s.phase==ORIGIN_REVOKED);
 s=(OriginSlot){0};assert(origin_spawn(&s,42,100));assert(origin_begin(&s,1,1,101,9,a,b));assert(origin_ack(&s,1,1,102,9,a,b));assert(s.phase==ORIGIN_CONSUMED);
 assert(!origin_ack(&s,1,1,103,9,a,b));assert(!origin_begin(&s,1,1,103,9,a,b));
 s=(OriginSlot){0};assert(!origin_spawn(&s,0,100));assert(!origin_spawn(&s,42,UINT64_MAX));
 s=(OriginSlot){0};assert(origin_spawn(&s,42,100));assert(!origin_begin(&s,1,1,s.deadline,9,a,b));assert(s.phase==ORIGIN_REVOKED);
 s=(OriginSlot){0};assert(origin_spawn(&s,42,100));assert(origin_begin(&s,1,1,101,9,a,b));assert(!origin_ack(&s,1,0,102,9,a,b));assert(s.phase==ORIGIN_REVOKED);
 s=(OriginSlot){0};assert(origin_spawn(&s,42,100));assert(origin_begin(&s,1,1,101,9,a,b));uint64_t original=s.deadline;assert(!origin_begin(&s,1,1,102,9,wrong,b));assert(s.deadline==original&&!memcmp(s.client,a,32));assert(origin_ack(&s,1,1,103,9,a,b));
 puts("origin_protocol_cases=8 simulated_authority_no_identity");return 0;}
