/* SOURCE REVIEW FIRST. Compile-only preparation; no execution authorized. */
#if !defined(AX_CSSM_PROFILE) || AX_CSSM_PROFILE != 1
#error Qualification requires exact fixed fixture profile 1
#endif
#include "cssm_policy_builder.c"
#include "cssm_policy_inspect.h"
#include <stdio.h>
#include "cssm_policy_qualification_receipt.h"
/* Receipt hashes are bound by watchdog manifest. No runtime authority inputs. */
int main(int argc,char **argv) {
 (void)argv;
 if(argc!=1) return 2;
 int ok=ax_cssm_prepare_once(), inspected=0;
 static CSSM_ACL_OWNER_PROTOTYPE *final_owner;
 static CSSM_ACL_ENTRY_INFO *final_entries;
 uint32 count=0;
 if(ok) {
  ok=AX_CALL(7,SecAccessGetOwnerAndACL(prepared,&final_owner,&count,&final_entries))==errSecSuccess;
  if(ok) { ax_cssm_phase="inspect"; inspected=ax_cssm_inspect_framework(&arena,final_owner,count,final_entries); }
 }
 /* Exactly one fixed-schema line. No framework descriptions or opaque bytes. */
 printf("{\"profile\":\"fixed-fixture-1\",\"source_revision\":\"%s\",\"source_sha256\":\"%s\",\"phase\":\"%s\",\"stage\":%u,\"result\":\"%s\",\"osstatus\":%ld,\"structural_pass\":%s,\"entries\":%u}\n",
 AX_QUAL_SOURCE_REVISION,AX_QUAL_SOURCE_SHA256,ax_cssm_phase,ax_cssm_stage,ok&&inspected?"success":"refused",(long)ax_cssm_status,inspected?"true":"false",ax_cssm_stage==7&&ok?count:0);
 return ok&&inspected?0:1;
}
