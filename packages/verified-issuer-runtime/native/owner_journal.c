#include "owner_journal.h"
#include "synthetic_resource_contract.h"
#include <string.h>
static int generation(unsigned char out[16]){
 const char *s=AX_SYNTH_GENERATION;if(strlen(s)!=32)return 0;
 for(size_t i=0;i<16;i++){unsigned v=0;for(size_t k=0;k<2;k++){unsigned char c=(unsigned char)s[2*i+k];unsigned n;if(c>='0'&&c<='9')n=c-'0';else if(c>='a'&&c<='f')n=c-'a'+10;else return 0;v=(v<<4)|n;}out[i]=(unsigned char)v;}return 1;
}
static int valid_ops(const AxOwnerJournalOps*o){return o&&o->create&&o->append&&o->full_file_barrier&&o->full_dir_barrier&&o->close;}
static int emit(AxOwnerJournal*j,unsigned phase,unsigned reason){
 if(!j||!j->attempted||j->failed||j->closed||!valid_ops(&j->ops)||j->sequence>=AX_OWNER_MAX_RECORDS)return 0;
 unsigned char r[32]={0};memcpy(r,"AXOWN001",8);if(!generation(r+8)){j->failed=1;j->phase=AX_OWNER_JOURNAL_UNKNOWN;j->reason=AX_OWNER_REASON_STATE;return 0;}
 uint32_t next=j->sequence+1;r[24]=(unsigned char)(next>>24);r[25]=(unsigned char)(next>>16);r[26]=(unsigned char)(next>>8);r[27]=(unsigned char)next;r[28]=(unsigned char)phase;r[29]=(unsigned char)reason;
 /* Mark uncertain before the first possible effect; reentry cannot dispatch. */
 j->failed=1;j->phase=AX_OWNER_JOURNAL_UNKNOWN;j->reason=AX_OWNER_REASON_APPEND;j->sequence=next;
 if(j->ops.append(j->ops.context,r,sizeof r)!=1)return 0;
 j->reason=AX_OWNER_REASON_FILE_BARRIER;if(j->ops.full_file_barrier(j->ops.context)!=1)return 0;
 j->reason=AX_OWNER_REASON_DIR_BARRIER;if(j->ops.full_dir_barrier(j->ops.context)!=1)return 0;
 j->failed=0;j->phase=phase;j->reason=reason;return 1;
}
int ax_owner_journal_reserve(AxOwnerJournal*j,const AxOwnerJournalOps*o){
 if(!j||j->attempted||j->closed||j->sequence||j->phase||!valid_ops(o))return 0;
 j->attempted=1;j->ops=*o;j->failed=1;j->phase=AX_OWNER_JOURNAL_UNKNOWN;j->reason=AX_OWNER_REASON_CREATE;
 if(o->create(o->context)!=1)return 0;j->failed=0;return emit(j,AX_OWNER_JOURNAL_RESERVED,0);
}
int ax_owner_journal_intent(AxOwnerJournal*j){return j&&j->phase==AX_OWNER_JOURNAL_RESERVED?emit(j,AX_OWNER_JOURNAL_INTENT,0):0;}
int ax_owner_journal_created(AxOwnerJournal*j){return j&&j->phase==AX_OWNER_JOURNAL_INTENT?emit(j,AX_OWNER_JOURNAL_CREATED,0):0;}
int ax_owner_journal_exited(AxOwnerJournal*j){return j&&j->phase==AX_OWNER_JOURNAL_CREATED?emit(j,AX_OWNER_JOURNAL_EXITED,0):0;}
int ax_owner_journal_unknown(AxOwnerJournal*j,unsigned reason){return j&&j->phase>=AX_OWNER_JOURNAL_RESERVED&&j->phase<=AX_OWNER_JOURNAL_CREATED&&reason>=1&&reason<=AX_OWNER_REASON_UNSUPPORTED?emit(j,AX_OWNER_JOURNAL_UNKNOWN,reason):0;}
int ax_owner_journal_close(AxOwnerJournal*j){
 if(!j||!j->attempted||j->closed||!valid_ops(&j->ops))return 0;
 int healthy=!j->failed;j->closed=1;
 if(j->ops.close(j->ops.context)!=1){j->failed=1;j->phase=AX_OWNER_JOURNAL_UNKNOWN;j->reason=AX_OWNER_REASON_CLOSE;return 0;}return healthy;
}
int ax_owner_journal_decode(const unsigned char*p,size_t n,unsigned*phase,uint32_t*sequence,unsigned*reason){
 if(!p||!phase||!sequence||!reason||!n||n%32||n>AX_OWNER_MAX_RECORDS*32)return 0;
 unsigned char gen[16];if(!generation(gen))return 0;unsigned prior=0;uint32_t seq=0;unsigned why=0;
 for(size_t i=0;i<n;i+=32){
  const unsigned char*r=p+i;uint32_t next=(uint32_t)r[24]<<24|(uint32_t)r[25]<<16|(uint32_t)r[26]<<8|r[27];unsigned state=r[28],cause=r[29];
  if(memcmp(r,"AXOWN001",8)||memcmp(r+8,gen,16)||next!=seq+1||r[30]||r[31])return 0;
  if(state==AX_OWNER_JOURNAL_UNKNOWN){if(prior<1||prior>3||cause<1||cause>AX_OWNER_REASON_UNSUPPORTED)return 0;}
  else if(state<1||state>4||state!=prior+1||cause)return 0;
  if(prior==4||prior==5)return 0;prior=state;seq=next;why=cause;
 }
 *phase=prior;*sequence=seq;*reason=why;return 1;
}
