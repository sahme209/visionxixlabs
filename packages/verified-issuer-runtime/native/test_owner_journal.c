/* Pure native state/bytes tests. Every effect is a deterministic buffer callback. */
#include "owner_journal.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
typedef struct {char calls[128];size_t count;unsigned char bytes[160];size_t length;unsigned op,fail_at,negative_at;} Mock;
static int event(Mock*m,char c){m->calls[m->count++]=c;m->calls[m->count]=0;m->op++;return m->op==m->negative_at?-1:m->op!=m->fail_at;}
static int create(void*v){return event(v,'C');}
static int append(void*v,const unsigned char*p,size_t n){Mock*m=v;int accepted=event(m,'A');if(accepted!=1)return accepted;assert(n==32&&m->length+n<=sizeof m->bytes);memcpy(m->bytes+m->length,p,n);m->length+=n;return 1;}
static int file(void*v){return event(v,'F');}static int dir(void*v){return event(v,'D');}static int close_port(void*v){return event(v,'X');}
static AxOwnerJournalOps ops(Mock*m){AxOwnerJournalOps o={m,create,append,file,dir,close_port};return o;}
int main(void){
 Mock m={0};AxOwnerJournal j={0};AxOwnerJournalOps o=ops(&m);
 assert(ax_owner_journal_reserve(&j,&o)==1);assert(!strcmp(m.calls,"CAFD"));
 assert(j.phase==1&&j.sequence==1&&!j.failed);assert(!ax_owner_journal_reserve(&j,&o));assert(m.op==4);
 assert(ax_owner_journal_intent(&j));assert(j.phase==2&&j.sequence==2);
 assert(ax_owner_journal_created(&j));assert(ax_owner_journal_exited(&j));assert(j.phase==4&&j.sequence==4);
 assert(!ax_owner_journal_intent(&j));assert(!ax_owner_journal_unknown(&j,7));
 unsigned phase=0,reason=99;uint32_t sequence=0;
 assert(ax_owner_journal_decode(m.bytes,m.length,&phase,&sequence,&reason));assert(phase==4&&sequence==4&&reason==0);
 assert(ax_owner_journal_close(&j));assert(!ax_owner_journal_close(&j));assert(m.calls[m.count-1]=='X');
 assert(!ax_owner_journal_created(&j));
 /* Every reserve or later failure consumes the in-memory attempt and stops I/O. */
 for(unsigned fail=1;fail<=10;fail++){
  Mock q={.fail_at=fail};AxOwnerJournal a={0};AxOwnerJournalOps b=ops(&q);
  int r=ax_owner_journal_reserve(&a,&b);
  if(r)r=ax_owner_journal_intent(&a);if(r)r=ax_owner_journal_created(&a);
  assert(!r);assert(a.attempted&&a.failed);unsigned count=q.op;
  assert(!ax_owner_journal_reserve(&a,&b)&&!ax_owner_journal_intent(&a)&&!ax_owner_journal_created(&a)&&!ax_owner_journal_exited(&a)&&!ax_owner_journal_unknown(&a,7));assert(count==q.op);
 }
 /* Only exact one acknowledges effects; negative/unknown returns deny. */
 for(unsigned step=1;step<=4;step++){
  Mock q={.negative_at=step};AxOwnerJournal a={0};AxOwnerJournalOps b=ops(&q);
  assert(!ax_owner_journal_reserve(&a,&b));assert(a.failed);
 }
 /* Unknown is terminal from any successfully recorded incomplete prefix. */
 for(unsigned prefix=1;prefix<=3;prefix++){
  Mock q={0};AxOwnerJournal a={0};AxOwnerJournalOps b=ops(&q);assert(ax_owner_journal_reserve(&a,&b));
  if(prefix>=2)assert(ax_owner_journal_intent(&a));if(prefix>=3)assert(ax_owner_journal_created(&a));
  assert(ax_owner_journal_unknown(&a,7));assert(a.phase==5&&a.reason==7);
  assert(ax_owner_journal_decode(q.bytes,q.length,&phase,&sequence,&reason));assert(phase==5&&reason==7&&sequence==prefix+1);
  assert(!ax_owner_journal_exited(&a));
 }
 /* A malformed record/transition never becomes an observation. */
 for(size_t i=0;i<m.length;i++){unsigned char x[160];memcpy(x,m.bytes,m.length);x[i]^=0xff;assert(!ax_owner_journal_decode(x,m.length,&phase,&sequence,&reason));}
 for(size_t n=0;n<m.length;n++)if(n%32)assert(!ax_owner_journal_decode(m.bytes,n,&phase,&sequence,&reason));
 assert(!ax_owner_journal_decode(m.bytes,0,&phase,&sequence,&reason));
 assert(!ax_owner_journal_decode(m.bytes,m.length,NULL,&sequence,&reason));
 Mock q={0};AxOwnerJournal a={0};AxOwnerJournalOps b=ops(&q);assert(ax_owner_journal_reserve(&a,&b));unsigned before=q.op;
 assert(!ax_owner_journal_unknown(&a,0)&&!ax_owner_journal_unknown(&a,9));assert(q.op==before);
 q.fail_at=q.op+1;assert(!ax_owner_journal_close(&a));assert(a.failed&&a.closed);before=q.op;assert(!ax_owner_journal_close(&a)&&q.op==before);
 puts("owner journal pure cases passed");return 0;
}
