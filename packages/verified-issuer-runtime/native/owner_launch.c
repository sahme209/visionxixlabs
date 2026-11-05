#include "owner_launch.h"
/* State is consumed before the first external prerequisite; no re-entry can
 * retry a create, fork, barrier, or uncertain cleanup. */
void ax_owner_launch_stop(AxOwnerLaunch*s){
 if(!s||s->stopped)return;
 s->active=0;s->stopped=1;
 if(s->journal.failed||s->journal.phase==AX_OWNER_JOURNAL_UNKNOWN)s->cleanup_unknown=1;
 if(s->child>0){
  if(!s->ops.kill_and_reap||!s->ops.kill_and_reap(s->ops.context,s->child)){
   s->cleanup_unknown=1;
   (void)ax_owner_journal_unknown(&s->journal,AX_OWNER_REASON_CHILD);
  }else if(s->journal.phase==AX_OWNER_JOURNAL_CREATED&&!s->journal.failed){
   if(!ax_owner_journal_exited(&s->journal))s->cleanup_unknown=1;
  }
 }
 if(s->journal.attempted&&!ax_owner_journal_close(&s->journal))s->cleanup_unknown=1;
}
int ax_owner_launch_start(AxOwnerLaunch*s,const AxOwnerLaunchOps*o,const AxOwnerJournalOps*j){
 if(!s||s->attempted||s->stopped)return 0;
 s->attempted=1;
 if(!o||!j||!o->fixed_environment||!o->spawn_fixed||!o->child_alive||!o->kill_and_reap)return 0;
 s->ops=*o;
 if(!o->fixed_environment(o->context))return 0;
 if(!ax_owner_journal_reserve(&s->journal,j)||!ax_owner_journal_intent(&s->journal)){
  ax_owner_launch_stop(s);return 0;
 }
 s->child=o->spawn_fixed(o->context);
 if(s->child<=0){
  s->child=0;(void)ax_owner_journal_unknown(&s->journal,AX_OWNER_REASON_CHILD);
  ax_owner_launch_stop(s);return 0;
 }
 if(!ax_owner_journal_created(&s->journal)||!o->child_alive(o->context,s->child)){
  ax_owner_launch_stop(s);return 0;
 }
 s->active=1;return 1;
}
