#include "cssm_policy_inspect.h"
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
int main(void) {
 fixture f; ax_cssm_policy expected; init(&f); assert(run(&f,&expected));
 /* A separately relocated final application-only graph. */
 fixture final; init(&final);
 final.entry.EntryPublicInfo.TypedSubject=final.n[5].Element.Sublist;
 ax_cssm_range r={&final,sizeof final};
 assert(ax_cssm_inspect(&expected,&final.owner,1,&final.entry,&r,1));
 for(unsigned i=0;i<18;i++) {
  init(&final); final.entry.EntryPublicInfo.TypedSubject=final.n[5].Element.Sublist;
  switch(i) {
   case 0:final.owner.Delegate=1;break;
   case 1:final.process.uid=1;break;
   case 2:final.entry.EntryPublicInfo.Delegate=1;break;
   case 3:final.rights[1]=final.rights[0];break;
   case 4:final.requirement[6]^=1;break;
   case 5:final.aux[2]^=1;break;
   case 6:final.entry.EntryPublicInfo.TypedSubject=final.n[6].Element.Sublist;break;
   case 7:final.n[12].NextElement=&final.n[7];break;
   case 8:final.n[12].ElementType=CSSM_LIST_ELEMENT_SUBLIST;break;
   case 9:final.n[11].Element.Word.Length=65537;break;
   case 10:final.n[11].Element.Word.Data=(void *)(uintptr_t)1;break;
   case 11:final.entry.EntryPublicInfo.EntryTag[0]^=1;break;
   case 12:final.date[1]^=1;break;
   case 13:final.entry.EntryHandle++;break;
   case 14:final.entry.EntryPublicInfo.TypedSubject.Tail=&final.n[11];break;
   case 15:final.n[9].Element.Word.Data=final.path;break;
   case 16:final.owner.TypedSubject.ListType=CSSM_LIST_TYPE_SEXPR;break;
   case 17:final.n[7].WordID=CSSM_ACL_SUBJECT_TYPE_ANY;break;
  }
  assert(!ax_cssm_inspect(&expected,&final.owner,1,&final.entry,&r,1));
 }
 init(&final); final.entry.EntryPublicInfo.TypedSubject=final.n[5].Element.Sublist;
 CSSM_LIST_ELEMENT extra[257]={0};
 for(unsigned i=0;i<257;i++) { extra[i].ElementType=CSSM_LIST_ELEMENT_DATUM; extra[i].NextElement=i<256?&extra[i+1]:NULL; }
 final.n[12].NextElement=extra; final.entry.EntryPublicInfo.TypedSubject.Tail=&extra[256];
 ax_cssm_range many[2]={{&final,sizeof final},{extra,sizeof extra}};
 assert(!ax_cssm_inspect(&expected,&final.owner,1,&final.entry,many,2));
 ax_cssm_range overlap[2]={{&final,sizeof final},{&final.owner,sizeof final.owner}};
 assert(!ax_cssm_inspect(&expected,&final.owner,1,&final.entry,overlap,2));
 assert(!ax_cssm_inspect(&expected,&final.owner,0,&final.entry,&r,1));
 puts("PASS: final application-only equality and 18 malformed/mismatch refusals; no Security linkage");
 return 0;
}
