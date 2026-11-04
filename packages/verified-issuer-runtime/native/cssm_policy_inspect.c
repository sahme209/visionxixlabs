#include "cssm_policy_inspect.h"
#include <stdint.h>
#include <string.h>
typedef struct {
 const ax_cssm_range *r; size_t nr;
 ax_cssm_range seen[800]; size_t ns, nodes, bytes; int trusted;
} scan;
static int take(scan *s,const void *p,size_t n,size_t alignment) {
 uintptr_t a=(uintptr_t)p;
 if(!n) return !p;
 if(!p || a%alignment || n>UINTPTR_MAX-a || s->ns==800) return 0;
 if(!s->trusted) {
  int ok=0;
  for(size_t i=0;i<s->nr;i++) { uintptr_t b=(uintptr_t)s->r[i].base;
   if(a>=b && n<=s->r[i].size && a-b<=s->r[i].size-n) ok=1;
  }
  if(!ok) return 0;
 }
 for(size_t i=0;i<s->ns;i++) { uintptr_t b=(uintptr_t)s->seen[i].base;
  if(a<b+s->seen[i].size && b<a+n) return 0;
 }
 s->seen[s->ns++]=(ax_cssm_range){p,n}; return 1;
}
static int data(scan *s,CSSM_DATA d) {
 if(d.Length>65536-s->bytes || !take(s,d.Data,d.Length,1)) return 0;
 s->bytes+=d.Length; return 1;
}
static int list(scan *s,CSSM_LIST l,int owner) {
 if(l.ListType!=CSSM_LIST_TYPE_UNKNOWN || !l.Head || !l.Tail) return 0;
 unsigned i=0;
 for(const CSSM_LIST_ELEMENT *p=l.Head;p;p=p->NextElement,i++) {
  if(s->nodes++==256 || !take(s,p,sizeof *p,_Alignof(CSSM_LIST_ELEMENT))) return 0;
  if((!p->NextElement)!=(p==l.Tail)) return 0;
  if(i<(owner?1u:2u)) {
   CSSM_WORDID_TYPE w=owner?CSSM_ACL_SUBJECT_TYPE_PROCESS:(i?CSSM_ACL_CODE_SIGNATURE_OSX:CSSM_ACL_SUBJECT_TYPE_CODE_SIGNATURE);
   if(p->ElementType!=CSSM_LIST_ELEMENT_WORDID || p->WordID!=w) return 0;
  } else {
   if(p->ElementType!=CSSM_LIST_ELEMENT_DATUM || p->WordID || !data(s,p->Element.Word)) return 0;
   if(owner) {
    CSSM_ACL_PROCESS_SUBJECT_SELECTOR v;
    if(i!=1 || p->Element.Word.Length!=sizeof v) return 0;
    memcpy(&v,p->Element.Word.Data,sizeof v);
    if(v.version!=CSSM_ACL_PROCESS_SELECTOR_CURRENT_VERSION || v.mask!=CSSM_ACL_MATCH_UID || v.uid || v.gid) return 0;
   } else {
    if(i==2 && p->Element.Word.Length!=20) return 0;
    if(i==3 && (!p->Element.Word.Length || p->Element.Word.Data[p->Element.Word.Length-1])) return 0;
   }
  }
 }
 return owner?i==2:i>=4;
}
static int shape(scan *s,const CSSM_ACL_OWNER_PROTOTYPE *o,const CSSM_ACL_ENTRY_INFO *e) {
 if(!take(s,o,sizeof *o,_Alignof(CSSM_ACL_OWNER_PROTOTYPE)) || !take(s,e,sizeof *e,_Alignof(CSSM_ACL_ENTRY_INFO))) return 0;
 const CSSM_ACL_ENTRY_PROTOTYPE *p=&e->EntryPublicInfo;
 if(o->Delegate || p->Delegate || !list(s,o->TypedSubject,1) || !list(s,p->TypedSubject,0)) return 0;
 if(p->Authorization.NumberOfAuthTags!=2 || !take(s,p->Authorization.AuthTags,2*sizeof(CSSM_ACL_AUTHORIZATION_TAG),_Alignof(CSSM_ACL_AUTHORIZATION_TAG))) return 0;
 const CSSM_ACL_AUTHORIZATION_TAG *r=p->Authorization.AuthTags;
 if(!((r[0]==CSSM_ACL_AUTHORIZATION_DECRYPT && r[1]==CSSM_ACL_AUTHORIZATION_DB_READ) || (r[1]==CSSM_ACL_AUTHORIZATION_DECRYPT && r[0]==CSSM_ACL_AUTHORIZATION_DB_READ))) return 0;
 return data(s,p->TimeRange.StartDate) && data(s,p->TimeRange.EndDate);
}
static int eqdata(CSSM_DATA a,CSSM_DATA b) { return a.Length==b.Length && (!a.Length || !memcmp(a.Data,b.Data,a.Length)); }
static int eqlist(CSSM_LIST a,CSSM_LIST b) {
 const CSSM_LIST_ELEMENT *p=a.Head,*q=b.Head;
 for(;p && q;p=p->NextElement,q=q->NextElement) {
  if(p->ElementType!=q->ElementType || p->WordID!=q->WordID) return 0;
  if(p->ElementType==CSSM_LIST_ELEMENT_DATUM && !eqdata(p->Element.Word,q->Element.Word)) return 0;
 }
 return !p && !q;
}
static int inspect(const ax_cssm_policy *expected,const CSSM_ACL_OWNER_PROTOTYPE *o,unsigned count,const CSSM_ACL_ENTRY_INFO *e,const ax_cssm_range *r,size_t nr,int trusted) {
 if(!expected || count!=1) return 0;
 if(!trusted) {
  if(!r || !nr || nr>256) return 0;
  for(size_t i=0;i<nr;i++) { uintptr_t a=(uintptr_t)r[i].base;
   if(!a || !r[i].size || r[i].size>UINTPTR_MAX-a) return 0;
   for(size_t j=0;j<i;j++) { uintptr_t b=(uintptr_t)r[j].base;
    if(a<b+r[j].size && b<a+r[i].size) return 0;
   }
  }
 }
 ax_cssm_range er={expected,sizeof *expected};
 scan a={.r=&er,.nr=1}, b={.r=r,.nr=nr,.trusted=trusted};
 if(!shape(&a,&expected->owner,&expected->entry) || !shape(&b,o,e)) return 0;
 const CSSM_ACL_ENTRY_PROTOTYPE *x=&expected->entry.EntryPublicInfo,*y=&e->EntryPublicInfo;
 return eqlist(expected->owner.TypedSubject,o->TypedSubject) && eqlist(x->TypedSubject,y->TypedSubject) &&
 eqdata(x->TimeRange.StartDate,y->TimeRange.StartDate) && eqdata(x->TimeRange.EndDate,y->TimeRange.EndDate) &&
 !memcmp(x->EntryTag,y->EntryTag,sizeof x->EntryTag) && expected->entry.EntryHandle==e->EntryHandle;
}
int ax_cssm_inspect(const ax_cssm_policy *p,const CSSM_ACL_OWNER_PROTOTYPE *o,unsigned n,const CSSM_ACL_ENTRY_INFO *e,const ax_cssm_range *r,size_t nr) { return inspect(p,o,n,e,r,nr,0); }
int ax_cssm_inspect_framework(const ax_cssm_policy *p,const CSSM_ACL_OWNER_PROTOTYPE *o,unsigned n,const CSSM_ACL_ENTRY_INFO *e) { return inspect(p,o,n,e,NULL,0,1); }
