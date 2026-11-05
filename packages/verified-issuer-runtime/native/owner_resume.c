#include "owner_resume.h"
static int current(const AxOwnerResumeOps*o,uint64_t d){uint64_t n=o->now(o->context);return n!=UINT64_MAX&&n<d;}
int ax_owner_resume_once(AxOwnerResume*s,const AxOwnerResumeOps*o,pid_t p,uint64_t d){
 if(!s||s->attempted)return 0;s->attempted=1;
 if(!o||p<=0||!d||!o->now||!o->owned_stopped||!o->select_peer||!o->configure_listener||!o->peer_current||!o->resume)return 0;
 if(!current(o,d)||o->owned_stopped(o->context,p)!=1||!current(o,d))return 0;
 if(o->select_peer(o->context)!=1||!current(o,d))return 0;
 if(o->configure_listener(o->context)!=1||!current(o,d))return 0;
 if(o->owned_stopped(o->context,p)!=1||!current(o,d)||o->peer_current(o->context)!=1||!current(o,d))return 0;
 s->effect_unknown=1;
 if(o->resume(o->context,p)!=1||!current(o,d)||o->peer_current(o->context)!=1||!current(o,d))return 0;
 s->confirmed=1;s->effect_unknown=0;return 1;
}
