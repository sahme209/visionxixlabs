#include "owner_resume.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
typedef struct {char trace[64],fail,expire;unsigned count;uint64_t now;} Fixture;
static int action(Fixture*f,char c){f->trace[f->count++]=c;if(f->expire==c)f->now=1000;return f->fail!=c;}
static uint64_t now(void*p){return ((Fixture*)p)->now;}
static int stopped(void*p,pid_t child){assert(child==123);return action(p,'S');}
static int select_peer(void*p){return action(p,'P');}
static int listener(void*p){return action(p,'L');}
static int current(void*p){return action(p,'C');}
static int resume_child(void*p,pid_t child){assert(child==123);return action(p,'R');}
int main(void){
 Fixture f={.now=100};AxOwnerResumeOps ops={&f,now,stopped,select_peer,listener,current,resume_child};AxOwnerResume s={0};
 assert(ax_owner_resume_once(&s,&ops,123,1000));assert(s.confirmed&&!s.effect_unknown);
 assert(strchr(f.trace,'P')<strchr(f.trace,'L')&&strchr(f.trace,'L')<strchr(f.trace,'R'));
 unsigned n=f.count;assert(!ax_owner_resume_once(&s,&ops,123,1000)&&f.count==n);
 const char cases[]="SPLCR";
 for(unsigned i=0;i<5;i++){
  Fixture q={.now=100,.fail=cases[i]};ops.context=&q;AxOwnerResume denied={0};
  assert(!ax_owner_resume_once(&denied,&ops,123,1000));assert(denied.attempted&&!denied.confirmed);
  if(cases[i]!='R')assert(!strchr(q.trace,'R'));else assert(denied.effect_unknown);
 }
 for(unsigned i=0;i<5;i++){
  Fixture q={.now=100,.expire=cases[i]};ops.context=&q;AxOwnerResume late={0};
  assert(!ax_owner_resume_once(&late,&ops,123,1000));assert(!late.confirmed);
  if(cases[i]!='R')assert(!strchr(q.trace,'R'));else assert(late.effect_unknown);
 }
 puts("post-fork expectation/listener/resume order and late refusal: PASS");return 0;
}
