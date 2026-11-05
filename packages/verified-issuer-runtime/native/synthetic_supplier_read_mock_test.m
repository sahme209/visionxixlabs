/* Isolated closed-gate test: every Security function is renamed to an inert
 * aborting stub. Never invoke actual supplier OS paths or maintenance entry. */
#define SecKeychainSetUserInteractionAllowed mock_UI
#define SecKeychainItemGetTypeID mock_Type
#define SecKeychainItemCopyKeychain mock_Containing
#define SecKeychainItemCopyAttributesAndData mock_Attributes
#define SecKeychainItemFreeAttributesAndData mock_FreeAttributes
#define SecKeychainItemCopyAccess mock_Access
#define SecAccessCopyOwnerAndACL mock_Owner
#define SecAccessGetOwnerAndACL mock_Export
#define SecKeychainOpen mock_Open
#define SecItemCopyMatching mock_Match
#define SecKeychainItemCopyContent mock_Content
#define SecKeychainItemFreeContent mock_FreeContent
#define clock_gettime mock_clock
#define axiom_owner_binding_current mock_owner_current
static int ax_test_context(void);
#include AX_DERIVED_SUPPLIER_SOURCE
#include <assert.h>
#include <stdlib.h>
int mock_owner_current(void){abort();}
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

static fixture exported;static ax_cssm_policy expected_policy;static int mode;static CFDataRef expected_locator;static SecKeychainRef expected_keychain;
static int context_ok=1,content_mode,content_calls,free_calls,security_calls;static atomic_int cancellation;static long simulated_seconds=1;static size_t released_length;static unsigned fail_role;
static int ax_test_context(void){return context_ok;}
int mock_clock(clockid_t c,struct timespec*t){assert(c==CLOCK_MONOTONIC);t->tv_sec=simulated_seconds;t->tv_nsec=0;return 0;}
static unsigned item_role(SecKeychainItemRef item){for(unsigned i=0;i<3;i++)if(CFEqual(item,retained_items[i]))return i+1;abort();}
OSStatus mock_UI(Boolean x){security_calls++;(void)x;abort();}
CFTypeID mock_Type(void){security_calls++;return CFStringGetTypeID();}
OSStatus mock_Containing(SecKeychainItemRef x,SecKeychainRef*y){security_calls++;(void)x;*y=(SecKeychainRef)CFRetain(mode==4?(CFTypeRef)CFSTR("wrong-keychain"):(CFTypeRef)expected_keychain);return errSecSuccess;}
static SecKeychainAttribute attributes[2];static SecKeychainAttributeList attribute_list;
OSStatus mock_Attributes(SecKeychainItemRef a,SecKeychainAttributeInfo*b,SecItemClass*c,SecKeychainAttributeList**d,UInt32*e,void**f){security_calls++;
 unsigned role=item_role(a);assert(b->count==2&&b->tag[0]==kSecServiceItemAttr&&b->tag[1]==kSecAccountItemAttr);assert(!e&&!f);*c=mode==5?0:kSecGenericPasswordItemClass;
 attributes[0]=(SecKeychainAttribute){kSecServiceItemAttr,sizeof AX_SYNTH_SERVICE-1,(void*)AX_SYNTH_SERVICE};
 attributes[1]=(SecKeychainAttribute){kSecAccountItemAttr,(UInt32)strlen(ax_synthetic_account(role)),(void*)ax_synthetic_account(role)};
 attribute_list=(SecKeychainAttributeList){2,attributes};*d=&attribute_list;
 if(mode==6)*d=NULL;if(mode==7)attribute_list.count=1;if(mode==8)attributes[0].tag=0;if(mode==9)attributes[0].data=(void*)"bad";
 if(mode==9)attributes[0].length=3;if(mode==10)attributes[0].data=NULL;if(mode==11)attribute_list.attr=NULL;
 return errSecSuccess;
}
OSStatus mock_FreeAttributes(SecKeychainAttributeList*a,void*b){security_calls++;(void)a;assert(!b);return errSecSuccess;}
OSStatus mock_Access(SecKeychainItemRef a,SecAccessRef*b){security_calls++;(void)a;*b=(SecAccessRef)CFRetain(CFSTR("simulated-access"));return errSecSuccess;}
OSStatus mock_Owner(SecAccessRef a,uid_t*b,gid_t*c,SecAccessOwnerType*d,CFArrayRef*e){security_calls++;(void)a;*b=mode==12?1:0;*c=mode==13?1:0;*d=mode==14?0:kSecUseOnlyUID;*e=CFArrayCreate(NULL,NULL,0,&kCFTypeArrayCallBacks);return errSecSuccess;}
OSStatus mock_Export(SecAccessRef a,CSSM_ACL_OWNER_PROTOTYPE_PTR*b,uint32*c,CSSM_ACL_ENTRY_INFO_PTR*d){security_calls++;(void)a;*b=&exported.owner;*c=mode==15?2:mode==16?0:1;*d=&exported.entry;return errSecSuccess;}
OSStatus mock_Open(const char*a,SecKeychainRef*b){security_calls++;(void)a;(void)b;abort();}
OSStatus mock_Match(CFDictionaryRef a,CFTypeRef*b){security_calls++;
 NSDictionary*q=(__bridge NSDictionary*)a;assert(q.count==5);assert([q[(__bridge id)kSecClass] isEqual:(__bridge id)kSecClassGenericPassword]);
 NSArray*items=q[(__bridge id)kSecMatchItemList];NSArray*search=q[(__bridge id)kSecMatchSearchList];assert(items.count==1&&(__bridge CFTypeRef)items[0]==expected_locator);assert(search.count==1&&(__bridge CFTypeRef)search[0]==expected_keychain);
 assert([q[(__bridge id)kSecMatchLimit] isEqual:(__bridge id)kSecMatchLimitOne]);assert([q[(__bridge id)kSecReturnRef] isEqual:@YES]);
 assert(!q[(__bridge id)kSecAttrService]&&!q[(__bridge id)kSecAttrAccount]&&!q[(__bridge id)kSecReturnData]);
 if(mode==1)return errSecAuthFailed;if(mode==2)return errSecSuccess;if(mode==3){*b=CFDataCreate(NULL,NULL,0);return errSecSuccess;}
 *b=CFRetain(CFSTR("simulated-item"));return errSecSuccess;
}
OSStatus mock_Content(SecKeychainItemRef a,SecItemClass*b,SecKeychainAttributeList*c,UInt32*d,void**e){security_calls++;
 assert(!c);unsigned role=item_role(a);content_calls++;int effect=(!fail_role||role==fail_role)?content_mode:0;
 const char*url="postgresql://synthetic.invalid/test";size_t n=role==1?strlen(url):32;
 if(effect==10)n=role==1?8192:role==3?4096:32;
 if(effect==4)n=role==1?0:31;if(effect==5)n=role==1?8193:role==2?33:4097;
 *b=effect==3?0:kSecGenericPasswordItemClass;*d=(UInt32)n;*e=NULL;
 if(effect!=2){*e=malloc(n?n:1);assert(*e);memset(*e,0x55,n);if(role==1&&effect!=4&&effect!=5)memcpy(*e,url,strlen(url));released_length=n;}
 if(effect==6)atomic_store(&cancellation,1);if(effect==7)simulated_seconds=3;if(effect==8)context_ok=0;if(effect==9)exported.requirement[0]^=1;
 return effect==1?errSecAuthFailed:errSecSuccess;
}
OSStatus mock_FreeContent(SecKeychainAttributeList*a,void*b){security_calls++;assert(!a&&b);for(size_t i=0;i<released_length;i++)assert(((unsigned char*)b)[i]==0);free(b);free_calls++;return errSecSuccess;}
int ax_cssm_prepare_once(void){abort();}
const ax_cssm_policy*ax_cssm_prepared_policy(void){return mode==17?NULL:&expected_policy;}
void axiom_private_material_wipe(AxiomPrivateMaterial*m){memset_s(m,sizeof *m,0,sizeof *m);}
static void reset(void){
 mode=0;context_ok=1;content_mode=0;content_calls=free_calls=security_calls=0;fail_role=0;simulated_seconds=1;atomic_store(&cancellation,0);atomic_store(&startup_state,1);
 init(&exported);exported.entry.EntryPublicInfo.TypedSubject=exported.n[5].Element.Sublist;
}
static void wiped(const AxiomPrivateMaterial*m){const unsigned char*p=(const unsigned char*)m;for(size_t i=0;i<sizeof *m;i++)assert(!p[i]);}
int main(void){@autoreleasepool{
 fixture input;init(&input);assert(run(&input,&expected_policy));
 expected_keychain=(SecKeychainRef)CFSTR("simulated-keychain");selected_keychain=expected_keychain;
 retained_items[0]=(SecKeychainItemRef)CFSTR("simulated-role1");retained_items[1]=(SecKeychainItemRef)CFSTR("simulated-role2");retained_items[2]=(SecKeychainItemRef)CFSTR("simulated-role3");
 AxiomPrivateMaterial material;reset();assert(!axiom_private_supplier_operational());
 assert(axiom_private_supplier_read(&material,&cancellation,2000000000));assert(content_calls==3&&free_calls==3);assert(material.datasource_length==strlen("postgresql://synthetic.invalid/test")&&material.session_length==32);assert(material.vault[0]==0x55);
 reset();content_mode=10;assert(axiom_private_supplier_read(&material,&cancellation,2000000000));assert(material.datasource_length==8192&&material.session_length==4096&&content_calls==3&&free_calls==3);
 /* Direct actual reference reader bounds/status/type/null and late-result cases. */
 for(unsigned role=1;role<=3;role++)for(int effect=1;effect<=9;effect++){
  reset();content_mode=effect;unsigned char out[8193];memset(out,0x7f,sizeof out);size_t length=777;
  assert(!reference_read(role,out,role==1?1:32,role==1?8192:role==2?32:4096,&length,role==1,&cancellation,2000000000));
  assert(content_calls==1&&free_calls==(effect==2?0:1)&&length==777);for(size_t i=0;i<sizeof out;i++)assert(out[i]==0x7f);
 }
 /* Denial before content does no content/free call. */
 for(int before=0;before<3;before++){
  reset();if(before==0)atomic_store(&cancellation,1);if(before==1)simulated_seconds=3;if(before==2)context_ok=0;
  unsigned char out[32]={0};size_t length=0;assert(!reference_read(2,out,32,32,&length,0,&cancellation,2000000000));assert(!content_calls&&!free_calls&&!security_calls);
 }
 /* Full read wipes partial staging and burns epoch on any failed later read. */
 for(int effect=1;effect<=9;effect++){
  reset();fail_role=2;content_mode=effect;memset(&material,0x7f,sizeof material);
  assert(!axiom_private_supplier_read(&material,&cancellation,2000000000));wiped(&material);assert(atomic_load(&startup_state)==-1);int called=content_calls;
  context_ok=1;atomic_store(&cancellation,0);simulated_seconds=1;content_mode=0;
  assert(!axiom_private_supplier_read(&material,&cancellation,2000000000)&&content_calls==called);wiped(&material);
 }
 for(int before=0;before<3;before++){
  reset();if(before==0)context_ok=0;if(before==1)atomic_store(&cancellation,1);if(before==2)simulated_seconds=3;
  memset(&material,0x7f,sizeof material);assert(!axiom_private_supplier_read(&material,&cancellation,2000000000));wiped(&material);assert(atomic_load(&startup_state)==-1&&!content_calls&&!security_calls);
  context_ok=1;atomic_store(&cancellation,0);simulated_seconds=1;assert(!axiom_private_supplier_read(&material,&cancellation,2000000000)&&!content_calls&&!security_calls);
 }
 puts("PASS derived actual read bodies: simulated valid3read, 27 bounds/status/null/late-result refusals, predenial nocalls, staging wipe/free and permanently burned denied epochs; production gate unchanged");
}return 0;}
