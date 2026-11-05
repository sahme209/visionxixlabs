#include "owner_privilege_drop.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
typedef struct {char trace[8];int n,fail;} Fixture;
static int step(Fixture*f,char c){f->trace[f->n++]=c;return f->n!=f->fail;}
static int io(void*p){return step(p,'I');}
static int groups(void*p){return step(p,'G');}
static int gid(void*p,gid_t g){assert(g==502);return step(p,'D');}
static int uid(void*p,uid_t u){assert(u==501);return step(p,'U');}
static int verify(void*p,uid_t u,gid_t g){assert(u==501&&g==502);return step(p,'V');}
int main(void){
 Fixture f={0};AxOwnerDropOps o={&f,io,groups,gid,uid,verify};
 assert(ax_owner_drop_privileges(&o,501,502));assert(!strcmp(f.trace,"IGDUV"));
 for(int fail=1;fail<=5;fail++){Fixture q={.fail=fail};o.context=&q;assert(!ax_owner_drop_privileges(&o,501,502));assert(q.n==fail);}
 Fixture q={0};o.context=&q;assert(!ax_owner_drop_privileges(&o,0,502));assert(!ax_owner_drop_privileges(&o,501,0));assert(q.n==0);
 o.verify_ids=NULL;assert(!ax_owner_drop_privileges(&o,501,502));assert(q.n==0);
 puts("fixed privilege drop ordering and every refusal: PASS");return 0;
}
