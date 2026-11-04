#include "cssm_policy_copy.h"
#include <stdint.h>
#include <string.h>
typedef struct {
 const ax_cssm_range *ranges; size_t count;
 ax_cssm_range seen[800]; size_t used;
 int trusted;
 ax_cssm_policy *out;
} context;
static int accessible(context *c, const void *p, size_t n) {
 uintptr_t a=(uintptr_t)p;
 if (!n) return p == NULL;
 if (!p || n > UINTPTR_MAX-a) return 0;
 if (c->trusted) return 1;
 for (size_t i=0;i<c->count;i++) {
  uintptr_t b=(uintptr_t)c->ranges[i].base;
  if (a>=b && n<=c->ranges[i].size && a-b<=c->ranges[i].size-n) return 1;
 }
 return 0;
}
static int unique(context *c,const void *p,size_t n) {
 if (!n) return p==NULL;
 if (!accessible(c,p,n) || c->used==800) return 0;
 uintptr_t a=(uintptr_t)p;
 for(size_t i=0;i<c->used;i++) {
  uintptr_t b=(uintptr_t)c->seen[i].base;
  if (a<b+c->seen[i].size && b<a+n) return 0;
 }
 c->seen[c->used++]=(ax_cssm_range){p,n}; return 1;
}
static int datum(context *c,CSSM_DATA in,CSSM_DATA *out) {
 if(in.Length>65536-c->out->data_count || !unique(c,in.Data,in.Length)) return 0;
 out->Length=in.Length; out->Data=NULL;
 if(in.Length) { out->Data=c->out->data+c->out->data_count;
 memcpy(out->Data,in.Data,in.Length); c->out->data_count+=in.Length; }
 return 1;
}
static int list(context *c,CSSM_LIST in,CSSM_LIST *out,unsigned depth) {
 if(depth>8 || in.ListType!=CSSM_LIST_TYPE_UNKNOWN || !in.Head || !in.Tail) return 0;
 *out=(CSSM_LIST){CSSM_LIST_TYPE_UNKNOWN,NULL,NULL};
 CSSM_LIST_ELEMENT *last=NULL;
 for(const CSSM_LIST_ELEMENT *p=in.Head;p;) {
  if((uintptr_t)p % _Alignof(CSSM_LIST_ELEMENT) || c->out->node_count==256 || !unique(c,p,sizeof *p)) return 0;
  CSSM_LIST_ELEMENT *q=&c->out->nodes[c->out->node_count++];
  memset(q,0,sizeof *q); q->WordID=p->WordID; q->ElementType=p->ElementType;
  if(p->ElementType==CSSM_LIST_ELEMENT_DATUM) {
   if(p->WordID || !datum(c,p->Element.Word,&q->Element.Word)) return 0;
  } else if(p->ElementType==CSSM_LIST_ELEMENT_SUBLIST) {
   if(p->WordID || !list(c,p->Element.Sublist,&q->Element.Sublist,depth+1)) return 0;
  } else if(p->ElementType!=CSSM_LIST_ELEMENT_WORDID) return 0;
  if(last) last->NextElement=q; else out->Head=q;
  last=q; out->Tail=q;
  if(!p->NextElement && p!=in.Tail) return 0;
  if(p==in.Tail && p->NextElement) return 0;
  p=p->NextElement;
 }
 return 1;
}
static int word(const CSSM_LIST_ELEMENT *p,CSSM_WORDID_TYPE w) {
 return p && p->ElementType==CSSM_LIST_ELEMENT_WORDID && p->WordID==w;
}
static int isdata(const CSSM_LIST_ELEMENT *p) {
 return p && p->ElementType==CSSM_LIST_ELEMENT_DATUM && !p->WordID;
}
static int process(CSSM_LIST l) {
 CSSM_LIST_ELEMENT *p=l.Head;
 if(!word(p,CSSM_ACL_SUBJECT_TYPE_PROCESS)) return 0;
 p=p->NextElement;
 if(!isdata(p) || p->NextElement || p->Element.Word.Length!=sizeof(CSSM_ACL_PROCESS_SUBJECT_SELECTOR)) return 0;
 CSSM_ACL_PROCESS_SUBJECT_SELECTOR s; memcpy(&s,p->Element.Word.Data,sizeof s);
 return s.version==CSSM_ACL_PROCESS_SELECTOR_CURRENT_VERSION && s.mask==CSSM_ACL_MATCH_UID && !s.uid && !s.gid;
}
static int application(CSSM_LIST l) {
 CSSM_LIST_ELEMENT *p=l.Head;
 if(!word(p,CSSM_ACL_SUBJECT_TYPE_CODE_SIGNATURE)) return 0;
 p=p->NextElement; if(!word(p,CSSM_ACL_CODE_SIGNATURE_OSX)) return 0;
 p=p->NextElement; if(!isdata(p) || p->Element.Word.Length!=20) return 0;
 p=p->NextElement;
 if(!isdata(p) || !p->Element.Word.Length || p->Element.Word.Data[p->Element.Word.Length-1]!=0) return 0;
 for(p=p->NextElement;p;p=p->NextElement) if(!isdata(p)) return 0;
 return 1;
}
static int prompt(CSSM_LIST l) {
 CSSM_LIST_ELEMENT *p=l.Head;
 if(!word(p,CSSM_ACL_SUBJECT_TYPE_KEYCHAIN_PROMPT)) return 0;
 p=p->NextElement;
 if(!isdata(p) || p->Element.Word.Length!=sizeof(CSSM_ACL_KEYCHAIN_PROMPT_SELECTOR)) return 0;
 CSSM_ACL_KEYCHAIN_PROMPT_SELECTOR s; memcpy(&s,p->Element.Word.Data,sizeof s);
 if(s.version!=CSSM_ACL_KEYCHAIN_PROMPT_CURRENT_VERSION) return 0;
 p=p->NextElement; return isdata(p) && !p->NextElement;
}
static int assemble(context *c,const CSSM_ACL_OWNER_PROTOTYPE *owner,unsigned count,const CSSM_ACL_ENTRY_INFO *entries) {
 ax_cssm_policy *o=c->out;
 if(count!=1 || count>16 || (uintptr_t)owner % _Alignof(CSSM_ACL_OWNER_PROTOTYPE) || (uintptr_t)entries % _Alignof(CSSM_ACL_ENTRY_INFO) || !accessible(c,owner,sizeof *owner) || !accessible(c,entries,sizeof *entries)) return 0;
 if(owner->Delegate || entries->EntryPublicInfo.Delegate) return 0;
 if(!list(c,owner->TypedSubject,&o->owner.TypedSubject,1) || !process(o->owner.TypedSubject)) return 0;
 CSSM_LIST all;
 if(!list(c,entries->EntryPublicInfo.TypedSubject,&all,1)) return 0;
 CSSM_LIST_ELEMENT *p=all.Head;
 if(!word(p,CSSM_ACL_SUBJECT_TYPE_THRESHOLD)) return 0;
 p=p->NextElement; if(!word(p,1)) return 0;
 p=p->NextElement; if(!word(p,2)) return 0;
 p=p->NextElement;
 CSSM_LIST app={0}; unsigned apps=0,prompts=0,branches=0;
 for(;p;p=p->NextElement) {
  if(++branches>2 || p->ElementType!=CSSM_LIST_ELEMENT_SUBLIST) return 0;
  if(application(p->Element.Sublist)) { app=p->Element.Sublist; apps++; }
  else if(prompt(p->Element.Sublist)) prompts++; else return 0;
 }
 if(branches!=2 || apps!=1 || prompts!=1) return 0;
 const CSSM_ACL_ENTRY_PROTOTYPE *e=&entries->EntryPublicInfo;
 unsigned n=e->Authorization.NumberOfAuthTags;
 if(n!=2 || n>16 || (uintptr_t)e->Authorization.AuthTags % _Alignof(CSSM_ACL_AUTHORIZATION_TAG) || !unique(c,e->Authorization.AuthTags,n*sizeof(*o->rights))) return 0;
 memcpy(o->rights,e->Authorization.AuthTags,n*sizeof(*o->rights));
 if(!((o->rights[0]==CSSM_ACL_AUTHORIZATION_DECRYPT && o->rights[1]==CSSM_ACL_AUTHORIZATION_DB_READ) || (o->rights[1]==CSSM_ACL_AUTHORIZATION_DECRYPT && o->rights[0]==CSSM_ACL_AUTHORIZATION_DB_READ))) return 0;
 o->entry.EntryPublicInfo.TypedSubject=app;
 o->entry.EntryPublicInfo.Authorization=(CSSM_AUTHORIZATIONGROUP){n,o->rights};
 if(!datum(c,e->TimeRange.StartDate,&o->entry.EntryPublicInfo.TimeRange.StartDate) || !datum(c,e->TimeRange.EndDate,&o->entry.EntryPublicInfo.TimeRange.EndDate)) return 0;
 memcpy(o->entry.EntryPublicInfo.EntryTag,e->EntryTag,sizeof e->EntryTag);
 o->entry.EntryHandle=entries->EntryHandle; /* Representation only, not authority. */
 return 1;
}
static int copy(const CSSM_ACL_OWNER_PROTOTYPE *owner,unsigned n,const CSSM_ACL_ENTRY_INFO *entries,const ax_cssm_range *ranges,size_t count,int trusted,ax_cssm_policy *out) {
 if(!out) return 0;
 memset(out,0,sizeof *out);
 if(!trusted) {
  if(!ranges || !count || count>256) return 0;
  for(size_t i=0;i<count;i++) {
   uintptr_t a=(uintptr_t)ranges[i].base;
   if(!a || !ranges[i].size || ranges[i].size>UINTPTR_MAX-a) return 0;
   for(size_t j=0;j<i;j++) {
    uintptr_t b=(uintptr_t)ranges[j].base;
    if(a<b+ranges[j].size && b<a+ranges[i].size) return 0;
   }
  }
 }
 ax_cssm_policy scratch;
 memset(&scratch,0,sizeof scratch);
 context c={.ranges=ranges,.count=count,.trusted=trusted,.out=&scratch};
 if(assemble(&c,owner,n,entries)) {
  context final={.trusted=1,.out=out};
  if(!list(&final,scratch.owner.TypedSubject,&out->owner.TypedSubject,1) ||
     !list(&final,scratch.entry.EntryPublicInfo.TypedSubject,&out->entry.EntryPublicInfo.TypedSubject,1) ||
     !datum(&final,scratch.entry.EntryPublicInfo.TimeRange.StartDate,&out->entry.EntryPublicInfo.TimeRange.StartDate) ||
     !datum(&final,scratch.entry.EntryPublicInfo.TimeRange.EndDate,&out->entry.EntryPublicInfo.TimeRange.EndDate)) {
   memset(out,0,sizeof *out); return 0;
  }
  memcpy(out->rights,scratch.rights,sizeof out->rights);
  out->entry.EntryPublicInfo.Authorization=(CSSM_AUTHORIZATIONGROUP){2,out->rights};
  memcpy(out->entry.EntryPublicInfo.EntryTag,scratch.entry.EntryPublicInfo.EntryTag,sizeof out->entry.EntryPublicInfo.EntryTag);
  out->entry.EntryHandle=scratch.entry.EntryHandle;
  return 1;
 }
 memset(out,0,sizeof *out); return 0;
}
int ax_cssm_copy(const CSSM_ACL_OWNER_PROTOTYPE *o,unsigned n,const CSSM_ACL_ENTRY_INFO *e,const ax_cssm_range *r,size_t c,ax_cssm_policy *out) { return copy(o,n,e,r,c,0,out); }
int ax_cssm_copy_framework(const CSSM_ACL_OWNER_PROTOTYPE *o,unsigned n,const CSSM_ACL_ENTRY_INFO *e,ax_cssm_policy *out) { return copy(o,n,e,NULL,0,1,out); }
