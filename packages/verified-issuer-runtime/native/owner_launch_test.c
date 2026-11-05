/* Real coordinator; only its external effects are inert callbacks. */
#include "owner_launch.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
typedef struct {char events[512];size_t n;int fail,step,alive,reap;pid_t spawn;} Fixture;
static int event(Fixture*f,char c){f->events[f->n++]=c;f->events[f->n]=0;return ++f->step!=f->fail;}
static int create(void*p){return event(p,'C');}
static int append(void*p,const unsigned char*b,size_t n){assert(b&&n==32);return event(p,'W');}
static int file(void*p){return event(p,'F');}
static int directory(void*p){return event(p,'D');}
static int close_j(void*p){return event(p,'X');}
static int environment(void*p){return event(p,'E');}
static pid_t spawn(void*p){Fixture*f=p;event(f,'S');return f->spawn;}
static int alive(void*p,pid_t child){Fixture*f=p;assert(child==f->spawn);event(f,'A');return f->alive;}
static int reap(void*p,pid_t child){Fixture*f=p;assert(child==f->spawn);event(f,'K');return f->reap;}
int main(void){
 Fixture f={.alive=1,.reap=1,.spawn=123};
 AxOwnerLaunchOps ops={&f,environment,spawn,alive,reap};
 AxOwnerJournalOps jops={&f,create,append,file,directory,close_j};
 AxOwnerLaunch launch={0};
 assert(ax_owner_launch_start(&launch,&ops,&jops)==1);
 assert(launch.active&&launch.child==123);
 assert(!strcmp(f.events,"ECWFDWFDSWFDA"));
 const char*s=strchr(f.events,'S');assert(s&&strchr(f.events,'D')<s);
 assert(strchr(f.events,'F')<s);
 size_t previous=f.n;assert(!ax_owner_launch_start(&launch,&ops,&jops));assert(f.n==previous);
 ax_owner_launch_stop(&launch);assert(!launch.active&&launch.stopped&&!launch.cleanup_unknown);
 assert(strchr(f.events,'K'));previous=f.n;ax_owner_launch_stop(&launch);assert(f.n==previous);
 for(int fail=1;fail<=8;fail++){
  Fixture q={.fail=fail,.alive=1,.reap=1,.spawn=123};ops.context=&q;jops.context=&q;
  AxOwnerLaunch denied={0};assert(!ax_owner_launch_start(&denied,&ops,&jops));
  assert(!strchr(q.events,'S'));assert(denied.attempted&&!denied.active);
  previous=q.n;assert(!ax_owner_launch_start(&denied,&ops,&jops));assert(previous==q.n);
 }
 for(int fail=10;fail<=12;fail++){
  Fixture q={.fail=fail,.alive=1,.reap=1,.spawn=123};ops.context=&q;jops.context=&q;
  AxOwnerLaunch denied={0};assert(!ax_owner_launch_start(&denied,&ops,&jops));
  assert(strchr(q.events,'S')&&strchr(q.events,'K')&&!denied.active&&denied.stopped);
 }
 Fixture nochild={.spawn=-1,.reap=1};ops.context=&nochild;jops.context=&nochild;
 AxOwnerLaunch failed_spawn={0};assert(!ax_owner_launch_start(&failed_spawn,&ops,&jops));
 assert(!strchr(nochild.events,'K')&&!strchr(nochild.events,'A'));
 Fixture q={.alive=0,.reap=0,.spawn=123};ops.context=&q;jops.context=&q;
 AxOwnerLaunch unknown={0};assert(!ax_owner_launch_start(&unknown,&ops,&jops));
 assert(unknown.cleanup_unknown&&!unknown.active&&strchr(q.events,'K'));
 puts("owner launch ordering, one attempt, failed intent and unknown cleanup: PASS");
 return 0;
}
