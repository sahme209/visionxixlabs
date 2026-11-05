/* Only pure buffers and mocked OS ports. No Security/framework linkage. */
#include "synthetic_resource_contract.h"
#include <stdio.h>
#include <string.h>
static unsigned failures,checks;
#define CHECK(x) do{checks++;if(!(x)){fprintf(stderr,"FAIL line%d: %s\n",__LINE__,#x);failures++;}}while(0)
static AxSyntheticLocators locators,decoded;
static unsigned char wire[AX_SYNTH_RECORD_MAX+1];
static void locator_tests(void){
 memset(&locators,0,sizeof(locators));size_t n=0;
 for(unsigned i=0;i<3;i++){locators.length[i]=i+1;memset(locators.bytes[i],(int)(0x31+i),i+1);}
 CHECK(ax_synthetic_locator_encode(&locators,wire,&n));
 CHECK(n==62);CHECK(!memcmp(wire,"AXLOC001",8));CHECK(wire[24]==3);
 CHECK(ax_synthetic_locator_decode(wire,n,&decoded));
 CHECK(decoded.length[0]==1&&decoded.length[1]==2&&decoded.length[2]==3);
 CHECK(decoded.bytes[2][2]==0x33);
 unsigned char original[128];memcpy(original,wire,n);
 size_t offsets[]={0,8,24,25,32,33,36,37,38,39};
 for(unsigned i=0;i<sizeof(offsets)/sizeof(offsets[0]);i++){
  memcpy(wire,original,n);wire[offsets[i]]=0xff;
  CHECK(!ax_synthetic_locator_decode(wire,n,&decoded));
  CHECK(decoded.length[0]==0&&decoded.length[1]==0&&decoded.length[2]==0);
 }
 memcpy(wire,original,n);wire[n]=0;
 CHECK(!ax_synthetic_locator_decode(wire,n+1,&decoded));
 for(size_t i=0;i<n;i++)CHECK(!ax_synthetic_locator_decode(original,i,&decoded));
 CHECK(!ax_synthetic_locator_decode(wire,65537,&decoded));
 locators.length[0]=0;CHECK(!ax_synthetic_locator_encode(&locators,wire,&n));
 for(unsigned i=0;i<3;i++)locators.length[i]=16384;
 CHECK(ax_synthetic_locator_encode(&locators,wire,&n));CHECK(n==49208);
 CHECK(ax_synthetic_locator_decode(wire,n,&decoded));
 locators.length[2]=16385;CHECK(!ax_synthetic_locator_encode(&locators,wire,&n));
 CHECK(ax_synthetic_account(1)&&!strcmp(ax_synthetic_account(1),"authority-postgres"));
 CHECK(ax_synthetic_account(2)&&!strcmp(ax_synthetic_account(2),"vault-key"));
 CHECK(ax_synthetic_account(3)&&!strcmp(ax_synthetic_account(3),"desktop-session-key"));
 CHECK(!ax_synthetic_account(0)&&!ax_synthetic_account(4));
}
static void journal_tests(void){
 AxSyntheticJournal state={0},readback={0};unsigned char all[320]={0};
 CHECK(!ax_synthetic_journal_next(&state,2,0,all));CHECK(state.sequence==0);
 for(unsigned phase=1;phase<=9;phase++){
  CHECK(ax_synthetic_journal_next(&state,phase,0,all+(phase-1)*32));
  CHECK(state.sequence==phase&&state.phase==phase);
  CHECK(all[(phase-1)*32+24]==0&&all[(phase-1)*32+25]==0&&all[(phase-1)*32+26]==0);
  CHECK(all[(phase-1)*32+27]==phase&&all[(phase-1)*32+28]==phase);
 }
 CHECK(ax_synthetic_journal_decode(all,288,&readback));CHECK(readback.phase==9&&readback.sequence==9);
 CHECK(!ax_synthetic_journal_next(&state,10,1,all+288));
 for(unsigned i=0;i<288;i++){unsigned char b=all[i];all[i]^=0x80;CHECK(!ax_synthetic_journal_decode(all,288,&readback));all[i]=b;}
 CHECK(!ax_synthetic_journal_decode(all,287,&readback));
 CHECK(!ax_synthetic_journal_decode(all,321,&readback));
 CHECK(!ax_synthetic_journal_decode(all,0,&readback));
 unsigned char bad[32];memcpy(bad,all,32);bad[29]=1;CHECK(!ax_synthetic_journal_decode(bad,32,&readback));
 memcpy(bad,all,32);bad[27]=0;CHECK(!ax_synthetic_journal_decode(bad,32,&readback));
 memcpy(bad,all,32);bad[28]=10;bad[29]=7;CHECK(!ax_synthetic_journal_decode(bad,32,&readback));
 state=(AxSyntheticJournal){0};CHECK(ax_synthetic_journal_next(&state,1,0,all));
 CHECK(!ax_synthetic_journal_next(&state,10,0,all+32));
 CHECK(ax_synthetic_journal_next(&state,10,7,all+32));
 CHECK(ax_synthetic_journal_decode(all,64,&readback));CHECK(readback.phase==10);
 CHECK(!ax_synthetic_journal_next(&state,2,0,all+64));
}
typedef struct {unsigned journal_calls,add_calls,publish_calls,fail_journal,fail_role,add_result;int publish_ok,invalid_locator;unsigned char journal[320];size_t journal_size;} Fake;
static int journal(void*opaque,const unsigned char event[32]){
 Fake*f=opaque;f->journal_calls++;if(f->fail_journal==f->journal_calls)return 0;
 if(f->journal_size+32>sizeof(f->journal))return 0;
 memcpy(f->journal+f->journal_size,event,32);f->journal_size+=32;
 AxSyntheticJournal result;CHECK(ax_synthetic_journal_decode(f->journal,f->journal_size,&result));return 1;
}
static int add(void*opaque,unsigned role,unsigned char out[AX_SYNTH_LOCATOR_MAX],size_t*n){
 Fake*f=opaque;f->add_calls++;
 AxSyntheticJournal result;CHECK(ax_synthetic_journal_decode(f->journal,f->journal_size,&result));
 CHECK(result.phase==role*2); /* the durable intent precedes this effect */
 CHECK(role==f->add_calls);
 if(role==f->fail_role)return (int)f->add_result;
 *n=f->invalid_locator?0:2;out[0]=(unsigned char)role;out[1]=0xaa;return AX_SYNTH_ADD_OK;
}
static int publish(void*opaque,const AxSyntheticLocators*set){
 Fake*f=opaque;f->publish_calls++;
 AxSyntheticJournal result;CHECK(ax_synthetic_journal_decode(f->journal,f->journal_size,&result));CHECK(result.phase==8);
 CHECK(set->length[0]==2&&set->bytes[2][0]==3);return f->publish_ok;
}
static AxSyntheticProvisionResult run(Fake*f,AxSyntheticProvisionOnce*once){
 AxSyntheticProvisionOps ops={f,journal,add,publish};return ax_synthetic_provision_once(once,&ops);
}
static void transaction_tests(void){
 Fake success={.publish_ok=1};AxSyntheticProvisionOnce once={ATOMIC_FLAG_INIT};
 AxSyntheticProvisionResult r=run(&success,&once);
 CHECK(r.locators_published&&r.phase==9&&r.reason==0&&r.adds_started==3);
 CHECK(success.add_calls==3&&success.journal_calls==9&&success.publish_calls==1);
 r=run(&success,&once);CHECK(!r.locators_published);CHECK(success.add_calls==3&&success.journal_calls==9);
 for(unsigned fail=1;fail<=9;fail++){
  Fake f={.publish_ok=1,.fail_journal=fail};AxSyntheticProvisionOnce o={ATOMIC_FLAG_INIT};r=run(&f,&o);
  CHECK(!r.locators_published&&r.reason==AX_SYNTH_DURABILITY);
  CHECK(f.add_calls==(fail<=2?0:(fail-1)/2>3?3:(fail-1)/2));
  CHECK(f.publish_calls==(fail==9?1:0));
  unsigned calls=f.journal_calls;run(&f,&o);CHECK(f.journal_calls==calls);
 }
 for(unsigned role=1;role<=3;role++)for(unsigned failure=1;failure<=3;failure++){
  Fake f={.publish_ok=1,.fail_role=role,.add_result=failure};AxSyntheticProvisionOnce o={ATOMIC_FLAG_INIT};r=run(&f,&o);
  CHECK(!r.locators_published&&r.phase==10&&f.add_calls==role&&f.publish_calls==0);
  CHECK(r.reason==(failure==1?AX_SYNTH_DUPLICATE:failure==2?AX_SYNTH_ADD_REFUSED:AX_SYNTH_UNKNOWN_EFFECT));
 }
 Fake malformed={.publish_ok=1,.invalid_locator=1};AxSyntheticProvisionOnce o={ATOMIC_FLAG_INIT};r=run(&malformed,&o);
 CHECK(!r.locators_published&&r.reason==AX_SYNTH_INVALID_LOCATOR&&malformed.add_calls==1);
 Fake collision={0};AxSyntheticProvisionOnce c={ATOMIC_FLAG_INIT};r=run(&collision,&c);
 CHECK(!r.locators_published&&r.phase==10&&r.reason==AX_SYNTH_PUBLICATION_COLLISION&&collision.publish_calls==1);
 for(int outcome=-1;outcome>=-3;outcome--){
  Fake f={.publish_ok=outcome};AxSyntheticProvisionOnce o={ATOMIC_FLAG_INIT};r=run(&f,&o);
  CHECK(!r.locators_published&&r.phase==10&&r.reason==(unsigned)(outcome==-1?AX_SYNTH_IO:outcome==-2?AX_SYNTH_UNKNOWN_EFFECT:AX_SYNTH_UNSUPPORTED));
  CHECK(f.add_calls==3&&f.publish_calls==1);
 }
}
int main(void){locator_tests();journal_tests();transaction_tests();printf("%u checks, %u failures; pure buffers/mocked effects only\n",checks,failures);return failures?1:0;}
