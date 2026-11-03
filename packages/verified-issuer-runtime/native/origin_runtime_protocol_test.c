#include "origin_runtime_protocol.h"
#include <assert.h>
#include <stdio.h>
int main(void){AxiomOriginSlot s={0};unsigned char a[32]={1},b[32]={2},live[32]={3};
 assert(axiom_origin_slot_spawn(&s,42,100));assert(!axiom_origin_slot_spawn(&s,43,100));
 assert(!axiom_origin_slot_begin(&s,0,1,101,9,a,b));assert(axiom_origin_slot_begin(&s,1,1,101,9,a,b));
 assert(!axiom_origin_slot_ack(&s,1,1,102,10,a,b));assert(axiom_origin_slot_ack(&s,1,1,102,9,a,b));
 assert(axiom_origin_slot_live(&s,1,1,103,9,live,b));assert(!axiom_origin_slot_live(&s,1,1,104,9,live,b));
 assert(!axiom_origin_slot_live(&s,1,1,105,10,a,b));assert(s.phase==AXIOM_ORIGIN_CONSUMED);
 assert(!axiom_origin_slot_ack(&s,1,1,106,9,a,b));assert(s.phase==AXIOM_ORIGIN_REVOKED);
 s=(AxiomOriginSlot){0};assert(axiom_origin_slot_spawn(&s,42,100));assert(!axiom_origin_slot_begin(&s,1,1,s.deadline,9,a,b));assert(s.phase==AXIOM_ORIGIN_REVOKED);
 s=(AxiomOriginSlot){0};assert(axiom_origin_slot_spawn(&s,42,100));assert(axiom_origin_slot_begin(&s,1,1,101,9,a,b));assert(!axiom_origin_slot_ack(&s,1,0,102,9,a,b));assert(s.phase==AXIOM_ORIGIN_REVOKED);
 s=(AxiomOriginSlot){0};assert(axiom_origin_slot_spawn(&s,42,100));assert(axiom_origin_slot_begin(&s,1,1,101,9,a,b));assert(axiom_origin_slot_ack(&s,1,1,102,9,a,b));assert(!axiom_origin_slot_live(&s,1,0,103,9,live,b));assert(s.phase==AXIOM_ORIGIN_REVOKED);
 puts("runtime_protocol_simulated_cases=7; identity=unavailable");return 0;}
