/* Compile-only, unbound one-shot configuration preparation. NEVER RUN as part of
 * verification. No item, service, credential or supplier integration exists. */
#include "cssm_policy_copy.h"
#include "cssm_policy_once.h"
#include <Security/Security.h>
#include <stdlib.h>
static const char proposed_path[] = "/Library/Application Support/Vision XIX Labs/Axiom Synthetic Custodian/generations/c3b7bf334ce56a64575183b7a66e5109/origin-broker";
/* Proposed unallocated generation, not installation provenance. Review source if
 * actual installation differs. No runtime path argument/environment override. */
static ax_cssm_policy arena;
static SecAccessRef temporary, prepared;
static SecTrustedApplicationRef application;
static SecACLRef acl;
static CFArrayRef applications, authorizations;
static CSSM_ACL_OWNER_PROTOTYPE *exported_owner;
static CSSM_ACL_ENTRY_INFO *exported_entries;
static atomic_flag attempted=ATOMIC_FLAG_INIT;
int ax_cssm_prepare_once(void) {
 if(!ax_cssm_claim_once(&attempted)) return 0;
 CSSM_ACL_PROCESS_SUBJECT_SELECTOR selector={CSSM_ACL_PROCESS_SELECTOR_CURRENT_VERSION,CSSM_ACL_MATCH_UID,0,0};
 CSSM_LIST_ELEMENT nodes[2]={0};
 nodes[0].ElementType=CSSM_LIST_ELEMENT_WORDID;
 nodes[0].WordID=CSSM_ACL_SUBJECT_TYPE_PROCESS; nodes[0].NextElement=&nodes[1];
 nodes[1].ElementType=CSSM_LIST_ELEMENT_DATUM;
 nodes[1].Element.Word=(CSSM_DATA){sizeof selector,(uint8 *)&selector};
 CSSM_ACL_OWNER_PROTOTYPE owner={{CSSM_LIST_TYPE_UNKNOWN,&nodes[0],&nodes[1]},CSSM_FALSE};
 /* Retain all framework allocations and refs through dedicated process exit.
  * These stack inputs also require process-lifetime retention: copy them below. */
 static CSSM_ACL_PROCESS_SUBJECT_SELECTOR retained_selector;
 static CSSM_LIST_ELEMENT retained_nodes[2];
 static CSSM_ACL_OWNER_PROTOTYPE retained_owner;
 retained_selector=selector; retained_nodes[0]=nodes[0]; retained_nodes[1]=nodes[1];
 retained_nodes[0].NextElement=&retained_nodes[1];
 retained_nodes[1].Element.Word.Data=(uint8 *)&retained_selector;
 retained_owner=owner; retained_owner.TypedSubject.Head=&retained_nodes[0]; retained_owner.TypedSubject.Tail=&retained_nodes[1];
 /* The SDK requires a nonnull acls pointer. Count zero supplies no entries;
  * this unused static storage only satisfies that declaration. */
 static CSSM_ACL_ENTRY_INFO unused_zero_count_storage;
 if(SecAccessCreateFromOwnerAndACL(&retained_owner,0,&unused_zero_count_storage,&temporary)!=errSecSuccess) return 0;
 if(SecTrustedApplicationCreateFromPath(proposed_path,&application)!=errSecSuccess) return 0;
 const void *values[]={application};
 applications=CFArrayCreate(NULL,values,1,&kCFTypeArrayCallBacks);
 if(!applications) return 0;
 if(SecACLCreateWithSimpleContents(temporary,applications,CFSTR("Axiom unbound policy preparation"),0,&acl)!=errSecSuccess) return 0;
 const void *names[]={kSecACLAuthorizationDecrypt,kSecACLAuthorizationKeychainItemRead};
 authorizations=CFArrayCreate(NULL,names,2,&kCFTypeArrayCallBacks);
 if(!authorizations || SecACLUpdateAuthorizations(acl,authorizations)!=errSecSuccess) return 0;
 uint32 count=0;
 if(SecAccessGetOwnerAndACL(temporary,&exported_owner,&count,&exported_entries)!=errSecSuccess) return 0;
 if(!ax_cssm_copy_framework(exported_owner,count,exported_entries,&arena)) return 0;
 return SecAccessCreateFromOwnerAndACL(&arena.owner,1,&arena.entry,&prepared)==errSecSuccess;
}
