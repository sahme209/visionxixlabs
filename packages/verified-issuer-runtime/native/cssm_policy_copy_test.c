#include "cssm_policy_copy.h"
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef struct {
 CSSM_ACL_OWNER_PROTOTYPE owner; CSSM_ACL_ENTRY_INFO entry;
 CSSM_LIST_ELEMENT n[18]; CSSM_ACL_PROCESS_SUBJECT_SELECTOR process;
 CSSM_ACL_KEYCHAIN_PROMPT_SELECTOR prompt;
 unsigned char hash[20],path[8],requirement[7],aux[3],description[3],date[2];
 CSSM_ACL_AUTHORIZATION_TAG rights[2];
} fixture;
static CSSM_LIST chain(fixture *f,unsigned start,unsigned count) {
 for(unsigned i=start;i<start+count;i++) f->n[i].NextElement=i+1<start+count?&f->n[i+1]:NULL;
 return (CSSM_LIST){CSSM_LIST_TYPE_UNKNOWN,&f->n[start],&f->n[start+count-1]};
}
static void word(fixture *f,unsigned i,CSSM_WORDID_TYPE v) { f->n[i].ElementType=CSSM_LIST_ELEMENT_WORDID; f->n[i].WordID=v; }
static void data(fixture *f,unsigned i,void *p,size_t n) { f->n[i].ElementType=CSSM_LIST_ELEMENT_DATUM; f->n[i].Element.Word=(CSSM_DATA){n,p}; }
static void init(fixture *f) {
 memset(f,0,sizeof *f); f->process=(CSSM_ACL_PROCESS_SUBJECT_SELECTOR){CSSM_ACL_PROCESS_SELECTOR_CURRENT_VERSION,CSSM_ACL_MATCH_UID,0,0};
 f->prompt.version=CSSM_ACL_KEYCHAIN_PROMPT_CURRENT_VERSION;
 word(f,0,CSSM_ACL_SUBJECT_TYPE_PROCESS); data(f,1,&f->process,sizeof f->process); f->owner.TypedSubject=chain(f,0,2);
 word(f,2,CSSM_ACL_SUBJECT_TYPE_THRESHOLD); word(f,3,1); word(f,4,2);
 f->n[5].ElementType=f->n[6].ElementType=CSSM_LIST_ELEMENT_SUBLIST;
 f->entry.EntryPublicInfo.TypedSubject=chain(f,2,5);
 word(f,7,CSSM_ACL_SUBJECT_TYPE_CODE_SIGNATURE); word(f,8,CSSM_ACL_CODE_SIGNATURE_OSX);
 memset(f->hash,0x34,sizeof f->hash); memcpy(f->path,"/fixed",7);
 memset(f->requirement,0xa9,sizeof f->requirement); memset(f->aux,0x75,sizeof f->aux);
 data(f,9,f->hash,sizeof f->hash); data(f,10,f->path,sizeof f->path);
 data(f,11,f->requirement,sizeof f->requirement); data(f,12,f->aux,sizeof f->aux);
 f->n[5].Element.Sublist=chain(f,7,6);
 word(f,13,CSSM_ACL_SUBJECT_TYPE_KEYCHAIN_PROMPT); data(f,14,&f->prompt,sizeof f->prompt); data(f,15,f->description,sizeof f->description);
 f->n[6].Element.Sublist=chain(f,13,3);
 f->rights[0]=CSSM_ACL_AUTHORIZATION_DECRYPT; f->rights[1]=CSSM_ACL_AUTHORIZATION_DB_READ;
 f->entry.EntryPublicInfo.Authorization=(CSSM_AUTHORIZATIONGROUP){2,f->rights};
 f->entry.EntryPublicInfo.TimeRange.StartDate=(CSSM_DATA){sizeof f->date,f->date};
 memcpy(f->entry.EntryPublicInfo.EntryTag,"tag",4); f->entry.EntryHandle=19;
}
static int run(fixture *f,ax_cssm_policy *out) { ax_cssm_range r={f,sizeof *f}; return ax_cssm_copy(&f->owner,1,&f->entry,&r,1,out); }
static void refuses(fixture *f) { ax_cssm_policy out; memset(&out,0xa5,sizeof out); assert(!run(f,&out)); unsigned char *p=(unsigned char *)&out; for(size_t i=0;i<sizeof out;i++) assert(!p[i]); }
int main(void) {
 fixture f; ax_cssm_policy out; init(&f); assert(run(&f,&out));
 assert(out.node_count==8); /* owner2 + complete app6; no threshold/prompt */
 assert(out.entry.EntryPublicInfo.TypedSubject.Head->WordID==CSSM_ACL_SUBJECT_TYPE_CODE_SIGNATURE);
 CSSM_LIST_ELEMENT *p=out.entry.EntryPublicInfo.TypedSubject.Tail;
 assert(p->Element.Word.Length==sizeof f.aux && !memcmp(p->Element.Word.Data,f.aux,sizeof f.aux));
 assert(out.entry.EntryHandle==19 && !memcmp(out.entry.EntryPublicInfo.EntryTag,"tag",4));
 assert(out.entry.EntryPublicInfo.TimeRange.StartDate.Data!=f.date);
 memset(&f,0,sizeof f); assert(p->Element.Word.Data[0]==0x75); /* exclusive ownership */
 init(&f); CSSM_LIST swap=f.n[5].Element.Sublist; f.n[5].Element.Sublist=f.n[6].Element.Sublist; f.n[6].Element.Sublist=swap; assert(run(&f,&out));
 for(unsigned test=0;test<19;test++) {
  init(&f);
  switch(test) {
   case 0:f.n[4].WordID=3;break;
   case 1:f.n[6].NextElement=&f.n[2];break;
   case 2:f.n[5].Element.Sublist=f.n[6].Element.Sublist;break;
   case 3:f.n[8].WordID=99;break;
   case 4:f.n[9].Element.Word.Length=19;break;
   case 5:memset(f.path,1,sizeof f.path);break;
   case 6:f.n[11].ElementType=99;break;
   case 7:f.n[14].Element.Word.Data=(void *)(uintptr_t)1;break;
   case 8:f.n[15].NextElement=&f.n[13];break;
   case 9:f.owner.Delegate=1;break;
   case 10:f.entry.EntryPublicInfo.Delegate=1;break;
   case 11:f.rights[1]=f.rights[0];break;
   case 12:f.process.mask|=CSSM_ACL_MATCH_GID;break;
   case 13:f.process.uid=1;break;
   case 14:f.n[9].Element.Word.Length=65537;break;
   case 15:f.n[11].Element.Word.Data=f.hash;break;
   case 16:f.entry.EntryPublicInfo.TypedSubject.Tail=&f.n[5];break;
   case 17:f.owner.TypedSubject.ListType=CSSM_LIST_TYPE_SEXPR;break;
   case 18:f.n[12].ElementType=CSSM_LIST_ELEMENT_SUBLIST; f.n[12].Element.Sublist=f.n[5].Element.Sublist;break;
  }
  refuses(&f);
 }
 init(&f); ax_cssm_range overlap[2]={{&f,sizeof f},{&f.owner,sizeof f.owner}};
 assert(!ax_cssm_copy(&f.owner,1,&f.entry,overlap,2,&out));
 ax_cssm_range r={&f,sizeof f}; assert(!ax_cssm_copy(&f.owner,17,&f.entry,&r,1,&out));
 assert(!ax_cssm_copy(NULL,0,NULL,NULL,0,&out));
 /* Boundaries checked with complete disjoint synthetic allocations. */
 init(&f);
 CSSM_LIST_ELEMENT extra[257]; memset(extra,0,sizeof extra);
 for(size_t i=0;i<257;i++) { extra[i].ElementType=CSSM_LIST_ELEMENT_DATUM; extra[i].NextElement=i+1<257?&extra[i+1]:NULL; }
 f.n[12].NextElement=&extra[0]; f.n[5].Element.Sublist.Tail=&extra[256];
 ax_cssm_range many[]={{&f,sizeof f},{extra,sizeof extra}};
 assert(!ax_cssm_copy(&f.owner,1,&f.entry,many,2,&out));
 init(&f);
 unsigned char *large=malloc(65536); assert(large); memset(large,1,65536);
 f.n[11].Element.Word=(CSSM_DATA){65536,large};
 ax_cssm_range bytes[]={{&f,sizeof f},{large,65536}};
 assert(!ax_cssm_copy(&f.owner,1,&f.entry,bytes,2,&out)); free(large);
 init(&f);
 CSSM_LIST_ELEMENT nested[9]; memset(nested,0,sizeof nested);
 for(size_t i=0;i<9;i++) { nested[i].ElementType=CSSM_LIST_ELEMENT_SUBLIST; nested[i].Element.Sublist=(CSSM_LIST){CSSM_LIST_TYPE_UNKNOWN,i+1<9?&nested[i+1]:&f.n[7],i+1<9?&nested[i+1]:&f.n[12]}; }
 f.n[11].ElementType=CSSM_LIST_ELEMENT_SUBLIST; f.n[11].Element.Sublist=(CSSM_LIST){CSSM_LIST_TYPE_UNKNOWN,&nested[0],&nested[0]};
 ax_cssm_range depth[]={{&f,sizeof f},{nested,sizeof nested}};
 assert(!ax_cssm_copy(&f.owner,1,&f.entry,depth,2,&out));
 puts("PASS: owned complete subject, both branch orders, 19 malformed cases, range/count refusal; no Security linkage");
 return 0;
}
