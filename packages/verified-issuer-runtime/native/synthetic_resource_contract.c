#include "synthetic_resource_contract.h"
#include <string.h>
static uint32_t get32(const unsigned char*p){return(uint32_t)p[0]<<24|(uint32_t)p[1]<<16|(uint32_t)p[2]<<8|p[3];}
static void put32(unsigned char*p,uint32_t n){for(unsigned i=0;i<4;i++)p[3-i]=(unsigned char)(n>>(i*8));}
static void generation(unsigned char out[16]){
 const char*s=AX_SYNTH_GENERATION;
 for(unsigned i=0;i<16;i++){
  unsigned a=(unsigned)(s[2*i]<='9'?s[2*i]-'0':s[2*i]-'a'+10);
  unsigned b=(unsigned)(s[2*i+1]<='9'?s[2*i+1]-'0':s[2*i+1]-'a'+10);
  out[i]=(unsigned char)(a*16+b);
 }
}
static int same_generation(const unsigned char*p){unsigned char expected[16];generation(expected);return!memcmp(p,expected,16);}
const char *ax_synthetic_account(unsigned role){
 static const char*const values[]={"authority-postgres","vault-key","desktop-session-key"};
 return role>=1&&role<=3?values[role-1]:NULL;
}
int ax_synthetic_locator_encode(const AxSyntheticLocators*a,unsigned char*out,size_t*n){
 if(n)*n=0;if(!a||!out||!n)return 0;
 for(unsigned i=0;i<3;i++)if(!a->length[i]||a->length[i]>AX_SYNTH_LOCATOR_MAX)return 0;
 memset(out,0,AX_SYNTH_RECORD_MAX);memcpy(out,"AXLOC001",8);generation(out+8);out[24]=3;
 size_t offset=32;
 for(unsigned i=0;i<3;i++){out[offset]=(unsigned char)(i+1);put32(out+offset+4,(uint32_t)a->length[i]);memcpy(out+offset+8,a->bytes[i],a->length[i]);offset+=8+a->length[i];}
 *n=offset;return 1;
}
int ax_synthetic_locator_decode(const unsigned char*p,size_t n,AxSyntheticLocators*out){
 if(!out)return 0;memset(out,0,sizeof(*out));
 if(!p||n<32||n>AX_SYNTH_RECORD_MAX||memcmp(p,"AXLOC001",8)||!same_generation(p+8)||p[24]!=3)return 0;
 for(unsigned i=25;i<32;i++)if(p[i])return 0;
 size_t offset=32;
 for(unsigned i=0;i<3;i++){
  if(n-offset<8||p[offset]!=i+1||p[offset+1]||p[offset+2]||p[offset+3])goto fail;
  size_t length=get32(p+offset+4);
  if(!length||length>AX_SYNTH_LOCATOR_MAX||length>n-offset-8)goto fail;
  memcpy(out->bytes[i],p+offset+8,length);out->length[i]=length;offset+=8+length;
 }
 if(offset!=n)goto fail;return 1;
 fail:memset(out,0,sizeof(*out));return 0;
}
int ax_synthetic_journal_next(AxSyntheticJournal*state,unsigned phase,unsigned reason,unsigned char out[32]){
 if(!state||!out||state->phase>=9||state->sequence>8)return 0;
 if(phase==10){if(!state->phase||reason<1||reason>8)return 0;}
 else if(phase!=state->phase+1||phase>9||reason)return 0;
 memset(out,0,32);memcpy(out,"AXTXN001",8);generation(out+8);
 put32(out+24,state->sequence+1);out[28]=(unsigned char)phase;out[29]=(unsigned char)reason;
 state->sequence++;state->phase=(uint8_t)phase;return 1;
}
int ax_synthetic_journal_decode(const unsigned char*p,size_t n,AxSyntheticJournal*out){
 if(!out)return 0;*out=(AxSyntheticJournal){0};
 if(!p||!n||n>320||n%32)return 0;
 AxSyntheticJournal state={0};unsigned char expected[32];
 for(size_t offset=0;offset<n;offset+=32){
  if(!ax_synthetic_journal_next(&state,p[offset+28],p[offset+29],expected)||memcmp(expected,p+offset,32))return 0;
 }
 *out=state;return 1;
}
static int record(const AxSyntheticProvisionOps*ops,AxSyntheticJournal*s,unsigned phase,unsigned reason){
 AxSyntheticJournal next=*s;unsigned char bytes[32];
 if(!ax_synthetic_journal_next(&next,phase,reason,bytes)||!ops->journal(ops->context,bytes))return 0;
 *s=next;return 1;
}
static AxSyntheticProvisionResult incomplete(const AxSyntheticProvisionOps*ops,AxSyntheticJournal*s,AxSyntheticProvisionResult r,unsigned reason){
 r.reason=reason;
 if(!record(ops,s,10,reason))r.reason=AX_SYNTH_DURABILITY;
 r.phase=s->phase;return r;
}
AxSyntheticProvisionResult ax_synthetic_provision_once(AxSyntheticProvisionOnce*once,const AxSyntheticProvisionOps*ops){
 AxSyntheticProvisionResult r={0};AxSyntheticJournal state={0};AxSyntheticLocators locators={0};
 if(!once||atomic_flag_test_and_set(&once->attempted)){r.reason=AX_SYNTH_UNSUPPORTED;return r;}
 if(!ops||!ops->journal||!ops->add||!ops->publish){r.reason=AX_SYNTH_UNSUPPORTED;return r;}
 if(!record(ops,&state,1,0)){r.reason=AX_SYNTH_DURABILITY;return r;}
 for(unsigned role=1;role<=3;role++){
  if(!record(ops,&state,role*2,0)){r.reason=AX_SYNTH_DURABILITY;r.phase=state.phase;return r;}
  r.adds_started++;
  int result=ops->add(ops->context,role,locators.bytes[role-1],&locators.length[role-1]);
  if(result!=AX_SYNTH_ADD_OK)return incomplete(ops,&state,r,result==AX_SYNTH_ADD_DUPLICATE?AX_SYNTH_DUPLICATE:result==AX_SYNTH_ADD_FAILED?AX_SYNTH_ADD_REFUSED:AX_SYNTH_UNKNOWN_EFFECT);
  if(!locators.length[role-1]||locators.length[role-1]>AX_SYNTH_LOCATOR_MAX)return incomplete(ops,&state,r,AX_SYNTH_INVALID_LOCATOR);
  if(!record(ops,&state,role*2+1,0)){r.reason=AX_SYNTH_DURABILITY;r.phase=state.phase;return r;}
 }
 if(!record(ops,&state,8,0)){r.reason=AX_SYNTH_DURABILITY;r.phase=state.phase;return r;}
 int published=ops->publish(ops->context,&locators);
 if(published!=AX_SYNTH_PUBLISH_OK)return incomplete(ops,&state,r,published==AX_SYNTH_PUBLISH_COLLISION?AX_SYNTH_PUBLICATION_COLLISION:published==AX_SYNTH_PUBLISH_IO?AX_SYNTH_IO:published==AX_SYNTH_PUBLISH_UNSUPPORTED?AX_SYNTH_UNSUPPORTED:AX_SYNTH_UNKNOWN_EFFECT);
 if(!record(ops,&state,9,0)){r.reason=AX_SYNTH_DURABILITY;r.phase=state.phase;return r;}
 r.phase=9;r.locators_published=1;return r;
}
